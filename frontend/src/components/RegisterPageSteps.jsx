import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import '../styles/mobile.css';

function RegisterPageSteps({ onLogin }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    weight: '',
    heightFeet: '',
    heightInches: '',
    height: '',
    gender: 'male',
    fitnessLevel: 'beginner',
    agentType: 'personal_trainer',
    medicalConditions: ''
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const totalSteps = 5;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateStep = () => {
    setError('');
    
    switch(currentStep) {
      case 1: // Name fields only
        if (!formData.firstName.trim()) {
          setError('First name is required');
          return false;
        }
        if (!formData.lastName.trim()) {
          setError('Last name is required');
          return false;
        }
        break;
        
      case 2: // Email, username, and password
        if (!formData.username.trim()) {
          setError('Username is required');
          return false;
        }
        if (formData.username.length < 3) {
          setError('Username must be at least 3 characters');
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim()) {
          setError('Email is required');
          return false;
        }
        if (!emailRegex.test(formData.email)) {
          setError('Please enter a valid email address');
          return false;
        }
        if (!formData.password) {
          setError('Password is required');
          return false;
        }
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters');
          return false;
        }
        // Check for uppercase letter
        if (!/[A-Z]/.test(formData.password)) {
          setError('Password must contain at least one uppercase letter');
          return false;
        }
        // Check for lowercase letter
        if (!/[a-z]/.test(formData.password)) {
          setError('Password must contain at least one lowercase letter');
          return false;
        }
        // Check for number
        if (!/\d/.test(formData.password)) {
          setError('Password must contain at least one number');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        break;
        
      case 3: // Physical info
        if (!formData.age) {
          setError('Age is required');
          return false;
        }
        if (formData.age < 13 || formData.age > 120) {
          setError('Please enter a valid age');
          return false;
        }
        if (!formData.weight) {
          setError('Weight is required');
          return false;
        }
        if (formData.weight < 50 || formData.weight > 500) {
          setError('Please enter a valid weight');
          return false;
        }
        if (!formData.heightFeet || !formData.heightInches) {
          setError('Height is required (both feet and inches)');
          return false;
        }
        if (formData.height < 36 || formData.height > 96) {
          setError('Please enter a valid height (3-8 feet)');
          return false;
        }
        break;
        
      case 4: // Fitness goals
        // Optional fields, no validation needed
        break;
        
      case 5: // Health info
        // Optional fields, no validation needed
        break;
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/login');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setIsLoading(true);
    setError('');

    try {
      const fullName = [formData.firstName, formData.middleName, formData.lastName]
        .filter(n => n.trim())
        .join(' ');

      // Create user profile data
      const profileData = {
        email: formData.email,
        username: formData.username,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        name: fullName,
        password: formData.password,
        age: parseInt(formData.age),
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        gender: formData.gender,
        sex: formData.gender,
        fitnessLevel: formData.fitnessLevel,
        agentType: formData.agentType,
        fitnessAgent: formData.agentType,
        medicalConditions: formData.medicalConditions
          .split(',')
          .map(m => m.trim())
          .filter(m => m),
        createdAt: new Date().toISOString(),
        isActive: true,
        lastLoginAt: new Date().toISOString()
      };

      // Store profile locally
      localStorage.setItem(`userProfile_${formData.email}`, JSON.stringify(profileData));
      localStorage.setItem('userProfile', JSON.stringify(profileData));
      
      // Store credentials
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      const newUser = {
        id: Date.now(),
        ...profileData
      };
      
      const existingUserIndex = registeredUsers.findIndex(u => u.email === formData.email);
      if (existingUserIndex >= 0) {
        registeredUsers[existingUserIndex] = newUser;
      } else {
        registeredUsers.push(newUser);
      }
      
      localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
      
      // Store in backend (required for authentication)
      try {
        const response = await fetch(getApiUrl('/create-user-profile'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profileData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          // Show backend validation error to user
          setError(data.error || 'Registration failed. Please try again.');
          setIsLoading(false);
          return; // Stop here - don't proceed to dashboard
        }
        
        console.log('✅ User successfully registered');
        
        // Store JWT token for authentication
        if (data.token) {
          localStorage.setItem('token', data.token);
          console.log('✅ JWT token stored');
        }
        
        // Store complete profile data from backend response
        if (data.user) {
          const completeUserData = {
            ...data.user,
            ...profileData, // Merge with full profile data we sent
            id: newUser.id,
            isAuthenticated: true
          };
          localStorage.setItem('userProfile', JSON.stringify(completeUserData));
          localStorage.setItem(`userProfile_${formData.email}`, JSON.stringify(completeUserData));
        }
      } catch (err) {
        console.error('Backend connection error:', err);
        setError('Could not connect to server. Please check your connection and try again.');
        setIsLoading(false);
        return; // Stop here
      }
      
      // Login user
      const userData = {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: fullName,
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

  const renderProgressBar = () => (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '13px', color: 'var(--ios-gray)' }}>
          Step {currentStep} of {totalSteps}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--ios-gray)', fontWeight: '600' }}>
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>
      <div style={{ 
        height: '4px', 
        backgroundColor: '#e5e5ea', 
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          height: '100%', 
          backgroundColor: 'var(--ios-blue)',
          width: `${(currentStep / totalSteps) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );

  const renderStep1 = () => (
    <>
      <div className="ios-section-header">What's your name?</div>
      <div className="ios-list">
        <div className="ios-list-item">
          <div className="ios-list-item-content">
            <input
              type="text"
              className="ios-input"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First Name *"
              autoFocus
              style={{ border: 'none', fontSize: '17px' }}
            />
          </div>
        </div>
        <div className="ios-list-item">
          <div className="ios-list-item-content">
            <input
              type="text"
              className="ios-input"
              name="middleName"
              value={formData.middleName}
              onChange={handleChange}
              placeholder="Middle Name (optional)"
              style={{ border: 'none', fontSize: '17px' }}
            />
          </div>
        </div>
        <div className="ios-list-item">
          <div className="ios-list-item-content">
            <input
              type="text"
              className="ios-input"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last Name *"
              style={{ border: 'none', fontSize: '17px' }}
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="ios-section-header">Account Information</div>
      <div className="ios-list">
        <div className="ios-list-item">
          <div className="ios-list-item-content">
            <input
              type="text"
              className="ios-input"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Username *"
              autoFocus
              autoCapitalize="none"
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
              autoCapitalize="none"
              style={{ border: 'none', fontSize: '17px' }}
            />
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--ios-gray)' }}>
        Your username will be visible to other users
      </div>

      <div className="ios-section-header">Create Password</div>
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
              style={{ border: 'none', fontSize: '17px' }}
            />
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--ios-gray)' }}>
        Password must be at least 8 characters with 1 uppercase letter, 1 lowercase letter, and 1 number
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <div className="ios-section-header">Physical Information</div>
      <div className="ios-list">
        <div className="ios-list-item">
          <div className="ios-list-item-label">Age</div>
          <div className="ios-list-item-content">
            <input
              type="number"
              className="ios-input"
              name="age"
              value={formData.age}
              onChange={handleChange}
              placeholder="Years"
              autoFocus
              style={{ border: 'none', fontSize: '17px', textAlign: 'right' }}
            />
          </div>
        </div>
        <div className="ios-list-item">
          <div className="ios-list-item-label">Gender</div>
          <div className="ios-list-item-content" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <select
              className="ios-input"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              style={{ 
                border: 'none', 
                fontSize: '17px', 
                textAlign: 'right', 
                width: 'auto', 
                backgroundColor: 'transparent',
                color: '#000',
                appearance: 'none',
                paddingRight: '0',
                outline: 'none'
              }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="ios-list-item">
          <div className="ios-list-item-label">Weight</div>
          <div className="ios-list-item-content">
            <input
              type="number"
              className="ios-input"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              placeholder="lbs"
              step="0.1"
              style={{ border: 'none', fontSize: '17px', textAlign: 'right' }}
            />
          </div>
        </div>
        <div className="ios-list-item">
          <div className="ios-list-item-label">Height</div>
          <div className="ios-list-item-content" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <input
              type="number"
              className="ios-input"
              name="heightFeet"
              value={formData.heightFeet}
              onChange={(e) => {
                handleChange(e);
                const feet = parseInt(e.target.value) || 0;
                const inches = parseInt(formData.heightInches) || 0;
                setFormData(prev => ({ ...prev, height: feet * 12 + inches }));
              }}
              placeholder="0"
              min="0"
              max="8"
              style={{ 
                border: '1px solid #e5e5ea', 
                fontSize: '17px', 
                textAlign: 'center', 
                width: '50px', 
                padding: '8px 4px',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
              }}
            />
            <span style={{ fontSize: '17px', color: '#86868b', minWidth: '20px' }}>ft</span>
            <input
              type="number"
              className="ios-input"
              name="heightInches"
              value={formData.heightInches}
              onChange={(e) => {
                handleChange(e);
                const feet = parseInt(formData.heightFeet) || 0;
                const inches = parseInt(e.target.value) || 0;
                setFormData(prev => ({ ...prev, height: feet * 12 + inches }));
              }}
              placeholder="0"
              min="0"
              max="11"
              style={{ 
                border: '1px solid #e5e5ea', 
                fontSize: '17px', 
                textAlign: 'center', 
                width: '50px', 
                padding: '8px 4px',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
              }}
            />
            <span style={{ fontSize: '17px', color: '#86868b', minWidth: '20px' }}>in</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderStep4 = () => (
    <>
      <div className="ios-section-header">Fitness Goals</div>
      <div className="ios-list">
        <div className="ios-list-item">
          <div className="ios-list-item-label">Fitness Level</div>
          <div className="ios-list-item-content">
            <select
              className="ios-input"
              name="fitnessLevel"
              value={formData.fitnessLevel}
              onChange={handleChange}
              autoFocus
              style={{ border: 'none', fontSize: '17px', textAlign: 'right' }}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
        <div className="ios-list-item">
          <div className="ios-list-item-label">Coach Type</div>
          <div className="ios-list-item-content">
            <select
              className="ios-input"
              name="agentType"
              value={formData.agentType}
              onChange={handleChange}
              style={{ border: 'none', fontSize: '17px', textAlign: 'right' }}
            >
              <option value="personal_trainer">Personal Trainer</option>
              <option value="strength_coach">Strength Coach</option>
              <option value="cardio_specialist">Cardio Specialist</option>
              <option value="nutrition_expert">Nutrition Expert</option>
              <option value="weight_loss_coach">Weight Loss Coach</option>
              <option value="muscle_building_coach">Muscle Building</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );

  const renderStep5 = () => (
    <>
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
              rows="6"
              autoFocus
              style={{ border: 'none', fontSize: '15px', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--ios-gray)' }}>
        This helps us provide personalized recommendations
      </div>
    </>
  );

  return (
    <div style={{ backgroundColor: 'var(--ios-light-gray)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="ios-nav-bar">
        <button 
          className="ios-nav-button" 
          onClick={handleBack}
        >
          ← Back
        </button>
        <div className="ios-nav-title" style={{ textAlign: 'center', flex: 1 }}>Create Account</div>
        <div style={{ width: '60px' }}></div>
      </div>

      {renderProgressBar()}

      <div style={{ padding: '0 16px 100px' }}>
        {error && (
          <div className="ios-card" style={{ 
            backgroundColor: '#f8d7da', 
            marginBottom: '16px',
            padding: '12px'
          }}>
            <div style={{ color: '#721c24', fontSize: '15px' }}>
              ⚠️ {error}
            </div>
          </div>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}

        {/* Navigation Buttons */}
        <div style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          padding: '16px',
          backgroundColor: 'var(--ios-light-gray)',
          borderTop: '1px solid #e5e5ea',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))'
        }}>
          {currentStep < totalSteps ? (
            <button
              type="button"
              className="ios-button"
              onClick={handleNext}
              disabled={isLoading}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="ios-button"
              onClick={handleSubmit}
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
          )}

          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <p style={{ fontSize: '15px', color: 'var(--ios-gray)', margin: 0 }}>
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
      </div>
    </div>
  );
}

export default RegisterPageSteps;
