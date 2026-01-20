import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';

function FitnessAdvisorPage({ user }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]); // Store base64 images for display
  const [recommendation, setRecommendation] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [healthConditions, setHealthConditions] = useState('');
  const [agentType, setAgentType] = useState('general');
  const [fastMode, setFastMode] = useState(false); // Default to full analysis mode
  const [useRAG, setUseRAG] = useState(true); // Enable RAG mode for full analysis
  const [useMCP, setUseMCP] = useState(true); // Model Context Protocol mode for full analysis
  const [useHybrid, setUseHybrid] = useState(true); // Hybrid RAG + MCP mode for full analysis
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isGeneratingWeeklyPlan, setIsGeneratingWeeklyPlan] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Load profile data on component mount
  useEffect(() => {
    const loadProfileData = () => {
      console.log('FitnessAdvisorPage: Loading profile data...');
      
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          console.log('FitnessAdvisorPage: Profile data loaded:', profile);
          
          // Handle gender field with both sex and gender field names
          const profileGender = profile.sex || profile.gender;
          if (!gender && profileGender) {
            console.log('FitnessAdvisorPage: Setting gender to:', profileGender);
            setGender(profileGender);
          }
          
          // Only auto-fill if the fields are empty
          if (!age && profile.age) setAge(profile.age);
          if (!weight && profile.weight) setWeight(profile.weight);
          if (!height && profile.height) setHeight(profile.height);
          if (!healthConditions && profile.healthConditions) setHealthConditions(profile.healthConditions);
          
          // Map fitness agent to existing options
          const agentMapping = {
            'personal_trainer': 'general',
            'strength_coach': 'strength',
            'cardio_specialist': 'cardio',
            'nutrition_expert': 'general',
            'weight_loss_coach': 'weight_loss',
            'muscle_building_coach': 'muscle_gain'
          };
          
          if (profile.fitnessAgent || profile.agentType) {
            const agentValue = profile.fitnessAgent || profile.agentType;
            setAgentType(agentMapping[agentValue] || 'general');
          }
          
          // Only show profile loaded message if we actually loaded some data
          if (profileGender || profile.age || profile.weight || profile.height || profile.fitnessAgent || profile.agentType || profile.healthConditions) {
            setProfileLoaded(true);
          }
        } catch (error) {
          console.error('FitnessAdvisorPage: Error loading profile data:', error);
        }
      }
      
      // Also check for user-specific profile data if user is available
      if (user?.email) {
        const userSpecificProfile = localStorage.getItem(`userProfile_${user.email}`);
        if (userSpecificProfile) {
          try {
            const profile = JSON.parse(userSpecificProfile);
            console.log('FitnessAdvisorPage: User-specific profile loaded:', profile);
            
            const profileGender = profile.sex || profile.gender;
            if (!gender && profileGender) {
              setGender(profileGender);
            }
            
            if (!age && profile.age) setAge(profile.age);
            if (!weight && profile.weight) setWeight(profile.weight);
            if (!height && profile.height) setHeight(profile.height);
          } catch (error) {
            console.error('FitnessAdvisorPage: Error loading user-specific profile:', error);
          }
        }
      }
    };
    
    loadProfileData();
  }, [user]); // Include user in dependency array

  useEffect(() => {
    if (showVideo) {
      startVideoStream();
    } else {
      stopVideoStream();
    }
    return () => stopVideoStream(); // Cleanup on unmount
  }, [showVideo]);

  const startVideoStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Error accessing camera. Please ensure permissions are granted.');
      setShowVideo(false);
    }
  };

  const stopVideoStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Function to save profile data when form fields are updated
  const saveProfileData = (updatedData) => {
    try {
      setProfileSaving(true);
      
      const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const updatedProfile = { ...currentProfile, ...updatedData };
      
      // Ensure gender/sex field consistency - store both for compatibility
      if (updatedData.sex) {
        updatedProfile.gender = updatedData.sex; // Also store as gender
      }
      if (updatedData.gender) {
        updatedProfile.sex = updatedData.gender; // Also store as sex
      }
      
      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      console.log('FitnessAdvisorPage: Profile saved:', updatedProfile);

      // Also update registered user data if user is registered
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.id) {
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const userIndex = registeredUsers.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
          registeredUsers[userIndex] = {
            ...registeredUsers[userIndex],
            ...updatedData
          };
          
          // Ensure consistency in registered users too
          if (updatedData.sex) {
            registeredUsers[userIndex].gender = updatedData.sex;
          }
          if (updatedData.gender) {
            registeredUsers[userIndex].sex = updatedData.gender;
          }
          
          localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        }
      }
      
      // Also store user-specific profile if user email is available
      if (user?.email) {
        localStorage.setItem(`userProfile_${user.email}`, JSON.stringify(updatedProfile));
      }

      // Brief feedback - hide after 1 second
      setTimeout(() => {
        setProfileSaving(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error saving profile data:', error);
      setProfileSaving(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
    setShowVideo(false); // Hide video if files are selected
  };

  // Handlers for form field changes that also save to profile
  const handleGenderChange = (e) => {
    const value = e.target.value;
    setGender(value);
    if (value) {
      saveProfileData({ sex: value });
    }
  };

  const handleAgeChange = (e) => {
    const value = e.target.value;
    setAge(value);
    if (value && !isNaN(value)) {
      saveProfileData({ age: value });
    }
  };

  const handleWeightChange = (e) => {
    const value = e.target.value;
    setWeight(value);
    if (value && !isNaN(value)) {
      saveProfileData({ weight: value });
    }
  };

  const handleHeightChange = (e) => {
    const value = e.target.value;
    setHeight(value);
    if (value && !isNaN(value)) {
      saveProfileData({ height: value });
    }
  };

  const handleHealthConditionsChange = (e) => {
    const value = e.target.value;
    setHealthConditions(value);
    if (value.trim()) {
      saveProfileData({ healthConditions: value });
    }
  };

  const handleAgentTypeChange = (e) => {
    const value = e.target.value;
    setAgentType(value);
    
    // Map back to detailed fitness agent names for profile
    const reverseAgentMapping = {
      'general': 'personal_trainer',
      'strength': 'strength_coach',
      'cardio': 'cardio_specialist',
      'weight_loss': 'weight_loss_coach',
      'muscle_gain': 'muscle_building_coach'
    };
    
    const fitnessAgent = reverseAgentMapping[value] || 'personal_trainer';
    saveProfileData({ fitnessAgent });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gender || !age || !weight) {
      setError('Please fill in all personal details.');
      return;
    }
    setLoading(true);
    
    // Set loading message for full analysis mode
    const loadingMsg = 'Using Full Analysis for comprehensive fitness recommendations (45-60s)...';
    
    setLoadingMessage(loadingMsg);
    setError('');
    setRecommendation('');
    setCapturedImages([]); // Clear previous images
    
    // Convert uploaded files to base64 for display
    const imageDataUrls = [];
    for (const file of selectedFiles) {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      imageDataUrls.push(dataUrl);
    }
    setCapturedImages(imageDataUrls);
    
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });
    formData.append('gender', gender);
    formData.append('age', age);
    formData.append('weight', weight);
    formData.append('height', height);
    formData.append('health_conditions', healthConditions);
    formData.append('agent_type', agentType);
    formData.append('user_email', user?.email || ''); // Add user email for Azure Search storage
    formData.append('fast_mode', fastMode.toString());
    formData.append('use_rag', useRAG.toString());
    formData.append('use_mcp', useMCP.toString());
    formData.append('use_hybrid', (useHybrid || (useRAG && useMCP)).toString());
    
    // Debug logging
    console.log('FitnessAdvisorPage: Sending analysis mode parameters:', {
      fastMode: fastMode.toString(),
      useRAG: useRAG.toString(),
      useMCP: useMCP.toString(),
      useHybrid: (useHybrid || (useRAG && useMCP)).toString()
    });

    try {
      const response = await axios.post(getApiUrl('/fitness_recommendation'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 1 minute timeout for Agentic RAG analysis
      });
      setRecommendation(response.data.recommendation);
      
      // Save the recommendation to localStorage with timestamp
      const recommendationData = {
        recommendation: response.data.recommendation,
        timestamp: new Date().toISOString(),
        capturedImages: capturedImages, // Include images with the recommendation
        userProfile: {
          gender,
          age,
          weight,
          healthConditions,
          agentType
        },
        analysisMode: useHybrid || (useRAG && useMCP) ? 'Full Analysis' : 
                     fastMode ? 'Quick Analysis' : 'Enhanced Analysis',
        dateCreated: new Date().toLocaleDateString()
      };
      
      // Save to localStorage with user-specific keys
      if (user && user.email) {
        const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
        const userSpecificHistoryKey = `fitnessRecommendationHistory_${user.email}`;
        
        localStorage.setItem(userSpecificLatestKey, JSON.stringify(recommendationData));
        
        // Also add to recommendation history
        const history = JSON.parse(localStorage.getItem(userSpecificHistoryKey) || '[]');
        history.unshift(recommendationData); // Add to beginning of array
        // Keep only last 10 recommendations
        if (history.length > 10) {
          history.splice(10);
        }
        localStorage.setItem(userSpecificHistoryKey, JSON.stringify(history));
      } else {
        console.warn('No user available, recommendation not saved to localStorage');
      }
      
      // Dispatch custom event to notify other components (like Dashboard) of the update
      window.dispatchEvent(new CustomEvent('recommendationUpdated', { 
        detail: recommendationData 
      }));
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Full Analysis with MCP can take several minutes. Please try again or switch to Quick Analysis mode.');
      } else {
        setError('Failed to get recommendation. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleCaptureAndRecommend = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (!gender || !age || !weight) {
      setError('Please fill in all personal details before capturing.');
      return;
    }

    const video = videoRef.current;

    // Ensure video is ready and has dimensions
    if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
      setError("Video stream is not ready yet. Please try again in a moment.");
      return;
    }

    setLoading(true);
    setLoadingMessage('Capturing image...');
    setError('');
    setRecommendation('');
    setCapturedImages([]); // Clear previous images

    // Add a small delay to ensure the frame is current
    setTimeout(async () => {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to capture image from video. Blob is null.');
          setLoading(false);
          setLoadingMessage('');
          return;
        }
        
        // Convert captured image to base64 for display
        const reader = new FileReader();
        reader.onload = (e) => {
          setCapturedImages([e.target.result]);
        };
        reader.readAsDataURL(blob);
        
        setLoadingMessage('Processing image and generating fitness recommendations...');
        
        const formData = new FormData();
        formData.append('images', blob, 'captured_image.jpg');
        formData.append('gender', gender);
        formData.append('age', age);
        formData.append('weight', weight);
        formData.append('height', height);
        formData.append('health_conditions', healthConditions);
        formData.append('agent_type', agentType);
        formData.append('user_email', user?.email || ''); // Add user email for Azure Search storage
        formData.append('fast_mode', fastMode.toString());
        formData.append('use_rag', useRAG.toString());
        formData.append('use_mcp', useMCP.toString());
        formData.append('use_hybrid', (useHybrid || (useRAG && useMCP)).toString());
        
        // Debug logging
        console.log('FitnessAdvisorPage: Sending analysis mode parameters (camera):', {
          fastMode: fastMode.toString(),
          useRAG: useRAG.toString(),
          useMCP: useMCP.toString(),
          useHybrid: (useHybrid || (useRAG && useMCP)).toString()
        });

        try {
          const response = await axios.post(getApiUrl('/fitness_recommendation'), formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000, // 1 minute timeout for Agentic RAG analysis
          });
          setRecommendation(response.data.recommendation);
          
          // Save the recommendation to localStorage with timestamp
          const recommendationData = {
            recommendation: response.data.recommendation,
            timestamp: new Date().toISOString(),
            capturedImages: capturedImages, // Include captured image
            userProfile: {
              gender,
              age,
              weight,
              healthConditions,
              agentType
            },
            analysisMode: useHybrid || (useRAG && useMCP) ? 'Full Analysis' : 
                         fastMode ? 'Quick Analysis' : 'Enhanced Analysis',
            dateCreated: new Date().toLocaleDateString(),
            capturedFromCamera: true
          };
          
          // Save to localStorage with user-specific keys
          if (user && user.email) {
            const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
            const userSpecificHistoryKey = `fitnessRecommendationHistory_${user.email}`;
            
            localStorage.setItem(userSpecificLatestKey, JSON.stringify(recommendationData));
            
            // Also add to recommendation history
            const history = JSON.parse(localStorage.getItem(userSpecificHistoryKey) || '[]');
            history.unshift(recommendationData);
            if (history.length > 10) {
              history.splice(10);
            }
            localStorage.setItem(userSpecificHistoryKey, JSON.stringify(history));
          } else {
            console.warn('No user available, recommendation not saved to localStorage');
          }
          
          // Dispatch custom event to notify other components (like Dashboard) of the update
          window.dispatchEvent(new CustomEvent('recommendationUpdated', { 
            detail: recommendationData 
          }));
        } catch (err) {
          if (err.code === 'ECONNABORTED') {
            setError('Request timed out. Full Analysis with MCP can take several minutes. Please try again or switch to Quick Analysis mode.');
          } else {
            setError('Failed to get recommendation from captured image. Please try again.');
          }
        } finally {
          setLoading(false);
          setLoadingMessage('');
          setShowVideo(false); // Hide video after capture
        }
      }, 'image/jpeg', 0.8); // Reduced quality for faster upload
    }, 100); // 100ms delay
  };

  const generateWeeklyPlan = async () => {
    if (!recommendation) {
      alert('Please generate a fitness recommendation first.');
      return;
    }

    setIsGeneratingWeeklyPlan(true);
    
    try {
      const userProfile = {
        gender: gender,
        age: age,
        weight: weight,
        agentType: agentType,
        healthConditions: healthConditions
      };

      const response = await fetch(getApiUrl('/generate-weekly-plan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userProfile: userProfile,
          baseRecommendation: recommendation
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate weekly plan');
      }

      const data = await response.json();
      
      const weeklyPlanData = {
        ...data,
        dateCreated: new Date().toISOString(),
        userProfile: userProfile
      };
      
      // Save to localStorage
      if (user && user.email) {
        const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
        localStorage.setItem(userSpecificWeeklyKey, JSON.stringify(weeklyPlanData));
      }
      
      // Navigate to weekly plan page
      navigate('/weekly-plan');
      
    } catch (error) {
      console.error('Error generating weekly plan:', error);
      alert('Failed to generate weekly plan. Please try again.');
    } finally {
      setIsGeneratingWeeklyPlan(false);
    }
  };

  return (
    <div className="container">
      <h2 className="mb-4">FitFusion AI</h2>

      {/* Profile Status */}
      {profileLoaded && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="fas fa-check-circle me-2"></i>
          <strong>Profile data loaded!</strong> Your personal information has been automatically filled in. You can update it in your <a href="/profile" className="alert-link">Profile page</a> if needed.
          <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      )}

      {/* Profile Saving Indicator */}
      {profileSaving && (
        <div className="alert alert-info py-2 fade show" role="alert">
          <i className="fas fa-save me-2"></i>
          <small>Saving to profile...</small>
        </div>
      )}

      {/* User Details Form */}
      <div className="row mb-3">
        <div className="col-12 mb-2">
          <small className="text-muted">
            <i className="fas fa-info-circle me-1"></i>
            Your information is automatically saved to your profile as you update it.
          </small>
        </div>
        <div className="col-md-3">
          <label htmlFor="agentType" className="form-label">Fitness Coach</label>
          <select id="agentType" className="form-select" value={agentType} onChange={handleAgentTypeChange} required>
            <option value="general">General Fitness</option>
            <option value="weight_loss">Weight Loss</option>
            <option value="muscle_gain">Muscle Building</option>
            <option value="cardio">Cardio Focus</option>
            <option value="strength">Strength Training</option>
          </select>
        </div>
        <div className="col-md-3">
          <label htmlFor="gender" className="form-label">Gender</label>
          <select id="gender" className="form-select" value={gender} onChange={handleGenderChange} required>
            <option value="" disabled>Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="col-md-3">
          <label htmlFor="age" className="form-label">Age</label>
          <input type="number" id="age" className="form-control" value={age} onChange={handleAgeChange} placeholder="e.g., 25" required />
        </div>
        <div className="col-md-3">
          <label htmlFor="weight" className="form-label">Weight (lbs)</label>
          <input type="number" id="weight" className="form-control" value={weight} onChange={handleWeightChange} placeholder="e.g., 150" required />
        </div>
        <div className="col-md-3">
          <label htmlFor="height" className="form-label">Height (inches)</label>
          <input type="number" id="height" className="form-control" value={height} onChange={handleHeightChange} placeholder="e.g., 70" required />
        </div>
      </div>

      {/* Health Conditions and Preferences */}
      <div className="row mb-3">
        <div className="col-12">
          <label htmlFor="healthConditions" className="form-label">
            <i className="fas fa-heart text-danger me-1"></i>
            Health Conditions & Exercise Preferences <span className="text-muted">(Optional)</span>
          </label>
          <textarea 
            id="healthConditions" 
            className="form-control" 
            value={healthConditions} 
            onChange={handleHealthConditionsChange}
            placeholder="e.g., Lower back pain, knee injury, pregnant, beginner to exercise, prefer low-impact workouts, avoid jumping exercises, etc."
            rows="3"
          />
          <div className="form-text">
            <i className="fas fa-info-circle me-1"></i>
            Share any health conditions, injuries, physical limitations, or exercise preferences to get safer and more personalized recommendations.
          </div>
        </div>
      </div>

      {/* Video Feed Section */}
      {showVideo && (
        <div className="mb-3">
          <video ref={videoRef} autoPlay playsInline className="img-fluid border rounded" style={{ maxWidth: '100%', maxHeight: '400px' }}></video>
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          <button 
            type="button" 
            className="btn btn-success mt-2 me-2"
            onClick={handleCaptureAndRecommend} 
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {loadingMessage || 'Analyzing...'}
              </>
            ) : (
              'Capture & Get Recommendation'
            )}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary mt-2"
            onClick={() => setShowVideo(false)} 
            disabled={loading}
          >
            Close Camera
          </button>
        </div>
      )}

      {/* File Upload Section (hide if video is shown) */}
      {!showVideo && (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="images" className="form-label">Upload Images (front, side, back, etc.)</label>
            <input
              type="file"
              id="images"
              className="form-control"
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
          </div>
          <button type="submit" className="btn btn-primary me-2" disabled={loading || selectedFiles.length === 0}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {loadingMessage || 'Analyzing...'}
              </>
            ) : (
              'Get Recommendation from Files'
            )}
          </button>
          <button 
            type="button" 
            className="btn btn-info"
            onClick={() => { setShowVideo(true); setSelectedFiles([]); /* Clear file selection */ }}
            disabled={loading}
          >
            Use Camera
          </button>
        </form>
      )}

      {error && <div className="alert alert-danger mt-3">{error}</div>}
      
      {loading && (
        <div className="alert alert-info mt-3">
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-3" role="status" aria-hidden="true"></div>
            <div>
              <strong>{loadingMessage || 'Processing...'}</strong>
              <div className="small mt-1">
                Full analysis: 45-90 seconds with comprehensive recommendations using all available technologies
              </div>
            </div>
          </div>
        </div>
      )}
      
      {recommendation && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card border-success">
              <div className="card-header bg-success text-white">
                <h5 className="mb-0">
                  <i className="fas fa-check-circle me-2"></i>
                  Your Personalized Fitness Analysis
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* Images Column */}
                  {capturedImages.length > 0 && (
                    <div className="col-md-4">
                      <h6 className="text-primary mb-3">
                        <i className="fas fa-camera me-2"></i>
                        Images Analyzed
                      </h6>
                      <div className="row">
                        {capturedImages.map((imageUrl, index) => (
                          <div key={index} className="col-12 mb-3">
                            <div className="card">
                              <img 
                                src={imageUrl} 
                                className="card-img-top" 
                                alt={`Analyzed image ${index + 1}`}
                                style={{ 
                                  maxHeight: '200px', 
                                  objectFit: 'cover',
                                  borderRadius: '8px'
                                }}
                              />
                              <div className="card-body py-2">
                                <small className="text-muted">
                                  <i className="fas fa-eye me-1"></i>
                                  Image {index + 1} - Analyzed by AI
                                </small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recommendation Column */}
                  <div className={capturedImages.length > 0 ? "col-md-8" : "col-12"}>
                    <h6 className="text-success mb-3">
                      <i className="fas fa-dumbbell me-2"></i>
                      Comprehensive Fitness Recommendation
                    </h6>
                    <div 
                      className="recommendation-content"
                      style={{ 
                        whiteSpace: 'pre-line',
                        maxHeight: '600px',
                        overflowY: 'auto',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        padding: '1rem',
                        backgroundColor: '#f8f9fa'
                      }}
                    >
                      {recommendation}
                    </div>
                    
                    <div className="mt-3">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <small className="text-muted">
                          <i className="fas fa-robot me-1"></i>
                          Generated by AI Fitness Expert
                        </small>
                        <div className="d-flex gap-2">
                          <button 
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(recommendation);
                              // You could add a toast notification here
                            }}
                          >
                            <i className="fas fa-copy me-1"></i>
                            Copy
                          </button>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => window.open('/', '_self')}
                          >
                            <i className="fas fa-tachometer-alt me-1"></i>
                            View Dashboard
                          </button>
                        </div>
                      </div>
                      
                      {/* Weekly Plan Generation */}
                      <div className="border-top pt-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="mb-1 text-success">
                              <i className="fas fa-calendar-week me-2"></i>
                              Ready for a Complete Weekly Plan?
                            </h6>
                            <small className="text-muted">
                              Generate a structured 7-day workout schedule based on your recommendation
                            </small>
                          </div>
                          <button 
                            className="btn btn-success"
                            onClick={generateWeeklyPlan}
                            disabled={isGeneratingWeeklyPlan}
                          >
                            {isGeneratingWeeklyPlan ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Generating...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-calendar-plus me-2"></i>
                                Generate Weekly Plan
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FitnessAdvisorPage;
