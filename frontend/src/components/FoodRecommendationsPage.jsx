import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';

function FoodRecommendationsPage({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Profile fields
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('maintenance');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [mealPreferences, setMealPreferences] = useState('');
  
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  const navigate = useNavigate();

  // Load profile data on component mount
  useEffect(() => {
    const loadProfileData = () => {
      console.log('FoodRecommendationsPage: Loading profile data...');
      
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          console.log('FoodRecommendationsPage: Profile data loaded:', profile);
          
          // Handle gender field with both sex and gender field names
          const profileGender = profile.sex || profile.gender;
          if (!gender && profileGender) {
            setGender(profileGender);
          }
          
          // Only auto-fill if the fields are empty
          if (!age && profile.age) setAge(profile.age);
          if (!weight && profile.weight) setWeight(profile.weight);
          if (!height && profile.height) setHeight(profile.height);
          
          // Map fitness goals
          const goalMapping = {
            'weight_loss': 'weight_loss',
            'muscle_gain': 'muscle_gain',
            'muscle_building_coach': 'muscle_gain',
            'weight_loss_coach': 'weight_loss',
            'general': 'maintenance'
          };
          
          if (profile.fitnessGoal || profile.agentType) {
            const goalValue = profile.fitnessGoal || profile.agentType;
            setFitnessGoal(goalMapping[goalValue] || 'maintenance');
          }
          
          // Load dietary preferences if available
          if (profile.dietaryRestrictions) setDietaryRestrictions(profile.dietaryRestrictions);
          if (profile.mealPreferences) setMealPreferences(profile.mealPreferences);
          
          setProfileLoaded(true);
        } catch (error) {
          console.error('FoodRecommendationsPage: Error loading profile data:', error);
        }
      }
      
      // Also check for user-specific profile data
      if (user?.email) {
        const userSpecificProfile = localStorage.getItem(`userProfile_${user.email}`);
        if (userSpecificProfile) {
          try {
            const profile = JSON.parse(userSpecificProfile);
            console.log('FoodRecommendationsPage: User-specific profile loaded:', profile);
            
            const profileGender = profile.sex || profile.gender;
            if (!gender && profileGender) {
              setGender(profileGender);
            }
            
            if (!age && profile.age) setAge(profile.age);
            if (!weight && profile.weight) setWeight(profile.weight);
            if (!height && profile.height) setHeight(profile.height);
          } catch (error) {
            console.error('FoodRecommendationsPage: Error loading user-specific profile:', error);
          }
        }
      }
    };

    loadProfileData();
  }, [user, gender, age, weight, height]);

  const handleGetFoodRecommendations = async () => {
    // Validation
    if (!gender || !age || !weight || !height) {
      setError('Please fill in all required fields (gender, age, weight, height).');
      return;
    }

    if (age < 10 || age > 100) {
      setError('Please enter a valid age between 10 and 100.');
      return;
    }

    if (weight < 30 || weight > 300) {
      setError('Please enter a valid weight between 30 and 300 kg.');
      return;
    }

    if (height < 36 || height > 96) {
      setError('Please enter a valid height between 36 and 96 inches.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('gender', gender);
      formData.append('age', age);
      formData.append('weight', weight);
      formData.append('height', height);
      formData.append('fitness_goal', fitnessGoal);
      formData.append('dietary_restrictions', dietaryRestrictions);
      formData.append('meal_preferences', mealPreferences);
      
      if (user?.email) {
        formData.append('user_email', user.email);
      }

      console.log('Sending food recommendations request...');
      
      const response = await axios.post(getApiUrl('/food_recommendations'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 second timeout
      });

      console.log('Food recommendations response:', response.data);

      if (response.data.success) {
        setRecommendations(response.data.food_recommendations);
        setSuccess('Food recommendations generated successfully!');
        
        // Save dietary preferences to profile for future use
        const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const updatedProfile = {
          ...currentProfile,
          dietaryRestrictions,
          mealPreferences,
          fitnessGoal
        };
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        
        if (user?.email) {
          localStorage.setItem(`userProfile_${user.email}`, JSON.stringify(updatedProfile));
        }
      } else {
        setError('Failed to generate food recommendations. Please try again.');
      }
    } catch (error) {
      console.error('Error getting food recommendations:', error);
      
      if (error.code === 'ECONNABORTED') {
        setError('Request timed out. The AI is taking longer than usual. Please try again.');
      } else if (error.response?.status === 400) {
        setError(error.response.data.error || 'Invalid request. Please check your input.');
      } else if (error.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else {
        setError('Failed to connect to the server. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderMealPlan = () => {
    // Try to parse if recommendations is a JSON string
    let parsedRecommendations = recommendations;
    if (typeof recommendations === 'string') {
      try {
        parsedRecommendations = JSON.parse(recommendations);
      } catch (e) {
        // If it's not valid JSON, try to extract JSON from the string
        const jsonMatch = recommendations.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedRecommendations = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.error('Failed to parse JSON from string:', e2);
          }
        }
      }
    }
    
    // Check if we have the structured meal_plan format
    if (parsedRecommendations?.meal_plan) {
      return renderStructuredMealPlan(parsedRecommendations);
    }
    
    // Check if we have the fallback format with response text
    if (parsedRecommendations?.response) {
      return renderFallbackResponse(parsedRecommendations);
    }
    
    // Try to render as structured meal plan anyway
    if (parsedRecommendations?.daily_calories || parsedRecommendations?.macronutrient_targets) {
      return renderStructuredMealPlan(parsedRecommendations);
    }
    
    return (
      <div className="mt-4">
        <div className="alert alert-warning">
          <h6>⚠️ Unable to parse meal plan data</h6>
          <p className="mb-2">We received data but couldn't display it properly. Please try generating recommendations again.</p>
          <details>
            <summary className="btn btn-sm btn-outline-secondary">Show raw data</summary>
            <pre className="small mt-2" style={{maxHeight: '200px', overflow: 'auto', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px'}}>
              {typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  };

  const renderFallbackResponse = (data = recommendations) => {
    const { response, daily_calories, goal } = data;
    
    return (
      <div className="mt-4">
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-success">
              <div className="card-header bg-success text-white">
                <h4 className="mb-0">
                  <i className="fas fa-chart-pie me-2"></i>
                  Your Personalized Food Recommendations
                </h4>
              </div>
              <div className="card-body">
                <div className="row text-center mb-3">
                  <div className="col-md-4">
                    <div className="border rounded p-3">
                      <h5 className="text-success">{daily_calories}</h5>
                      <small className="text-muted">Daily Calories</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded p-3">
                      <h5 className="text-info">{goal}</h5>
                      <small className="text-muted">Fitness Goal</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded p-3">
                      <h5 className="text-primary">AI Generated</h5>
                      <small className="text-muted">Personalized Plan</small>
                    </div>
                  </div>
                </div>
                
                <div className="alert alert-light">
                  <h6 className="mb-3">
                    <i className="fas fa-utensils me-2"></i>
                    Your Complete Nutrition Plan
                  </h6>
                  <div style={{whiteSpace: 'pre-line', lineHeight: '1.6'}}>
                    {response}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStructuredMealPlan = (data = recommendations) => {
    const { meal_plan, daily_calories, macronutrient_targets } = data;
    
    return (
      <div className="mt-4">
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-success">
              <div className="card-header bg-success text-white">
                <h4 className="mb-0">
                  <i className="fas fa-chart-pie me-2"></i>
                  Daily Nutrition Targets
                </h4>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-3">
                    <div className="border rounded p-3">
                      <h5 className="text-success">{daily_calories}</h5>
                      <small className="text-muted">Daily Calories</small>
                    </div>
                  </div>
                  {macronutrient_targets && (
                    <>
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <h5 className="text-info">{macronutrient_targets.protein || 'N/A'}</h5>
                          <small className="text-muted">Protein</small>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <h5 className="text-warning">{macronutrient_targets.carbohydrates || 'N/A'}</h5>
                          <small className="text-muted">Carbs</small>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <h5 className="text-danger">{macronutrient_targets.fat || 'N/A'}</h5>
                          <small className="text-muted">Fat</small>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          {Object.entries(meal_plan).map(([mealType, mealData], index) => (
            <div key={mealType} className="col-md-6 mb-4">
              <div className="card h-100">
                <div className="card-header bg-light">
                  <h5 className="mb-0 text-capitalize">
                    <i className={`fas ${getMealIcon(mealType)} me-2`}></i>
                    {mealType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h5>
                </div>
                <div className="card-body">
                  <h6 className="card-title">{mealData.meal}</h6>
                  
                  {mealData.calories && (
                    <div className="row text-center mb-3">
                      <div className="col-3">
                        <div className="small-stat">
                          <strong>{mealData.calories}</strong>
                          <br />
                          <small className="text-muted">kcal</small>
                        </div>
                      </div>
                      {mealData.protein && (
                        <div className="col-3">
                          <div className="small-stat">
                            <strong>{mealData.protein}g</strong>
                            <br />
                            <small className="text-muted">protein</small>
                          </div>
                        </div>
                      )}
                      {mealData.carbs && (
                        <div className="col-3">
                          <div className="small-stat">
                            <strong>{mealData.carbs}g</strong>
                            <br />
                            <small className="text-muted">carbs</small>
                          </div>
                        </div>
                      )}
                      {mealData.fat && (
                        <div className="col-3">
                          <div className="small-stat">
                            <strong>{mealData.fat}g</strong>
                            <br />
                            <small className="text-muted">fat</small>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mealData.ingredients && (
                    <div className="mb-3">
                      <h6 className="text-muted">Ingredients:</h6>
                      <ul className="list-unstyled">
                        {mealData.ingredients.map((ingredient, idx) => (
                          <li key={idx} className="small">
                            <i className="fas fa-check text-success me-1"></i>
                            {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mealData.preparation && (
                    <div>
                      <h6 className="text-muted">Preparation:</h6>
                      <p className="small text-muted">{mealData.preparation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional recommendations */}
        {(data.hydration || data.meal_prep_tips || data.food_substitutions) && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-info text-white">
                  <h5 className="mb-0">
                    <i className="fas fa-lightbulb me-2"></i>
                    Additional Tips & Recommendations
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    {data.hydration && (
                      <div className="col-md-4 mb-3">
                        <h6 className="text-info">
                          <i className="fas fa-tint me-2"></i>
                          Hydration
                        </h6>
                        <p className="small">{data.hydration}</p>
                      </div>
                    )}
                    
                    {data.meal_prep_tips && (
                      <div className="col-md-4 mb-3">
                        <h6 className="text-success">
                          <i className="fas fa-utensils me-2"></i>
                          Meal Prep Tips
                        </h6>
                        <ul className="list-unstyled">
                          {data.meal_prep_tips.map((tip, idx) => (
                            <li key={idx} className="small mb-1">
                              <i className="fas fa-arrow-right text-success me-1"></i>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {data.food_substitutions && (
                      <div className="col-md-4 mb-3">
                        <h6 className="text-warning">
                          <i className="fas fa-exchange-alt me-2"></i>
                          Food Substitutions
                        </h6>
                        {Object.entries(data.food_substitutions).map(([category, options]) => (
                          <div key={category} className="mb-2">
                            <small className="fw-bold text-capitalize">{category.replace('_', ' ')}:</small>
                            <br />
                            <small className="text-muted">{Array.isArray(options) ? options.join(', ') : options}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {data.notes && (
                    <div className="alert alert-light mt-3">
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>Note:</strong> {data.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getMealIcon = (mealType) => {
    const icons = {
      breakfast: 'fa-sun',
      lunch: 'fa-sun',
      dinner: 'fa-moon',
      snack1: 'fa-apple-alt',
      snack2: 'fa-cookie-bite',
      snacks: 'fa-apple-alt'
    };
    return icons[mealType] || 'fa-utensils';
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card shadow-lg">
            <div className="card-header bg-success text-white text-center">
              <h2 className="mb-0">
                <i className="fas fa-utensils me-2"></i>
                Food Recommendations
              </h2>
              <p className="mb-0 mt-2">AI-powered nutrition guidance tailored to your fitness goals</p>
            </div>
            <div className="card-body p-4">
              
              {profileLoaded && (
                <div className="alert alert-info mb-4">
                  <i className="fas fa-user-check me-2"></i>
                  Profile data loaded! Review and adjust settings below.
                </div>
              )}

              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success" role="alert">
                  <i className="fas fa-check-circle me-2"></i>
                  {success}
                </div>
              )}

              {/* Input Form */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label htmlFor="gender" className="form-label">
                    <i className="fas fa-venus-mars me-1"></i>
                    Gender <span className="text-danger">*</span>
                  </label>
                  <select 
                    className="form-select" 
                    id="gender" 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label htmlFor="age" className="form-label">
                    <i className="fas fa-birthday-cake me-1"></i>
                    Age <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="number" 
                    className="form-control" 
                    id="age" 
                    value={age} 
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Enter your age"
                    min="10"
                    max="100"
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="weight" className="form-label">
                    <i className="fas fa-weight me-1"></i>
                    Weight (kg) <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="number" 
                    className="form-control" 
                    id="weight" 
                    value={weight} 
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Enter your weight in kg"
                    min="30"
                    max="300"
                    step="0.1"
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="height" className="form-label">
                    <i className="fas fa-ruler-vertical me-1"></i>
                    Height (inches) <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="number" 
                    className="form-control" 
                    id="height" 
                    value={height} 
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="Enter your height in inches"
                    min="36"
                    max="96"
                    step="0.5"
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="fitnessGoal" className="form-label">
                    <i className="fas fa-bullseye me-1"></i>
                    Fitness Goal
                  </label>
                  <select 
                    className="form-select" 
                    id="fitnessGoal" 
                    value={fitnessGoal} 
                    onChange={(e) => setFitnessGoal(e.target.value)}
                  >
                    <option value="weight_loss">Weight Loss</option>
                    <option value="muscle_gain">Muscle Gain</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label htmlFor="mealPreferences" className="form-label">
                    <i className="fas fa-leaf me-1"></i>
                    Meal Preferences
                  </label>
                  <select 
                    className="form-select" 
                    id="mealPreferences" 
                    value={mealPreferences} 
                    onChange={(e) => setMealPreferences(e.target.value)}
                  >
                    <option value="">No specific preference</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="keto">Keto</option>
                    <option value="paleo">Paleo</option>
                    <option value="mediterranean">Mediterranean</option>
                    <option value="high_protein">High Protein</option>
                    <option value="low_carb">Low Carb</option>
                  </select>
                </div>

                <div className="col-12">
                  <label htmlFor="dietaryRestrictions" className="form-label">
                    <i className="fas fa-ban me-1"></i>
                    Dietary Restrictions & Allergies
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    id="dietaryRestrictions" 
                    value={dietaryRestrictions} 
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="e.g., gluten-free, lactose intolerant, nut allergy"
                  />
                  <div className="form-text">
                    List any foods you cannot or prefer not to eat
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="text-center mb-4">
                <button 
                  className="btn btn-success btn-lg px-5" 
                  onClick={handleGetFoodRecommendations}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Generating Food Recommendations...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magic me-2"></i>
                      Get My Food Recommendations
                    </>
                  )}
                </button>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="text-center mb-4">
                  <div className="spinner-border text-success mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">
                    Our AI nutritionist is creating personalized meal recommendations for you...
                    <br />
                    <small>This may take up to 30 seconds</small>
                  </p>
                </div>
              )}

              {/* Results */}
              {recommendations && renderMealPlan()}

              {/* Help Section */}
              <div className="row g-4 mt-4">
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <div className="flex-shrink-0 bg-success p-2 me-3" style={{borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <i className="fas fa-bullseye text-white"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold">Goal-Based Nutrition</h6>
                      <p className="text-muted mb-0 small">
                        Get meal recommendations tailored to your specific fitness goals
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <div className="flex-shrink-0 bg-success p-2 me-3" style={{borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <i className="fas fa-calculator text-white"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold">Macro Tracking</h6>
                      <p className="text-muted mb-0 small">
                        Detailed nutritional information for every meal and snack
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .small-stat {
          padding: 0.25rem;
        }
        .card {
          transition: transform 0.2s;
        }
        .card:hover {
          transform: translateY(-2px);
        }
        .spinner-border-sm {
          width: 1rem;
          height: 1rem;
        }
      `}</style>
    </div>
  );
}

export default FoodRecommendationsPage;
