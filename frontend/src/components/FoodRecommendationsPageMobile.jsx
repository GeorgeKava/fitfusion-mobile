import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import { IoSunny, IoFastFood, IoMoon, IoNutrition, IoRestaurant } from 'react-icons/io5';

function FoodRecommendationsPageMobile({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);
  
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
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          
          const profileGender = profile.sex || profile.gender;
          if (!gender && profileGender) setGender(profileGender);
          
          if (!age && profile.age) setAge(profile.age);
          if (!weight && profile.weight) setWeight(profile.weight);
          if (!height && profile.height) setHeight(profile.height);
          
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
          
          if (profile.dietaryRestrictions) setDietaryRestrictions(profile.dietaryRestrictions);
          if (profile.mealPreferences) setMealPreferences(profile.mealPreferences);
          
          setProfileLoaded(true);
        } catch (error) {
          console.error('Error loading profile data:', error);
        }
      }
      
      if (user?.email) {
        const userSpecificProfile = localStorage.getItem(`userProfile_${user.email}`);
        if (userSpecificProfile) {
          try {
            const profile = JSON.parse(userSpecificProfile);
            const profileGender = profile.sex || profile.gender;
            if (!gender && profileGender) setGender(profileGender);
            if (!age && profile.age) setAge(profile.age);
            if (!weight && profile.weight) setWeight(profile.weight);
            if (!height && profile.height) setHeight(profile.height);
          } catch (error) {
            console.error('Error loading user-specific profile:', error);
          }
        }
      }
    };

    loadProfileData();
  }, [user]);

  const handleGetFoodRecommendations = async () => {
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
      
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'multipart/form-data' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.post(getApiUrl('/food_recommendations'), formData, {
        headers: headers,
        timeout: 60000,
      });

      if (response.data.success) {
        setRecommendations(response.data.food_recommendations);
        setShowForm(false);
        
        // Save preferences to profile
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
        setError('Request timed out. Please try again.');
      } else if (error.response?.status === 400) {
        setError(error.response.data.error || 'Invalid request. Please check your input.');
      } else if (error.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else {
        setError('Failed to connect. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getMealIcon = (mealType) => {
    const iconComponents = {
      breakfast: IoSunny,
      lunch: IoFastFood,
      dinner: IoMoon,
      snack1: IoNutrition,
      snack2: IoNutrition,
      snacks: IoNutrition
    };
    const IconComponent = iconComponents[mealType] || IoRestaurant;
    return <IconComponent size={24} />;
  };

  const renderMealCard = (mealType, mealData) => {
    return (
      <div className="ios-card" style={{ marginBottom: '12px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '17px',
            fontWeight: '600'
          }}>
            {getMealIcon(mealType)} {mealType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </h3>
          {mealData.calories && (
            <span style={{ 
              backgroundColor: 'var(--ios-blue)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {mealData.calories} kcal
            </span>
          )}
        </div>
        
        <h4 style={{ 
          margin: '0 0 12px 0', 
          fontSize: '15px',
          color: 'var(--ios-label)'
        }}>
          {mealData.meal}
        </h4>
        
        {/* Macros */}
        {(mealData.protein || mealData.carbs || mealData.fat) && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '8px',
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: 'var(--ios-system-gray6)',
            borderRadius: '8px'
          }}>
            {mealData.protein && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{mealData.protein}g</div>
                <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Protein</div>
              </div>
            )}
            {mealData.carbs && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{mealData.carbs}g</div>
                <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Carbs</div>
              </div>
            )}
            {mealData.fat && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{mealData.fat}g</div>
                <div style={{ fontSize: '12px', color: 'var(--ios-secondary-label)' }}>Fat</div>
              </div>
            )}
          </div>
        )}
        
        {/* Ingredients */}
        {mealData.ingredients && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Ingredients:</div>
            <ul style={{ 
              margin: 0, 
              paddingLeft: '20px',
              fontSize: '14px',
              color: 'var(--ios-secondary-label)'
            }}>
              {mealData.ingredients.map((ingredient, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{ingredient}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Preparation */}
        {mealData.preparation && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Preparation:</div>
            <div style={{ fontSize: '14px', color: 'var(--ios-secondary-label)' }}>
              {mealData.preparation}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    if (recommendations?.meal_plan) {
      return (
        <div>
          {/* Daily Nutrition Targets */}
          <div className="ios-card" style={{ marginBottom: '16px' }}>
            <h3 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '17px',
              fontWeight: '600'
            }}>
              📊 Daily Nutrition Targets
            </h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '12px'
            }}>
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: 'var(--ios-system-gray6)',
                borderRadius: '12px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ios-blue)' }}>
                  {recommendations.daily_calories}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                  Daily Calories
                </div>
              </div>
              
              {recommendations.macronutrient_targets && (
                <>
                  <div style={{ 
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: 'var(--ios-system-gray6)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ios-green)' }}>
                      {recommendations.macronutrient_targets.protein || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                      Protein
                    </div>
                  </div>
                  
                  <div style={{ 
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: 'var(--ios-system-gray6)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ios-orange)' }}>
                      {recommendations.macronutrient_targets.carbohydrates || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                      Carbs
                    </div>
                  </div>
                  
                  <div style={{ 
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: 'var(--ios-system-gray6)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ios-red)' }}>
                      {recommendations.macronutrient_targets.fat || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                      Fat
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Meal Cards */}
          {Object.entries(recommendations.meal_plan).map(([mealType, mealData]) => 
            renderMealCard(mealType, mealData)
          )}

          {/* Additional Tips */}
          {(recommendations.hydration || recommendations.meal_prep_tips || recommendations.notes) && (
            <div className="ios-card" style={{ marginTop: '16px' }}>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '17px',
                fontWeight: '600',
                color: 'var(--ios-blue)'
              }}>
                💡 Tips & Recommendations
              </h3>
              
              {recommendations.hydration && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                    💧 Hydration
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--ios-secondary-label)' }}>
                    {recommendations.hydration}
                  </div>
                </div>
              )}
              
              {recommendations.meal_prep_tips && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                    🍳 Meal Prep Tips
                  </div>
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px',
                    fontSize: '14px',
                    color: 'var(--ios-secondary-label)'
                  }}>
                    {recommendations.meal_prep_tips.map((tip, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {recommendations.notes && (
                <div style={{ 
                  padding: '12px',
                  backgroundColor: 'var(--ios-system-gray6)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--ios-secondary-label)'
                }}>
                  <strong>Note:</strong> {recommendations.notes}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    
    // Fallback for text response
    if (recommendations?.response) {
      return (
        <div>
          <div className="ios-card" style={{ marginBottom: '16px' }}>
            <h3 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '17px',
              fontWeight: '600'
            }}>
              📊 Your Plan
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '12px'
            }}>
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: 'var(--ios-system-gray6)',
                borderRadius: '12px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ios-blue)' }}>
                  {recommendations.daily_calories}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                  Daily Calories
                </div>
              </div>
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: 'var(--ios-system-gray6)',
                borderRadius: '12px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ios-green)' }}>
                  {recommendations.goal}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                  Goal
                </div>
              </div>
            </div>
          </div>
          
          <div className="ios-card">
            <div style={{ 
              whiteSpace: 'pre-line',
              fontSize: '15px',
              lineHeight: '1.5',
              color: 'var(--ios-label)'
            }}>
              {recommendations.response}
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  if (!showForm && recommendations) {
    return (
      <div style={{ paddingBottom: '80px' }}>
        <div className="ios-nav-bar">
          <button className="ios-nav-back" onClick={() => setShowForm(true)}>
            ← Back
          </button>
          <h1 className="ios-nav-title">Meal Plan</h1>
        </div>
        
        <div style={{ padding: '16px' }}>
          {renderResults()}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="ios-nav-bar">
        <h1 className="ios-nav-title">
          Food Recommendations 
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
        {/* Profile Alert */}
        {profileLoaded && (
          <div className="ios-card" style={{ 
            marginBottom: '16px',
            backgroundColor: '#d1f2eb',
            borderLeft: '4px solid var(--ios-green)'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--ios-label)' }}>
              ✅ Profile data loaded
            </div>
          </div>
        )}

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

        {/* Personal Info Card */}
        <div className="ios-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '17px',
            fontWeight: '600'
          }}>
            Personal Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="ios-input-label">Gender *</label>
                <select 
                  className="ios-input" 
                  value={gender} 
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="ios-input-label">Age *</label>
                <input 
                  type="number" 
                  className="ios-input" 
                  value={age} 
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                  min="10"
                  max="100"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="ios-input-label">Weight (kg) *</label>
                <input 
                  type="number" 
                  className="ios-input" 
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  min="30"
                  max="300"
                  step="0.1"
                />
              </div>

              <div>
                <label className="ios-input-label">Height (in) *</label>
                <input 
                  type="number" 
                  className="ios-input" 
                  value={height} 
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="70"
                  min="36"
                  max="96"
                  step="0.5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Goals & Preferences Card */}
        <div className="ios-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '17px',
            fontWeight: '600'
          }}>
            Goals & Preferences
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="ios-input-label">Fitness Goal</label>
              <select 
                className="ios-input" 
                value={fitnessGoal} 
                onChange={(e) => setFitnessGoal(e.target.value)}
              >
                <option value="weight_loss">Weight Loss</option>
                <option value="muscle_gain">Muscle Gain</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label className="ios-input-label">Meal Preferences</label>
              <select 
                className="ios-input" 
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

            <div>
              <label className="ios-input-label">Dietary Restrictions</label>
              <input 
                type="text" 
                className="ios-input" 
                value={dietaryRestrictions} 
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                placeholder="e.g., gluten-free, nut allergy"
              />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button 
          className="ios-button"
          onClick={handleGetFoodRecommendations}
          disabled={isLoading}
          style={{ width: '100%' }}
        >
          {isLoading ? (
            <>⏳ Generating Meal Plan...</>
          ) : (
            <>✨ Get Food Recommendations</>
          )}
        </button>

        {isLoading && (
          <div className="ios-card" style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: 'var(--ios-secondary-label)' }}>
              Our AI nutritionist is creating your personalized meal plan...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FoodRecommendationsPageMobile;
