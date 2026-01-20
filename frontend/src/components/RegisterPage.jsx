import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';

function RegisterPage({ onLogin }) {
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

      // Create user profile data following Azure best practices
      const profileData = {
        email: formData.email,
        password: formData.password, // Add password for Azure storage
        name: formData.name,
        age: parseInt(formData.age) || null,
        weight: parseFloat(formData.weight) || null,
        height: parseFloat(formData.height) || null,
        gender: formData.gender,
        sex: formData.gender, // Store both field names for consistency
        fitnessLevel: formData.fitnessLevel,
        agentType: formData.agentType,
        fitnessAgent: formData.agentType, // Store both field names for consistency
        medicalConditions: formData.medicalConditions.split(',').map(m => m.trim()).filter(m => m),
        healthConditions: formData.medicalConditions, // Store both field names
        createdAt: new Date().toISOString(),
        // Azure Search optimized fields
        isActive: true,
        lastLoginAt: new Date().toISOString()
      };

      // Store profile in localStorage for immediate access
      localStorage.setItem(`userProfile_${formData.email}`, JSON.stringify(profileData));
      
      // Also store as general userProfile for immediate use
      localStorage.setItem('userProfile', JSON.stringify(profileData));
      console.log('RegisterPage: Profile data stored:', profileData);
      
      // Store user credentials for login authentication
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      const newUser = {
        id: Date.now(), // Simple ID generation
        email: formData.email,
        password: formData.password, // In production, this should be hashed
        name: formData.name,
        age: parseInt(formData.age) || null,
        weight: parseFloat(formData.weight) || null,
        height: parseFloat(formData.height) || null,
        gender: formData.gender,
        sex: formData.gender, // Store both field names
        fitnessLevel: formData.fitnessLevel,
        agentType: formData.agentType,
        createdAt: new Date().toISOString()
      };
      
      // Check if user already exists
      const existingUserIndex = registeredUsers.findIndex(u => u.email === formData.email);
      if (existingUserIndex >= 0) {
        // Update existing user
        registeredUsers[existingUserIndex] = newUser;
      } else {
        // Add new user
        registeredUsers.push(newUser);
      }
      localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
      
      // Store in Azure user_data index (following Azure best practices)
      try {
        const response = await fetch(getApiUrl('/create-user-profile'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(profileData),
        });

        if (!response.ok) {
          console.warn('Azure storage encountered an issue, continuing with local registration');
        }
      } catch (azureError) {
        // Following Azure best practices: graceful degradation
        console.log('Azure storage temporarily unavailable, profile saved locally');
      }
      
      // Create user session object
      const user = {
        email: formData.email,
        name: formData.name,
        age: parseInt(formData.age) || null,
        weight: parseFloat(formData.weight) || null,
        height: parseFloat(formData.height) || null,
        gender: formData.gender,
        fitnessLevel: formData.fitnessLevel,
        agentType: formData.agentType,
        createdAt: new Date().toISOString()
      };

      // Log the user in and redirect to dashboard
      onLogin(user);
      navigate('/');

    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header text-center">
              <div className="logo-container">
                <img 
                  src="/logo.png" 
                  alt="FitFusion AI Logo" 
                  className="fitfusion-logo-medium mb-2"
                />
              </div>
              <h3 className="mb-2">
                <i className="fas fa-user-plus me-2"></i>
                Create Your Account
              </h3>
              <p className="text-muted mb-0">
                Join FitFusion AI and start your fitness journey
              </p>
            </div>
            <div className="card-body">
              {error && (
                <div className="alert alert-danger">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                {/* Required Information */}
                <div className="mb-4">
                  <h6 className="text-primary">
                    <i className="fas fa-asterisk me-2"></i>
                    Required Information
                  </h6>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="name" className="form-label">Full Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Enter your full name"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="email" className="form-label">Email *</label>
                        <input
                          type="email"
                          className="form-control"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="password" className="form-label">Password *</label>
                        <input
                          type="password"
                          className="form-control"
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          placeholder="Create a password"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="confirmPassword" className="form-label">Confirm Password *</label>
                        <input
                          type="password"
                          className="form-control"
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
                          placeholder="Confirm your password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="gender" className="form-label">Gender *</label>
                    <select
                      className="form-select"
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      required
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                {/* Optional Information */}
                <div className="mb-4">
                  <h6 className="text-info">
                    <i className="fas fa-info-circle me-2"></i>
                    Optional Information (can be added later)
                  </h6>
                  
                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label htmlFor="age" className="form-label">Age</label>
                        <input
                          type="number"
                          className="form-control"
                          id="age"
                          name="age"
                          value={formData.age}
                          onChange={handleChange}
                          min="13"
                          max="120"
                          placeholder="Your age"
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label htmlFor="weight" className="form-label">Weight (lbs)</label>
                        <input
                          type="number"
                          className="form-control"
                          id="weight"
                          name="weight"
                          value={formData.weight}
                          onChange={handleChange}
                          min="50"
                          max="500"
                          placeholder="Weight in pounds"
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label htmlFor="height" className="form-label">Height (inches)</label>
                        <input
                          type="number"
                          className="form-control"
                          id="height"
                          name="height"
                          value={formData.height}
                          onChange={handleChange}
                          min="36"
                          max="96"
                          placeholder="Height in inches"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="fitnessLevel" className="form-label">Fitness Level</label>
                        <select
                          className="form-select"
                          id="fitnessLevel"
                          name="fitnessLevel"
                          value={formData.fitnessLevel}
                          onChange={handleChange}
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                          <option value="expert">Expert</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="agentType" className="form-label">Preferred Fitness Coach</label>
                        <select
                          className="form-select"
                          id="agentType"
                          name="agentType"
                          value={formData.agentType}
                          onChange={handleChange}
                        >
                          <option value="personal_trainer">Personal Trainer - General fitness</option>
                          <option value="strength_coach">Strength Coach - Strength training focus</option>
                          <option value="cardio_specialist">Cardio Specialist - Endurance training</option>
                          <option value="nutrition_expert">Nutrition Expert - Diet planning</option>
                          <option value="weight_loss_coach">Weight Loss Coach - Fat loss strategies</option>
                          <option value="muscle_building_coach">Muscle Building Coach - Hypertrophy focus</option>
                        </select>
                        <small className="form-text text-muted">
                          Choose the type of fitness guidance you prefer (can be changed later)
                        </small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Health Conditions */}
                <div className="mb-4">
                  <h6 className="text-success">
                    <i className="fas fa-heart me-2"></i>
                    Health Conditions & Exercise Preferences
                  </h6>
                  
                  <div className="mb-3">
                    <label htmlFor="medicalConditions" className="form-label">Health Conditions</label>
                    <textarea
                      className="form-control"
                      id="medicalConditions"
                      name="medicalConditions"
                      value={formData.medicalConditions}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Share any health conditions, injuries, physical limitations or exercise preferences to get safer and more personalized recommendations"
                    />
                    <small className="form-text text-muted">
                      Share any health conditions, injuries, physical limitations or exercise preferences to get safer and more personalized recommendations.
                    </small>
                  </div>
                </div>
                
                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-plus me-2"></i>
                        Create Account
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-3 text-center">
                  <small className="text-muted">
                    Already have an account? <a href="/login" className="text-decoration-none">Login here</a>
                  </small>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
