import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';

const WeeklyPlanPage = ({ user }) => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const navigate = useNavigate();

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  useEffect(() => {
    loadWeeklyPlan();
  }, [user]);

  const loadWeeklyPlan = () => {
    if (!user || !user.email) {
      return;
    }
    
    // Check for existing weekly plan in localStorage
    const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
    const savedPlan = localStorage.getItem(userSpecificWeeklyKey);
    
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan);
        // Check if plan is less than a week old
        const planDate = new Date(parsed.dateCreated);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        if (planDate > weekAgo) {
          setWeeklyPlan(parsed);
          return;
        }
      } catch (error) {
        console.error('Error parsing saved weekly plan:', error);
      }
    }
    
    // If no valid plan exists, check if we have a recent recommendation to base it on
    const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
    const latestRecommendation = localStorage.getItem(userSpecificLatestKey);
    
    if (latestRecommendation) {
      try {
        const rec = JSON.parse(latestRecommendation);
        generateWeeklyPlanFromRecommendation(rec);
      } catch (error) {
        console.error('Error parsing latest recommendation:', error);
      }
    }
  };

  const generateWeeklyPlanFromRecommendation = async (recommendation) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl('/generate-weekly-plan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userProfile: {
            ...recommendation.userProfile,
            email: user?.email // Ensure email is included for Azure Search storage
          },
          baseRecommendation: recommendation.recommendation
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate weekly plan');
      }

      const data = await response.json();
      
      const weeklyPlanData = {
        ...data,
        dateCreated: new Date().toISOString(),
        userProfile: recommendation.userProfile
      };
      
      setWeeklyPlan(weeklyPlanData);
      
      // Save to localStorage
      const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
      localStorage.setItem(userSpecificWeeklyKey, JSON.stringify(weeklyPlanData));
      
    } catch (error) {
      console.error('Error generating weekly plan:', error);
      setError('Failed to generate weekly plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewWeeklyPlan = async () => {
    // Get latest recommendation first
    const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
    const latestRecommendation = localStorage.getItem(userSpecificLatestKey);
    
    if (!latestRecommendation) {
      setError('No recent fitness recommendation found. Please get a new recommendation first.');
      return;
    }
    
    try {
      const rec = JSON.parse(latestRecommendation);
      await generateWeeklyPlanFromRecommendation(rec);
    } catch (error) {
      setError('Error accessing your fitness recommendation. Please get a new recommendation.');
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInHours = Math.floor((now - then) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  if (!user) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          <h4>Please log in to view your weekly plan</h4>
          <p>You need to be logged in to access your personalized weekly fitness plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2>
                <i className="fas fa-calendar-week me-3"></i>
                Your Weekly Fitness Plan
              </h2>
              <p className="text-muted">Comprehensive 7-day training schedule tailored to your goals. Generate a plan based on your latest AI recommendation to get started!</p>
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-outline-secondary"
                onClick={() => navigate('/')}
              >
                <i className="fas fa-arrow-left me-2"></i>
                Back to Dashboard
              </button>
              <button 
                className="btn btn-primary"
                onClick={generateNewWeeklyPlan}
                disabled={isLoading}
              >
                <i className="fas fa-sync-alt me-2"></i>
                {isLoading ? 'Generating...' : 'Generate New Plan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
          <button 
            className="btn btn-primary ms-3"
            onClick={() => navigate('/fitness-advisor')}
          >
            Get New Recommendation
          </button>
        </div>
      )}

      {isLoading && (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h5>Generating Your Weekly Plan...</h5>
                <p className="text-muted">Creating a personalized 7-day fitness schedule based on your goals</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {weeklyPlan && !isLoading && (
        <>
          {/* Plan Overview */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-primary">
                <div className="card-header bg-primary text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      <i className="fas fa-info-circle me-2"></i>
                      Plan Overview
                    </h5>
                    <small>Created {formatTimeAgo(weeklyPlan.dateCreated)}</small>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-8">
                      <h6 className="text-primary mb-3">Weekly Focus</h6>
                      <p>{weeklyPlan.weeklyOverview || "A comprehensive 7-day plan designed to help you achieve your fitness goals through progressive training and recovery."}</p>
                      
                      {weeklyPlan.weeklyGoals && (
                        <div className="mt-3">
                          <h6 className="text-success mb-2">This Week's Goals</h6>
                          <ul className="list-unstyled">
                            {weeklyPlan.weeklyGoals.map((goal, index) => (
                              <li key={index} className="mb-1">
                                <i className="fas fa-target text-success me-2"></i>
                                {goal}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title text-primary">
                            <i className="fas fa-user-circle me-2"></i>
                            Your Profile
                          </h6>
                          <small>
                            <strong>Goal:</strong> 
                            <span className="badge bg-warning ms-2">
                              {weeklyPlan.userProfile.agentType.replace('_', ' ')}
                            </span><br/>
                            <strong>Age:</strong> {weeklyPlan.userProfile.age} | 
                            <strong> Weight:</strong> {weeklyPlan.userProfile.weight} lbs
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Day Selection Tabs */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <ul className="nav nav-tabs card-header-tabs" role="tablist">
                    {daysOfWeek.map((day) => (
                      <li key={day} className="nav-item" role="presentation">
                        <button
                          className={`nav-link ${selectedDay === day ? 'active' : ''}`}
                          onClick={() => setSelectedDay(day)}
                          type="button"
                          role="tab"
                        >
                          {day}
                          {weeklyPlan.dailyPlans && weeklyPlan.dailyPlans[day] && weeklyPlan.dailyPlans[day].isRestDay && (
                            <span className="badge bg-info ms-1">Rest</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Day Content */}
          {weeklyPlan.dailyPlans && weeklyPlan.dailyPlans[selectedDay] && (
            <div className="row">
              <div className="col-12">
                <div className="card border-success">
                  <div className="card-header bg-success text-white">
                    <h5 className="mb-0">
                      <i className="fas fa-calendar-day me-2"></i>
                      {selectedDay} Plan
                      {weeklyPlan.dailyPlans[selectedDay].isRestDay && (
                        <span className="badge bg-light text-success ms-2">Rest Day</span>
                      )}
                    </h5>
                  </div>
                  <div className="card-body">
                    {weeklyPlan.dailyPlans[selectedDay].isRestDay ? (
                      /* Rest Day Content */
                      <div className="text-center py-4">
                        <i className="fas fa-bed fa-3x text-info mb-3"></i>
                        <h4 className="text-info">Active Recovery Day</h4>
                        <p className="text-muted mb-4">Focus on rest, recovery, and light activities</p>
                        
                        {weeklyPlan.dailyPlans[selectedDay].activities && (
                          <div className="row">
                            <div className="col-md-8 offset-md-2">
                              <h6 className="text-primary mb-3">Recommended Activities</h6>
                              <div className="list-group">
                                {weeklyPlan.dailyPlans[selectedDay].activities.map((activity, index) => (
                                  <div key={index} className="list-group-item">
                                    <i className="fas fa-leaf text-success me-2"></i>
                                    {activity}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Training Day Content */
                      <div className="row">
                        {/* Exercises */}
                        <div className="col-md-6">
                          <h6 className="text-primary mb-3">
                            <i className="fas fa-dumbbell me-2"></i>
                            Exercises
                          </h6>
                          {weeklyPlan.dailyPlans[selectedDay].exercises && weeklyPlan.dailyPlans[selectedDay].exercises.length > 0 ? (
                            <div className="list-group">
                              {weeklyPlan.dailyPlans[selectedDay].exercises.map((exercise, index) => (
                                <div key={index} className="list-group-item">
                                  <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                      <h6 className="mb-1">{exercise.name || exercise}</h6>
                                      {exercise.sets && exercise.reps && (
                                        <small className="text-muted">
                                          {exercise.sets} sets × {exercise.reps} reps
                                        </small>
                                      )}
                                      {exercise.duration && (
                                        <small className="text-muted">
                                          Duration: {exercise.duration}
                                        </small>
                                      )}
                                      {exercise.notes && (
                                        <p className="mb-0 text-muted small mt-1">{exercise.notes}</p>
                                      )}
                                    </div>
                                    <span className="badge bg-primary">
                                      {exercise.type || 'Exercise'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="alert alert-info">
                              <i className="fas fa-info-circle me-2"></i>
                              No specific exercises planned for this day.
                            </div>
                          )}
                        </div>

                        {/* Goals & Notes */}
                        <div className="col-md-6">
                          <h6 className="text-warning mb-3">
                            <i className="fas fa-target me-2"></i>
                            Daily Goals
                          </h6>
                          {weeklyPlan.dailyPlans[selectedDay].goals && weeklyPlan.dailyPlans[selectedDay].goals.length > 0 ? (
                            <ul className="list-unstyled">
                              {weeklyPlan.dailyPlans[selectedDay].goals.map((goal, index) => (
                                <li key={index} className="mb-2">
                                  <i className="fas fa-star text-warning me-2"></i>
                                  {goal}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="alert alert-info">
                              <i className="fas fa-info-circle me-2"></i>
                              No specific goals set for this day.
                            </div>
                          )}

                          {weeklyPlan.dailyPlans[selectedDay].focus && (
                            <div className="mt-4">
                              <h6 className="text-success mb-2">
                                <i className="fas fa-bullseye me-2"></i>
                                Focus Area
                              </h6>
                              <div className="alert alert-success">
                                {weeklyPlan.dailyPlans[selectedDay].focus}
                              </div>
                            </div>
                          )}

                          {weeklyPlan.dailyPlans[selectedDay].notes && (
                            <div className="mt-4">
                              <h6 className="text-info mb-2">
                                <i className="fas fa-sticky-note me-2"></i>
                                Notes
                              </h6>
                              <div className="alert alert-info">
                                {weeklyPlan.dailyPlans[selectedDay].notes}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Summary */}
          <div className="row mt-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">
                    <i className="fas fa-chart-bar me-2"></i>
                    Weekly Summary
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3">
                      <div className="text-center">
                        <i className="fas fa-dumbbell fa-2x text-primary mb-2"></i>
                        <h6>Training Days</h6>
                        <span className="badge bg-primary">
                          {weeklyPlan.dailyPlans ? 
                            Object.values(weeklyPlan.dailyPlans).filter(day => !day.isRestDay).length : 0
                          }
                        </span>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center">
                        <i className="fas fa-bed fa-2x text-info mb-2"></i>
                        <h6>Rest Days</h6>
                        <span className="badge bg-info">
                          {weeklyPlan.dailyPlans ? 
                            Object.values(weeklyPlan.dailyPlans).filter(day => day.isRestDay).length : 0
                          }
                        </span>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center">
                        <i className="fas fa-calendar fa-2x text-success mb-2"></i>
                        <h6>Weekly Focus</h6>
                        <span className="badge bg-success">
                          {weeklyPlan.userProfile.agentType.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center">
                        <i className="fas fa-clock fa-2x text-warning mb-2"></i>
                        <h6>Plan Age</h6>
                        <span className="badge bg-warning">
                          {formatTimeAgo(weeklyPlan.dateCreated)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!weeklyPlan && !isLoading && !error && (
        <div className="row">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-body text-center py-5">
                <i className="fas fa-calendar-plus fa-3x text-info mb-3"></i>
                <h4>No Weekly Plan Yet</h4>
                <p className="text-muted mb-4">
                  Create your personalized weekly fitness plan based on your latest recommendation
                </p>
                <button 
                  className="btn btn-primary me-3"
                  onClick={generateNewWeeklyPlan}
                >
                  <i className="fas fa-plus me-2"></i>
                  Generate Weekly Plan
                </button>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={() => navigate('/fitness-advisor')}
                >
                  <i className="fas fa-camera me-2"></i>
                  Get New Recommendation First
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanPage;
