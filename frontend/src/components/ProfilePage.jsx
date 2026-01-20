import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import { formatHeight } from '../utils/heightUtils';
import { authFetch, logout as authLogout } from '../utils/auth';
import { IoTrash } from 'react-icons/io5';

function ProfilePage({ user, onUpdateUser, onLogout }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '',
    weight: '',
    height: '',
    healthConditions: '',
    fitnessAgent: 'personal_trainer'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [message, setMessage] = useState('');

  const fitnessAgents = [
    { value: 'personal_trainer', label: 'Personal Trainer - General fitness guidance' },
    { value: 'strength_coach', label: 'Strength Coach - Focus on strength training' },
    { value: 'cardio_specialist', label: 'Cardio Specialist - Endurance and heart health' },
    { value: 'nutrition_expert', label: 'Nutrition Expert - Diet and meal planning' },
    { value: 'weight_loss_coach', label: 'Weight Loss Coach - Fat loss strategies' },
    { value: 'muscle_building_coach', label: 'Muscle Building Coach - Hypertrophy focus' }
  ];

  useEffect(() => {
    // Fetch profile data from backend using JWT authentication
    const loadProfileData = async () => {
      if (!user?.email) {
        console.log('ProfilePage: No user email, skipping fetch');
        return;
      }

      // Check if token exists before making request
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('ProfilePage: No token found, skipping profile fetch');
        return;
      }

      console.log('ProfilePage: Fetching profile from backend for:', user.email);
      
      try {
        const response = await authFetch(getApiUrl(`/get-user-profile/${user.email}`));
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('ProfilePage: Profile data received:', data);
        
        if (data.success && data.user) {
          const profile = data.user;
          
          // Map profile data to form fields with proper field name mapping
          const mappedData = {
            name: profile.name || '',
            age: profile.age || '',
            sex: profile.sex || profile.gender || '', // Map both sex and gender fields
            weight: profile.weight || '',
            height: profile.height || '',
            healthConditions: Array.isArray(profile.healthConditions) 
              ? profile.healthConditions.join(', ') 
              : (profile.healthConditions || profile.medicalConditions || ''),
            fitnessAgent: profile.fitnessAgent || profile.agentType || 'personal_trainer'
          };
          
          console.log('ProfilePage: Mapped data:', mappedData);
          setFormData(mappedData);
        }
      } catch (error) {
        console.error('ProfilePage: Error loading profile data:', error);
        
        // Fallback to localStorage if backend fetch fails
        console.log('ProfilePage: Falling back to localStorage');
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          try {
            const profile = JSON.parse(savedProfile);
            const mappedData = {
              name: profile.name || '',
              age: profile.age || '',
              sex: profile.sex || profile.gender || '',
              weight: profile.weight || '',
              height: profile.height || '',
              healthConditions: Array.isArray(profile.healthConditions) 
                ? profile.healthConditions.join(', ') 
                : (profile.healthConditions || profile.medicalConditions || ''),
              fitnessAgent: profile.fitnessAgent || profile.agentType || 'personal_trainer'
            };
            console.log('ProfilePage: Loaded from localStorage:', mappedData);
            setFormData(mappedData);
          } catch (parseError) {
            console.error('ProfilePage: Error parsing localStorage profile:', parseError);
          }
        }
      }
    };
    
    loadProfileData();
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setMessage(''); // Clear message when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.age || !formData.sex || !formData.weight) {
        setMessage('Please fill in all required fields');
        setIsSaving(false);
        return;
      }

      // Validate age, weight, and height are numbers (height is optional)
      if (isNaN(formData.age) || isNaN(formData.weight) || (formData.height && isNaN(formData.height))) {
        setMessage('Age, weight, and height must be valid numbers');
        setIsSaving(false);
        return;
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Save to localStorage (in a real app, this would be an API call)
      const profileDataToSave = {
        ...formData,
        gender: formData.sex, // Ensure both sex and gender fields are stored
        sex: formData.sex
      };
      
      localStorage.setItem('userProfile', JSON.stringify(profileDataToSave));
      console.log('ProfilePage: Profile saved:', profileDataToSave);
      
      // Update registered user data if user is registered
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.id) {
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const userIndex = registeredUsers.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
          registeredUsers[userIndex] = {
            ...registeredUsers[userIndex],
            name: formData.name,
            age: formData.age,
            sex: formData.sex,
            gender: formData.sex, // Store both for consistency
            weight: formData.weight,
            fitnessAgent: formData.fitnessAgent
          };
          localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        }
      }
      
      // Also store user-specific profile if user email is available
      if (user?.email) {
        localStorage.setItem(`userProfile_${user.email}`, JSON.stringify(profileDataToSave));
      }
      
      setMessage('Profile saved successfully!');
      setIsEditing(false);
    } catch (err) {
      setMessage('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setMessage('');
  };

  const handleCancel = () => {
    // Reload from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      setFormData(JSON.parse(savedProfile));
    }
    setIsEditing(false);
    setMessage('');
  };

  const handleDeleteAccount = () => {
    // First confirmation
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete your account and all associated data.\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you sure you want to continue?'
    );
    
    if (!confirmed) {
      return;
    }

    // Show password modal for second confirmation
    setShowDeleteModal(true);
    setDeletePassword('');
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword) {
      setMessage('Please enter your password to confirm');
      return;
    }

    setIsDeleting(true);
    setMessage('');
    setShowDeleteModal(false);

    try {
      const response = await authFetch(getApiUrl('/delete-account'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword })
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: 'Invalid response from server' };
      }

      if (response.ok) {
        // Clear all local storage data immediately
        localStorage.clear();
        
        // Show success message
        alert('Your account has been successfully deleted.');
        
        // Force immediate redirect to login page
        window.location.href = '/login';
      } else {
        // Show detailed error message
        const errorMsg = data.error || `Failed to delete account (Status: ${response.status})`;
        console.error('Delete account failed:', response.status, data);
        setMessage(errorMsg);
        alert(`Error: ${errorMsg}\n\nPlease make sure you're logged in and try again.`);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      const errorMsg = error.message || 'An error occurred while deleting your account';
      setMessage(errorMsg);
      alert(`Error: ${errorMsg}\n\nPlease make sure you're logged in and the backend is running.`);
    } finally {
      setIsDeleting(false);
    }
  };



  // Load profile from user_data index on component mount
  useEffect(() => {
    const loadProfileFromAzure = async () => {
      if (user?.email) {
        try {
          const response = await fetch(getApiUrl(`/get-user-profile/${user.email}`));
          if (response.ok) {
            const azureProfile = await response.json();
            // Update formData with Azure profile data if available
            setFormData(prevData => ({
              ...prevData,
              ...azureProfile
            }));

          }
        } catch (error) {
          console.log('Could not load profile from Azure, using localStorage');
        }
      }
    };

    loadProfileFromAzure();
  }, [user]);

  return (
    <div>
      <div className="ios-nav-bar">
        <div></div>
        <div className="ios-nav-title">Profile</div>
        <button 
          className="ios-nav-button" 
          onClick={isEditing ? handleCancel : handleEdit}
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {message && (
        <div className="ios-card" style={{ backgroundColor: message.includes('successfully') ? '#d4edda' : '#f8d7da' }}>
          <div style={{ color: message.includes('successfully') ? '#155724' : '#721c24' }}>
            {message}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="ios-section-header">Basic Information</div>
        <div className="ios-list">
          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Name</div>
              <input
                type="text"
                className="ios-input"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="Enter your full name"
                required
                style={{ marginTop: '8px', fontSize: '15px' }}
              />
            </div>
          </div>
        </div>

        <div className="ios-list">
          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Age</div>
              <input
                type="number"
                className="ios-input"
                name="age"
                value={formData.age}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="Age in years"
                min="13"
                max="120"
                required
                style={{ marginTop: '8px', fontSize: '15px' }}
              />
            </div>
          </div>

          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Sex</div>
              <select
                className="ios-input"
                name="sex"
                value={formData.sex}
                onChange={handleChange}
                disabled={!isEditing}
                required
                style={{ marginTop: '8px', fontSize: '15px' }}
              >
                <option value="">Select sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="ios-section-header">Physical Stats</div>
        <div className="ios-list">
          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Weight (lbs)</div>
              <input
                type="number"
                className="ios-input"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="Weight in pounds"
                min="50"
                max="1000"
                step="0.1"
                required
                style={{ marginTop: '8px', fontSize: '15px' }}
              />
            </div>
          </div>

          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Height (inches)</div>
              <input
                type="number"
                className="ios-input"
                name="height"
                value={formData.height}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="Height in inches"
                min="36"
                max="96"
                step="0.5"
                style={{ marginTop: '8px', fontSize: '15px' }}
              />
              <div style={{ fontSize: '13px', color: 'var(--ios-gray)', marginTop: '4px' }}>
                Optional - helps provide more accurate recommendations
              </div>
            </div>
          </div>
        </div>

        <div className="ios-section-header">Health & Preferences</div>
        <div className="ios-list">
          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Health Conditions & Exercise Preferences</div>
              <textarea
                className="ios-input"
                name="healthConditions"
                value={formData.healthConditions}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="e.g., Lower back pain, knee injury, prefer low-impact workouts..."
                rows="4"
                style={{ marginTop: '8px', fontSize: '15px', resize: 'vertical' }}
              />
              <div style={{ fontSize: '13px', color: 'var(--ios-gray)', marginTop: '4px' }}>
                Share any health conditions, injuries, or exercise preferences for safer recommendations
              </div>
            </div>
          </div>

          <div className="ios-list-item">
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">Fitness Agent</div>
              <select
                className="ios-input"
                name="fitnessAgent"
                value={formData.fitnessAgent}
                onChange={handleChange}
                disabled={!isEditing}
                required
                style={{ marginTop: '8px', fontSize: '15px' }}
              >
                {fitnessAgents.map(agent => (
                  <option key={agent.value} value={agent.value}>
                    {agent.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '13px', color: 'var(--ios-gray)', marginTop: '4px' }}>
                Choose the type of fitness guidance you prefer
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <div style={{ padding: '16px' }}>
            <button
              type="submit"
              className="ios-button ios-button-success"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="ios-spinner" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        )}
      </form>

      {formData.name && !isEditing && (
        <div className="ios-card">
          <h5 className="ios-card-title">Profile Summary</h5>
          <div style={{ fontSize: '15px', color: 'var(--ios-dark-gray)' }}>
            <p style={{ marginBottom: '8px' }}><strong>Name:</strong> {formData.name}</p>
            <p style={{ marginBottom: '8px' }}><strong>Age:</strong> {formData.age} years</p>
            <p style={{ marginBottom: '8px' }}><strong>Sex:</strong> {formData.sex}</p>
            <p style={{ marginBottom: '8px' }}><strong>Weight:</strong> {formData.weight} lbs</p>
            {formData.height && <p style={{ marginBottom: '8px' }}><strong>Height:</strong> {formatHeight(formData.height)}</p>}
            <p style={{ marginBottom: '0' }}><strong>Fitness Agent:</strong> {fitnessAgents.find(agent => agent.value === formData.fitnessAgent)?.label}</p>
          </div>
        </div>
      )}

      <div style={{ padding: '16px', marginBottom: '80px' }}>
        <button
          type="button"
          className="ios-button ios-button-danger"
          onClick={onLogout}
          style={{ width: '100%', marginBottom: '12px' }}
        >
          Log Out
        </button>
        
        <button
          type="button"
          className="ios-button"
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          style={{ 
            width: '100%',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            opacity: isDeleting ? 0.6 : 1
          }}
        >
          {isDeleting ? (
            <>
              <span className="ios-spinner" style={{ display: 'inline-block', marginRight: '8px' }}></span>
              Deleting Account...
            </>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <IoTrash size={20} />
              <span>Delete Account</span>
            </span>
          )}
        </button>
      </div>

      {/* Password Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#dc3545' }}>
              Confirm Account Deletion
            </h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Please enter your password to confirm account deletion:
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmDelete();
                }
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setMessage('Account deletion cancelled');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!deletePassword}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: deletePassword ? '#dc3545' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: deletePassword ? 'pointer' : 'not-allowed',
                  opacity: deletePassword ? 1 : 0.6
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
