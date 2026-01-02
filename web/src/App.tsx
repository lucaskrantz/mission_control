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
    if (data.type === 'initial' || data.type === 'stats') {
      // Handle initial load and periodic stats updates from WebSocket
      setSystemStats(data.data);
    } else if (data.type === 'event') {
      // Container events (start/stop/restart) - stats will be updated on next periodic refresh
      console.log('Container event:', data.data);
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
    // Fetch initial stats as fallback if WebSocket is slow
    fetchStats();
    
    // Fallback polling only if WebSocket disconnects
    let fallbackInterval: number | null = null;
    if (!isConnected) {
      fallbackInterval = setInterval(fetchStats, 2000) as unknown as number;
    }
    
    return () => {
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [isConnected]);

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
