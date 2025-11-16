import React, { useEffect, useState } from 'react';
import './Header.css';

const Header: React.FC = () => {
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    // Random flicker effect
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        setFlicker(true);
        setTimeout(() => setFlicker(false), 50);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className={`header ${flicker ? 'flicker' : ''}`}>
      <div className="header-content">
        <span className="header-icon"></span>
        <h1 className="header-title">MISSION CONTROL</h1>
        <span className="header-icon"></span>
      </div>
      <div className="header-subtitle">DOCKER CONTAINER MONITORING SYSTEM</div>
    </header>
  );
};

export default Header;
