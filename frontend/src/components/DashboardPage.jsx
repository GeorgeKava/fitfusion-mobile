import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';

const DashboardPage = ({ user }) => {
  const [latestRecommendation, setLatestRecommendation] = useState(null);
  const [recommendationHistory, setRecommendationHistory] = useState([]);
  const [todaysPlan, setTodaysPlan] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [isGeneratingWeeklyPlan, setIsGeneratingWeeklyPlan] = useState(false);
  const [showFullRecommendation, setShowFullRecommendation] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [completedExercises, setCompletedExercises] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
    
    // Listen for localStorage changes to refresh dashboard data
    const handleStorageChange = (e) => {
      // Only listen to changes for the current user's keys
      if (user && user.email) {
        const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
        const userSpecificHistoryKey = `fitnessRecommendationHistory_${user.email}`;
        const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
        
        if (e.key === userSpecificLatestKey || e.key === userSpecificHistoryKey || e.key === userSpecificWeeklyKey) {
          loadDashboardData();
        }
      }
    };
    
    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events within the same tab
    const handleCustomUpdate = () => {
      loadDashboardData();
    };
    
    window.addEventListener('recommendationUpdated', handleCustomUpdate);
    
    // Cleanup event listeners
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('recommendationUpdated', handleCustomUpdate);
    };
  }, [user]); // Add user as dependency so it reloads when user changes

  // Clear dashboard data when user logs out or switches
  const clearDashboardData = () => {
    setLatestRecommendation(null);
    setRecommendationHistory([]);
    setTodaysPlan(null);
    setWeeklyPlan(null);
  };

  // Effect to clear data when user changes or becomes null
  useEffect(() => {
    if (!user) {
      clearDashboardData();
    } else {
      // Clean up any old global localStorage keys when a user logs in
      const oldLatestKey = 'latestFitnessRecommendation';
      const oldHistoryKey = 'fitnessRecommendationHistory';
      
      if (localStorage.getItem(oldLatestKey)) {
        localStorage.removeItem(oldLatestKey);
      }
      if (localStorage.getItem(oldHistoryKey)) {
        localStorage.removeItem(oldHistoryKey);
      }
    }
  }, [user]);

  // Cleanup old completed exercise data
  useEffect(() => {
    if (!user || !user.email) return;
    
    const cleanupOldCompletedData = () => {
      const today = new Date().toLocaleDateString();
      const keysToRemove = [];
      
      // Check all localStorage keys for old completed exercise data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`completedExercises_${user.email}_`)) {
          const keyDate = key.split('_').pop();
          if (keyDate !== today) {
            keysToRemove.push(key);
          }
        }
      }
      
      // Remove old data
      keysToRemove.forEach(key => localStorage.removeItem(key));
    };
    
    cleanupOldCompletedData();
  }, [user]);

  const loadDashboardData = () => {
    // Check if user is available before loading data
    if (!user || !user.email) {
      setLatestRecommendation(null);
      setRecommendationHistory([]);
      setTodaysPlan(null);
      setWeeklyPlan(null);
      return;
    }
    
    // Create user-specific localStorage keys
    const userSpecificLatestKey = `latestFitnessRecommendation_${user.email}`;
    const userSpecificHistoryKey = `fitnessRecommendationHistory_${user.email}`;
    const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;

    // Load weekly plan first (higher priority for today's plan)
    const weeklyPlanData = localStorage.getItem(userSpecificWeeklyKey);
    if (weeklyPlanData) {
      try {
        const parsedWeeklyPlan = JSON.parse(weeklyPlanData);
        setWeeklyPlan(parsedWeeklyPlan);
        generateTodaysPlanFromWeeklyPlan(parsedWeeklyPlan);
      } catch (error) {
        setWeeklyPlan(null);
      }
    }
    
    // Load latest recommendation
    const latest = localStorage.getItem(userSpecificLatestKey);
    
    if (latest) {
      try {
        const parsed = JSON.parse(latest);
        setLatestRecommendation(parsed);
      } catch (error) {
        setLatestRecommendation(null);
      }
    }

    // Load recommendation history
    const history = localStorage.getItem(userSpecificHistoryKey);
    
    if (history) {
      try {
        const parsed = JSON.parse(history);
        setRecommendationHistory(parsed);
      } catch (error) {
        setRecommendationHistory([]);
      }
    }

    // Load completed exercises for today
    const today = new Date().toLocaleDateString();
    const userSpecificCompletedKey = `completedExercises_${user.email}_${today}`;
    const completed = localStorage.getItem(userSpecificCompletedKey);
    
    if (completed) {
      try {
        const parsedCompleted = JSON.parse(completed);
        setCompletedExercises(new Set(parsedCompleted));
      } catch (error) {
        setCompletedExercises(new Set());
      }
    } else {
      setCompletedExercises(new Set());
    }

    // Generate today's plan from latest recommendation (only if no weekly plan exists)
    if (latest && !weeklyPlanData) {
      try {
        const parsedRecommendation = JSON.parse(latest);
        generateTodaysPlan(parsedRecommendation);
      } catch (error) {
        // Error already handled above, no need to log again
      }
    }
  };

  const generateTodaysPlanFromWeeklyPlan = (weeklyPlanData) => {
    if (!weeklyPlanData || !weeklyPlanData.dailyPlans) {
      return;
    }

    const today = new Date().toLocaleDateString();
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    const todaysPlanFromWeekly = weeklyPlanData.dailyPlans[dayOfWeek];
    
    if (todaysPlanFromWeekly) {
      setTodaysPlan({
        date: today,
        dayOfWeek,
        exercises: todaysPlanFromWeekly.exercises || [],
        goals: todaysPlanFromWeekly.goals || [],
        focus: todaysPlanFromWeekly.focus || '',
        notes: todaysPlanFromWeekly.notes || '',
        isRestDay: todaysPlanFromWeekly.isRestDay || false,
        activities: todaysPlanFromWeekly.activities || [],
        fromWeeklyPlan: true
      });
    }
  };

  const generateWeeklyPlanFromDashboard = async () => {
    if (!latestRecommendation) {
      alert('Please generate a fitness recommendation first.');
      return;
    }

    setIsGeneratingWeeklyPlan(true);
    
    try {
      const response = await fetch(getApiUrl('/generate-weekly-plan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userProfile: latestRecommendation.userProfile,
          baseRecommendation: latestRecommendation.recommendation
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate weekly plan');
      }

      const data = await response.json();
      
      const weeklyPlanData = {
        ...data,
        dateCreated: new Date().toISOString(),
        userProfile: latestRecommendation.userProfile
      };
      
      setWeeklyPlan(weeklyPlanData);
      
      // Save to localStorage
      const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
      localStorage.setItem(userSpecificWeeklyKey, JSON.stringify(weeklyPlanData));
      
      // Update today's plan from the new weekly plan
      generateTodaysPlanFromWeeklyPlan(weeklyPlanData);
      
      // Navigate to weekly plan page
      navigate('/weekly-plan');
      
    } catch (error) {
      console.error('Error generating weekly plan:', error);
      alert('Failed to generate weekly plan. Please try again.');
    } finally {
      setIsGeneratingWeeklyPlan(false);
    }
  };

  const generateTodaysPlan = (recommendation) => {
    // Add null checking for recommendation object
    if (!recommendation) {
      return;
    }
    
    const today = new Date().toLocaleDateString();
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    // Check if recommendation has valid text content
    if (!recommendation.recommendation || typeof recommendation.recommendation !== 'string') {
      // Set empty plan with fallbacks
      setTodaysPlan({
        date: today,
        dayOfWeek,
        exercises: [],
        goals: []
      });
      return;
    }
    
    // Parse the recommendation to extract actionable items
    const agentType = recommendation.userProfile?.agentType || 'general';
    const plan = extractDailyPlan(recommendation.recommendation, dayOfWeek, agentType);
    
    setTodaysPlan({
      date: today,
      dayOfWeek,
      ...plan
    });
  };

  const extractDailyPlan = (recommendationText, dayOfWeek, agentType = 'general') => {
    // Add null/undefined checking for recommendationText
    if (!recommendationText || typeof recommendationText !== 'string') {
      return {
        exercises: [],
        goals: []
      };
    }

    // Enhanced parsing for Agentic RAG content with improved regex patterns
    const exercises = [];
    const goals = [];

    // Enhanced parsing for Agentic RAG content with improved extraction

    // Improved exercise extraction patterns with better completion
    const exercisePatterns = [
      // Match "X sets of Y-Z reps" patterns BEFORE exercise names (correct order)
      /(\d+)\s*sets?\s*of\s*(\d+)(?:-(\d+))?\s*reps?\s*(?:of\s*|:?\s*)([a-zA-Z\s\-]{3,50}(?:push-?ups?|squats?|lunges?|planks?|burpees?|deadlifts?|pull-?ups?|sit-?ups?|crunches?|dips|rows?|presses?|curls?|raises?|extensions?|twists?))/gi,
      // Match exercise names FOLLOWED BY sets/reps (exercise name first)
      /([a-zA-Z\s\-]{3,50}(?:push-?ups?|squats?|lunges?|planks?|burpees?|deadlifts?|pull-?ups?|sit-?ups?|crunches?|dips|rows?|presses?|curls?|raises?|extensions?|twists?))[\s:]*(\d+)\s*sets?\s*(?:of\s*)?(\d+)(?:-(\d+))?\s*reps?/gi,
      // Match time-based exercises
      /(\d+)\s*minutes?\s*(?:of\s*)?([a-zA-Z\s\-]{5,60}(?:cardio|running|walking|cycling|swimming|stretching|yoga|aerobics?|jogging|warming?|cooling?))/gi,
      // Match bullet point exercises with complete descriptions
      /(?:^|\n)\s*[-•*]\s*([A-Z][a-zA-Z\s\-]{8,80}(?:push-?ups?|squats?|lunges?|planks?|burpees?|deadlifts?|pull-?ups?|sit-?ups?|crunches?|dips|rows?|presses?|curls?|raises?|extensions?|twists?|exercise|workout|training))/gim,
      // Match structured workout items
      /(?:^|\n)\s*[-•*]\s*([A-Z][a-zA-Z\s\-\(\)]{10,100}(?:seconds?|minutes?|reps?|sets?|hold))/gim,
      // Match action-based exercise descriptions
      /(?:perform|do|complete|execute|try)\s*([a-zA-Z\s\-\(\)]{8,80}(?:push-?ups?|squats?|lunges?|planks?|burpees?|deadlifts?|pull-?ups?|sit-?ups?|crunches?|dips|rows?|presses?|curls?|cardio|exercise))/gi,
      // Match equipment names
      /(Stair\s*climber|Stairmaster|Treadmill|Elliptical|Rowing\s*machine|Stationary\s*bike|Exercise\s*bike)/gi,
      // Match exercises with equipment in parentheses
      /([A-Z][a-zA-Z\s\-]{3,40})\s*\([^)]{5,30}\)/gi
    ];

    // Process each pattern to extract exercises
    exercisePatterns.forEach(pattern => {
      const matches = [...recommendationText.matchAll(pattern)];
      matches.forEach(match => {
        let exerciseText = '';
        
        // Pattern 1: "X sets of Y-Z reps" BEFORE exercise name (e.g., "3 sets of 8-12 reps tricep dips")
        if (match[1] && match[2] && match[4] && !isNaN(match[1])) {
          const sets = match[1];
          const repsMin = match[2];
          const repsMax = match[3] ? `-${match[3]}` : '';
          const exercise = match[4].trim();
          if (exercise) {
            exerciseText = `${sets} sets of ${repsMin}${repsMax} ${exercise}`;
          }
        }
        // Pattern 2: Exercise name FOLLOWED BY sets/reps (e.g., "Tricep dips: 3 sets of 8-12 reps")
        else if (match[1] && match[2] && match[3] && isNaN(match[1])) {
          const exercise = match[1].trim();
          const sets = match[2];
          const repsMin = match[3];
          const repsMax = match[4] ? `-${match[4]}` : '';
          if (exercise) {
            exerciseText = `${sets} sets of ${repsMin}${repsMax} ${exercise}`;
          }
        }
        // Pattern 3: Time-based exercises
        else if (match[1] && match[2] && !isNaN(match[1])) {
          const minutes = match[1];
          const exercise = match[2].trim();
          if (exercise) {
            exerciseText = `${minutes} minutes of ${exercise}`;
          }
        }
        // Pattern 4: Direct exercise description (bullet points, equipment, etc.)
        else {
          exerciseText = match[1]?.trim() || match[0]?.trim();
        }
        
        if (exerciseText && exerciseText.length > 3 && exerciseText.length < 150) {
          // Clean up the text
          exerciseText = exerciseText.replace(/^[-•*]\s*/, '').trim();
          // Ensure proper capitalization
          if (exerciseText.length > 0) {
            exerciseText = exerciseText.charAt(0).toUpperCase() + exerciseText.slice(1);
          }
          // Remove incomplete trailing phrases but preserve equipment info
          exerciseText = exerciseText.replace(/\s+(?:per|each|for|and|with)$/i, '').trim();
          
          // More permissive duplicate checking
          if (!exercises.some(ex => ex.toLowerCase().includes(exerciseText.toLowerCase().substring(0, Math.min(15, exerciseText.length))))) {
            exercises.push(exerciseText);
          }
        }
      });
    });

    // Enhanced goal extraction with better patterns
    const goalPatterns = [
      // Specific fitness goals with expanded capture
      /(?:goal|target|objective|aim)(?:s)?:\s*([^.!?\n]{8,120})/gi,
      // Weight targets with more context
      /(?:lose|burn|gain|build)\s*(?:up\s+to\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg)(?:\s*(?:of\s*)?(?:weight|fat|muscle))?/gi,
      // Performance targets with broader capture
      /(?:increase|improve|build|achieve|develop|enhance)\s*([^.!?\n]{8,100}(?:strength|endurance|muscle|fitness|performance|stamina|flexibility))/gi,
      // Weekly/daily targets
      /(?:weekly|daily|week|day)\s*(?:goal|target|focus|objective):\s*([^.!?\n]{8,100})/gi,
      // Achievement-focused goals
      /(?:work\s+(?:on|towards)|focus\s+on|concentrate\s+on)\s*([^.!?\n]{10,120})/gi,
      // Bullet point goals
      /(?:^|\n)\s*[-•*]\s*([^.!?\n]{10,120}(?:goal|target|focus|lose|gain|build|improve))/gim,
      // Health and fitness outcomes
      /(?:for|to)\s*([^.!?\n]{15,120}(?:health|fitness|weight\s+loss|muscle\s+gain|fat\s+burning|wellness))/gi,
      // NEW: Specific fitness goal phrases
      /(?:^|\n)\s*[-•*]?\s*((?:Weight\s+Loss|Fat\s+Burning|Muscle\s+Building|Strength\s+Training|Cardiovascular\s+Health|Endurance\s+Building|Flexibility\s+Improvement|Overall\s+Fitness)\s*[^.\n]*)/gim,
      // NEW: Action-based fitness goals
      /((?:Build|Develop|Improve|Increase|Enhance|Achieve|Maintain)\s+(?:strength|endurance|flexibility|stamina|muscle|fitness|health|wellness)[^.\n]*)/gi
    ];

    // Add agent-specific goal patterns for better extraction
    const agentSpecificPatterns = {
      'weight_loss': [
        /(?:lose|burn|reduce)\s*(?:up\s+to\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg)(?:\s*(?:of\s*)?(?:weight|fat))?/gi,
        /(?:calorie|caloric)\s*deficit\s*(?:of\s*)?(\d+)\s*calories?/gi,
        /fat\s*burning|weight\s*loss|lose\s*weight|shed\s*pounds/gi,
        /reduce\s*body\s*fat|lower\s*bmi|slim\s*down/gi
      ],
      'muscle_gain': [
        /(?:gain|build|add)\s*(?:up\s+to\s*)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg)(?:\s*(?:of\s*)?(?:muscle|lean\s*mass))?/gi,
        /(?:protein)\s*(?:intake|target)\s*(?:of\s*)?(\d+)\s*(?:grams?|g)/gi,
        /muscle\s*building|mass\s*gaining|bulking|hypertrophy/gi,
        /increase\s*muscle|build\s*strength|progressive\s*overload/gi
      ],
      'cardio': [
        /(?:improve|increase|build)\s*(?:cardiovascular|cardio|aerobic)\s*(?:fitness|endurance|capacity)/gi,
        /(?:run|jog|cycle|swim)\s*for\s*(\d+)\s*(?:minutes?|hours?)/gi,
        /heart\s*rate|vo2\s*max|endurance|stamina/gi,
        /cardio\s*training|aerobic\s*exercise|cardiovascular\s*health/gi
      ],
      'strength': [
        /(?:increase|improve|build)\s*(?:strength|power|max)/gi,
        /(?:lift|press|squat|deadlift)\s*(\d+)\s*(?:lbs?|pounds?|kg)/gi,
        /strength\s*training|powerlifting|resistance\s*training/gi,
        /one\s*rep\s*max|1rm|personal\s*record|pr/gi
      ],
      'general': [
        /overall\s*fitness|general\s*health|wellness|balanced\s*approach/gi,
        /stay\s*active|maintain\s*health|improve\s*quality\s*of\s*life/gi
      ]
    };

    // Apply agent-specific patterns if available
    if (agentSpecificPatterns[agentType]) {
      agentSpecificPatterns[agentType].forEach(pattern => {
        const matches = [...recommendationText.matchAll(pattern)];
        matches.forEach(match => {
          let goalText = match[1]?.trim() || match[0]?.trim();
          if (goalText && goalText.length > 5 && goalText.length < 150) {
            // Clean and format the goal text
            goalText = goalText.replace(/^[-•*]\s*/, '').trim();
            if (goalText.length > 0) {
              goalText = goalText.charAt(0).toUpperCase() + goalText.slice(1);
            }
            
            if (!goals.some(goal => goal.toLowerCase().includes(goalText.toLowerCase().substring(0, 15)))) {
              goals.push(goalText);
            }
          }
        });
      });
    }

    goalPatterns.forEach(pattern => {
      const matches = [...recommendationText.matchAll(pattern)];
      matches.forEach(match => {
        let goalText = match[1]?.trim() || match[0]?.trim();
        
        if (goalText && goalText.length > 8 && goalText.length < 150) {
          // Format weight goals specifically
          if (match[0].includes('lbs') || match[0].includes('pounds') || match[0].includes('kg')) {
            const action = match[0].match(/(lose|burn|gain|build)/i)?.[1];
            const amount = match[1];
            if (action && amount) {
              goalText = `${action.charAt(0).toUpperCase() + action.slice(1)} ${amount} lbs`;
            }
          } else {
            // Clean up bullet points and formatting
            goalText = goalText.replace(/^[-•*]\s*/, '').trim();
            // Ensure first letter is capitalized
            if (goalText.length > 0) {
              goalText = goalText.charAt(0).toUpperCase() + goalText.slice(1);
            }
            // Remove trailing incomplete words or phrases
            goalText = goalText.replace(/\s+(?:and|or|with|for|to)$/i, '').trim();
            
            // Improve goal statements by ensuring they're actionable
            if (!goalText.match(/^(Build|Develop|Improve|Increase|Enhance|Achieve|Maintain|Focus|Work|Complete|Stay|Track|Listen)/i)) {
              // If it doesn't start with an action word, try to make it actionable
              if (goalText.toLowerCase().includes('weight loss')) {
                goalText = 'Achieve sustainable weight loss';
              } else if (goalText.toLowerCase().includes('fat burning')) {
                goalText = 'Focus on effective fat burning';
              } else if (goalText.toLowerCase().includes('endurance')) {
                goalText = 'Build cardiovascular endurance';
              } else if (goalText.toLowerCase().includes('strength')) {
                goalText = 'Develop overall strength';
              } else if (goalText.toLowerCase().includes('muscle')) {
                goalText = 'Build lean muscle mass';
              }
            }
          }
          
          if (!goals.some(goal => goal.toLowerCase().includes(goalText.toLowerCase().substring(0, 15)))) {
            goals.push(goalText);
          }
        }
      });
    });

    // Improved fallbacks based on day of week and common fitness patterns
    const daySpecificExercises = {
      'Monday': [
        '3 sets of 12-15 push-ups (modify as needed)',
        '3 sets of 20 bodyweight squats with proper form', 
        '3 sets of 30-45 second plank holds',
        '10 minutes light cardio warm-up (walking or marching)',
        '5 minutes cool-down stretching'
      ],
      'Tuesday': [
        '20-25 minutes brisk walking or light jogging',
        '3 sets of 10 lunges (each leg) focusing on balance',
        '2 sets of 15 jumping jacks for cardio boost',
        '3 sets of 12 wall push-ups for upper body',
        '5-10 minutes full body stretching routine'
      ],
      'Wednesday': [
        '3 sets of 8-12 modified push-ups (knees or wall)',
        '3 sets of 15 wall sits (30-45 seconds each)',
        '2 sets of 12 leg raises for core strength',
        '15 minutes gentle yoga or tai chi flow',
        '3 sets of 10 arm circles (forward and backward)'
      ],
      'Thursday': [
        '25-30 minutes moderate cardio activity of choice',
        '3 sets of 10 tricep dips (using stable chair)',
        '3 sets of 20 calf raises for lower leg strength',
        '2 sets of 15 seated rows (resistance band)',
        '5-8 minutes walking cool-down with deep breathing'
      ],
      'Friday': [
        '3 sets of 12 mountain climbers (controlled pace)',
        '3 sets of 15 glute bridges for posterior chain',
        '2 sets of 30-45 second side planks (each side)',
        '15-20 minutes recreational activity you enjoy',
        '10 minutes flexibility and mobility work'
      ],
      'Saturday': [
        '30-45 minutes outdoor activity (hiking, cycling, sports)',
        '2 sets of 8-10 burpees (modify as needed)',
        '3 sets of 15 arm circles and shoulder rolls',
        '20 minutes nature walk or active recovery',
        '15 minutes comprehensive stretching session'
      ],
      'Sunday': [
        '20-30 minutes gentle yoga, tai chi, or meditation',
        '2 sets of 12 seated rows with resistance band',
        '3 sets of 10 standing marches with high knees',
        '15-20 minutes mindful walking or light movement',
        '10 minutes deep breathing and relaxation'
      ]
    };

    // Agent-specific goals based on user's fitness objective
    const agentSpecificGoals = {
      'general': {
        'Monday': [
          'Set the tone for a balanced fitness week',
          'Complete all planned exercises with proper form',
          'Focus on building healthy movement habits'
        ],
        'Tuesday': [
          'Build on Monday\'s momentum with consistent effort',
          'Focus on improving overall fitness and technique',
          'Maintain steady energy levels throughout the day'
        ],
        'Wednesday': [
          'Push through mid-week challenges with determination',
          'Stay consistent with your balanced fitness goals',
          'Listen to your body and adjust intensity as needed'
        ],
        'Thursday': [
          'Maintain strong habits as you approach the weekend',
          'Focus on recovery and proper rest',
          'Prepare for tomorrow\'s wellness activities'
        ],
        'Friday': [
          'Complete your week strong with balanced movement',
          'Achieve overall fitness improvements through consistency',
          'Build well-rounded strength and endurance',
          'Maintain proper form and technique in all exercises'
        ],
        'Saturday': [
          'Enjoy active recreation and longer workout sessions',
          'Balance fitness goals with social activities',
          'Explore new physical activities or outdoor adventures'
        ],
        'Sunday': [
          'Focus on recovery, flexibility, and mental wellness',
          'Prepare your body and mind for the upcoming week',
          'Reflect on your progress and plan for continued success'
        ]
      },
      'weight_loss': {
        'Monday': [
          'Start the week strong with fat-burning focus',
          'Create a sustainable calorie deficit through exercise',
          'Track your food intake and make mindful choices',
          'Stay hydrated and energized for weight loss success'
        ],
        'Tuesday': [
          'Maintain consistent cardio intensity for fat burning',
          'Focus on portion control and nutrient-dense meals',
          'Build lean muscle to boost your metabolism',
          'Celebrate small victories in your weight loss journey'
        ],
        'Wednesday': [
          'Push through mid-week motivation challenges',
          'Combine strength training with cardio for optimal results',
          'Stay committed to your calorie and exercise goals',
          'Remember that sustainable weight loss takes time'
        ],
        'Thursday': [
          'Keep your metabolism active with varied workouts',
          'Focus on recovery nutrition and adequate sleep',
          'Plan healthy weekend meals to stay on track',
          'Maintain consistency even when motivation wavers'
        ],
        'Friday': [
          'Complete your week with high-intensity fat burning',
          'Achieve 3-5 pounds weight loss per month safely',
          'Build cardiovascular endurance for better fat oxidation',
          'Prepare mentally for weekend challenges and social events'
        ],
        'Saturday': [
          'Stay active with fun, calorie-burning activities',
          'Make smart choices at social events and restaurants',
          'Incorporate longer cardio sessions if energy permits',
          'Focus on non-scale victories and how you feel'
        ],
        'Sunday': [
          'Plan your meals and workouts for the upcoming week',
          'Reflect on your weight loss progress and adjust goals',
          'Prepare healthy snacks and meal prep for success',
          'Prioritize rest and recovery for optimal fat loss'
        ]
      },
      'muscle_gain': {
        'Monday': [
          'Start your muscle-building week with compound movements',
          'Focus on progressive overload in all exercises',
          'Consume adequate protein for muscle protein synthesis',
          'Track your lifts and aim for strength improvements'
        ],
        'Tuesday': [
          'Build on yesterday\'s intensity with focused muscle targeting',
          'Prioritize proper form over heavy weight',
          'Fuel your muscles with post-workout nutrition',
          'Get adequate rest between sets for optimal performance'
        ],
        'Wednesday': [
          'Push through plateaus with varied rep ranges',
          'Focus on time under tension for muscle growth',
          'Maintain caloric surplus for muscle building',
          'Listen to your body and adjust volume as needed'
        ],
        'Thursday': [
          'Continue building strength with compound exercises',
          'Focus on muscle recovery and sleep quality',
          'Plan your weekend nutrition for continued gains',
          'Stay consistent with your muscle-building protocol'
        ],
        'Friday': [
          'Complete your week with focused muscle isolation',
          'Achieve 0.5-1 pound lean muscle gain per month',
          'Build functional strength and muscle mass',
          'Prepare for active recovery over the weekend'
        ],
        'Saturday': [
          'Enjoy active recovery or lighter training sessions',
          'Focus on muscle recovery and flexibility work',
          'Maintain your muscle-building nutrition on weekends',
          'Consider recreational activities that complement your goals'
        ],
        'Sunday': [
          'Prioritize recovery, stretching, and mobility work',
          'Plan your training split for the upcoming week',
          'Reflect on strength gains and muscle development',
          'Prepare meals to support your muscle-building goals'
        ]
      },
      'cardio': {
        'Monday': [
          'Start your week with steady-state cardio foundation',
          'Build your aerobic base with moderate intensity',
          'Focus on proper breathing techniques during exercise',
          'Track your heart rate zones for optimal training'
        ],
        'Tuesday': [
          'Increase cardio intensity with interval training',
          'Build cardiovascular endurance progressively',
          'Stay hydrated and monitor your exertion levels',
          'Focus on consistent pacing and rhythm'
        ],
        'Wednesday': [
          'Challenge your cardiovascular system with varied workouts',
          'Mix high and low-intensity cardio for best results',
          'Listen to your heart rate and adjust accordingly',
          'Stay motivated through mid-week training sessions'
        ],
        'Thursday': [
          'Maintain your cardio momentum with active recovery',
          'Focus on form and efficiency in your movements',
          'Prepare your cardiovascular system for weekend activities',
          'Monitor your resting heart rate improvements'
        ],
        'Friday': [
          'Complete your week with high-intensity cardio',
          'Improve VO2 max and cardiovascular efficiency',
          'Build stamina for daily activities and sports',
          'Celebrate your cardiovascular fitness improvements'
        ],
        'Saturday': [
          'Enjoy longer cardio sessions or outdoor activities',
          'Try new forms of cardiovascular exercise',
          'Focus on recreational cardio like hiking or cycling',
          'Use weekend time for extended aerobic training'
        ],
        'Sunday': [
          'Focus on light cardio and active recovery',
          'Plan your cardio training schedule for next week',
          'Reflect on your cardiovascular fitness progress',
          'Prepare your mindset for consistent cardio training'
        ]
      },
      'strength': {
        'Monday': [
          'Start your strength week with major compound lifts',
          'Focus on progressive overload and proper form',
          'Build maximal strength through heavy, controlled reps',
          'Track your one-rep max improvements over time'
        ],
        'Tuesday': [
          'Continue strength building with accessory movements',
          'Focus on weak points and muscle imbalances',
          'Maintain intensity while allowing adequate recovery',
          'Perfect your lifting technique and movement patterns'
        ],
        'Wednesday': [
          'Challenge your strength with varied rep ranges',
          'Focus on functional strength and power development',
          'Stay committed to your strength training protocol',
          'Monitor fatigue levels and adjust intensity accordingly'
        ],
        'Thursday': [
          'Build explosive power and strength endurance',
          'Focus on recovery between intense training sessions',
          'Plan your weekend training for optimal recovery',
          'Stay consistent with your strength development goals'
        ],
        'Friday': [
          'Complete your week with focused strength training',
          'Achieve consistent strength gains week over week',
          'Build functional strength for daily activities',
          'Test your limits safely with proper progression'
        ],
        'Saturday': [
          'Focus on lighter loads and movement quality',
          'Work on mobility and flexibility for better lifting',
          'Try new strength training variations or techniques',
          'Enjoy recreational activities that support strength'
        ],
        'Sunday': [
          'Prioritize recovery, stretching, and injury prevention',
          'Plan your strength training progression for next week',
          'Reflect on your strength gains and set new targets',
          'Prepare mentally and physically for heavy training days'
        ]
      }
    };

    // Add fallback parsing for any line that looks like useful content
    const lines = recommendationText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // First, try to find day-specific content
    const daySpecificLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      return lowerLine.includes(dayOfWeek.toLowerCase()) || 
             lowerLine.includes('today') ||
             lowerLine.includes('daily') ||
             (dayOfWeek === 'Friday' && (lowerLine.includes('friday') || lowerLine.includes('end of week')));
    });
    
    // More aggressive complete sentence extraction
    const allLinesToProcess = daySpecificLines.length > 0 ? daySpecificLines.concat(lines) : lines;
    
    allLinesToProcess.forEach(line => {
      // Remove markdown formatting and bullets
      const cleanLine = line.replace(/^[#*-•>\s]+/, '').trim();
      
      if (cleanLine.length > 20 && cleanLine.length < 300) {
        // Look for complete sentences that end with periods or are complete thoughts
        const isCompleteSentence = cleanLine.endsWith('.') || 
                                   cleanLine.endsWith('!') || 
                                   cleanLine.includes(' and ') ||
                                   cleanLine.includes(' with ') ||
                                   cleanLine.match(/\b(daily|per day|each day|minutes?|calories?|grams?)\b/);
        
        if (isCompleteSentence) {
          // Exercise keywords - look for complete exercise descriptions
          if (/\b(sets?|reps?|minutes?|seconds?|push-?ups?|squats?|lunges?|planks?|burpees?|cardio|workout|exercise|training|resistance|strength)\b/i.test(cleanLine)) {
            // Make sure it's not a goal statement
            if (!cleanLine.toLowerCase().includes('goal') && 
                !cleanLine.toLowerCase().includes('aim to') &&
                !cleanLine.toLowerCase().includes('focus on achieving')) {
              if (!exercises.some(ex => ex.toLowerCase().includes(cleanLine.toLowerCase().substring(0, 20)))) {
                exercises.push(cleanLine);
              }
            }
          }
          // Goal keywords - look for complete goal statements
          else if (/\b(goal|target|lose|gain|build|improve|achieve|focus|weight|fat|muscle|strength|endurance|burning)\b/i.test(cleanLine)) {
            // Additional validation to ensure this is really a goal and not an exercise or nutrition tip
            if (!cleanLine.toLowerCase().includes('minutes') && 
                !cleanLine.toLowerCase().includes('sets') && 
                !cleanLine.toLowerCase().includes('reps') &&
                !cleanLine.toLowerCase().includes('calories') &&
                !cleanLine.toLowerCase().includes('protein') &&
                !cleanLine.toLowerCase().includes('grams') &&
                !cleanLine.toLowerCase().includes('exercise') &&
                !cleanLine.toLowerCase().includes('workout') &&
                !cleanLine.toLowerCase().includes('training')) {
              if (!goals.some(goal => goal.toLowerCase().includes(cleanLine.toLowerCase().substring(0, 20)))) {
                goals.push(cleanLine);
              }
            }
          }
        }
      }
    });

    // NEW: Add specific extraction for database results and machine names
    const dbExercisePattern = /([A-Z][a-zA-Z\s]+(?:climber|master|mill|bike|row|press|curl|lift|squat|lunge|plank|push|pull))/gi;
    const dbMatches = [...recommendationText.matchAll(dbExercisePattern)];
    dbMatches.forEach(match => {
      const exerciseName = match[1]?.trim();
      if (exerciseName && exerciseName.length > 3 && exerciseName.length < 50) {
        if (!exercises.some(ex => ex.toLowerCase().includes(exerciseName.toLowerCase().substring(0, 15)))) {
          exercises.push(exerciseName);
        }
      }
    });

    // NEW: Extract specific exercise names from "RECOMMENDED EXERCISES" section
    const exerciseListPattern = /RECOMMENDED EXERCISES[^:]*:\s*([^]+?)(?=\n\n|\nRaw|$)/i;
    const exerciseListMatch = recommendationText.match(exerciseListPattern);
    if (exerciseListMatch && exerciseListMatch[1]) {
      const exerciseSection = exerciseListMatch[1];
      if (exerciseSection && typeof exerciseSection === 'string') {
        const exerciseLines = exerciseSection.split('\n').filter(line => line.trim().length > 0);
        exerciseLines.forEach(line => {
          const cleaned = line.replace(/^[-•*\s]*/, '').trim();
          if (cleaned.length > 5 && cleaned.length < 100 && 
              !cleaned.toLowerCase().includes('from fitness database') &&
              !cleaned.toLowerCase().includes('raw exercises')) {
            if (!exercises.some(ex => ex.toLowerCase().includes(cleaned.toLowerCase().substring(0, 15)))) {
              exercises.push(cleaned);
            }
          }
        });
      }
    }

    // Extract validated content for display

    // Filter out incomplete or too short content with more permissive validation
    const validExercises = exercises.filter(ex => {
      const clean = ex.trim();
      return clean.length > 10 && // Reduced to capture more exercises
             !clean.startsWith('*') &&
             !clean.startsWith('-') &&
             !clean.endsWith(' of') && 
             !clean.endsWith(' sets') &&
             !clean.endsWith(':') &&
             !clean.match(/^\d+\s*(sets?|reps?)?\s*$/) &&
             !clean.includes("'m having") && // Filter out user input
             !clean.includes("I have") && // Filter out user input
             !clean.includes("I want") && // Filter out user input
             !clean.includes("since I") && // Filter out user input
             !clean.toLowerCase().includes("trouble") && // Filter out health conditions
             !clean.toLowerCase().includes("problem") && // Filter out health conditions
             // Prefer specific exercise names over generic time recommendations
             (!clean.toLowerCase().includes('minutes of moderate') || clean.toLowerCase().includes('stair') || clean.toLowerCase().includes('machine')) &&
             clean.split(' ').length >= 2; // Reduced to 2 words to capture exercise names
    });
    

    
    const validGoals = goals.filter(goal => {
      const clean = goal.trim();
      return clean.length > 20 && // Increased back to 20 for better quality
             !clean.startsWith(':') && 
             !clean.endsWith(':') &&
             !clean.startsWith('*') &&
             !clean.startsWith('-') &&
             !clean.includes('None,') &&
             !clean.includes('Member') &&
             !clean.includes('Target') &&
             // Filter out exercise-related content that got misclassified as goals
             !clean.includes('Quadriceps') &&
             !clean.includes('Equipment:') &&
             !clean.includes('Machine)') &&
             !clean.includes('Body Only') &&
             !clean.includes('(Targets:') &&
             !clean.includes('detected -') &&
             !clean.includes('minutes') &&
             !clean.includes('sets') &&
             !clean.includes('reps') &&
             !clean.includes('exercise') &&
             !clean.includes('workout') &&
             !clean.includes('training') &&
             // Filter out incomplete phrases
             !clean.endsWith('build') &&
             !clean.endsWith('loss') &&
             !clean.endsWith('gain') &&
             !clean.endsWith('improve') &&
             !clean.endsWith('focus') &&
             !clean.endsWith('fitness') &&
             // Filter out short fragments
             !clean.startsWith('Week ') &&
             !clean.startsWith('Your ') &&
             // Ensure it's a complete goal statement (more strict)
             (clean.includes('goal') || 
              clean.includes('focus on') || 
              clean.includes('aim to') ||
              clean.includes('build') ||
              clean.includes('lose') ||
              clean.includes('gain') ||
              clean.includes('improve') ||
              clean.includes('achieve') ||
              clean.includes('develop') ||
              clean.includes('weight loss') ||
              clean.includes('fat burning') ||
              clean.includes('muscle building') ||
              clean.includes('strength training') ||
              clean.includes('cardiovascular health') ||
              clean.length > 40) && // Require longer, more complete statements
             clean.split(' ').length >= 4; // Back to 4 words minimum
    });

    // If we don't have enough quality content, prefer the fallbacks
    const useExerciseFallback = validExercises.length < 1; // Keep at 1 for exercises
    const useGoalsFallback = validGoals.length < 2; // Increased back to 2 for goals to ensure quality

    return {
      exercises: useExerciseFallback ? 
        (daySpecificExercises[dayOfWeek] || daySpecificExercises['Monday']) :
        validExercises.slice(0, 5),
      goals: useGoalsFallback ? 
        (agentSpecificGoals[agentType]?.[dayOfWeek] || agentSpecificGoals['general'][dayOfWeek] || [
          'Complete all planned exercises with proper form',
          'Stay consistent with daily nutrition goals',
          'Track progress and celebrate small wins',
          'Listen to your body and prioritize recovery'
        ]) :
        validGoals.slice(0, 4)
    };
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

  const handleGetNewRecommendation = () => {
    navigate('/fitness-advisor');
  };

  const handleExerciseCompletion = (exerciseIndex) => {
    if (!user || !user.email) return;
    
    const today = new Date().toLocaleDateString();
    const exerciseKey = `${today}_${exerciseIndex}`;
    
    // Toggle completion status
    const newCompletedExercises = new Set(completedExercises);
    if (newCompletedExercises.has(exerciseKey)) {
      newCompletedExercises.delete(exerciseKey);
    } else {
      newCompletedExercises.add(exerciseKey);
    }
    
    setCompletedExercises(newCompletedExercises);
    
    // Save to localStorage with user-specific key for today
    const userSpecificCompletedKey = `completedExercises_${user.email}_${today}`;
    localStorage.setItem(userSpecificCompletedKey, JSON.stringify(Array.from(newCompletedExercises)));
  };

  const handleViewFullRecommendation = (recommendation = null) => {
    const recToShow = recommendation || latestRecommendation;
    setSelectedRecommendation(recToShow);
    setShowFullRecommendation(true);
  };

  const handleCloseFullRecommendation = () => {
    setShowFullRecommendation(false);
    setSelectedRecommendation(null);
  };

  const formatRecommendationContent = (content) => {
    // Split content into sections for better formatting
    const sections = content.split(/(?=##|###|\*\*)/);
    return sections.map((section, index) => {
      if (section.trim().startsWith('##')) {
        // Main headers
        const headerText = section.replace(/^##\s*/, '').split('\n')[0];
        const bodyText = section.substring(section.indexOf('\n') + 1);
        return (
          <div key={index} className="mb-4">
            <h4 className="text-primary border-bottom pb-2">{headerText}</h4>
            <div className="mt-2">{formatTextContent(bodyText)}</div>
          </div>
        );
      } else if (section.trim().startsWith('###')) {
        // Sub headers
        const headerText = section.replace(/^###\s*/, '').split('\n')[0];
        const bodyText = section.substring(section.indexOf('\n') + 1);
        return (
          <div key={index} className="mb-3">
            <h5 className="text-secondary">{headerText}</h5>
            <div className="mt-2">{formatTextContent(bodyText)}</div>
          </div>
        );
      } else if (section.trim().startsWith('**') && section.includes('**')) {
        // Bold sections
        const boldText = section.match(/\*\*(.*?)\*\*/)?.[1] || '';
        const restText = section.replace(/\*\*.*?\*\*/, '');
        return (
          <div key={index} className="mb-2">
            <strong className="text-info">{boldText}</strong>
            <div>{formatTextContent(restText)}</div>
          </div>
        );
      } else {
        return <div key={index} className="mb-2">{formatTextContent(section)}</div>;
      }
    });
  };

  const formatTextContent = (text) => {
    return text.split('\n').map((line, index) => {
      if (line.trim().startsWith('-')) {
        return (
          <div key={index} className="ms-3">
            <i className="fas fa-check-circle text-success me-2"></i>
            {line.replace(/^-\s*/, '')}
          </div>
        );
      } else if (line.trim().startsWith('*')) {
        return (
          <div key={index} className="ms-3">
            <i className="fas fa-star text-warning me-2"></i>
            {line.replace(/^\*\s*/, '')}
          </div>
        );
      } else if (line.trim()) {
        return <div key={index}>{line}</div>;
      }
      return null;
    });
  };

  if (!user) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          <h4>Please log in to view your dashboard</h4>
          <p>You need to be logged in to access your personalized fitness dashboard.</p>
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
              <h2>Welcome back, {user.name || 'Fitness Champion'}!</h2>
              <p className="text-muted">Ready to crush your fitness goals today?</p>
            </div>
            <button 
              className="btn btn-primary"
              onClick={handleGetNewRecommendation}
            >
              <i className="fas fa-plus me-2"></i>
              Get New Recommendation
            </button>
          </div>
        </div>
      </div>

      {/* Today's Plan Section */}
      {todaysPlan ? (
        <div className="row mb-3">
          <div className="col-12">
            <div className={`card ${todaysPlan.fromWeeklyPlan ? 'border-success' : 'border-primary'}`}>
              <div className={`card-header ${todaysPlan.fromWeeklyPlan ? 'bg-success' : 'bg-primary'} text-white py-2`}>
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">
                    <i className="fas fa-calendar-day me-2"></i>
                    Today's Plan - {todaysPlan.dayOfWeek}
                  </h4>
                  <div className="d-flex gap-2">
                    {todaysPlan.fromWeeklyPlan && (
                      <span className="badge bg-light text-dark">
                        <i className="fas fa-calendar-week me-1"></i>
                        From Weekly Plan
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="card-body py-3">
                {/* Focus Area (if from weekly plan) */}
                {todaysPlan.fromWeeklyPlan && todaysPlan.focus && (
                  <div className="row mb-2">
                    <div className="col-12">
                      <div className="alert alert-info d-flex align-items-center mb-2 py-2">
                        <i className="fas fa-crosshairs me-2"></i>
                        <strong>Focus Area: </strong>
                        <span className="ms-2">{todaysPlan.focus}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="row">
                  {/* Exercise Plan */}
                  <div className={todaysPlan.fromWeeklyPlan ? "col-md-6" : "col-md-6"}>
                    <h5 className={`${todaysPlan.fromWeeklyPlan ? "text-success" : "text-primary"} mb-2`}>
                      <i className="fas fa-dumbbell me-2"></i>
                      {todaysPlan.isRestDay ? 'Recovery Activities' : 'Exercises'}
                    </h5>
                    <div className="exercises-list">
                      {(todaysPlan.isRestDay ? todaysPlan.activities : todaysPlan.exercises).map((exercise, index) => {
                        const today = new Date().toLocaleDateString();
                        const exerciseKey = `${today}_${index}`;
                        const isCompleted = completedExercises.has(exerciseKey);
                        
                        return (
                          <div key={index} className="d-flex align-items-start mb-2">
                            <div className="me-2">
                              <span className="badge bg-primary rounded-pill">{index + 1}</span>
                            </div>
                            <div className="flex-grow-1">
                              <p className={`mb-0 ${isCompleted ? 'text-decoration-line-through text-muted' : ''}`}>
                                {exercise}
                              </p>
                            </div>
                            <button 
                              className={`btn btn-sm ms-2 ${isCompleted ? 'btn-success' : 'btn-outline-success'}`}
                              title={isCompleted ? "Completed - Click to undo" : "Mark as complete"}
                              onClick={() => handleExerciseCompletion(index)}
                            >
                              <i className={`fas ${isCompleted ? 'fa-check-circle' : 'fa-check'}`}></i>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Goals */}
                  <div className="col-md-6">
                    <h5 className="text-warning mb-2">
                      <i className="fas fa-target me-2"></i>
                      Today's Goals
                    </h5>
                    <div className="goals-list">
                      {todaysPlan.goals.map((goal, index) => (
                        <div key={index} className="d-flex align-items-start mb-1">
                          <i className="fas fa-star text-warning me-2 mt-1"></i>
                          <span>{goal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes (if from weekly plan) */}
                {todaysPlan.fromWeeklyPlan && todaysPlan.notes && (
                  <div className="row mt-2">
                    <div className="col-12">
                      <div className="alert alert-light mb-2 py-2">
                        <i className="fas fa-sticky-note me-2 text-info"></i>
                        <strong>Notes: </strong>
                        {todaysPlan.notes}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="row mt-2">
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        {todaysPlan.fromWeeklyPlan ? (
                          <button 
                            className="btn btn-success"
                            onClick={() => navigate('/weekly-plan')}
                          >
                            <i className="fas fa-calendar-week me-2"></i>
                            View Full Weekly Plan
                          </button>
                        ) : (
                          <button 
                            className="btn btn-primary"
                            onClick={generateWeeklyPlanFromDashboard}
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
                        )}
                      </div>
                      <small className="text-muted">
                        <i className="fas fa-clock me-1"></i>
                        {todaysPlan.date}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-body text-center">
                <i className="fas fa-info-circle fa-3x text-info mb-3"></i>
                <h4>No Fitness Plan Yet</h4>
                <p className="text-muted">Get started by creating your first personalized fitness recommendation!</p>
                <button 
                  className="btn btn-info"
                  onClick={handleGetNewRecommendation}
                >
                  Create Your First Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest Recommendation Summary */}
      {latestRecommendation && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="fas fa-robot me-2"></i>
                    Latest AI Recommendation
                  </h5>
                  <div>
                    <span className="badge bg-info me-2">{latestRecommendation.analysisMode}</span>
                    <small className="text-muted">{formatTimeAgo(latestRecommendation.timestamp)}</small>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* Images preview if available */}
                  {latestRecommendation.capturedImages && latestRecommendation.capturedImages.length > 0 && (
                    <div className="col-md-3">
                      <h6 className="text-primary mb-2">
                        <i className="fas fa-camera me-2"></i>
                        Analyzed Images
                      </h6>
                      <div className="mb-3">
                        {latestRecommendation.capturedImages.slice(0, 2).map((imageUrl, index) => (
                          <div key={index} className="mb-2">
                            <img 
                              src={imageUrl} 
                              className="img-thumbnail" 
                              alt={`Analyzed image ${index + 1}`}
                              style={{ 
                                width: '100%', 
                                maxHeight: '120px', 
                                objectFit: 'cover',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleViewFullRecommendation()}
                              title="Click to view full recommendation"
                            />
                          </div>
                        ))}
                        {latestRecommendation.capturedImages.length > 2 && (
                          <small className="text-muted">
                            +{latestRecommendation.capturedImages.length - 2} more image(s)
                          </small>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className={latestRecommendation.capturedImages && latestRecommendation.capturedImages.length > 0 ? "col-md-5" : "col-md-8"}>
                    <div className="recommendation-preview">
                      {/* Show more content and format better */}
                      {latestRecommendation.recommendation.length > 500 
                        ? (
                          <div>
                            <div className="mb-3">
                              {formatRecommendationContent(latestRecommendation.recommendation.substring(0, 500))}
                            </div>
                            <div className="text-muted small">
                              <i className="fas fa-info-circle me-1"></i>
                              Showing first 500 characters of {latestRecommendation.recommendation.length} total
                            </div>
                          </div>
                        )
                        : formatRecommendationContent(latestRecommendation.recommendation)
                      }
                    </div>
                    {latestRecommendation.recommendation.length > 500 && (
                      <button 
                        className="btn btn-primary btn-sm mt-3"
                        onClick={() => handleViewFullRecommendation()}
                      >
                        <i className="fas fa-expand me-2"></i>
                        View Complete Recommendation
                      </button>
                    )}
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-light h-100">
                      <div className="card-body">
                        <h6 className="card-title text-primary">
                          <i className="fas fa-user-circle me-2"></i>
                          Your Profile at Analysis
                        </h6>
                        <ul className="list-unstyled small">
                          <li className="mb-1">
                            <strong>Gender:</strong> 
                            <span className="badge bg-secondary ms-2">{latestRecommendation.userProfile.gender}</span>
                          </li>
                          <li className="mb-1">
                            <strong>Age:</strong> 
                            <span className="badge bg-info ms-2">{latestRecommendation.userProfile.age}</span>
                          </li>
                          <li className="mb-1">
                            <strong>Weight:</strong> 
                            <span className="badge bg-success ms-2">{latestRecommendation.userProfile.weight} lbs</span>
                          </li>
                          <li className="mb-1">
                            <strong>Goal:</strong> 
                            <span className="badge bg-warning ms-2">{latestRecommendation.userProfile.agentType.replace('_', ' ')}</span>
                          </li>
                          {latestRecommendation.userProfile.healthConditions && (
                            <li className="mb-1">
                              <strong>Health Notes:</strong> 
                              <div className="small text-muted mt-1 p-2 border rounded">
                                {latestRecommendation.userProfile.healthConditions.length > 100 
                                  ? `${latestRecommendation.userProfile.healthConditions.substring(0, 100)}...`
                                  : latestRecommendation.userProfile.healthConditions
                                }
                              </div>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendation History */}
      {recommendationHistory.length > 0 && (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-history me-2"></i>
                  Recent Recommendations
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {recommendationHistory.slice(0, 3).map((rec, index) => (
                    <div key={index} className="col-md-4 mb-3">
                      <div 
                        className="card border-light h-100 recommendation-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleViewFullRecommendation(rec)}
                      >
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <span className="badge bg-secondary">{rec.analysisMode}</span>
                            <small className="text-muted">{rec.dateCreated}</small>
                          </div>
                          <p className="card-text small">
                            {rec.recommendation.substring(0, 120)}...
                          </p>
                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                              <span className="badge bg-outline-primary me-1">
                                {rec.userProfile.agentType.replace('_', ' ')}
                              </span>
                              {formatTimeAgo(rec.timestamp)}
                            </small>
                            <i className="fas fa-eye text-primary"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {recommendationHistory.length > 3 && (
                  <div className="text-center">
                    <button className="btn btn-outline-secondary btn-sm">
                      View All History ({recommendationHistory.length} total)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Quick Actions</h5>
              <div className="row">
                <div className="col-md-3">
                  <button 
                    className="btn btn-outline-primary w-100 mb-2"
                    onClick={() => navigate('/fitness-advisor')}
                  >
                    <i className="fas fa-camera me-2"></i>
                    New Analysis
                  </button>
                </div>
                <div className="col-md-3">
                  <button 
                    className="btn btn-outline-success w-100 mb-2"
                    onClick={() => navigate('/food-recommendations')}
                  >
                    <i className="fas fa-utensils me-2"></i>
                    Food Recommendations
                  </button>
                </div>
                <div className="col-md-3">
                  <button 
                    className="btn btn-outline-info w-100 mb-2"
                    onClick={() => navigate('/identify-food')}
                  >
                    <i className="fas fa-search me-2"></i>
                    Identify Food
                  </button>
                </div>
                <div className="col-md-3">
                  <button 
                    className="btn btn-outline-warning w-100 mb-2"
                    onClick={() => navigate('/weekly-plan')}
                  >
                    <i className="fas fa-calendar me-2"></i>
                    Weekly Plan
                  </button>
                </div>
              </div>
              <div className="row mt-2">
                <div className="col-md-4">
                  <button 
                    className="btn btn-outline-secondary w-100 mb-2"
                    onClick={() => navigate('/profile')}
                  >
                    <i className="fas fa-user me-2"></i>
                    Update Profile
                  </button>
                </div>
                {/* Voice Chat DISABLED to save tokens */}
                {/* <div className="col-md-4">
                  <button 
                    className="btn btn-outline-dark w-100 mb-2"
                    onClick={() => navigate('/voice-chat')}
                  >
                    <i className="fas fa-microphone me-2"></i>
                    Voice Chat
                  </button>
                </div> */}
                <div className="col-md-4">
                  <button 
                    className="btn btn-outline-primary w-100 mb-2"
                    onClick={() => navigate('/progress')}
                  >
                    <i className="fas fa-chart-line me-2"></i>
                    Progress
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Recommendation Modal */}
      {showFullRecommendation && selectedRecommendation && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-robot me-2"></i>
                  Complete Fitness Recommendation
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={handleCloseFullRecommendation}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-8">
                    <div className="d-flex align-items-center mb-3">
                      <span className="badge bg-info me-2">{selectedRecommendation.analysisMode}</span>
                      <small className="text-muted">{formatTimeAgo(selectedRecommendation.timestamp)}</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-light">
                      <div className="card-body py-2">
                        <h6 className="card-title text-primary mb-2">
                          <i className="fas fa-user-circle me-1"></i>
                          Profile Summary
                        </h6>
                        <div className="row small">
                          <div className="col-6">
                            <strong>Gender:</strong> {selectedRecommendation.userProfile.gender}<br/>
                            <strong>Age:</strong> {selectedRecommendation.userProfile.age}<br/>
                          </div>
                          <div className="col-6">
                            <strong>Weight:</strong> {selectedRecommendation.userProfile.weight} lbs<br/>
                            <strong>Goal:</strong> {selectedRecommendation.userProfile.agentType.replace('_', ' ')}<br/>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Show captured images if available */}
                {selectedRecommendation.capturedImages && selectedRecommendation.capturedImages.length > 0 && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <h6 className="text-primary">
                        <i className="fas fa-camera me-2"></i>
                        Images Analyzed
                      </h6>
                      <div className="row">
                        {selectedRecommendation.capturedImages.map((imageUrl, index) => (
                          <div key={index} className="col-md-3 mb-3">
                            <img 
                              src={imageUrl} 
                              className="img-fluid rounded" 
                              alt={`Analyzed image ${index + 1}`}
                              style={{ 
                                maxHeight: '200px', 
                                width: '100%',
                                objectFit: 'cover'
                              }}
                            />
                            <small className="text-muted d-block text-center mt-1">
                              Image {index + 1}
                            </small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="recommendation-content">
                  {formatRecommendationContent(selectedRecommendation.recommendation)}
                </div>
                
                {selectedRecommendation.userProfile.healthConditions && (
                  <div className="mt-4">
                    <h6 className="text-warning">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      Health Considerations
                    </h6>
                    <div className="alert alert-warning">
                      {selectedRecommendation.userProfile.healthConditions}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCloseFullRecommendation}
                >
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => {
                    handleCloseFullRecommendation();
                    navigate('/fitness-advisor');
                  }}
                >
                  <i className="fas fa-plus me-2"></i>
                  Get New Recommendation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add some inline styles for better presentation
const styles = `
  .recommendation-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
  }
  
  .recommendation-preview {
    max-height: 400px;
    overflow-y: auto;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #dee2e6;
  }
  
  .recommendation-content {
    line-height: 1.6;
  }
  
  .recommendation-content h4 {
    color: #0d6efd;
    border-bottom: 2px solid #0d6efd;
    padding-bottom: 8px;
    margin-top: 24px;
    margin-bottom: 16px;
  }
  
  .recommendation-content h5 {
    color: #6c757d;
    margin-top: 20px;
    margin-bottom: 12px;
  }
  
  .modal-xl {
    max-width: 90%;
  }
  
  @media (max-width: 768px) {
    .modal-xl {
      max-width: 95%;
      margin: 10px;
    }
  }
`;

// Inject styles into the document head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default DashboardPage;
