import React, { useState } from 'react';
import { ContainerStats } from '../types';
import { theme } from '../theme';
import './PlanetDetails.css';

interface PlanetDetailsProps {
  container: ContainerStats;
  groupTitle: string;
}

const PlanetDetails: React.FC<PlanetDetailsProps> = ({ container, groupTitle }) => {
  const [networkExpanded, setNetworkExpanded] = useState(false);
  const [resourcesExpanded, setResourcesExpanded] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const [playerListExpanded, setPlayerListExpanded] = useState(false);

  const formatUptime = (created: number) => {
    const now = Date.now();
    const diff = now - created * 1000;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStateColor = (state: string) => {
    const s = state.toLowerCase();
    if (s === 'running') return theme.colors.running;
    if (s === 'paused') return theme.colors.paused;
    if (s === 'restarting') return theme.colors.restarting;
    if (s === 'exited') return theme.colors.exited;
    return '#888888';
  };

  // Extract image name and tag
  const imageMatch = container.image.match(/([^/:]+):([^/:]+)$/);
  const imageName = imageMatch ? imageMatch[1] : container.image;
  const imageTag = imageMatch ? imageMatch[2] : 'latest';

  return (
    <div className="planet-details">
      {/* Header Section */}
      <div className="details-header-section">
        <div className="details-subtitle">{groupTitle}</div>
        <div className="state-badge" style={{ borderColor: getStateColor(container.state) }}>
          <span className="state-dot" style={{ backgroundColor: getStateColor(container.state) }} />
          {container.state}
        </div>
      </div>

      {/* Metrics Section */}
      <div className="details-section">
        <div className="details-section-title">Metrics</div>
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-label">CPU</div>
            <div className="metric-value">{(container.cpuPercent || 0).toFixed(1)}%</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Memory</div>
            <div className="metric-value">
              {(container.memoryUsage / (1024 * 1024)).toFixed(0)} MB
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Mem %</div>
            <div className="metric-value">{(container.memoryPercent || 0).toFixed(1)}%</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Uptime</div>
            <div className="metric-value">{formatUptime(container.created)}</div>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="details-section">
        <div className="details-section-title">Status</div>
        <div className="detail-row">
          <span className="detail-label">Full Status:</span>
          <span className="detail-value">{container.status}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Container ID:</span>
          <span className="detail-value mono-small">{container.id.substring(0, 12)}</span>
        </div>
      </div>

      {/* Image Section */}
      <div className="details-section">
        <div className="details-section-title">Image</div>
        <div className="image-info">
          <div className="image-name">{imageName}</div>
          <div className="image-tag">{imageTag}</div>
        </div>
      </div>

      {/* Service Section (Minecraft) */}
      {container.extra?.service === 'minecraft' && container.extra.mc && (
        <div className="details-section">
          <div className="details-section-title">
            Service
            <span className="service-badge">🎮 Minecraft</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Players:</span>
            <span className="detail-value">
              {container.extra.mc.playersOnline > 0 && (
                <span className="player-indicator-dot" />
              )}
              {container.extra.mc.playersOnline} / {container.extra.mc.playersMax}
            </span>
          </div>

          {container.extra.mc.motd && (
            <div className="detail-row">
              <span className="detail-label">MOTD:</span>
              <span className="detail-value" title={container.extra.mc.motd}>
                {container.extra.mc.motd.length > 30 
                  ? `${container.extra.mc.motd.substring(0, 30)}...` 
                  : container.extra.mc.motd}
              </span>
            </div>
          )}

          {container.extra.mc.playerList && container.extra.mc.playerList.length > 0 && (
            <>
              <button
                className="collapsible-header"
                onClick={() => setPlayerListExpanded(!playerListExpanded)}
                aria-expanded={playerListExpanded}
                style={{ marginTop: '8px' }}
              >
                <span className="collapsible-title">
                  Players Online ({container.extra.mc.playerList.length})
                </span>
                <span className="collapsible-icon">{playerListExpanded ? '−' : '+'}</span>
              </button>
              {playerListExpanded && (
                <div className="collapsible-content">
                  <div className="player-list">
                    {container.extra.mc.playerList.map((player, idx) => (
                      <div key={idx} className="player-item">
                        <span className="player-dot" />
                        {player}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Networking Section (Collapsible) */}
      <div className="details-section">
        <button
          className="collapsible-header"
          onClick={() => setNetworkExpanded(!networkExpanded)}
          aria-expanded={networkExpanded}
        >
          <span className="collapsible-title">Networking</span>
          <span className="collapsible-icon">{networkExpanded ? '−' : '+'}</span>
        </button>
        {networkExpanded && (
          <div className="collapsible-content">
            <div className="detail-row">
              <span className="detail-label">RX:</span>
              <span className="detail-value">{formatBytes(container.networkRx)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">TX:</span>
              <span className="detail-value">{formatBytes(container.networkTx)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Networks:</span>
              <span className="detail-value">bridge</span>
            </div>
          </div>
        )}
      </div>

      {/* Resources Section (Collapsible) */}
      <div className="details-section">
        <button
          className="collapsible-header"
          onClick={() => setResourcesExpanded(!resourcesExpanded)}
          aria-expanded={resourcesExpanded}
        >
          <span className="collapsible-title">Resources</span>
          <span className="collapsible-icon">{resourcesExpanded ? '−' : '+'}</span>
        </button>
        {resourcesExpanded && (
          <div className="collapsible-content">
            <div className="detail-row">
              <span className="detail-label">CPU Quota:</span>
              <span className="detail-value">Unlimited</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Mem Limit:</span>
              <span className="detail-value">
                {container.memoryLimit > 0
                  ? `${(container.memoryLimit / (1024 * 1024)).toFixed(0)} MB`
                  : 'Unlimited'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created:</span>
              <span className="detail-value">{new Date(container.created * 1000).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Labels Section (Collapsible, if available) */}
      {container.labels && Object.keys(container.labels).length > 0 && (
        <div className="details-section">
          <button
            className="collapsible-header"
            onClick={() => setLabelsExpanded(!labelsExpanded)}
            aria-expanded={labelsExpanded}
          >
            <span className="collapsible-title">Labels ({Object.keys(container.labels).length})</span>
            <span className="collapsible-icon">{labelsExpanded ? '−' : '+'}</span>
          </button>
          {labelsExpanded && (
            <div className="collapsible-content">
              {Object.entries(container.labels).map(([key, value]) => (
                <div key={key} className="detail-row">
                  <span className="detail-label">{key}:</span>
                  <span className="detail-value mono-small">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions Section (Optional) */}
      <div className="details-section">
        <div className="details-section-title">Actions</div>
        <div className="actions-row">
          <button className="action-btn" disabled>
            View Logs
          </button>
          <button className="action-btn" disabled>
            Portainer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanetDetails;
