import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import '../styles/mobile.css';

function RegisterPageMobile({ onLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    weight: '',
    height: '',
    gender: 'male',
    fitnessLevel: 'beginner',
    agentType: 'personal_trainer',
    medicalConditions: ''
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.password) {
        throw new Error('Please fill in all required fields');
      }

      // Validate password confirmation
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Create user profile data
      const profileData = {
        email: formData.email,
        password: formData.password, // Add password for backend
        name: formData.name,
        age: parseInt(formData.age) || null,
        weight: parseFloat(formData.weight) || null,
        height: parseFloat(formData.height) || null,
        gender: formData.gender,
        sex: formData.gender,
        fitnessLevel: formData.fitnessLevel,
        agentType: formData.agentType,
        fitnessAgent: formData.agentType,
        medicalConditions: formData.medicalConditions.split(',').map(m => m.trim()).filter(m => m),
        createdAt: new Date().toISOString(),
        isActive: true,
        lastLoginAt: new Date().toISOString()
      };

      // Store profile
      localStorage.setItem(`userProfile_${formData.email}`, JSON.stringify(profileData));
      localStorage.setItem('userProfile', JSON.stringify(profileData));
      
      // Store credentials
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      const newUser = {
        id: Date.now(),
        email: formData.email,
        password: formData.password,
        name: formData.name,
        age: parseInt(formData.age) || null,
        weight: parseFloat(formData.weight) || null,
        height: parseFloat(formData.height) || null,
        gender: formData.gender,
        sex: formData.gender,
        fitnessLevel: formData.fitnessLevel,
        agentType: formData.agentType,
        createdAt: new Date().toISOString()
      };
      
      const existingUserIndex = registeredUsers.findIndex(u => u.email === formData.email);
      if (existingUserIndex >= 0) {
        registeredUsers[existingUserIndex] = newUser;
      } else {
        registeredUsers.push(newUser);
      }
      
      localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
      
      // Store user in Azure Search
      try {
        console.log('RegisterPageMobile: Attempting to create user profile');
        console.log('RegisterPageMobile: API URL:', getApiUrl('/create-user-profile'));
        console.log('RegisterPageMobile: Profile data:', JSON.stringify(profileData, null, 2));
        
        const response = await fetch(getApiUrl('/create-user-profile'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profileData)
        });
        
        console.log('RegisterPageMobile: Response status:', response.status);
        const responseData = await response.json();
        console.log('RegisterPageMobile: Response data:', JSON.stringify(responseData, null, 2));
        
        if (!response.ok) {
          console.error('RegisterPageMobile: Failed to store profile in backend:', responseData);
          // Show backend error to user
          throw new Error(responseData.error || 'Failed to create account on server');
        } else {
          console.log('RegisterPageMobile: Successfully stored profile in backend');
        }
      } catch (err) {
        console.error('RegisterPageMobile: Error storing profile in backend:', err);
        console.error('RegisterPageMobile: Error details:', err.message, err.stack);
        // Re-throw to show error to user
        throw new Error(err.message || 'Could not connect to server. Please check your internet connection.');
      }
      
      // Login user
      const userData = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        isAuthenticated: true
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      onLogin(userData);
      
      navigate('/dashboard');
      
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--ios-light-gray)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="ios-nav-bar">
        <button 
          className="ios-nav-button" 
          onClick={() => navigate('/login')}
        >
          ← Back
        </button>
        <div className="ios-nav-title">Create Account</div>
        <div></div>
      </div>

      <div style={{ padding: '16px' }}>
        {error && (
          <div className="ios-card" style={{ backgroundColor: '#f8d7da', marginBottom: '16px' }}>
            <div style={{ color: '#721c24', fontSize: '15px' }}>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="ios-section-header">Basic Information</div>
          <div className="ios-list">
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="text"
                  className="ios-input"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Full Name *"
                  required
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="email"
                  className="ios-input"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address *"
                  required
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="ios-section-header">Security</div>
          <div className="ios-list">
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="password"
                  className="ios-input"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password *"
                  required
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="password"
                  className="ios-input"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm Password *"
                  required
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
          </div>
          <div style={{ 
            padding: '0 16px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#8E8E93',
            lineHeight: '1.4'
          }}>
            Password must be at least 8 characters with uppercase, lowercase, and number
          </div>

          {/* Physical Info */}
          <div className="ios-section-header">Physical Information</div>
          <div className="ios-list">
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="number"
                  className="ios-input"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="Age (optional)"
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <select
                  className="ios-input"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  style={{ border: 'none', fontSize: '17px' }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="number"
                  className="ios-input"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  placeholder="Weight (lbs, optional)"
                  step="0.1"
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <input
                  type="number"
                  className="ios-input"
                  name="height"
                  value={formData.height}
                  onChange={handleChange}
                  placeholder="Height (inches, optional)"
                  step="0.5"
                  style={{ border: 'none', fontSize: '17px' }}
                />
              </div>
            </div>
          </div>

          {/* Fitness Goals */}
          <div className="ios-section-header">Fitness Goals</div>
          <div className="ios-list">
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <div style={{ fontSize: '13px', color: 'var(--ios-gray)', marginBottom: '8px' }}>
                  Fitness Level
                </div>
                <select
                  className="ios-input"
                  name="fitnessLevel"
                  value={formData.fitnessLevel}
                  onChange={handleChange}
                  style={{ border: 'none', fontSize: '17px' }}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <div style={{ fontSize: '13px', color: 'var(--ios-gray)', marginBottom: '8px' }}>
                  Fitness Coach Type
                </div>
                <select
                  className="ios-input"
                  name="agentType"
                  value={formData.agentType}
                  onChange={handleChange}
                  style={{ border: 'none', fontSize: '17px' }}
                >
                  <option value="personal_trainer">Personal Trainer</option>
                  <option value="strength_coach">Strength Coach</option>
                  <option value="cardio_specialist">Cardio Specialist</option>
                  <option value="nutrition_expert">Nutrition Expert</option>
                  <option value="weight_loss_coach">Weight Loss Coach</option>
                  <option value="muscle_building_coach">Muscle Building Coach</option>
                </select>
              </div>
            </div>
          </div>

          {/* Health Info */}
          <div className="ios-section-header">Health Information (Optional)</div>
          <div className="ios-list">
            <div className="ios-list-item">
              <div className="ios-list-item-content">
                <textarea
                  className="ios-input"
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleChange}
                  placeholder="Medical conditions, injuries, or exercise preferences (comma-separated)"
                  rows="4"
                  style={{ border: 'none', fontSize: '15px', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ padding: '24px 16px 80px' }}>
            <button
              type="submit"
              className="ios-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="ios-spinner" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <p style={{ fontSize: '15px', color: 'var(--ios-gray)' }}>
                Already have an account?{' '}
                <a 
                  href="/login" 
                  style={{ color: 'var(--ios-blue)', textDecoration: 'none', fontWeight: '600' }}
                >
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterPageMobile;
