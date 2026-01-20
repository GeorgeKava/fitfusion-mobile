import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IoStatsChart, IoBarbell, IoCamera, IoTrophy, IoPerson } from 'react-icons/io5';
import '../styles/mobile.css';

const MobileTabBar = () => {
  const location = useLocation();

  const tabs = [
    { path: '/dashboard', icon: IoStatsChart, label: 'Dashboard' },
    { path: '/fitness-advisor', icon: IoBarbell, label: 'Advisor' },
    { path: '/food', icon: IoCamera, label: 'Food', beta: true },
    { path: '/progress', icon: IoTrophy, label: 'Progress', beta: true },
    { path: '/profile', icon: IoPerson, label: 'Profile' },
  ];

  // Don't show tab bar on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') {
    return null;
  }

  return (
    <div className="ios-tab-bar">
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`ios-tab-item ${location.pathname === tab.path ? 'active' : ''}`}
          >
            <div className="ios-tab-icon" style={{ position: 'relative' }}>
              <IconComponent size={24} />
              {tab.beta && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-12px',
                  backgroundColor: '#FF9500',
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: '700',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  Beta
                </span>
              )}
            </div>
            <div>{tab.label}</div>
          </Link>
        );
      })}
    </div>
  );
};

export default MobileTabBar;
