import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IoSearch, IoCamera, IoImages, IoTrash } from 'react-icons/io5';

function IdentifyFoodPageMobile({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [analysisType, setAnalysisType] = useState('food');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [stream, setStream] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const profile = localStorage.getItem('userProfile');
    if (profile) {
      setUserProfile(JSON.parse(profile));
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setAnalysisResult(null);
        setError(null);
        setShowResults(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Use native camera on mobile
  const handleTakePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      
      setSelectedImage(image.dataUrl);
      setAnalysisResult(null);
      setShowResults(false);
    } catch (error) {
      if (error.message !== 'User cancelled photos app') {
        setError('Failed to capture photo. Please try again.');
      }
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      
      setSelectedImage(image.dataUrl);
      setAnalysisResult(null);
      setShowResults(false);
    } catch (error) {
      if (error.message !== 'User cancelled photos app') {
        setError('Failed to select photo. Please try again.');
      }
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    setError(null);
    setShowCamera(false);
    setShowResults(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      setShowCamera(true);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        } 
      });
      
      setStream(mediaStream);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions or use file upload.');
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && stream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedImage(e.target.result);
          setShowCamera(false);
          setAnalysisResult(null);
          setShowResults(false);
          
          try {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            if (fileInputRef.current) {
              fileInputRef.current.files = dataTransfer.files;
            }
          } catch (error) {
            console.log('File input update failed:', error);
          }
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.85);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const stopCamera = () => {
    setShowCamera(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleAnalyzeFood = async () => {
    console.log('[IdentifyFood] === STARTING FOOD ANALYSIS ===');
    console.log('[IdentifyFood] Selected image:', selectedImage);
    
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    let fileToUpload = null;
    
    if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]) {
      fileToUpload = fileInputRef.current.files[0];
      console.log('[IdentifyFood] Using file input:', fileToUpload.name);
    } else if (selectedImage) {
      try {
        console.log('[IdentifyFood] Converting camera image to file...');
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        console.log('[IdentifyFood] Blob size:', blob.size, 'bytes');
        fileToUpload = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      } catch (error) {
        console.error('[IdentifyFood] Failed to convert image:', error);
        setError('Failed to process image. Please try again.');
        return;
      }
    }

    if (!fileToUpload) {
      console.error('[IdentifyFood] No file to upload');
      setError('No image file available for analysis');
      return;
    }

    console.log('[IdentifyFood] File ready:', fileToUpload.name, fileToUpload.size, 'bytes');
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', fileToUpload);
      formData.append('analysis_type', analysisType);
      
      if (userProfile) {
        formData.append('user_email', userProfile.email || '');
        formData.append('fitness_goal', userProfile.fitnessGoal || 'general');
        formData.append('dietary_restrictions', userProfile.dietaryRestrictions || '');
      }

      const token = localStorage.getItem('token');
      console.log('[IdentifyFood] Token exists:', !!token);
      
      // Don't set Content-Type for multipart/form-data - let axios set the boundary
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('[IdentifyFood] Sending request to:', getApiUrl('/identify_food'));
      console.log('[IdentifyFood] Analysis type:', analysisType);
      
      const response = await axios.post(getApiUrl('/identify_food'), formData, {
        headers: headers,
        timeout: 90000, // Increase timeout for image analysis
      });

      console.log('[IdentifyFood] Response received:', response.status);
      console.log('[IdentifyFood] Response data:', response.data);

      if (response.data.success) {
        const analysis = response.data.food_analysis;
        
        if (analysis && analysis.recipes) {
          if (!Array.isArray(analysis.recipes)) {
            analysis.recipes = [];
          } else {
            analysis.recipes = analysis.recipes.filter(recipe => 
              recipe && typeof recipe === 'object'
            );
          }
        }

        if (analysis && analysisType === 'ingredient' && analysis.identified_ingredients) {
          if (!Array.isArray(analysis.identified_ingredients)) {
            analysis.identified_ingredients = [analysis.identified_ingredients];
          }
        }

        if (analysis && analysisType === 'food' && analysis.identified_foods) {
          if (!Array.isArray(analysis.identified_foods)) {
            analysis.identified_foods = [analysis.identified_foods];
          }
        }

        setAnalysisResult(analysis);
        setShowResults(true);
      } else {
        console.error('[IdentifyFood] Analysis failed:', response.data.error);
        setError(response.data.error || 'Failed to analyze image');
      }
    } catch (error) {
      console.error('[IdentifyFood] Error analyzing food:', error);
      console.error('[IdentifyFood] Error response:', error.response?.data);
      console.error('[IdentifyFood] Error status:', error.response?.status);
      
      if (error.code === 'ECONNABORTED') {
        setError('Request timed out. The image analysis is taking too long. Please try again with a clearer photo.');
      } else if (error.response?.status === 401) {
        setError('Authentication failed. Please log out and log in again.');
      } else if (error.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError(error.response?.data?.error || error.message || 'Failed to analyze image');
      }
    } finally {
      console.log('[IdentifyFood] Analysis complete, isLoading set to false');
      setIsLoading(false);
    }
  };

  if (showCamera) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          
          {!stream && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'white'
            }}>
              <div>Starting camera...</div>
            </div>
          )}
        </div>
        
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {error && (
            <div style={{ 
              padding: '12px',
              backgroundColor: '#ff3b30',
              color: 'white',
              borderRadius: '12px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="ios-button ios-button-secondary"
              onClick={stopCamera}
              disabled={!stream}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              className="ios-button"
              onClick={capturePhoto}
              disabled={!stream}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <IoSearch size={20} />
              <span>Capture Photo</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && analysisResult) {
    return (
      <div style={{ paddingBottom: '80px' }}>
        <div className="ios-nav-bar">
          <button className="ios-nav-back" onClick={() => {
            setShowResults(false);
            setAnalysisResult(null);
          }}>
            ← Back
          </button>
          <h1 className="ios-nav-title">Analysis Results</h1>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Image Preview */}
          {selectedImage && (
            <div className="ios-card" style={{ marginBottom: '16px', padding: '8px' }}>
              <img 
                src={selectedImage} 
                alt="Analyzed" 
                style={{ 
                  width: '100%', 
                  borderRadius: '12px',
                  maxHeight: '200px',
                  objectFit: 'cover'
                }}
              />
            </div>
          )}

          {/* Food Analysis Results */}
          {analysisType === 'food' && (
            <>
              {/* Identified Foods */}
              <div className="ios-card" style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: '600' }}>
                  🍽️ Identified Foods
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {analysisResult.identified_foods?.map((food, index) => (
                    <span key={index} style={{
                      backgroundColor: 'var(--ios-blue)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '14px'
                    }}>
                      {food}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--ios-secondary-label)' }}>
                  <div><strong>Portion:</strong> {analysisResult.portion_estimate}</div>
                  <div><strong>Confidence:</strong> {analysisResult.confidence}</div>
                </div>
              </div>

              {/* Nutrition Facts */}
              {analysisResult.nutrition && (
                <div className="ios-card" style={{ marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: '600' }}>
                    📊 Nutrition Facts
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--ios-system-gray6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{analysisResult.nutrition.calories}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Calories</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--ios-system-gray6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{analysisResult.nutrition.protein}g</div>
                      <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Protein</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--ios-system-gray6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{analysisResult.nutrition.carbohydrates}g</div>
                      <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Carbs</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--ios-system-gray6)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{analysisResult.nutrition.fat}g</div>
                      <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Fat</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Health Assessment */}
              {analysisResult.health_assessment && (
                <div className="ios-card" style={{ marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: '600' }}>
                    ❤️ Health Assessment
                  </h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Rating:</strong>{' '}
                      <span style={{
                        backgroundColor: analysisResult.health_assessment.overall_rating === 'excellent' ? 'var(--ios-green)' :
                                       analysisResult.health_assessment.overall_rating === 'good' ? 'var(--ios-blue)' :
                                       analysisResult.health_assessment.overall_rating === 'moderate' ? 'var(--ios-orange)' : 'var(--ios-red)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}>
                        {analysisResult.health_assessment.overall_rating}
                      </span>
                    </div>
                    <div><strong>Goal Alignment:</strong> {analysisResult.health_assessment.fitness_goal_alignment}</div>
                    <div><strong>Quality:</strong> {analysisResult.health_assessment.nutritional_quality}</div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations && (
                <div className="ios-card">
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: '600' }}>
                    💡 Recommendations
                  </h3>
                  <div style={{ 
                    backgroundColor: analysisResult.recommendations.should_eat ? '#d1f2eb' : '#fff3cd',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <strong>Should you eat this?</strong>{' '}
                    <span style={{ fontWeight: '600' }}>
                      {analysisResult.recommendations.should_eat ? '✅ Yes' : '⚠️ Consider alternatives'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div><strong>Portion Advice:</strong> {analysisResult.recommendations.portion_advice}</div>
                    <div><strong>Best Timing:</strong> {analysisResult.recommendations.timing}</div>
                    {analysisResult.recommendations.alternatives?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <strong>Healthier Alternatives:</strong>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                          {analysisResult.recommendations.alternatives.map((alt, index) => (
                            <li key={index}>{alt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ingredient Analysis Results */}
          {analysisType === 'ingredient' && (
            <>
              {/* Identified Ingredients */}
              <div className="ios-card" style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: '600' }}>
                  🌱 Identified Ingredients
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {analysisResult.identified_ingredients?.map((ingredient, index) => (
                    <span key={index} style={{
                      backgroundColor: 'var(--ios-green)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '14px'
                    }}>
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recipes */}
              {analysisResult.recipes && analysisResult.recipes.length > 0 && (
                <div>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '17px', 
                    fontWeight: '600',
                    padding: '0 16px'
                  }}>
                    📖 Healthy Recipes ({analysisResult.recipes.length})
                  </h3>
                  {analysisResult.recipes.map((recipe, index) => (
                    <div key={index} className="ios-card" style={{ marginBottom: '12px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--ios-blue)' }}>
                        {recipe.name || `Recipe ${index + 1}`}
                      </h4>
                      {recipe.description && (
                        <p style={{ fontSize: '14px', color: 'var(--ios-secondary-label)', marginBottom: '12px' }}>
                          {recipe.description}
                        </p>
                      )}
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px' }}>
                          <strong>Prep Time:</strong> {recipe.prep_time || 'N/A'}
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          <strong>Difficulty:</strong>{' '}
                          <span style={{
                            backgroundColor: recipe.difficulty === 'easy' ? 'var(--ios-green)' :
                                           recipe.difficulty === 'medium' ? 'var(--ios-orange)' : 'var(--ios-red)',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}>
                            {recipe.difficulty || 'Medium'}
                          </span>
                        </div>
                      </div>

                      {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <strong style={{ fontSize: '14px' }}>Ingredients:</strong>
                          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                            {recipe.ingredients.map((ing, idx) => (
                              <li key={idx}>{ing}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {recipe.instructions && (
                        <div style={{ marginBottom: '12px' }}>
                          <strong style={{ fontSize: '14px' }}>Instructions:</strong>
                          <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--ios-secondary-label)' }}>
                            {recipe.instructions}
                          </p>
                        </div>
                      )}

                      {recipe.nutrition_per_serving && (
                        <div style={{ 
                          padding: '12px',
                          backgroundColor: 'var(--ios-system-gray6)',
                          borderRadius: '8px',
                          fontSize: '13px'
                        }}>
                          <strong>Nutrition per serving:</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginTop: '8px' }}>
                            <div>Calories: {recipe.nutrition_per_serving.calories || 'N/A'}</div>
                            <div>Protein: {recipe.nutrition_per_serving.protein || 'N/A'}g</div>
                            <div>Carbs: {recipe.nutrition_per_serving.carbohydrates || 'N/A'}g</div>
                            <div>Fat: {recipe.nutrition_per_serving.fat || 'N/A'}g</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="ios-nav-bar">
        <h1 className="ios-nav-title">
          Food Analysis 
          <span style={{
            marginLeft: '8px',
            backgroundColor: '#FF9500',
            color: 'white',
            fontSize: '11px',
            fontWeight: '700',
            padding: '3px 6px',
            borderRadius: '6px'
          }}>
            BETA
          </span>
        </h1>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Analysis Type Selector */}
        <div className="ios-segmented-control" style={{ marginBottom: '16px' }}>
          <button
            className={analysisType === 'food' ? 'active' : ''}
            onClick={() => {
              setAnalysisType('food');
              handleClearImage();
            }}
          >
            🍽️ Analyze Food
          </button>
          <button
            className={analysisType === 'ingredient' ? 'active' : ''}
            onClick={() => {
              setAnalysisType('ingredient');
              handleClearImage();
            }}
          >
            🌱 Get Recipes
          </button>
        </div>

        <div className="ios-card" style={{ marginBottom: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--ios-secondary-label)', margin: 0 }}>
            {analysisType === 'food' 
              ? 'Analyze prepared meals and get nutritional insights'
              : 'Upload ingredients and get healthy recipe suggestions'
            }
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="ios-card" style={{ 
            marginBottom: '16px',
            backgroundColor: '#ffe6e6',
            borderLeft: '4px solid var(--ios-red)'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--ios-red)' }}>
              {error}
            </div>
          </div>
        )}

        {/* Image Preview or Upload */}
        {selectedImage ? (
          <div className="ios-card" style={{ marginBottom: '16px', padding: '8px' }}>
            <img 
              src={selectedImage} 
              alt="Selected" 
              style={{ 
                width: '100%', 
                borderRadius: '12px',
                maxHeight: '300px',
                objectFit: 'cover',
                marginBottom: '12px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="ios-button ios-button-secondary"
                onClick={handleClearImage}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <IoTrash size={18} />
                <span>Clear</span>
              </button>
              <button 
                className="ios-button"
                onClick={handleAnalyzeFood}
                disabled={isLoading}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isLoading ? '⏳ Analyzing...' : (
                  <>
                    <IoSearch size={20} />
                    <span>Analyze</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="ios-card" style={{ marginBottom: '16px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '17px',
              fontWeight: '600',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <IoCamera size={20} />
              <span>Capture Your {analysisType === 'food' ? 'Meal' : 'Ingredients'}</span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="ios-button"
                onClick={handleTakePhoto}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <IoCamera size={20} />
                <span>Take Photo</span>
              </button>
              
              <div style={{ textAlign: 'center', color: 'var(--ios-secondary-label)', fontSize: '14px' }}>
                or
              </div>
              
              <button 
                className="ios-button ios-button-secondary"
                onClick={handlePickFromGallery}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <IoImages size={20} />
                <span>Choose from Gallery</span>
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Features */}
        <div className="ios-card">
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '17px',
            fontWeight: '600'
          }}>
            ℹ️ How It Works
          </h3>
          {analysisType === 'food' ? (
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div>✅ Food Recognition - AI identifies meal components</div>
              <div>✅ Nutritional Analysis - Calorie and macro breakdowns</div>
              <div>✅ Health Assessment - Based on your fitness goals</div>
              <div>✅ Personalized Advice - Recommendations for your plan</div>
            </div>
          ) : (
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div>✅ Ingredient ID - AI identifies your ingredients</div>
              <div>✅ Recipe Suggestions - Get 3+ healthy recipes</div>
              <div>✅ Nutrition Info - Calories and macros per serving</div>
              <div>✅ Fitness Aligned - Recipes match your goals</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IdentifyFoodPageMobile;
