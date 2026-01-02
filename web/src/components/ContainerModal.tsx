import React, { useEffect, useState } from 'react';
import { ContainerStats } from '../types';
import './ContainerModal.css';

interface ContainerModalProps {
  container: ContainerStats;
  onClose: () => void;
}

interface ContainerDetails {
  id: string;
  name: string;
  image: string;
  state: string;
  created: string;
  started: string;
  finished: string;
  restartCount: number;
  platform: string;
  ports: any;
  mounts: any[];
  env: string[];
}

const ContainerModal: React.FC<ContainerModalProps> = ({ container, onClose }) => {
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`/api/container/${container.id}`);
        const data = await response.json();
        setDetails(data);
      } catch (error) {
        console.error('Error fetching container details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [container.id]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number | string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'running': return '#0f0';
      case 'exited': return '#f00';
      case 'paused': return '#08f';
      case 'restarting': return '#ff0';
      default: return '#888';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <span style={{ color: getStateColor(container.state) }}>●</span> {container.name}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="modal-loading">LOADING DATA...</div>
        ) : (
          <div className="modal-body">
            <div className="modal-section">
              <h3 className="section-title">STATUS</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">STATE:</span>
                  <span className="info-value" style={{ color: getStateColor(container.state) }}>
                    {container.state.toUpperCase()}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">STATUS:</span>
                  <span className="info-value">{container.status}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">RESTARTS:</span>
                  <span className="info-value">{details?.restartCount || 0}</span>
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h3 className="section-title">RESOURCES</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">CPU:</span>
                  <span className="info-value">{container.cpuPercent.toFixed(2)}%</span>
                </div>
                <div className="info-item">
                  <span className="info-label">MEMORY:</span>
                  <span className="info-value">
                    {formatBytes(container.memoryUsageBytes)} / {formatBytes(container.memoryLimitBytes)}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">MEM %:</span>
                  <span className="info-value">{container.memoryPercent.toFixed(2)}%</span>
                </div>
                <div className="info-item">
                  <span className="info-label">NET RX:</span>
                  <span className="info-value">{formatBytes(container.networkRx)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">NET TX:</span>
                  <span className="info-value">{formatBytes(container.networkTx)}</span>
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h3 className="section-title">DETAILS</h3>
              <div className="info-grid">
                <div className="info-item full-width">
                  <span className="info-label">ID:</span>
                  <span className="info-value mono">{container.id.substring(0, 12)}</span>
                </div>
                <div className="info-item full-width">
                  <span className="info-label">IMAGE:</span>
                  <span className="info-value">{container.image}</span>
                </div>
                <div className="info-item full-width">
                  <span className="info-label">CREATED:</span>
                  <span className="info-value">{formatDate(container.created * 1000)}</span>
                </div>
                {details?.started && (
                  <div className="info-item full-width">
                    <span className="info-label">STARTED:</span>
                    <span className="info-value">{formatDate(details.started)}</span>
                  </div>
                )}
                {details?.platform && (
                  <div className="info-item full-width">
                    <span className="info-label">PLATFORM:</span>
                    <span className="info-value">{details.platform}</span>
                  </div>
                )}
              </div>
            </div>

            {details?.mounts && details.mounts.length > 0 && (
              <div className="modal-section">
                <h3 className="section-title">MOUNTS ({details.mounts.length})</h3>
                <div className="mounts-list">
                  {details.mounts.slice(0, 3).map((mount: any, idx: number) => (
                    <div key={idx} className="mount-item">
                      <span className="mount-type">[{mount.Type}]</span>
                      <span className="mount-path">{mount.Source || mount.Name}</span>
                    </div>
                  ))}
                  {details.mounts.length > 3 && (
                    <div className="mount-item">... and {details.mounts.length - 3} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
};

export default ContainerModal;
