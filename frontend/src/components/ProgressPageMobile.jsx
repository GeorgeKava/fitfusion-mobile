import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoBarbell, IoFlame, IoFootsteps, IoWalk, IoCalendar, IoCheckmarkCircle, IoEllipseOutline, IoFitness } from 'react-icons/io5';

// Helper to get consistent date key (matches Dashboard)
const getTodayKey = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

const ProgressPageMobile = ({ user }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const [activityLog, setActivityLog] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [todayExercises, setTodayExercises] = useState([]);
  const [completedExercises, setCompletedExercises] = useState({});
  const [metrics, setMetrics] = useState({
    workoutsCompleted: 0,
    restDaysObserved: 0,
    consistencyScore: 0,
    totalCaloriesBurned: 0,
    totalSteps: 0,
    totalMiles: 0,
    averageFeelingRating: 0
  });

  const navigate = useNavigate();
  
  // Get today's day name
  const getTodayName = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  };
  
  useEffect(() => {
    if (user && user.email) {
      loadProgressData();
      loadWeeklyPlan();
      loadCompletedExercises();
      
      // Listen for storage changes from other tabs/pages
      const handleStorageChange = (e) => {
        if (e.key && e.key.includes('completedExercises')) {
          loadCompletedExercises();
        }
      };
      window.addEventListener('storage', handleStorageChange);
      
      // Poll for changes (for same-tab updates from Dashboard)
      const pollInterval = setInterval(() => {
        loadCompletedExercises();
      }, 1000);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(pollInterval);
      };
    }
  }, [user, selectedTimeframe]);

  const loadWeeklyPlan = () => {
    if (!user || !user.email) return;
    
    const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
    const savedPlan = localStorage.getItem(userSpecificWeeklyKey);
    
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan);
        setWeeklyPlan(parsed);
        
        // Get today's exercises
        const today = getTodayName();
        const todayPlan = parsed?.dailyPlans?.[today];
        
        if (todayPlan && !todayPlan.isRestDay && todayPlan.exercises) {
          setTodayExercises(todayPlan.exercises);
        } else if (todayPlan && todayPlan.isRestDay) {
          setTodayExercises(['rest']);
        } else {
          setTodayExercises([]);
        }
      } catch (e) {
        console.error('Error parsing weekly plan:', e);
      }
    }
  };

  const loadCompletedExercises = () => {
    if (!user || !user.email) return;
    
    const today = getTodayKey();
    const completedKey = `completedExercises_${user.email}_${today}`;
    const saved = localStorage.getItem(completedKey);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only update if different to avoid infinite loops
        if (JSON.stringify(parsed) !== JSON.stringify(completedExercises)) {
          setCompletedExercises(parsed);
        }
      } catch (e) {
        console.error('Error parsing completed exercises:', e);
      }
    } else if (Object.keys(completedExercises).length > 0) {
      setCompletedExercises({});
    }
  };

  const toggleExerciseComplete = (exerciseIndex) => {
    const today = getTodayKey();
    const completedKey = `completedExercises_${user.email}_${today}`;
    
    const newCompleted = { ...completedExercises };
    if (newCompleted[exerciseIndex]) {
      delete newCompleted[exerciseIndex];
    } else {
      newCompleted[exerciseIndex] = true;
    }
    
    setCompletedExercises(newCompleted);
    localStorage.setItem(completedKey, JSON.stringify(newCompleted));
    
    // Also update the activity log for tracking
    updateActivityLog(newCompleted);
  };

  const updateActivityLog = (completed) => {
    const today = getTodayKey();
    const userActivitiesKey = `userActivities_${user.email}`;
    
    let activities = [];
    const savedActivities = localStorage.getItem(userActivitiesKey);
    if (savedActivities) {
      try {
        activities = JSON.parse(savedActivities);
      } catch (e) {
        activities = [];
      }
    }
    
    // Find or create today's activity
    const todayIndex = activities.findIndex(a => a.date === today);
    const completedExercisesList = todayExercises.filter((_, idx) => completed[idx]);
    
    const todayActivity = {
      date: today,
      exercisesCompleted: completedExercisesList,
      caloriesBurned: completedExercisesList.length * 50, // Estimate
      steps: 0,
      milesRun: 0,
      feelingRating: 3,
      notes: ''
    };
    
    if (todayIndex >= 0) {
      activities[todayIndex] = { ...activities[todayIndex], ...todayActivity };
    } else if (completedExercisesList.length > 0) {
      activities.push(todayActivity);
    }
    
    localStorage.setItem(userActivitiesKey, JSON.stringify(activities));
    loadProgressData(); // Refresh metrics
  };

  const loadProgressData = () => {
    const userActivitiesKey = `userActivities_${user.email}`;
    const savedActivities = localStorage.getItem(userActivitiesKey);
    
    let activities = [];
    if (savedActivities) {
      try {
        const parsedActivities = JSON.parse(savedActivities);
        activities = parsedActivities.map(activity => ({
          date: new Date(activity.date),
          completed: activity.exercisesCompleted ? activity.exercisesCompleted.length : 0,
          details: activity.exercisesCompleted || [],
          caloriesBurned: parseInt(activity.caloriesBurned) || 0,
          steps: parseInt(activity.steps) || 0,
          milesRun: parseFloat(activity.milesRun) || 0,
          feelingRating: parseInt(activity.feelingRating) || 3,
          notes: activity.notes || '',
          type: activity.exercisesCompleted && activity.exercisesCompleted.length > 0 ? 'workout' : 'rest'
        }));
      } catch (e) {
        console.error('Error parsing user activities:', e);
      }
    }
    
    setActivityLog(activities);
    calculateMetrics(activities);
  };

  const calculateMetrics = (activityLog) => {
    const today = new Date();
    
    let timeframeDays;
    if (selectedTimeframe === 'week') {
      timeframeDays = 7;
    } else if (selectedTimeframe === 'month') {
      timeframeDays = 30;
    } else {
      timeframeDays = 365;
    }
    
    const startDate = new Date();
    startDate.setDate(today.getDate() - timeframeDays);
    
    const recentActivities = activityLog.filter(activity => activity.date >= startDate);
    const workoutsCompleted = recentActivities.filter(a => a.type === 'workout').length;
    const restDaysObserved = recentActivities.filter(a => a.type === 'rest').length;
    
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
    
    const daysInPeriod = Math.min(timeframeDays, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1);
    const daysWithActivity = recentActivities.length;
    
    let consistencyScore = 0;
    if (daysWithActivity > 0) {
      consistencyScore = Math.min(100, Math.round((daysWithActivity / daysInPeriod) * 100));
    }
    
    let progressRate;
    const expectedActivities = Math.ceil(timeframeDays * 0.4);
    progressRate = Math.min(100, Math.round((workoutsCompleted / Math.max(1, expectedActivities)) * 100));
    
    const averageFeelingRating = feelingRatingCount > 0 
      ? Math.round((feelingRatingSum / feelingRatingCount) * 10) / 10 
      : 0;
    
    setMetrics({
      workoutsCompleted,
      restDaysObserved,
      consistencyScore,
      totalCaloriesBurned,
      totalSteps,
      totalMiles: Math.round(totalMiles * 10) / 10,
      averageFeelingRating
    });
  };

  const renderMetricCard = (icon, title, value, subtitle, color = 'var(--ios-blue)') => (
    <div className="ios-card" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '13px', 
            color: 'var(--ios-gray)',
            marginBottom: '4px',
            fontWeight: '500'
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '28px', 
            fontWeight: '700',
            color: 'var(--ios-label)',
            lineHeight: '1'
          }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--ios-gray)',
              marginTop: '4px'
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const hasActivityData = activityLog.length > 0;

  if (!user) {
    return (
      <div style={{ padding: '16px' }}>
        <div className="ios-card" style={{ 
          backgroundColor: '#fff3cd',
          borderLeft: '4px solid var(--ios-orange)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '17px' }}>⚠️ Login Required</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>Please log in to view your progress</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="ios-nav-bar">
        <h1 className="ios-nav-title">
          Progress 
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
        {/* Today's Workout Section */}
        {weeklyPlan && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                margin: 0,
                color: 'var(--ios-label)'
              }}>
                Today's Workout
              </h2>
              <span style={{ 
                fontSize: '14px', 
                color: 'var(--ios-gray)',
                fontWeight: '500'
              }}>
                {getTodayName()}
              </span>
            </div>
            
            {todayExercises.length === 0 ? (
              <div className="ios-card" style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
                <p style={{ color: 'var(--ios-gray)', margin: 0 }}>
                  No exercises scheduled for today
                </p>
                <button 
                  className="ios-button ios-button-secondary"
                  onClick={() => navigate('/weekly-plan')}
                  style={{ marginTop: '16px', width: '100%' }}
                >
                  View Weekly Plan
                </button>
              </div>
            ) : todayExercises[0] === 'rest' ? (
              <div className="ios-card" style={{ 
                textAlign: 'center', 
                padding: '24px',
                background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>😴</div>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  margin: '0 0 8px 0',
                  color: '#2E7D32'
                }}>
                  Rest Day
                </h3>
                <p style={{ color: '#558B2F', margin: 0 }}>
                  Take it easy and let your body recover!
                </p>
              </div>
            ) : (
              <div className="ios-card" style={{ padding: '0' }}>
                <div style={{ 
                  padding: '16px',
                  borderBottom: '1px solid var(--ios-separator)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ 
                    fontSize: '15px', 
                    fontWeight: '600',
                    color: 'var(--ios-label)'
                  }}>
                    {Object.keys(completedExercises).length} of {todayExercises.length} completed
                  </span>
                  <div style={{ 
                    width: '100px',
                    height: '8px',
                    backgroundColor: 'var(--ios-fill)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${(Object.keys(completedExercises).length / todayExercises.length) * 100}%`,
                      height: '100%',
                      backgroundColor: '#34C759',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                
                {todayExercises.map((exercise, index) => (
                  <div 
                    key={index}
                    onClick={() => toggleExerciseComplete(index)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      padding: '14px 16px',
                      borderBottom: index < todayExercises.length - 1 ? '1px solid var(--ios-separator)' : 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      backgroundColor: completedExercises[index] ? 'rgba(52, 199, 89, 0.1)' : 'transparent'
                    }}
                  >
                    {completedExercises[index] ? (
                      <IoCheckmarkCircle size={28} color="#34C759" />
                    ) : (
                      <IoEllipseOutline size={28} color="var(--ios-gray)" />
                    )}
                    <span style={{ 
                      fontSize: '16px',
                      flex: 1,
                      color: completedExercises[index] ? 'var(--ios-gray)' : 'var(--ios-label)',
                      textDecoration: completedExercises[index] ? 'line-through' : 'none'
                    }}>
                      {exercise}
                    </span>
                    <IoFitness size={20} color={completedExercises[index] ? '#34C759' : '#007AFF'} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* No Weekly Plan - Show prompt */}
        {!weeklyPlan && (
          <div className="ios-card" style={{ 
            marginBottom: '24px',
            textAlign: 'center',
            padding: '24px',
            background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)'
          }}>
            <IoCalendar size={40} color="#1976D2" style={{ marginBottom: '12px' }} />
            <h3 style={{ 
              fontSize: '17px', 
              fontWeight: '600',
              margin: '0 0 8px 0',
              color: '#1565C0'
            }}>
              No Weekly Plan Yet
            </h3>
            <p style={{ 
              fontSize: '14px', 
              color: '#1976D2', 
              marginBottom: '16px' 
            }}>
              Create a workout plan to track your exercises
            </p>
            <button 
              className="ios-button"
              onClick={() => navigate('/fitness-advisor')}
              style={{ width: '100%' }}
            >
              Get AI Fitness Plan
            </button>
          </div>
        )}

        {/* Timeframe Selector */}
        <div className="ios-segmented-control" style={{ marginBottom: '20px' }}>
          <button
            className={`ios-segment ${selectedTimeframe === 'week' ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe('week')}
          >
            Week
          </button>
          <button
            className={`ios-segment ${selectedTimeframe === 'month' ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe('month')}
          >
            Month
          </button>
          <button
            className={`ios-segment ${selectedTimeframe === 'year' ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe('year')}
          >
            Year
          </button>
        </div>

        {hasActivityData ? (
          <>
            {/* Section Header */}
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              margin: '0 0 16px 0',
              color: 'var(--ios-label)'
            }}>
              Activity Stats
            </h2>
            
            {/* Primary Metrics */}
            <div style={{ marginBottom: '24px' }}>
              {renderMetricCard(<IoBarbell size={24} />, 'Workouts Completed', metrics.workoutsCompleted, `in the past ${selectedTimeframe}`, '#007AFF')}
              {renderMetricCard(<IoFlame size={24} />, 'Calories Burned', metrics.totalCaloriesBurned.toLocaleString(), 'estimated total', '#FF3B30')}
              {renderMetricCard(<IoFootsteps size={24} />, 'Steps', metrics.totalSteps.toLocaleString(), 'total recorded', '#34C759')}
              {renderMetricCard(<IoWalk size={24} />, 'Distance', `${metrics.totalMiles} mi`, 'miles run/walked', '#FF9500')}
            </div>

            {/* Secondary Metrics Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div className="ios-card" style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>😴</div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700',
                  color: 'var(--ios-label)',
                  marginBottom: '4px'
                }}>
                  {metrics.restDaysObserved}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-gray)' }}>
                  Rest Days
                </div>
              </div>

              <div className="ios-card" style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700',
                  color: 'var(--ios-label)',
                  marginBottom: '4px'
                }}>
                  {metrics.consistencyScore}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-gray)' }}>
                  Consistency
                </div>
              </div>

              <div className="ios-card" style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>😊</div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700',
                  color: 'var(--ios-label)',
                  marginBottom: '4px'
                }}>
                  {metrics.averageFeelingRating > 0 ? `${metrics.averageFeelingRating}/5` : '-'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-gray)' }}>
                  Avg. Feeling
                </div>
              </div>

              <div className="ios-card" style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⭐</div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700',
                  color: 'var(--ios-label)',
                  marginBottom: '4px'
                }}>
                  {activityLog.length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-gray)' }}>
                  Total Activities
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="ios-button"
                onClick={() => navigate('/fitness-advisor')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <IoBarbell size={20} />
                <span>Get AI Fitness Advice</span>
              </button>
              
              <button 
                className="ios-button ios-button-secondary"
                onClick={() => navigate('/weekly-plan')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <IoCalendar size={20} />
                <span>Create Weekly Plan</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Empty State */}
            <div className="ios-card" style={{ 
              textAlign: 'center', 
              padding: '48px 24px',
              marginBottom: '24px'
            }}>
              <div style={{ 
                fontSize: '64px', 
                marginBottom: '16px',
                opacity: 0.3
              }}>
                📊
              </div>
              <h3 style={{ 
                fontSize: '22px', 
                fontWeight: '700',
                marginBottom: '12px',
                color: 'var(--ios-label)'
              }}>
                No Activity Data
              </h3>
              <p style={{ 
                fontSize: '15px', 
                color: 'var(--ios-gray)',
                lineHeight: '1.4',
                marginBottom: '0'
              }}>
                Start logging your workouts to see your progress metrics!
              </p>
            </div>

            {/* Get Started Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="ios-button"
                onClick={() => navigate('/fitness-advisor')}
                style={{ padding: '16px' }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <IoBarbell size={20} />
                  <span>Get AI Fitness Advice</span>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.7 }}>
                  Analyze your form and get personalized recommendations
                </div>
              </button>
              
              <button 
                className="ios-button ios-button-secondary"
                onClick={() => navigate('/weekly-plan')}
                style={{ padding: '16px' }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>� Create Weekly Plan</div>
                <div style={{ fontSize: '13px', opacity: 0.7 }}>
                  Build a structured workout schedule
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProgressPageMobile;
