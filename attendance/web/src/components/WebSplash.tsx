import React, { useEffect, useState } from 'react';
import './WebSplash.css';

interface WebSplashProps {
  onComplete?: () => void;
  minDuration?: number;
}

export const WebSplash: React.FC<WebSplashProps> = ({ onComplete, minDuration = 2000 }) => {
  const [scaleUp, setScaleUp] = useState(false);
  const [fadedIn, setFadedIn] = useState(false);

  useEffect(() => {
    // Start fade + scale animation
    requestAnimationFrame(() => {
      setFadedIn(true);
      setScaleUp(true);
    });

    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  return (
    <div className="web-splash-container">
      <div className={`web-splash-logo-wrapper ${fadedIn ? 'fade-in' : ''} ${scaleUp ? 'scale-up' : ''}`}>
        <img
          src="/branding/yaazh360-original.png"
          alt="Yaazh 360 HRMS"
          className="web-splash-logo-img"
        />
        <h1 className="web-splash-brand-title">Yaazh 360 HRMS</h1>
      </div>
    </div>
  );
};

export default WebSplash;

