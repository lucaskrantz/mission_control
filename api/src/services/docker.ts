import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { readFileSync } from 'fs';
import { enrichContainer } from '../adapters';

export interface ContainerStats {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  statusFormatted: string;
  created: number;
  startedAt: string | null;
  uptimeSeconds: number;
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  group: string;
  labels?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface HostStats {
  totalMemoryBytes: number;
  cpuCount: number;
  cpuPercent: number;
}

export interface SystemStats {
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  pausedContainers: number;
  host: HostStats;
  containers: ContainerStats[];
}

export class DockerService extends EventEmitter {
  private docker: any;
  private eventStream: Readable | null = null;
  private statsRefreshInterval: NodeJS.Timeout | null = null;
  private readonly STATS_REFRESH_MS = 2000;
  private previousCpuStats: { total: number; idle: number } | null = null;

  constructor() {
    super();
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  private deriveGroupFromContainer(containerInfo: any, name: string): string {
    const labels = containerInfo.Labels || {};
    
    // Priority 1: Custom mission.group label
    if (labels['mission.group']) {
      return labels['mission.group'];
    }
    
    // Priority 2: Docker Compose project
    if (labels['com.docker.compose.project']) {
      return labels['com.docker.compose.project'];
    }
    
    // Priority 3: Prefix of container name (before first - or _)
    const match = name.match(/^([^-_]+)/);
    if (match) {
      return match[1];
    }
    
    // Fallback: use the full name
    return name;
  }

  private async getHostCpuUsage(): Promise<number> {
    try {
      const cpuData = readFileSync('/proc/stat', 'utf-8');
      const cpuLine = cpuData.split('\n')[0];
      const cpuValues = cpuLine.split(/\s+/).slice(1).map(Number);
      
      // CPU time values: user, nice, system, idle, iowait, irq, softirq, steal
      const idle = cpuValues[3] + cpuValues[4]; // idle + iowait
      const total = cpuValues.reduce((sum, val) => sum + val, 0);
      
      if (this.previousCpuStats) {
        const totalDelta = total - this.previousCpuStats.total;
        const idleDelta = idle - this.previousCpuStats.idle;
        
        if (totalDelta > 0) {
          const cpuPercent = ((totalDelta - idleDelta) / totalDelta) * 100;
          this.previousCpuStats = { total, idle };
          return Math.round(cpuPercent * 10) / 10; // Round to 1 decimal
        }
      }
      
      // Store current stats for next calculation
      this.previousCpuStats = { total, idle };
      return 0;
    } catch (error) {
      console.error('Error reading host CPU stats:', error);
      return 0;
    }
  }

  private formatContainerStatus(state: string, uptimeSeconds: number, originalStatus: string): string {
    // For running containers, format with correct uptime
    if (state === 'running' && uptimeSeconds > 0) {
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;
      
      if (days > 0) {
        return `Up ${days} day${days !== 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `Up ${hours} hour${hours !== 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `Up ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else {
        return `Up ${seconds} second${seconds !== 1 ? 's' : ''}`;
      }
    }
    
    // For non-running containers, use the original status
    return originalStatus;
  }

  async getContainerStats(): Promise<SystemStats> {
    try {
      const [containers, systemInfo] = await Promise.all([
        this.docker.listContainers({ all: true }),
        this.docker.info()
      ]);
      const stats: ContainerStats[] = [];

      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        
        let cpuPercent = 0;
        let memoryUsageBytes = 0;
        let memoryLimitBytes = 0;
        let memoryPercent = 0;
        let networkRx = 0;
        let networkTx = 0;
        let startedAt: string | null = null;
        let uptimeSeconds = 0;

        // Get container inspect data for accurate uptime
        try {
          const inspect = await container.inspect();
          startedAt = inspect.State.StartedAt;
          
          // Calculate uptime from StartedAt if container is running
          if (containerInfo.State === 'running' && startedAt && startedAt !== '0001-01-01T00:00:00Z') {
            const startTime = new Date(startedAt).getTime();
            const now = Date.now();
            uptimeSeconds = Math.floor((now - startTime) / 1000);
            
            // Ensure uptimeSeconds is a valid positive number
            if (uptimeSeconds < 0 || !isFinite(uptimeSeconds)) {
              console.error(`Invalid uptime calculated for ${containerInfo.Id}: ${uptimeSeconds}`);
              uptimeSeconds = 0;
            }
          }
        } catch (error) {
          console.error(`Error inspecting container ${containerInfo.Id}:`, error);
        }

        // Get live stats for running containers
        if (containerInfo.State === 'running') {
          try {
            const statsStream = await container.stats({ stream: false });
            const statsData = statsStream as any;

            // Calculate CPU percentage using Docker's recommended formula
            // Reference: https://docs.docker.com/engine/api/v1.41/#operation/ContainerStats
            const cpuDelta = statsData.cpu_stats.cpu_usage.total_usage - 
                           (statsData.precpu_stats.cpu_usage?.total_usage || 0);
            const systemDelta = statsData.cpu_stats.system_cpu_usage - 
                              (statsData.precpu_stats.system_cpu_usage || 0);
            const cpuCount = statsData.cpu_stats.online_cpus || 1;
            
            // Only calculate if we have valid deltas (avoids issues on first call)
            if (systemDelta > 0 && cpuDelta >= 0) {
              cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100;
            }

            // Memory stats - exclude cache to match docker stats behavior
            // Docker CLI formula: usage - cache
            const memUsage = statsData.memory_stats.usage || 0;
            const memCache = statsData.memory_stats.stats?.cache || 0;
            memoryUsageBytes = Math.max(0, memUsage - memCache);
            memoryLimitBytes = statsData.memory_stats.limit || 0;
            memoryPercent = memoryLimitBytes > 0 ? (memoryUsageBytes / memoryLimitBytes) * 100 : 0;

            // Network stats - sum across all interfaces
            if (statsData.networks) {
              for (const network of Object.values(statsData.networks) as any[]) {
                networkRx += network.rx_bytes || 0;
                networkTx += network.tx_bytes || 0;
              }
            }
          } catch (error) {
            console.error(`Error fetching stats for container ${containerInfo.Id}:`, error);
          }
        }

        const name = containerInfo.Names[0].replace(/^\//, '');
        const group = this.deriveGroupFromContainer(containerInfo, name);
        
        // Format status with correct uptime
        const statusFormatted = this.formatContainerStatus(containerInfo.State, uptimeSeconds, containerInfo.Status);
        
        stats.push({
          id: containerInfo.Id,
          name,
          image: containerInfo.Image,
          state: containerInfo.State,
          status: containerInfo.Status,
          statusFormatted,
          created: containerInfo.Created,
          startedAt,
          uptimeSeconds,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsageBytes,
          memoryLimitBytes,
          memoryPercent: Math.round(memoryPercent * 100) / 100,
          networkRx,
          networkTx,
          group,
          labels: containerInfo.Labels,
        });
      }

      // Enrich containers with service-specific data in parallel
      const enrichmentPromises = stats.map(async (stat, index) => {
        try {
          const extra = await enrichContainer(containers[index]);
          if (extra) {
            stat.extra = extra;
          }
        } catch (error) {
          // Silently fail - don't block stats if adapter fails
          console.error(`Error enriching container ${stat.id}:`, error);
        }
      });

      await Promise.allSettled(enrichmentPromises);

      const runningContainers = stats.filter(c => c.state === 'running').length;
      const stoppedContainers = stats.filter(c => c.state === 'exited').length;
      const pausedContainers = stats.filter(c => c.state === 'paused').length;

      // Get host CPU usage
      const hostCpuPercent = await this.getHostCpuUsage();

      return {
        totalContainers: stats.length,
        runningContainers,
        stoppedContainers,
        pausedContainers,
        host: {
          totalMemoryBytes: systemInfo.MemTotal || 0,
          cpuCount: systemInfo.NCPU || 1,
          cpuPercent: hostCpuPercent,
        },
        containers: stats,
      };
    } catch (error) {
      console.error('Error getting container stats:', error);
      throw error;
    }
  }

  async getContainerDetails(id: string) {
    try {
      const container = this.docker.getContainer(id);
      const inspect = await container.inspect();
      
      return {
        id: inspect.Id,
        name: inspect.Name.replace(/^\//, ''),
        image: inspect.Config.Image,
        state: inspect.State.Status,
        created: inspect.Created,
        started: inspect.State.StartedAt,
        finished: inspect.State.FinishedAt,
        restartCount: inspect.RestartCount,
        platform: inspect.Platform,
        ports: inspect.NetworkSettings.Ports,
        mounts: inspect.Mounts,
        env: inspect.Config.Env,
      };
    } catch (error) {
      console.error('Error getting container details:', error);
      throw error;
    }
  }

  async startEventStream() {
    try {
      this.eventStream = await this.docker.getEvents({
        filters: { type: ['container'] },
      }) as Readable;

      this.eventStream.on('data', (chunk: Buffer) => {
        try {
          const events = chunk.toString().trim().split('\n');
          events.forEach((eventStr) => {
            if (eventStr) {
              const event = JSON.parse(eventStr);
              
              // Filter relevant events
              if (['start', 'stop', 'die', 'restart', 'pause', 'unpause', 'kill'].includes(event.Action)) {
                this.emit('containerEvent', {
                  action: event.Action,
                  id: event.Actor.ID,
                  name: event.Actor.Attributes.name,
                  image: event.Actor.Attributes.image,
                  timestamp: event.time,
                });
              }
            }
          });
        } catch (error) {
          console.error('Error parsing Docker event:', error);
        }
      });

      this.eventStream.on('error', (error) => {
        console.error('Docker event stream error:', error);
      });

      console.log('Docker event stream started');
    } catch (error) {
      console.error('Error starting Docker event stream:', error);
    }

    // Start periodic stats refresh for live monitoring
    this.startStatsRefresh();
  }

  private startStatsRefresh() {
    if (this.statsRefreshInterval) {
      clearInterval(this.statsRefreshInterval);
    }

    this.statsRefreshInterval = setInterval(async () => {
      try {
        const stats = await this.getContainerStats();
        this.emit('statsUpdate', stats);
      } catch (error) {
        console.error('Error during periodic stats refresh:', error);
      }
    }, this.STATS_REFRESH_MS);

    console.log(`Periodic stats refresh started (every ${this.STATS_REFRESH_MS}ms)`);
  }

  private stopStatsRefresh() {
    if (this.statsRefreshInterval) {
      clearInterval(this.statsRefreshInterval);
      this.statsRefreshInterval = null;
      console.log('Periodic stats refresh stopped');
    }
  }

  stopEventStream() {
    this.stopStatsRefresh();
    if (this.eventStream) {
      this.eventStream.destroy();
      this.eventStream = null;
      console.log('Docker event stream stopped');
    }
  }
}
