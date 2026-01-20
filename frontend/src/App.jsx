import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { StatusBar, Style } from '@capacitor/status-bar';
import './styles/logo.css';
import './styles/mobile.css';

import FitnessAdvisorPageMobile from './components/FitnessAdvisorPageMobile';
import DashboardPageMobile from './components/DashboardPageMobile';
import WeeklyPlanPageMobile from './components/WeeklyPlanPageMobile';
import ProgressPageMobile from './components/ProgressPageMobile';
import LoginPageMobile from './components/LoginPageMobile';
import RegisterPageSteps from './components/RegisterPageSteps';
import ProfilePage from './components/ProfilePage';
import VoiceChatWebRTC from './components/VoiceChatWebRTC';
import FoodRecommendationsPageMobile from './components/FoodRecommendationsPageMobile';
import IdentifyFoodPageMobile from './components/IdentifyFoodPageMobile';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import MobileTabBar from './components/MobileTabBar';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);

    // Configure status bar for iOS
    const configureStatusBar = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#007AFF' });
      } catch (error) {
        // Status bar API not available (web browser)
        console.log('Status bar configuration skipped (not on mobile)');
      }
    };
    
    configureStatusBar();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleRegister = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    // Clear general user session data but KEEP user-specific fitness data
    // so it's available when they log back in
    localStorage.removeItem('user');
    localStorage.removeItem('userProfile');
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="mobile-container">
        <NavBar user={user} onLogout={handleLogout} />
        <main className="ios-content">
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" /> : <LoginPageMobile onLogin={handleLogin} />} 
            />
            <Route 
              path="/register" 
              element={user ? <Navigate to="/" /> : <RegisterPageSteps onLogin={handleRegister} />} 
            />
            <Route 
              path="/profile" 
              element={user ? <ProfilePage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/fitness-advisor" 
              element={user ? <FitnessAdvisorPageMobile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/weekly-plan" 
              element={user ? <WeeklyPlanPageMobile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/progress" 
              element={user ? <ProgressPageMobile user={user} /> : <Navigate to="/login" />} 
            />
            {/* Voice Chat DISABLED to save tokens */}
            {/* <Route 
              path="/voice-chat" 
              element={user ? <VoiceChatWebRTC user={user} /> : <Navigate to="/login" />} 
            /> */}
                        <Route 
              path="/food" 
              element={user ? <FoodRecommendationsPageMobile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/identify-food" 
              element={user ? <IdentifyFoodPageMobile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <DashboardPageMobile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/" 
              element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} 
            />
          </Routes>
        </main>
        <MobileTabBar />
      </div>
    </Router>
  );
}

export default App;