import React, { useState } from 'react';
import '../styles/mobile.css';
import { getApiUrl } from '../config/api';
import { login as authLogin } from '../utils/auth';

const LoginPageMobile = ({ onLogin }) => {
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
    setError('');
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
        // Login successful - store JWT token
        const userData = {
          id: data.user.id || Date.now(),
          email: data.user.user_email || data.user.email,
          name: data.user.name,
          isAuthenticated: true
        };
        
        // Store JWT token and user data
        authLogin(data.token, data.user);
        
        // Store user profile
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
        setError(data.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px 16px', backgroundColor: 'var(--ios-light-gray)', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <img 
          src="/logo.png" 
          alt="FitFusion AI Logo" 
          style={{ width: '100px', height: '100px', marginBottom: '16px' }}
        />
        <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Welcome Back
        </h2>
        <p style={{ color: 'var(--ios-gray)', fontSize: '17px' }}>
          Login to FitFusion AI
        </p>
      </div>

      {error && (
        <div className="ios-card" style={{ backgroundColor: '#f8d7da', marginBottom: '16px' }}>
          <div style={{ color: '#721c24', fontSize: '15px' }}>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="ios-input-group">
          <label className="ios-input-label">Email</label>
          <input
            type="email"
            className="ios-input"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
          />
        </div>

        <div className="ios-input-group">
          <label className="ios-input-label">Password</label>
          <input
            type="password"
            className="ios-input"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
          />
        </div>

        <div style={{ marginTop: '24px' }}>
          <button
            type="submit"
            className="ios-button"
            disabled={isLoading}
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
        </div>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <p style={{ fontSize: '15px', color: 'var(--ios-gray)' }}>
          Don't have an account?{' '}
          <a 
            href="/register" 
            style={{ color: 'var(--ios-blue)', textDecoration: 'none', fontWeight: '600' }}
          >
            Register here
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPageMobile;
