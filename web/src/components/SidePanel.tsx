import React, { useMemo } from 'react';
import { useSelectionStore } from '../state/selection';
import { ContainerStats } from '../types';
import { theme } from '../theme';
import PlanetDetails from './PlanetDetails';
import './SidePanel.css';

const SidePanel: React.FC = () => {
  const { selection, hover, clearSelection } = useSelectionStore();

  // Compute group stats
  const groupStats = useMemo(() => {
    if (selection.kind !== 'group') return null;

    const { group } = selection;
    const counts = {
      running: 0,
      paused: 0,
      exited: 0,
      restarting: 0,
      other: 0,
    };

    let totalCpu = 0;
    let totalMem = 0;

    group.containers.forEach((c: ContainerStats) => {
      const state = c.state.toLowerCase();
      if (state === 'running') counts.running++;
      else if (state === 'paused') counts.paused++;
      else if (state === 'exited') counts.exited++;
      else if (state === 'restarting') counts.restarting++;
      else counts.other++;

      totalCpu += c.cpuPercent || 0;
      totalMem += c.memoryUsageBytes || 0;
    });

    const avgCpu = group.containers.length > 0 ? totalCpu / group.containers.length : 0;

    return {
      counts,
      avgCpu,
      totalMem: totalMem / (1024 * 1024), // Convert to MiB
      members: group.containers.map((c: ContainerStats) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        cpu: c.cpuPercent || 0,
        mem: c.memoryUsageBytes / (1024 * 1024), // MiB
        memLimit: c.memoryLimitBytes / (1024 * 1024), // MiB
      })),
    };
  }, [selection]);

  const getStateColor = (state: string) => {
    const s = state.toLowerCase();
    if (s === 'running') return theme.colors.running;
    if (s === 'paused') return theme.colors.paused;
    if (s === 'restarting') return theme.colors.restarting;
    if (s === 'exited') return theme.colors.exited;
    return '#888888';
  };

  const renderNone = () => {
    // Show hover info if available
    if (hover.planetId && hover.container) {
      return (
        <>
          <div className="panel-header-sticky">
            <div className="header-title">{hover.container.name}</div>
          </div>
          <div className="panel-body">
            <div className="hover-hint">Hovering · Click to pin</div>
            <div className="panel-section">
              <div className="section-label">Group</div>
              <div className="section-value">{hover.container.group}</div>
            </div>
            <div className="panel-section">
              <div className="section-label">Status</div>
              <div className="stats-chips">
                <div className="chip" style={{ borderColor: getStateColor(hover.container.state) }}>
                  <span className="chip-dot" style={{ backgroundColor: getStateColor(hover.container.state) }} />
                  {hover.container.state}
                </div>
              </div>
            </div>
            <div className="panel-section">
              <div className="section-label">Quick Stats</div>
              <div className="stats-row">
                <span className="stat-label">CPU:</span>
                <span className="stat-value">{(hover.container.cpuPercent || 0).toFixed(1)}%</span>
              </div>
              <div className="stats-row">
                <span className="stat-label">Memory:</span>
                <span className="stat-value">
                  {(hover.container.memoryUsageBytes / (1024 * 1024)).toFixed(0)} MiB
                </span>
              </div>
            </div>
          </div>
        </>
      );
    }
    
    return (
      <>
        <div className="panel-header-sticky">
          <div className="header-title">Mission Control</div>
        </div>
        <div className="panel-body">
          <div className="side-panel-empty">
            <div className="empty-icon">◯</div>
            <div className="empty-text">No selection</div>
            <div className="empty-hint">Hover a planet or click a ring</div>
          </div>
        </div>
      </>
    );
  };

  const renderPlanet = () => {
    if (selection.kind !== 'planet') return null;
    const { container } = selection;

    return (
      <>
        <div className="panel-header-sticky">
          <div className="header-title">{container.name}</div>
          <button className="clear-btn" onClick={clearSelection} aria-label="Clear selection">
            ✕
          </button>
        </div>
        <div className="panel-body">
          <div className="header-underline" />
          <PlanetDetails container={container} groupTitle={container.group} />
        </div>
      </>
    );
  };

  const renderGroup = () => {
    if (selection.kind !== 'group' || !groupStats) return null;
    const { group } = selection;

    return (
      <>
        <div className="panel-header-sticky">
          <div className="header-title">{group.title}</div>
          <button className="clear-btn" onClick={clearSelection} aria-label="Clear selection">
            ✕
          </button>
        </div>
        <div className="panel-body">
          <div className="header-underline" />

          <div className="panel-section">
            <div className="section-label">Status</div>
            <div className="stats-chips">
              <div className="chip" style={{ borderColor: getStateColor(group.dominantState) }}>
                <span className="chip-dot" style={{ backgroundColor: getStateColor(group.dominantState) }} />
                {group.dominantState}
              </div>
            </div>
          </div>

          <div className="panel-section">
            <div className="section-label">Counts</div>
            <div className="stats-row">
              <span className="stat-label">Running:</span>
              <span className="stat-value">{groupStats.counts.running}</span>
            </div>
            <div className="stats-row">
              <span className="stat-label">Paused:</span>
              <span className="stat-value">{groupStats.counts.paused}</span>
            </div>
            <div className="stats-row">
              <span className="stat-label">Exited:</span>
              <span className="stat-value">{groupStats.counts.exited}</span>
            </div>
          </div>

          <div className="panel-section">
            <div className="section-label">Aggregate</div>
            <div className="stats-row">
              <span className="stat-label">Avg CPU:</span>
              <span className="stat-value">{groupStats.avgCpu.toFixed(1)}%</span>
            </div>
            <div className="stats-row">
              <span className="stat-label">Total Mem:</span>
              <span className="stat-value">{groupStats.totalMem.toFixed(0)} MiB</span>
            </div>
          </div>

          <div className="panel-section">
            <div className="section-label">Members ({groupStats.members.length})</div>
            <div className="member-list">
              {groupStats.members.map((member: { id: string; name: string; state: string; cpu: number; mem: number; memLimit: number }) => (
                <div key={member.id} className="member-row">
                  <span className="member-dot" style={{ backgroundColor: getStateColor(member.state) }} />
                  <div className="member-info">
                    <div className="member-name">{member.name}</div>
                    <div className="member-stats">
                      CPU {member.cpu.toFixed(1)}% · Mem {member.mem.toFixed(0)} MiB
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="side-panel" role="complementary" aria-live="polite">
      {selection.kind === 'none' && renderNone()}
      {selection.kind === 'planet' && renderPlanet()}
      {selection.kind === 'group' && renderGroup()}
    </div>
  );
};

export default SidePanel;
