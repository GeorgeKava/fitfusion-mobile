import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';

// Error Boundary Component to catch rendering errors
class RecipeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Recipe rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-warning">
          <i className="fas fa-exclamation-triangle me-2"></i>
          <strong>Recipe Display Error:</strong> Unable to display recipes due to data formatting issues. 
          Please try analyzing the image again.
        </div>
      );
    }

    return this.props.children;
  }
}

function IdentifyFoodPage({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [analysisType, setAnalysisType] = useState('food'); // 'food' or 'ingredient'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Load user profile for personalized analysis
    const profile = localStorage.getItem('userProfile');
    if (profile) {
      setUserProfile(JSON.parse(profile));
    }

    // Cleanup camera stream on unmount
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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    setError(null);
    setShowCamera(false);
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
      setShowCamera(true); // Show camera UI immediately
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'environment' // Use back camera on mobile if available
        } 
      });
      
      setStream(mediaStream);
      
      // Wait for video element to be available and set stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check your permissions or use file upload instead.');
      setShowCamera(false); // Hide camera UI if failed
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && stream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas (flip back since video was mirrored)
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();
      
      // Convert canvas to blob and create image URL
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedImage(e.target.result);
          setShowCamera(false);
          setAnalysisResult(null);
          
          // Try to create a file object for form submission (optional, as handleAnalyzeFood will handle this)
          try {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            if (fileInputRef.current) {
              fileInputRef.current.files = dataTransfer.files;
            }
          } catch (error) {
            console.log('File input update failed, will create file during analysis:', error);
            // This is OK - handleAnalyzeFood will create the file from selectedImage
          }
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.8);
      
      // Stop camera stream
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
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    // Check if we have a file in the input or if we need to create one from selectedImage
    let fileToUpload = null;
    
    if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]) {
      fileToUpload = fileInputRef.current.files[0];
    } else if (selectedImage) {
      // Create file from base64 image (for camera captures)
      try {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        fileToUpload = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      } catch (error) {
        setError('Failed to process image. Please try again.');
        return;
      }
    }

    if (!fileToUpload) {
      setError('No image file available for analysis');
      return;
    }

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

      const response = await axios.post(getApiUrl('/identify_food'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        // Validate and sanitize the analysis result
        const analysis = response.data.food_analysis;
        
        // Ensure recipes array is properly formatted
        if (analysis && analysis.recipes) {
          if (!Array.isArray(analysis.recipes)) {
            console.warn('Recipes data is not an array, attempting to fix...');
            analysis.recipes = [];
          } else {
            // Filter out invalid recipe objects
            analysis.recipes = analysis.recipes.filter(recipe => 
              recipe && typeof recipe === 'object'
            );
          }
        }

        // Ensure identified_ingredients is an array for ingredient analysis
        if (analysis && analysisType === 'ingredient' && analysis.identified_ingredients) {
          if (!Array.isArray(analysis.identified_ingredients)) {
            analysis.identified_ingredients = [analysis.identified_ingredients];
          }
        }

        // Ensure identified_foods is an array for food analysis
        if (analysis && analysisType === 'food' && analysis.identified_foods) {
          if (!Array.isArray(analysis.identified_foods)) {
            analysis.identified_foods = [analysis.identified_foods];
          }
        }

        setAnalysisResult(analysis);
      } else {
        setError(response.data.error || 'Failed to analyze image');
      }
    } catch (error) {
      console.error('Error analyzing food:', error);
      setError(error.response?.data?.error || 'Failed to analyze image');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFoodAnalysis = (analysis) => {
    return (
      <div className="row">
        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-utensils me-2"></i>
                Identified Foods
              </h5>
            </div>
            <div className="card-body">
              {analysis.identified_foods?.map((food, index) => (
                <span key={index} className="badge bg-primary me-2 mb-2">{food}</span>
              ))}
              <p className="mt-3"><strong>Portion:</strong> {analysis.portion_estimate}</p>
              <p><strong>Confidence:</strong> {analysis.confidence}</p>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">
                <i className="fas fa-chart-pie me-2"></i>
                Nutrition Facts
              </h5>
            </div>
            <div className="card-body">
              {analysis.nutrition && (
                <div className="row">
                  <div className="col-6">
                    <p><strong>Calories:</strong> {analysis.nutrition.calories}</p>
                    <p><strong>Protein:</strong> {analysis.nutrition.protein}g</p>
                    <p><strong>Carbs:</strong> {analysis.nutrition.carbohydrates}g</p>
                  </div>
                  <div className="col-6">
                    <p><strong>Fat:</strong> {analysis.nutrition.fat}g</p>
                    <p><strong>Fiber:</strong> {analysis.nutrition.fiber}g</p>
                    <p><strong>Sodium:</strong> {analysis.nutrition.sodium}mg</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="fas fa-heart me-2"></i>
                Health Assessment
              </h5>
            </div>
            <div className="card-body">
              {analysis.health_assessment && (
                <>
                  <p><strong>Overall Rating:</strong> 
                    <span className={`badge ms-2 ${
                      analysis.health_assessment.overall_rating === 'excellent' ? 'bg-success' :
                      analysis.health_assessment.overall_rating === 'good' ? 'bg-info' :
                      analysis.health_assessment.overall_rating === 'moderate' ? 'bg-warning' : 'bg-danger'
                    }`}>
                      {analysis.health_assessment.overall_rating}
                    </span>
                  </p>
                  <p><strong>Fitness Goal Alignment:</strong> {analysis.health_assessment.fitness_goal_alignment}</p>
                  <p><strong>Nutritional Quality:</strong> {analysis.health_assessment.nutritional_quality}</p>
                  {analysis.health_assessment.food_plan_compatibility && (
                    <p><strong>Food Plan Compatibility:</strong> {analysis.health_assessment.food_plan_compatibility}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-secondary text-white">
              <h5 className="mb-0">
                <i className="fas fa-lightbulb me-2"></i>
                Recommendations
              </h5>
            </div>
            <div className="card-body">
              {analysis.recommendations && (
                <>
                  <div className="alert alert-info">
                    <strong>Should you eat this?</strong> 
                    <span className={`badge ms-2 ${analysis.recommendations.should_eat ? 'bg-success' : 'bg-warning'}`}>
                      {analysis.recommendations.should_eat ? 'Yes' : 'Consider alternatives'}
                    </span>
                  </div>
                  <p><strong>Portion Advice:</strong> {analysis.recommendations.portion_advice}</p>
                  <p><strong>Best Timing:</strong> {analysis.recommendations.timing}</p>
                  {analysis.recommendations.modifications && (
                    <p><strong>Modifications:</strong> {analysis.recommendations.modifications}</p>
                  )}
                  {analysis.recommendations.alternatives?.length > 0 && (
                    <div>
                      <strong>Healthier Alternatives:</strong>
                      <ul className="mt-2">
                        {analysis.recommendations.alternatives.map((alt, index) => (
                          <li key={index}>{alt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {analysis.detailed_analysis && (
          <div className="col-12 mt-3">
            <div className="card">
              <div className="card-header bg-dark text-white">
                <h5 className="mb-0">
                  <i className="fas fa-microscope me-2"></i>
                  Detailed Analysis
                </h5>
              </div>
              <div className="card-body">
                <p>{analysis.detailed_analysis}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderIngredientAnalysis = (analysis) => {
    return (
      <div className="row">
        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-seedling me-2"></i>
                Identified Ingredients
              </h5>
            </div>
            <div className="card-body">
              {analysis.identified_ingredients && Array.isArray(analysis.identified_ingredients) && analysis.identified_ingredients.length > 0 ? (
                analysis.identified_ingredients.map((ingredient, index) => (
                  <span key={index} className="badge bg-primary me-2 mb-2">
                    {ingredient || `Ingredient ${index + 1}`}
                  </span>
                ))
              ) : (
                <span className="text-muted">No ingredients identified</span>
              )}
              <p className="mt-3"><strong>Confidence:</strong> {analysis.confidence || 'Unknown'}</p>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">
                <i className="fas fa-heart me-2"></i>
                Health Benefits
              </h5>
            </div>
            <div className="card-body">
              {analysis.ingredient_benefits && (
                <>
                  <p><strong>Nutritional Value:</strong> {analysis.ingredient_benefits.nutritional_value}</p>
                  <p><strong>Health Properties:</strong> {analysis.ingredient_benefits.health_properties}</p>
                  <p><strong>Fitness Relevance:</strong> {analysis.ingredient_benefits.fitness_relevance}</p>
                </>
              )}
            </div>
          </div>

          {analysis.usage_tips && (
            <div className="card">
              <div className="card-header bg-warning text-dark">
                <h5 className="mb-0">
                  <i className="fas fa-tips me-2"></i>
                  Usage Tips
                </h5>
              </div>
              <div className="card-body">
                <p><strong>Usage Tips:</strong> {analysis.usage_tips}</p>
                {analysis.storage_advice && (
                  <p><strong>Storage:</strong> {analysis.storage_advice}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header bg-purple text-white" style={{backgroundColor: '#6f42c1'}}>
              <h5 className="mb-0">
                <i className="fas fa-book me-2"></i>
                Healthy Recipes ({analysis.recipes?.length || 0})
              </h5>
            </div>
            <div className="card-body" style={{maxHeight: '600px', overflowY: 'auto'}}>
              <RecipeErrorBoundary>
                {analysis.recipes && Array.isArray(analysis.recipes) && analysis.recipes.length > 0 ? (
                  analysis.recipes.map((recipe, index) => {
                    // Safety check for recipe object
                    if (!recipe || typeof recipe !== 'object') {
                      return (
                        <div key={index} className="alert alert-warning">
                          <small>Recipe {index + 1}: Invalid recipe data received</small>
                        </div>
                      );
                    }

                    return (
                      <div key={index} className="recipe-item mb-4 p-3 border rounded">
                        <h6 className="text-primary">
                          <i className="fas fa-utensils me-2"></i>
                          {recipe.name || `Recipe ${index + 1}`}
                        </h6>
                        {recipe.description && (
                          <p className="text-muted">{recipe.description}</p>
                        )}
                        
                        <div className="row mb-2">
                          <div className="col-6">
                            <small><strong>Prep Time:</strong> {recipe.prep_time || 'Not specified'}</small>
                          </div>
                          <div className="col-6">
                            <small><strong>Difficulty:</strong> 
                              <span className={`badge ms-1 ${
                                recipe.difficulty === 'easy' ? 'bg-success' :
                                recipe.difficulty === 'medium' ? 'bg-warning' : 
                                recipe.difficulty === 'hard' ? 'bg-danger' : 'bg-secondary'
                              }`}>
                                {recipe.difficulty || 'Medium'}
                              </span>
                            </small>
                          </div>
                        </div>

                        {recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
                          <div className="mb-2">
                            <strong>Ingredients:</strong>
                            <ul className="list-unstyled ms-3">
                              {recipe.ingredients.map((ing, idx) => (
                                <li key={idx}>• {ing}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {recipe.instructions && (
                          <div className="mb-2">
                            <strong>Instructions:</strong>
                            <p className="ms-3">{recipe.instructions}</p>
                          </div>
                        )}

                        {recipe.nutrition_per_serving && typeof recipe.nutrition_per_serving === 'object' && (
                          <div className="mb-2">
                            <strong>Nutrition per serving:</strong>
                            <div className="row">
                              <div className="col-6">
                                <small>Calories: {recipe.nutrition_per_serving.calories || 'N/A'}</small><br/>
                                <small>Protein: {recipe.nutrition_per_serving.protein || 'N/A'}g</small>
                              </div>
                              <div className="col-6">
                                <small>Carbs: {recipe.nutrition_per_serving.carbohydrates || 'N/A'}g</small><br/>
                                <small>Fat: {recipe.nutrition_per_serving.fat || 'N/A'}g</small>
                              </div>
                            </div>
                          </div>
                        )}

                        {recipe.fitness_benefits && (
                          <div className="alert alert-success py-2">
                            <small><strong>Fitness Benefits:</strong> {recipe.fitness_benefits}</small>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted py-3">
                    <i className="fas fa-info-circle me-2"></i>
                    No recipes available for these ingredients
                  </div>
                )}
              </RecipeErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-lg-12">
          <div className="card shadow-lg">
            <div className="card-header bg-info text-white text-center">
              <h2 className="mb-0">
                <i className="fas fa-camera me-2"></i>
                AI Food Analysis
              </h2>
              <p className="mb-0 mt-2">AI-powered food recognition, nutritional analysis, and recipe suggestions</p>
            </div>
            <div className="card-body p-4">
              
              {/* Analysis Type Selector */}
              <div className="row mb-4">
                <div className="col-12 text-center">
                  <div className="ios-segmented-control" style={{
                    display: 'inline-flex',
                    backgroundColor: '#e5e5ea',
                    borderRadius: '10px',
                    padding: '3px',
                    gap: '0px',
                    maxWidth: '400px',
                    width: '100%'
                  }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: analysisType === 'food' ? '#fff' : 'transparent',
                        color: analysisType === 'food' ? '#000' : '#8e8e93',
                        fontWeight: analysisType === 'food' ? '600' : '500',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: analysisType === 'food' ? '0 3px 8px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.14)' : 'none',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                        zIndex: analysisType === 'food' ? 2 : 1
                      }}
                      onClick={() => {
                        setAnalysisType('food');
                        setAnalysisResult(null);
                        setError(null);
                        setSelectedImage(null);
                        setShowCamera(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                        if (stream) {
                          stream.getTracks().forEach(track => track.stop());
                          setStream(null);
                        }
                      }}
                    >
                      <span style={{ fontSize: '16px', marginRight: '6px' }}>🍽️</span>
                      Analyze Food
                    </button>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: analysisType === 'ingredient' ? '#fff' : 'transparent',
                        color: analysisType === 'ingredient' ? '#000' : '#8e8e93',
                        fontWeight: analysisType === 'ingredient' ? '600' : '500',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: analysisType === 'ingredient' ? '0 3px 8px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.14)' : 'none',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                        zIndex: analysisType === 'ingredient' ? 2 : 1
                      }}
                      onClick={() => {
                        setAnalysisType('ingredient');
                        setAnalysisResult(null);
                        setError(null);
                        setSelectedImage(null);
                        setShowCamera(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                        if (stream) {
                          stream.getTracks().forEach(track => track.stop());
                          setStream(null);
                        }
                      }}
                    >
                      <span style={{ fontSize: '16px', marginRight: '6px' }}>🌱</span>
                      Get Recipes
                    </button>
                  </div>
                  <div className="mt-3" style={{ maxWidth: '500px', margin: '0 auto', marginTop: '12px' }}>
                    <small style={{ 
                      color: '#8e8e93', 
                      fontSize: '13px',
                      lineHeight: '1.4',
                      display: 'block'
                    }}>
                      {analysisType === 'food' 
                        ? 'Analyze prepared meals and get nutritional insights based on your food plan'
                        : 'Upload ingredients and get healthy recipe suggestions tailored to your fitness goals'
                      }
                    </small>
                  </div>
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="card bg-light h-100">
                    <div className="card-body text-center">
                      <h5 className="card-title">
                        <i className="fas fa-upload me-2"></i>
                        Upload {analysisType === 'food' ? 'Food' : 'Ingredient'} Photo
                      </h5>
                      
                      {showCamera ? (
                        <div>
                          <div className="position-relative">
                            <video 
                              ref={videoRef}
                              autoPlay 
                              playsInline
                              muted
                              className="img-fluid rounded mb-3"
                              style={{ 
                                maxHeight: '300px', 
                                width: '100%',
                                objectFit: 'cover',
                                transform: 'scaleX(-1)',
                                backgroundColor: '#000'
                              }}
                            />
                            {!stream && (
                              <div className="position-absolute top-50 start-50 translate-middle text-white">
                                <div className="spinner-border" role="status">
                                  <span className="visually-hidden">Loading camera...</span>
                                </div>
                                <p className="mt-2">Starting camera...</p>
                              </div>
                            )}
                          </div>
                          <canvas ref={canvasRef} style={{ display: 'none' }} />
                          <div>
                            <button 
                              className="btn btn-success btn-sm me-2"
                              onClick={capturePhoto}
                              disabled={!stream}
                            >
                              <i className="fas fa-camera me-1"></i>
                              Capture Photo
                            </button>
                            <button 
                              className="btn btn-outline-secondary btn-sm"
                              onClick={stopCamera}
                            >
                              <i className="fas fa-times me-1"></i>
                              Cancel
                            </button>
                          </div>
                          <small className="text-muted d-block mt-2">
                            Position your {analysisType} in the camera view and click "Capture Photo"
                          </small>
                        </div>
                      ) : selectedImage ? (
                        <div>
                          <img 
                            src={selectedImage} 
                            alt="Selected food/ingredient" 
                            className="img-fluid rounded mb-3"
                            style={{ maxHeight: '200px' }}
                          />
                          <div>
                            <button 
                              className="btn btn-outline-danger btn-sm me-2"
                              onClick={handleClearImage}
                            >
                              <i className="fas fa-trash me-1"></i>
                              Clear Image
                            </button>
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={handleAnalyzeFood}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-magic me-1"></i>
                                  {analysisType === 'food' ? 'Analyze Food' : 'Get Recipes'}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="border-dashed border-2 rounded p-4 mb-3" style={{ borderColor: '#dee2e6', borderStyle: 'dashed' }}>
                            <i className="fas fa-cloud-upload-alt fa-2x text-muted mb-2"></i>
                            <p className="text-muted mb-0">Choose an option below</p>
                          </div>
                          
                          {/* Camera and File Upload Buttons */}
                          <div className="d-grid gap-2 mb-3">
                            <button 
                              className="btn btn-outline-primary"
                              onClick={startCamera}
                            >
                              <i className="fas fa-camera me-2"></i>
                              Take Photo with Camera
                            </button>
                            <div className="d-flex align-items-center">
                              <div className="flex-grow-1 border-top"></div>
                              <span className="px-3 text-muted small">OR</span>
                              <div className="flex-grow-1 border-top"></div>
                            </div>
                          </div>
                          
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="form-control"
                            accept="image/*"
                            onChange={handleImageSelect}
                          />
                          <small className="text-muted">
                            Take a photo or upload an image of your {analysisType}
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card bg-light h-100">
                    <div className="card-body">
                      <h5 className="card-title">
                        <i className="fas fa-info-circle me-2"></i>
                        How It Works
                      </h5>
                      {analysisType === 'food' ? (
                        <div>
                          <p className="mb-2">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Food Recognition:</strong> AI identifies your meal components
                          </p>
                          <p className="mb-2">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Nutritional Analysis:</strong> Get calorie and macro breakdowns
                          </p>
                          <p className="mb-2">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Health Assessment:</strong> Evaluates based on your fitness goals
                          </p>
                          <p className="mb-0">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Personalized Advice:</strong> Recommendations based on your food plan
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="mb-2">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Ingredient ID:</strong> AI identifies your ingredients
                          </p>
                          <p className="mb-2">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Recipe Suggestions:</strong> Get 3+ healthy recipes
                          </p>
                          <p className="mb-2">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Nutrition Info:</strong> Calories and macros per serving
                          </p>
                          <p className="mb-0">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>Fitness Aligned:</strong> Recipes match your goals
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </div>
              )}

              {/* Analysis Results */}
              {analysisResult && (
                <div className="mb-4">
                  <h4 className="text-center mb-4">
                    <i className="fas fa-chart-line me-2"></i>
                    Analysis Results
                  </h4>
                  {analysisType === 'food' 
                    ? renderFoodAnalysis(analysisResult) 
                    : renderIngredientAnalysis(analysisResult)
                  }
                </div>
              )}

              {/* Features Preview */}
              {!analysisResult && (
                <div className="row g-4 mb-4">
                  <div className="col-md-6">
                    <div className="d-flex align-items-start">
                      <div className="flex-shrink-0 bg-info rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                        <i className="fas fa-eye text-white"></i>
                      </div>
                      <div>
                        <h5 className="fw-bold">Smart Recognition</h5>
                        <p className="text-muted mb-0">
                          Advanced computer vision to identify foods, ingredients, 
                          and dishes from photos with high accuracy.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-start">
                      <div className="flex-shrink-0 bg-info rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                        <i className="fas fa-calculator text-white"></i>
                      </div>
                      <div>
                        <h5 className="fw-bold">Nutritional Analysis</h5>
                        <p className="text-muted mb-0">
                          Get accurate calorie counts, macronutrient breakdowns,
                          and portion size estimates.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-start">
                      <div className="flex-shrink-0 bg-info rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                        <i className="fas fa-book text-white"></i>
                      </div>
                      <div>
                        <h5 className="fw-bold">Recipe Suggestions</h5>
                        <p className="text-muted mb-0">
                          Get healthy recipe ideas from ingredients with 
                          step-by-step instructions and nutrition info.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-start">
                      <div className="flex-shrink-0 bg-info rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                        <i className="fas fa-target text-white"></i>
                      </div>
                      <div>
                        <h5 className="fw-bold">Goal-Aligned Advice</h5>
                        <p className="text-muted mb-0">
                          Personalized recommendations based on your 
                          fitness goals and dietary preferences.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <a href="/food-recommendations" className="btn btn-info btn-lg me-3">
                  <i className="fas fa-apple-alt me-2"></i>
                  Get Food Plan
                </a>
                <a href="/fitness-advisor" className="btn btn-outline-info btn-lg">
                  <i className="fas fa-dumbbell me-2"></i>
                  Fitness Advice
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IdentifyFoodPage;
