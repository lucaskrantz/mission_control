import { ServiceAdapter, MinecraftServiceData } from './types';
import * as net from 'net';

// Cache to rate-limit queries (1-2 Hz max)
const cache = new Map<string, { data: MinecraftServiceData | null; timestamp: number }>();
const CACHE_TTL_MS = 1000; // 1 second cache

interface MinecraftStatusResponse {
  version?: { name: string; protocol: number };
  players?: { online: number; max: number; sample?: Array<{ name: string; id: string }> };
  description?: string | { text: string };
}

/**
 * Perform a Minecraft Server List Ping (Status Request)
 * Uses the modern protocol (1.7+)
 */
async function queryMinecraftStatus(host: string, port: number, timeout = 1000): Promise<MinecraftStatusResponse | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeout);

    socket.on('error', () => {
      cleanup();
      clearTimeout(timer);
      resolve(null);
    });

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      try {
        // Parse the response
        let offset = 0;

        // Read packet length (VarInt)
        const { value: packetLength, bytesRead: lengthBytes } = readVarInt(buffer, offset);
        offset += lengthBytes;

        // Read packet ID (should be 0x00 for status response)
        const { value: packetId, bytesRead: idBytes } = readVarInt(buffer, offset);
        offset += idBytes;

        if (packetId !== 0x00) {
          cleanup();
          clearTimeout(timer);
          resolve(null);
          return;
        }

        // Read JSON response length
        const { value: jsonLength, bytesRead: jsonLengthBytes } = readVarInt(buffer, offset);
        offset += jsonLengthBytes;

        // Read JSON string
        const jsonString = buffer.toString('utf8', offset, offset + jsonLength);
        const response = JSON.parse(jsonString) as MinecraftStatusResponse;

        cleanup();
        clearTimeout(timer);
        resolve(response);
      } catch (error) {
        // Not enough data yet or parse error, wait for more data
        if (buffer.length > 4096) {
          // Too much data, something went wrong
          cleanup();
          clearTimeout(timer);
          resolve(null);
        }
      }
    });

    socket.connect(port, host, () => {
      try {
        // Build handshake packet
        const handshake = buildHandshakePacket(host, port);
        socket.write(handshake);

        // Build status request packet
        const statusRequest = buildStatusRequestPacket();
        socket.write(statusRequest);
      } catch (error) {
        cleanup();
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
}

/**
 * Build Minecraft handshake packet
 */
function buildHandshakePacket(host: string, port: number): Buffer {
  const packetId = 0x00;
  const protocolVersion = 47; // 1.8.x protocol version (widely compatible)
  const nextState = 1; // Status request

  const hostBuffer = Buffer.from(host, 'utf8');
  
  const data = Buffer.concat([
    writeVarInt(protocolVersion),
    writeVarInt(hostBuffer.length),
    hostBuffer,
    Buffer.from([port >> 8, port & 0xff]), // Unsigned short
    writeVarInt(nextState),
  ]);

  const packet = Buffer.concat([
    writeVarInt(data.length + 1), // Packet length (data + packet ID)
    writeVarInt(packetId),
    data,
  ]);

  return packet;
}

/**
 * Build Minecraft status request packet
 */
function buildStatusRequestPacket(): Buffer {
  const packetId = 0x00;
  return Buffer.concat([
    writeVarInt(1), // Packet length
    writeVarInt(packetId),
  ]);
}

/**
 * Write a VarInt to a buffer
 */
function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let temp = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      temp |= 0x80;
    }
    bytes.push(temp);
  } while (value !== 0);
  return Buffer.from(bytes);
}

/**
 * Read a VarInt from a buffer
 */
function readVarInt(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
  let numRead = 0;
  let result = 0;
  let read: number;

  do {
    if (offset + numRead >= buffer.length) {
      throw new Error('VarInt is too short');
    }
    read = buffer[offset + numRead];
    const value = read & 0x7f;
    result |= value << (7 * numRead);
    numRead++;
    if (numRead > 5) {
      throw new Error('VarInt is too big');
    }
  } while ((read & 0x80) !== 0);

  return { value: result, bytesRead: numRead };
}

/**
 * Extract host and port from container info
 */
function resolveConnection(containerInfo: any): { host: string; port: number } | null {
  const labels = containerInfo.Labels || {};

  // Check for explicit host/port in labels
  const labelHost = labels['mission.mc.host'];
  const labelPort = labels['mission.mc.queryPort'];

  if (labelHost && labelPort) {
    return { host: labelHost, port: parseInt(labelPort, 10) };
  }

  // Try to infer from container name or network
  const containerName = containerInfo.Names?.[0]?.replace(/^\//, '') || '';
  
  // Default Minecraft query port
  const defaultPort = 25565;

  // Try to get container IP from first network
  const networks = containerInfo.NetworkSettings?.Networks || {};
  const networkNames = Object.keys(networks);
  
  if (networkNames.length > 0) {
    const firstNetwork = networks[networkNames[0]];
    const ipAddress = firstNetwork?.IPAddress;
    
    if (ipAddress) {
      return { host: ipAddress, port: labelPort ? parseInt(labelPort, 10) : defaultPort };
    }
  }

  // Fallback to container name (works if on same Docker network)
  if (containerName) {
    return { host: containerName, port: labelPort ? parseInt(labelPort, 10) : defaultPort };
  }

  return null;
}

/**
 * Minecraft Service Adapter
 */
export const minecraftAdapter: ServiceAdapter = {
  id: 'minecraft',

  match: (containerInfo: any): boolean => {
    const labels = containerInfo.Labels || {};
    
    // Check for explicit mission.type label
    if (labels['mission.type'] === 'minecraft') {
      return true;
    }

    // Check if image contains 'minecraft'
    const image = containerInfo.Image || '';
    if (image.toLowerCase().includes('minecraft')) {
      return true;
    }

    return false;
  },

  enrich: async (containerInfo: any): Promise<MinecraftServiceData | null> => {
    const containerId = containerInfo.Id;

    // Check cache
    const cached = cache.get(containerId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Only query running containers
    if (containerInfo.State !== 'running') {
      const result = null;
      cache.set(containerId, { data: result, timestamp: Date.now() });
      return result;
    }

    try {
      const connection = resolveConnection(containerInfo);
      if (!connection) {
        console.log(`[Minecraft Adapter] Could not resolve connection for container ${containerId}`);
        const result = null;
        cache.set(containerId, { data: result, timestamp: Date.now() });
        return result;
      }

      const { host, port } = connection;
      const response = await queryMinecraftStatus(host, port, 800);

      if (!response || !response.players) {
        const result = null;
        cache.set(containerId, { data: result, timestamp: Date.now() });
        return result;
      }

      // Extract MOTD
      let motd = 'Minecraft Server';
      if (response.description) {
        if (typeof response.description === 'string') {
          motd = response.description;
        } else if (response.description.text) {
          motd = response.description.text;
        }
      }

      // Clean MOTD (remove color codes)
      motd = motd.replace(/§[0-9a-fk-or]/gi, '');

      const result: MinecraftServiceData = {
        service: 'minecraft',
        mc: {
          motd,
          playersOnline: response.players.online || 0,
          playersMax: response.players.max || 0,
          playerList: response.players.sample?.map((p) => p.name) || undefined,
        },
      };

      // Cache result
      cache.set(containerId, { data: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error(`[Minecraft Adapter] Error enriching container ${containerId}:`, error);
      const result = null;
      cache.set(containerId, { data: result, timestamp: Date.now() });
      return result;
    }
  },
};
