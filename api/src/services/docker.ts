import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { enrichContainer } from '../adapters';

export interface ContainerStats {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  group: string;
  labels?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface SystemStats {
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  pausedContainers: number;
  containers: ContainerStats[];
}

export class DockerService extends EventEmitter {
  private docker: any;
  private eventStream: Readable | null = null;

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

  async getContainerStats(): Promise<SystemStats> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const stats: ContainerStats[] = [];

      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        
        let cpuPercent = 0;
        let memoryUsage = 0;
        let memoryLimit = 0;
        let memoryPercent = 0;
        let networkRx = 0;
        let networkTx = 0;

        // Get live stats for running containers
        if (containerInfo.State === 'running') {
          try {
            const statsStream = await container.stats({ stream: false });
            const statsData = statsStream as any;

            // Calculate CPU percentage
            const cpuDelta = statsData.cpu_stats.cpu_usage.total_usage - 
                           (statsData.precpu_stats.cpu_usage?.total_usage || 0);
            const systemDelta = statsData.cpu_stats.system_cpu_usage - 
                              (statsData.precpu_stats.system_cpu_usage || 0);
            const cpuCount = statsData.cpu_stats.online_cpus || 1;
            
            if (systemDelta > 0 && cpuDelta > 0) {
              cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100;
            }

            // Memory stats
            memoryUsage = statsData.memory_stats.usage || 0;
            memoryLimit = statsData.memory_stats.limit || 0;
            memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

            // Network stats
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
        
        stats.push({
          id: containerInfo.Id,
          name,
          image: containerInfo.Image,
          state: containerInfo.State,
          status: containerInfo.Status,
          created: containerInfo.Created,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsage,
          memoryLimit,
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

      return {
        totalContainers: stats.length,
        runningContainers,
        stoppedContainers,
        pausedContainers,
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
  }

  stopEventStream() {
    if (this.eventStream) {
      this.eventStream.destroy();
      this.eventStream = null;
      console.log('Docker event stream stopped');
    }
  }
}
