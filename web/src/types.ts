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
  extra?: {
    service?: 'minecraft' | string;
    mc?: {
      motd?: string;
      playersOnline: number;
      playersMax: number;
      playerList?: string[];
    };
  };
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

export interface ContainerEvent {
  action: string;
  id: string;
  name: string;
  image: string;
  timestamp: number;
}

export interface Group {
  key: string;
  title: string;
  containers: ContainerStats[];
  dominantState: 'running' | 'paused' | 'exited' | 'restarting';
}
