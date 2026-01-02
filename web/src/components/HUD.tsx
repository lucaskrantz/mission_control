import React, { useEffect, useState } from 'react';
import { SystemStats } from '../types';
import { groupContainers } from '../utils/grouping';
import { theme } from '../theme';
import './HUD.css';

interface HUDProps {
  systemStats: SystemStats | null;
  isConnected: boolean;
}

const HUD: React.FC<HUDProps> = ({ systemStats }) => {
  const [pulse, setPulse] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (): string => {
    if (!systemStats?.containers.length) return '0m';
    
    // Get longest uptime from running containers
    const runningContainers = systemStats.containers.filter(c => c.state === 'running');
    if (runningContainers.length === 0) return '0m';
    
    // Filter out invalid uptime values (e.g., Unix timestamps mistakenly used)
    // Valid uptime should be less than ~100 years (3.15e9 seconds)
    const validUptimes = runningContainers
      .map(c => c.uptimeSeconds)
      .filter(uptime => uptime > 0 && uptime < 3153600000);
    
    if (validUptimes.length === 0) return '0m';
    
    const maxUptimeSeconds = Math.max(...validUptimes);
    
    const days = Math.floor(maxUptimeSeconds / 86400);
    const hours = Math.floor((maxUptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((maxUptimeSeconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const totalMemory = systemStats?.containers.reduce((sum, c) => sum + c.memoryUsageBytes, 0) || 0;
  const totalMemoryLimit = systemStats?.containers.reduce((sum, c) => sum + c.memoryLimitBytes, 0) || 0;
  const avgCpu = systemStats?.containers.length 
    ? (systemStats.containers.reduce((sum, c) => sum + c.cpuPercent, 0) / systemStats.containers.length).toFixed(1)
    : '0.0';

  // Calculate group statistics
  const groups = systemStats ? groupContainers(systemStats.containers) : [];
  const totalGroups = groups.length;

  // Pulse effect when containers are running
  useEffect(() => {
    if (systemStats && systemStats.runningContainers > 0) {
      setPulse(true);
      const timeout = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [systemStats?.runningContainers]);

  return (
    <div className="hud" style={{ height: `${theme.hud.height}px` }}>
      <div className="hud-left">
        <div className="hud-item">
          <span className="hud-label">GROUPS</span>
          <span className="hud-value">{totalGroups}</span>
        </div>
        <div className="hud-separator" />
        <div className="hud-item">
          <span className="hud-label">CONTAINERS</span>
          <span className="hud-value">{systemStats?.totalContainers || 0}</span>
        </div>
        <div className="hud-separator" />
        <div className="hud-item">
          <span className="hud-badge running" data-pulse={pulse}>
            <span className="badge-dot" />
            {systemStats?.runningContainers || 0}
          </span>
          <span className="hud-badge-label">RUN</span>
        </div>
        <div className="hud-item">
          <span className="hud-badge paused">
            <span className="badge-dot" />
            {systemStats?.pausedContainers || 0}
          </span>
          <span className="hud-badge-label">PAUSE</span>
        </div>
        <div className="hud-item">
          <span className="hud-badge exited">
            <span className="badge-dot" />
            {systemStats?.stoppedContainers || 0}
          </span>
          <span className="hud-badge-label">EXIT</span>
        </div>
      </div>
      
      <div className="hud-right">
        <div className="hud-item">
          <span className="hud-label">CPU</span>
          <span className="hud-value">{avgCpu}%</span>
          <div className="hud-accent-bar" />
        </div>
        <div className="hud-separator" />
        <div className="hud-item">
          <span className="hud-label">MEM</span>
          <span className="hud-value">{formatBytes(totalMemory)}/{formatBytes(totalMemoryLimit)}</span>
          <div className="hud-accent-bar" />
        </div>
        <div className="hud-separator" />
        <div className="hud-item">
          <span className="hud-label">UP</span>
          <span className="hud-value">{formatUptime()}</span>
          <div className="hud-accent-bar" />
        </div>
      </div>
    </div>
  );
};

export default HUD;
