import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCamera, IoBarbell } from 'react-icons/io5';
import '../styles/mobile.css';

// Helper to get consistent date key
const getTodayKey = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

const DashboardPageMobile = ({ user }) => {
  const [todaysPlan, setTodaysPlan] = useState(null);
  const [latestRecommendation, setLatestRecommendation] = useState(null);
  const [completedExercises, setCompletedExercises] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
    
    // Listen for storage changes from other tabs/pages
    const handleStorageChange = (e) => {
      if (e.key && e.key.includes('completedExercises')) {
        loadCompletedExercises();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll for changes (for same-tab updates)
    const pollInterval = setInterval(() => {
      loadCompletedExercises();
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [user]);

  const loadCompletedExercises = () => {
    if (!user || !user.email) return;
    
    const today = getTodayKey();
    const completedKey = `completedExercises_${user.email}_${today}`;
    const saved = localStorage.getItem(completedKey);
    
    if (saved) {
      try {
        setCompletedExercises(JSON.parse(saved));
      } catch (e) {
        setCompletedExercises({});
      }
    } else {
      setCompletedExercises({});
    }
  };

  const loadDashboardData = () => {
    if (!user || !user.email) return;

    const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
    const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;

    // Load weekly plan
    const weeklyPlanData = localStorage.getItem(userSpecificWeeklyKey);
    if (weeklyPlanData) {
      try {
        const parsedWeeklyPlan = JSON.parse(weeklyPlanData);
        generateTodaysPlanFromWeeklyPlan(parsedWeeklyPlan);
      } catch (error) {
        console.error('Error loading weekly plan:', error);
      }
    }

    // Load latest recommendation
    const latest = localStorage.getItem(userSpecificLatestKey);
    if (latest) {
      try {
        setLatestRecommendation(JSON.parse(latest));
      } catch (error) {
        console.error('Error loading latest recommendation:', error);
      }
    }

    // Load completed exercises
    loadCompletedExercises();
  };

  const generateTodaysPlanFromWeeklyPlan = (weeklyPlanData) => {
    if (!weeklyPlanData || !weeklyPlanData.dailyPlans) return;

    const today = getTodayKey();
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaysPlanFromWeekly = weeklyPlanData.dailyPlans[dayOfWeek];

    if (todaysPlanFromWeekly) {
      setTodaysPlan({
        date: today,
        dayOfWeek,
        exercises: todaysPlanFromWeekly.exercises || [],
        goals: todaysPlanFromWeekly.goals || [],
        focus: todaysPlanFromWeekly.focus || '',
        isRestDay: todaysPlanFromWeekly.isRestDay || false,
        activities: todaysPlanFromWeekly.activities || [],
        fromWeeklyPlan: true
      });
    }
  };

  const handleExerciseCompletion = (exerciseIndex) => {
    if (!user || !user.email) return;

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
  };

  const getCompletionPercentage = () => {
    if (!todaysPlan) return 0;
    const exercises = todaysPlan.isRestDay ? todaysPlan.activities : todaysPlan.exercises;
    if (exercises.length === 0) return 0;
    
    const completedCount = Object.keys(completedExercises).filter(key => completedExercises[key]).length;
    return Math.round((completedCount / exercises.length) * 100);
  };

  const getProgressColor = (percentage) => {
    if (percentage === 0) return '#FF3B30'; // iOS red
    if (percentage < 33) return '#FF6B6B'; // Light red
    if (percentage < 67) return '#FFCC00'; // Yellow
    return '#34C759'; // iOS green
  };

  if (!user) {
    return (
      <div className="ios-card">
        <h4 className="ios-card-title">Please log in</h4>
        <p>You need to be logged in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="ios-nav-bar">
        <div></div>
        <div className="ios-nav-title">Dashboard</div>
        <div></div>
      </div>

      {/* Welcome Card */}
      <div className="ios-card">
        <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>
          Welcome back, {user.name || 'Champion'}!
        </h2>
        <p style={{ color: 'var(--ios-gray)', marginBottom: '0' }}>
          Ready to crush your fitness goals today?
        </p>
      </div>

      {/* Today's Progress */}
      {todaysPlan && (
        <div className="ios-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="ios-card-title" style={{ marginBottom: '0' }}>
              Today's Progress
            </h3>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              border: `4px solid ${getProgressColor(getCompletionPercentage())}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '16px',
              color: getProgressColor(getCompletionPercentage())
            }}>
              {getCompletionPercentage()}%
            </div>
          </div>
          <p style={{ color: 'var(--ios-gray)', fontSize: '15px' }}>
            {todaysPlan.dayOfWeek} - {todaysPlan.focus || 'General Fitness'}
          </p>
        </div>
      )}

      {/* Today's Exercises */}
      {todaysPlan ? (
        <>
          <div className="ios-section-header">
            {todaysPlan.isRestDay ? 'Recovery Activities' : "Today's Exercises"}
          </div>
          <div className="ios-list">
            {(todaysPlan.isRestDay ? todaysPlan.activities : todaysPlan.exercises).map((exercise, index) => {
              const isCompleted = completedExercises[index] === true;

              return (
                <div
                  key={index}
                  className="ios-list-item"
                  onClick={() => handleExerciseCompletion(index)}
                >
                  <div className="ios-list-item-content">
                    <div 
                      className="ios-list-item-title" 
                      style={{ 
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'var(--ios-gray)' : '#000'
                      }}
                    >
                      {exercise}
                    </div>
                  </div>
                  <div style={{ fontSize: '24px' }}>
                    {isCompleted ? '✅' : '⚪'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Goals */}
          <div className="ios-section-header">Today's Goals</div>
          <div className="ios-card">
            {todaysPlan.goals.map((goal, index) => (
              <div key={index} style={{ display: 'flex', marginBottom: '8px' }}>
                <span style={{ marginRight: '8px' }}>⭐</span>
                <span style={{ fontSize: '15px' }}>{goal}</span>
              </div>
            ))}
          </div>

          {/* View Weekly Plan Button */}
          {todaysPlan.fromWeeklyPlan && (
            <div style={{ padding: '16px' }}>
              <button
                className="ios-button"
                onClick={() => navigate('/weekly-plan')}
              >
                📅 View Full Weekly Plan
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="ios-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            <IoBarbell size={48} style={{ color: '#007AFF' }} />
          </div>
          <h4 className="ios-card-title">No Fitness Plan Yet</h4>
          <p style={{ color: 'var(--ios-gray)', marginBottom: '20px' }}>
            Get started by creating your first personalized fitness recommendation!
          </p>
          <button
            className="ios-button"
            onClick={() => navigate('/fitness-advisor')}
          >
            Create Your First Plan
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="ios-section-header">Quick Actions</div>
      <div className="ios-list">
        <div className="ios-list-item" onClick={() => navigate('/fitness-advisor')}>
          <div className="ios-list-item-content">
            <div className="ios-list-item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IoCamera size={18} />
              <span>New Fitness Analysis</span>
            </div>
            <div className="ios-list-item-subtitle">Get AI-powered recommendations</div>
          </div>
          <div className="ios-list-item-chevron">›</div>
        </div>

        <div className="ios-list-item" onClick={() => navigate('/food-recommendations')}>
          <div className="ios-list-item-content">
            <div className="ios-list-item-title">🍎 Food Recommendations</div>
            <div className="ios-list-item-subtitle">Nutrition guidance</div>
          </div>
          <div className="ios-list-item-chevron">›</div>
        </div>

        <div className="ios-list-item" onClick={() => navigate('/identify-food')}>
          <div className="ios-list-item-content">
            <div className="ios-list-item-title">🔍 Identify Food</div>
            <div className="ios-list-item-subtitle">Scan and analyze meals</div>
          </div>
          <div className="ios-list-item-chevron">›</div>
        </div>

        <div className="ios-list-item" onClick={() => navigate('/weekly-plan')}>
          <div className="ios-list-item-content">
            <div className="ios-list-item-title">📅 Weekly Plan</div>
            <div className="ios-list-item-subtitle">View your full week</div>
          </div>
          <div className="ios-list-item-chevron">›</div>
        </div>

        {/* Voice Chat DISABLED to save tokens */}
        {/* <div className="ios-list-item" onClick={() => navigate('/voice-chat')}>
          <div className="ios-list-item-content">
            <div className="ios-list-item-title">🎙️ Voice Chat</div>
            <div className="ios-list-item-subtitle">Talk to your AI trainer</div>
          </div>
          <div className="ios-list-item-chevron">›</div>
        </div> */}
      </div>

      {/* Latest Recommendation Summary */}
      {latestRecommendation && (
        <>
          <div className="ios-section-header">Latest AI Recommendation</div>
          <div className="ios-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="ios-badge">{latestRecommendation.analysisMode}</span>
              <span style={{ fontSize: '13px', color: 'var(--ios-gray)' }}>
                {new Date(latestRecommendation.timestamp).toLocaleDateString()}
              </span>
            </div>
            <p style={{ fontSize: '15px', color: 'var(--ios-dark-gray)' }}>
              {latestRecommendation.recommendation.substring(0, 150)}...
            </p>
            <button
              className="ios-button ios-button-secondary"
              onClick={() => navigate('/fitness-advisor')}
              style={{ marginTop: '12px' }}
            >
              View Full Recommendation
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPageMobile;
