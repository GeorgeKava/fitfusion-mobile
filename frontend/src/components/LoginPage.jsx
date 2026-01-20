import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import { login as authLogin } from '../utils/auth';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Try to authenticate with Azure backend first
      const response = await fetch(getApiUrl('/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Login successful with Azure backend - store JWT token
        const userData = {
          id: data.user.id || Date.now(),
          email: data.user.user_email || data.user.email,
          name: data.user.name,
          isAuthenticated: true
        };
        
        // Store JWT token and user data using auth helper
        authLogin(data.token, data.user);
        
        // Store user profile from Azure (backward compatibility)
        const userProfile = {
          name: data.user.name,
          age: data.user.age,
          sex: data.user.sex || data.user.gender,
          gender: data.user.gender || data.user.sex,
          weight: data.user.weight,
          height: data.user.height,
          fitnessAgent: data.user.fitness_agent || data.user.agentType || data.user.fitnessAgent,
          agentType: data.user.agent_type || data.user.agentType || data.user.fitnessAgent,
          healthConditions: data.user.healthConditions || data.user.medical_conditions || data.user.medicalConditions,
          medicalConditions: data.user.medical_conditions || data.user.medicalConditions || data.user.healthConditions
        };
        
        localStorage.setItem('userProfile', JSON.stringify(userProfile));
        localStorage.setItem('user', JSON.stringify(userData));
        onLogin(userData);
      } else {
        // Azure login failed, try localStorage fallback
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = registeredUsers.find(u => u.email === formData.email && u.password === formData.password);
        
        if (user) {
          const userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            isAuthenticated: true
          };
          
          const userProfile = {
            name: user.name,
            age: user.age,
            sex: user.sex,
            weight: user.weight,
            fitnessAgent: user.fitnessAgent
          };
          localStorage.setItem('userProfile', JSON.stringify(userProfile));
          localStorage.setItem('user', JSON.stringify(userData));
          onLogin(userData);
        } else {
          setError('Invalid email or password');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      // Fallback to localStorage on network error
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      const user = registeredUsers.find(u => u.email === formData.email && u.password === formData.password);
      
      if (user) {
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          isAuthenticated: true
        };
        
        const userProfile = {
          name: user.name,
          age: user.age,
          sex: user.sex,
          weight: user.weight,
          fitnessAgent: user.fitnessAgent
        };
        localStorage.setItem('userProfile', JSON.stringify(userProfile));
        localStorage.setItem('user', JSON.stringify(userData));
        onLogin(userData);
      } else {
        setError('Login failed. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ios-content" style={{ 
      backgroundColor: 'var(--ios-light-gray)', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '32px 24px'
    }}>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '48px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #007AFF 0%, #00C7BE 100%)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)'
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 12C24 12 28 8 32 8C36 8 40 12 40 16C40 20 36 24 32 24C28 24 24 20 24 16V12Z" fill="white" opacity="0.9"/>
            <circle cx="24" cy="24" r="8" fill="white"/>
            <path d="M16 32L12 40H20L24 32H16Z" fill="white" opacity="0.9"/>
            <path d="M32 32L28 40H36L40 32H32Z" fill="white" opacity="0.9"/>
          </svg>
        </div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: '700', 
          marginBottom: '8px',
          color: 'var(--ios-dark-gray)'
        }}>
          Welcome Back
        </h1>
        <p style={{ 
          fontSize: '17px', 
          color: 'var(--ios-gray)',
          margin: '0'
        }}>
          Login to FitFusion AI
        </p>
      </div>
      
      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '15px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="ios-list" style={{ marginBottom: '24px' }}>
          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div style={{ 
                fontSize: '13px', 
                color: 'var(--ios-gray)', 
                marginBottom: '8px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                EMAIL
              </div>
              <input
                type="email"
                className="ios-input"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
                style={{ 
                  fontSize: '17px',
                  padding: '12px 0',
                  border: 'none',
                  borderBottom: '1px solid var(--ios-separator)',
                  borderRadius: '0',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>

          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div style={{ 
                fontSize: '13px', 
                color: 'var(--ios-gray)', 
                marginBottom: '8px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                PASSWORD
              </div>
              <input
                type="password"
                className="ios-input"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
                style={{ 
                  fontSize: '17px',
                  padding: '12px 0',
                  border: 'none',
                  borderBottom: '1px solid var(--ios-separator)',
                  borderRadius: '0',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="ios-button"
          disabled={isLoading}
          style={{
            width: '100%',
            height: '56px',
            fontSize: '17px',
            fontWeight: '600',
            marginBottom: '24px'
          }}
        >
          {isLoading ? (
            <>
              <span className="ios-spinner" style={{ display: 'inline-block', marginRight: '8px' }}></span>
              Logging in...
            </>
          ) : (
            'Login'
          )}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <p style={{ 
          fontSize: '15px', 
          color: 'var(--ios-gray)',
          marginBottom: '8px'
        }}>
          Don't have an account? <a 
            href="/register" 
            onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}
            style={{ 
              color: 'var(--ios-blue)', 
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Register here
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
