import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import ActivityLogger from './ActivityLogger';
import { Button } from 'react-bootstrap';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const ProgressPage = ({ user }) => {
  const [progressData, setProgressData] = useState(null);
  const [exerciseDataAvailable, setExerciseDataAvailable] = useState(false);
  const [showActivityLogger, setShowActivityLogger] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recommendations, setRecommendations] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('month'); // 'week', 'month', 'year'
  const [metrics, setMetrics] = useState({
    workoutsCompleted: 0,
    restDaysObserved: 0,
    consistencyScore: 0,
    progressRate: 0,
    totalCaloriesBurned: 0,
    totalSteps: 0,
    totalMiles: 0,
    averageFeelingRating: 0
  });

  const navigate = useNavigate();
  
  useEffect(() => {
    if (user && user.email) {
      loadProgressData();
    } else {
      setIsLoading(false);
    }
  }, [user, selectedTimeframe]);
  
  const handleLogActivity = (date = new Date()) => {
    setSelectedDate(date);
    setShowActivityLogger(true);
  };
  
  const handleActivitySaved = (activityData) => {
    // Reload progress data to reflect the newly saved activity
    loadProgressData();
  };
  
  const loadProgressData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load recommendations history
      const userSpecificHistoryKey = `fitnessRecommendationHistory_${user.email}`;
      const recommendationsData = localStorage.getItem(userSpecificHistoryKey);
      let parsedRecommendations = [];
      
      if (recommendationsData) {
        parsedRecommendations = JSON.parse(recommendationsData);
        setRecommendations(parsedRecommendations);
      }
      
      // Load weekly plans from Azure Search via API
      let parsedWeeklyPlan = null;
      try {
        const response = await fetch(getApiUrl(`/get-weekly-plan?user_email=${encodeURIComponent(user.email)}`));
        const data = await response.json();
        
        if (data.success && data.weekly_plan) {
          parsedWeeklyPlan = data.weekly_plan;
          setWeeklyPlans([parsedWeeklyPlan]);
          console.log('Loaded weekly plan from Azure Search:', parsedWeeklyPlan);
        } else {
          console.log('No weekly plan found in Azure Search:', data.message);
          setWeeklyPlans([]);
        }
      } catch (apiError) {
        console.error('Error fetching weekly plan from API:', apiError);
        // Fallback to localStorage for backward compatibility
        const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
        const weeklyPlanData = localStorage.getItem(userSpecificWeeklyKey);
        
        if (weeklyPlanData) {
          parsedWeeklyPlan = JSON.parse(weeklyPlanData);
          setWeeklyPlans([parsedWeeklyPlan]);
          console.log('Loaded weekly plan from localStorage fallback');
        }
      }
      
      // Load completed exercises/activities (assuming you store these)
      const activityLogData = extractActivityData(parsedRecommendations, parsedWeeklyPlan);
      setActivityLog(activityLogData);
      
      // Calculate metrics
      calculateMetrics(parsedRecommendations, parsedWeeklyPlan, activityLogData);
      
      // Generate progress data for charts
      generateProgressCharts(parsedRecommendations, parsedWeeklyPlan, activityLogData);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading progress data:', error);
      setError('Failed to load progress data');
      setIsLoading(false);
    }
  };
  
  const extractActivityData = (recommendations, weeklyPlan) => {
    const activities = [];
    
    // First check for logged activities from the ActivityLogger component
    const userActivitiesKey = `userActivities_${user.email}`;
    const savedActivities = localStorage.getItem(userActivitiesKey);
    
    if (savedActivities) {
      try {
        const parsedActivities = JSON.parse(savedActivities);
        parsedActivities.forEach(activity => {
          activities.push({
            date: new Date(activity.date),
            completed: activity.exercisesCompleted ? activity.exercisesCompleted.length : 0,
            details: activity.exercisesCompleted || [],
            caloriesBurned: parseInt(activity.caloriesBurned) || 0,
            steps: parseInt(activity.steps) || 0,
            milesRun: parseFloat(activity.milesRun) || 0,
            feelingRating: parseInt(activity.feelingRating) || 3,
            notes: activity.notes || '',
            type: activity.exercisesCompleted && activity.exercisesCompleted.length > 0 ? 'workout' : 'rest'
          });
        });
      } catch (e) {
        console.error('Error parsing user activities:', e);
      }
    }
    
    // Also extract completed exercises from the old format for backward compatibility
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`completedExercises_${user.email}`)) {
        try {
          const dateStr = key.split('_')[2];
          // Check if we already have an activity for this date from the new format
          if (!activities.some(a => a.date.toDateString() === new Date(dateStr).toDateString())) {
            const completedExercises = JSON.parse(localStorage.getItem(key));
            
            if (Array.isArray(completedExercises)) {
              activities.push({
                date: new Date(dateStr),
                completed: completedExercises.length,
                type: 'workout'
              });
            }
          }
        } catch (e) {
          console.error('Error parsing completed exercises:', e);
        }
      }
    }
    
    // Also extract rest days from weekly plans if available
    if (weeklyPlan && weeklyPlan.dailyPlans) {
      const today = new Date();
      const planStartDate = new Date(weeklyPlan.dateCreated);
      
      // Only include rest days from the current week
      if (today - planStartDate < 7 * 24 * 60 * 60 * 1000) {
        Object.entries(weeklyPlan.dailyPlans).forEach(([dayName, dayPlan]) => {
          if (dayPlan.isRestDay) {
            // Convert day name to date
            const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
            if (dayIndex !== -1) {
              const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
              const diff = dayIndex - currentDay;
              
              const restDate = new Date();
              restDate.setDate(today.getDate() + diff);
              
              // Only add rest days that have passed or are today
              if (restDate <= today) {
                // Check if we already have an activity for this day
                if (!activities.some(a => a.date.toDateString() === restDate.toDateString())) {
                  activities.push({
                    date: restDate,
                    completed: 0,
                    type: 'rest'
                  });
                }
              }
            }
          }
        });
      }
    }
    
    return activities.sort((a, b) => a.date - b.date);
  };
  
  const calculateMetrics = (recommendations, weeklyPlan, activityLog) => {
    // Calculate various metrics based on available data - ONLY REAL DATA
    
    const today = new Date();
    
    // Set timeframe days based on selection
    let timeframeDays;
    if (selectedTimeframe === 'week') {
      timeframeDays = 7;
    } else if (selectedTimeframe === 'month') {
      timeframeDays = 30;
    } else { // year
      timeframeDays = 365;
    }
    
    // Calculate start date based on timeframe
    const startDate = new Date();
    startDate.setDate(today.getDate() - timeframeDays);
    
    const recentActivities = activityLog.filter(activity => activity.date >= startDate);
    const workoutsCompleted = recentActivities.filter(a => a.type === 'workout').length;
    const restDaysObserved = recentActivities.filter(a => a.type === 'rest').length;
    
    // Calculate additional metrics from logged activities
    let totalCaloriesBurned = 0;
    let totalSteps = 0;
    let totalMiles = 0;
    let feelingRatingSum = 0;
    let feelingRatingCount = 0;
    
    recentActivities.forEach(activity => {
      if (activity.caloriesBurned) totalCaloriesBurned += Number(activity.caloriesBurned);
      if (activity.steps) totalSteps += Number(activity.steps);
      if (activity.milesRun) totalMiles += Number(activity.milesRun);
      if (activity.feelingRating) {
        feelingRatingSum += Number(activity.feelingRating);
        feelingRatingCount++;
      }
    });
    
    // Calculate consistency score based only on logged activities
    // Without generating artificial expectations for days with no data
    const daysInPeriod = Math.min(timeframeDays, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1);
    const daysWithActivity = recentActivities.length;
    
    // If we have very few days of data, make consistency more encouraging
    let consistencyScore;
    if (daysWithActivity === 0) {
      consistencyScore = 0; // No activities
    } else if (daysInPeriod <= 3) {
      consistencyScore = Math.min(100, Math.round((daysWithActivity / daysInPeriod) * 100));
    } else {
      // For more established usage, use a more balanced formula
      consistencyScore = Math.min(100, Math.round((daysWithActivity / daysInPeriod) * 100));
    }
    
    // Calculate progress rate based on recommendations and actual activities
    let progressRate;
    if (recommendations.length === 0) {
      // No recommendations yet
      progressRate = workoutsCompleted > 0 ? 50 : 0; // Some progress for at least starting
    } else {
      // Has recommendations, calculate based on activity level
      const expectedActivities = Math.ceil(timeframeDays * 0.4); // Expect activity ~40% of days
      progressRate = Math.min(100, Math.round((workoutsCompleted / Math.max(1, expectedActivities)) * 100));
    }
    
    // Calculate average feeling rating
    const averageFeelingRating = feelingRatingCount > 0 
      ? Math.round((feelingRatingSum / feelingRatingCount) * 10) / 10 
      : 0;
    
    setMetrics({
      workoutsCompleted,
      restDaysObserved,
      consistencyScore,
      progressRate,
      totalCaloriesBurned,
      totalSteps,
      totalMiles: Math.round(totalMiles * 10) / 10,
      averageFeelingRating
    });
  };
  
  const generateProgressCharts = (recommendations, weeklyPlan, activityLog) => {
    // Generate data for various charts
    
    // Activity frequency data (for past X days)
    const labels = [];
    const activityFrequencyData = [];
    const today = new Date();
    
    // Set timeframe days based on selection
    let timeframeDays;
    if (selectedTimeframe === 'week') {
      timeframeDays = 7;
    } else if (selectedTimeframe === 'month') {
      timeframeDays = 30;
    } else { // year
      timeframeDays = 90;
    }
    
    // Create labels for days in selected timeframe
    for (let i = timeframeDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      
      // Find activity for this day
      const dayActivity = activityLog.find(a => 
        a.date.toDateString() === date.toDateString()
      );
      
      activityFrequencyData.push(dayActivity ? dayActivity.completed : 0);
    }
    
    // Distribution of exercise types (based on weekly plan)
    let exerciseTypes = { 
      'Strength': 0, 
      'Cardio': 0, 
      'Flexibility': 0, 
      'Recovery': 0 
    };
    
    // Try to extract exercise types from weekly plan - ONLY REAL DATA
    if (weeklyPlan && weeklyPlan.dailyPlans) {
      Object.values(weeklyPlan.dailyPlans).forEach(day => {
        if (day.isRestDay) {
          exerciseTypes['Recovery']++;
        } else if (day.exercises) {
          day.exercises.forEach(exercise => {
            // Categorize exercises based on name/description
            const exerciseStr = typeof exercise === 'string' ? exercise.toLowerCase() : exercise.name?.toLowerCase() || '';
            
            if (exerciseStr.includes('push') || exerciseStr.includes('pull') || 
                exerciseStr.includes('lift') || exerciseStr.includes('press') || 
                exerciseStr.includes('squat') || exerciseStr.includes('curl') ||
                exerciseStr.includes('strength')) {
              exerciseTypes['Strength']++;
            } else if (exerciseStr.includes('run') || exerciseStr.includes('jog') || 
                      exerciseStr.includes('cardio') || exerciseStr.includes('walk') || 
                      exerciseStr.includes('bike') || exerciseStr.includes('treadmill')) {
              exerciseTypes['Cardio']++;
            } else if (exerciseStr.includes('stretch') || exerciseStr.includes('yoga') || 
                      exerciseStr.includes('flex') || exerciseStr.includes('mobility')) {
              exerciseTypes['Flexibility']++;
            }
          });
        }
      });
    }
    
    // Check if we have any exercise data
    const hasData = Object.values(exerciseTypes).some(value => value > 0);
    
    // If no real exercise data, set all values to 0
    if (!hasData) {
      exerciseTypes = { 
        'Strength': 0, 
        'Cardio': 0, 
        'Flexibility': 0, 
        'Recovery': 0 
      };
    }
    
    // Update the state variable that tracks exercise data availability
    setExerciseDataAvailable(hasData);
    
    // Combine all chart data
    setProgressData({
      activityChart: {
        labels,
        datasets: [
          {
            label: 'Daily Activities',
            data: activityFrequencyData,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
          }
        ]
      },
      exerciseTypeChart: {
        labels: Object.keys(exerciseTypes),
        datasets: [
          {
            label: 'Exercise Types',
            data: Object.values(exerciseTypes),
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',  // red
              'rgba(54, 162, 235, 0.7)',  // blue
              'rgba(255, 206, 86, 0.7)',  // yellow
              'rgba(75, 192, 192, 0.7)',  // green
            ],
            borderWidth: 1
          }
        ]
      },
      consistencyChart: {
        labels: ['Workouts Completed', 'Rest Days', 'Inactive Days'],
        datasets: [
          {
            label: 'Consistency',
            data: [
              metrics.workoutsCompleted, 
              metrics.restDaysObserved,
              Math.max(0, timeframeDays - metrics.workoutsCompleted - metrics.restDaysObserved)
            ],
            backgroundColor: [
              'rgba(54, 162, 235, 0.7)',  // blue for workouts
              'rgba(75, 192, 192, 0.7)',  // green for rest days
              'rgba(201, 203, 207, 0.7)', // grey for inactive
            ],
            borderWidth: 1
          }
        ]
      }
    });
  };

  if (!user) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          <h4>Please log in to view your progress</h4>
          <p>You need to be logged in to access your fitness progress tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Activity Logger Modal */}
      <ActivityLogger 
        show={showActivityLogger}
        onHide={() => setShowActivityLogger(false)}
        onSave={handleActivitySaved}
        date={selectedDate.toISOString().split('T')[0]}
        user={user}
      />
      
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2>
                <i className="fas fa-chart-line me-3 text-success"></i>
                Your Fitness Progress
              </h2>
              <p className="text-muted">Track your fitness journey based on recommendations and completed activities</p>
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-success"
                onClick={() => handleLogActivity()}
              >
                <i className="fas fa-plus-circle me-2"></i>
                Log Activity
              </button>
              <button 
                className="btn btn-outline-secondary"
                onClick={() => navigate('/')}
              >
                <i className="fas fa-arrow-left me-2"></i>
                Back to Dashboard
              </button>
              <div className="btn-group" role="group">
                <button 
                  type="button" 
                  className={`btn ${selectedTimeframe === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setSelectedTimeframe('week')}
                >
                  Week
                </button>
                <button 
                  type="button" 
                  className={`btn ${selectedTimeframe === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setSelectedTimeframe('month')}
                >
                  Month
                </button>
                <button 
                  type="button" 
                  className={`btn ${selectedTimeframe === 'year' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setSelectedTimeframe('year')}
                >
                  Year
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h5>Loading Your Progress Data...</h5>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Progress Summary Cards */}
          {activityLog && activityLog.length > 0 ? (
            <div className="row mb-4">
              <div className="col-md-3">
                <div className="card border-primary h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-dumbbell fa-3x text-primary mb-3"></i>
                    <h5 className="card-title">Workouts Completed</h5>
                    <h3 className="display-4">{metrics.workoutsCompleted}</h3>
                    <p className="card-text text-muted">
                      {user && user.createdAt && new Date(user.createdAt) > new Date(Date.now() - 86400000 * 7)
                        ? `since account creation (${Math.floor((new Date() - new Date(user.createdAt)) / 86400000)} days)`
                        : `in the past ${selectedTimeframe === 'week' ? '7' : selectedTimeframe === 'month' ? '30' : '90'} days`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-info h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-bed fa-3x text-info mb-3"></i>
                    <h5 className="card-title">Rest Days Observed</h5>
                    <h3 className="display-4">{metrics.restDaysObserved}</h3>
                    <p className="card-text text-muted">
                      important for recovery
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-success h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-calendar-check fa-3x text-success mb-3"></i>
                    <h5 className="card-title">Consistency Score</h5>
                    <h3 className="display-4">{metrics.consistencyScore}%</h3>
                    <p className="card-text text-muted">
                      based on activity frequency
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-warning h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-tachometer-alt fa-3x text-warning mb-3"></i>
                    <h5 className="card-title">Progress Rate</h5>
                    <h3 className="display-4">{metrics.progressRate}%</h3>
                    <p className="card-text text-muted">
                      towards your fitness goals
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="row mb-4">
              <div className="col-12">
                <div className="card">
                  <div className="card-body text-center py-5">
                    <i className="fas fa-chart-line fa-3x text-muted mb-3"></i>
                    <h5>No Activity Data Available</h5>
                    <p className="text-muted">Start logging your workouts to see your progress metrics!</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Metrics Row */}
          {activityLog && activityLog.length > 0 && (
            <div className="row mb-4">
              <div className="col-md-3">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-fire-alt fa-3x text-danger mb-3"></i>
                    <h5 className="card-title">Calories Burned</h5>
                    <h3 className="display-4">{metrics.totalCaloriesBurned}</h3>
                    <p className="card-text text-muted">estimated total</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-shoe-prints fa-3x text-primary mb-3"></i>
                    <h5 className="card-title">Steps</h5>
                    <h3 className="display-4">{metrics.totalSteps.toLocaleString()}</h3>
                    <p className="card-text text-muted">total steps recorded</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-running fa-3x text-success mb-3"></i>
                    <h5 className="card-title">Distance</h5>
                    <h3 className="display-4">{metrics.totalMiles}</h3>
                    <p className="card-text text-muted">miles run/walked</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <i className="fas fa-smile fa-3x text-warning mb-3"></i>
                    <h5 className="card-title">Feeling Rating</h5>
                    <h3 className="display-4">{metrics.averageFeelingRating}/5</h3>
                    <p className="card-text text-muted">average rating</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          {progressData && (
            <div className="row">
              {/* Activity Frequency Chart */}
              <div className="col-md-8 mb-4">
                <div className="card">
                  <div className="card-header bg-light">
                    <h5 className="mb-0">
                      <i className="fas fa-chart-bar me-2 text-primary"></i>
                      Activity Frequency
                    </h5>
                  </div>
                  <div className="card-body">
                    {activityLog && activityLog.length > 0 ? (
                      <Bar 
                        data={progressData.activityChart}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'top' },
                            title: {
                              display: true,
                              text: `Daily Activities (Past ${selectedTimeframe === 'week' ? '7' : selectedTimeframe === 'month' ? '30' : '90'} Days)`
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Activities Completed'
                              }
                            }
                          }
                        }}
                        height={300}
                      />
                    ) : (
                      <div className="text-center py-5">
                        <i className="fas fa-chart-bar fa-3x text-muted mb-3"></i>
                        <p className="text-muted">Log your daily activities to see frequency data!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Exercise Distribution Chart */}
              <div className="col-md-4 mb-4">
                <div className="card h-100">
                  <div className="card-header bg-light">
                    <h5 className="mb-0">
                      <i className="fas fa-chart-pie me-2 text-success"></i>
                      Exercise Distribution
                    </h5>
                  </div>
                  <div className="card-body">
                    {exerciseDataAvailable ? (
                      <Pie 
                        data={progressData.exerciseTypeChart}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'bottom' },
                            title: {
                              display: true,
                              text: 'Types of Exercises'
                            }
                          }
                        }}
                        height={250}
                      />
                    ) : (
                      <div className="text-center py-5">
                        <i className="fas fa-dumbbell fa-3x text-muted mb-3"></i>
                        <p className="text-muted">Set up your weekly plan to see exercise distribution!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consistency Chart */}
              <div className="col-md-6 mb-4">
                <div className="card">
                  <div className="card-header bg-light">
                    <h5 className="mb-0">
                      <i className="fas fa-check-circle me-2 text-info"></i>
                      Workout Consistency
                    </h5>
                  </div>
                  <div className="card-body">
                    {activityLog && activityLog.length > 0 ? (
                      <Pie
                        data={progressData.consistencyChart}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'bottom' },
                            title: {
                              display: true,
                              text: 'Activity Consistency'
                            }
                          }
                        }}
                        height={250}
                      />
                    ) : (
                      <div className="text-center py-5">
                        <i className="fas fa-calendar-check fa-3x text-muted mb-3"></i>
                        <p className="text-muted">Track your workouts to see consistency data!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Motivational Card / Call to Action */}
              <div className="col-md-6 mb-4">
                <div className="card h-100">
                  <div className="card-header bg-light">
                    <h5 className="mb-0">
                      <i className="fas fa-rocket me-2 text-danger"></i>
                      Next Steps
                    </h5>
                  </div>
                  <div className="card-body">
                    {activityLog && activityLog.length > 0 ? (
                      <div className="text-center">
                        <h5 className="card-title mt-3">Keep Going Strong!</h5>
                        <p className="card-text my-4">
                          You're making great progress on your fitness journey. 
                          Remember that consistency is key to achieving your goals.
                        </p>
                        <button 
                          className="btn btn-success mt-3" 
                          onClick={() => handleLogActivity()}
                        >
                          <i className="fas fa-plus-circle me-2"></i>
                          Log Today's Activity
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <h5 className="card-title mt-3">Get Started!</h5>
                        <p className="card-text my-4">
                          Start tracking your fitness journey by logging your activities and 
                          creating a weekly workout plan.
                        </p>
                        <div className="d-flex justify-content-center gap-3">
                          <button 
                            className="btn btn-success" 
                            onClick={() => handleLogActivity()}
                          >
                            <i className="fas fa-plus-circle me-2"></i>
                            Log Activity
                          </button>
                          <button 
                            className="btn btn-primary" 
                            onClick={() => navigate('/weekly-plan')}
                          >
                            <i className="fas fa-calendar-plus me-2"></i>
                            Create Weekly Plan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProgressPage;
