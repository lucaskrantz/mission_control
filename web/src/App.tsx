import React, { useEffect, useState } from 'react';
import SolarSystem from './components/SolarSystem';
import HUD from './components/HUD';
import CRTEffect from './components/CRTEffect';
import SidePanel from './components/SidePanel';
import { useWebSocket } from './hooks/useWebSocket';
import { SystemStats } from './types';
import './App.css';

const App: React.FC = () => {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const { isConnected } = useWebSocket((data) => {
    if (data.type === 'initial' || data.type === 'update') {
      setSystemStats(data.data);
    } else if (data.type === 'event') {
      // Refresh stats on container events
      fetchStats();
    }
  });

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setSystemStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    // Throttle updates to 1-2 Hz for performance
    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <CRTEffect />
      <HUD systemStats={systemStats} isConnected={isConnected} />
      <div className="app-layout">
        <SidePanel />
        <div className="canvas-container">
          <SolarSystem 
            containers={systemStats?.containers || []} 
          />
        </div>
      </div>
    </div>
  );
};

export default App;
