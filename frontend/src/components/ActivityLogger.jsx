import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { Modal, Button, Form, Row, Col, Alert } from 'react-bootstrap';

const ActivityLogger = ({ show, onHide, onSave, date, user }) => {
  // Default values for the form
  const initialValues = {
    date: date || new Date().toISOString().split('T')[0],
    exercisesCompleted: [],
    caloriesBurned: '',
    steps: '',
    milesRun: '',
    feelingRating: 3,
    notes: '',
  };
  
  // Form states
  const [formData, setFormData] = useState(initialValues);
  const [exercises, setExercises] = useState([]);
  const [validated, setValidated] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Load any existing activities for this date
    loadExistingActivities();
    
    // Load available exercises from weekly plan
    loadAvailableExercises();
  }, [date, user]);

  const loadExistingActivities = () => {
    try {
      // Get activities for this specific date if they exist
      const userActivitiesKey = `userActivities_${user.email}`;
      const savedActivities = localStorage.getItem(userActivitiesKey);
      
      if (savedActivities) {
        const parsedActivities = JSON.parse(savedActivities);
        const todayActivity = parsedActivities.find(
          act => new Date(act.date).toDateString() === new Date(date).toDateString()
        );
        
        if (todayActivity) {
          setFormData({
            date: date,
            exercisesCompleted: todayActivity.exercisesCompleted || [],
            caloriesBurned: todayActivity.caloriesBurned || '',
            steps: todayActivity.steps || '',
            milesRun: todayActivity.milesRun || '',
            feelingRating: todayActivity.feelingRating || 3,
            notes: todayActivity.notes || '',
          });
        } else {
          setFormData(initialValues);
        }
      }
    } catch (error) {
      console.error('Error loading existing activities:', error);
    }
  };

  const loadAvailableExercises = async () => {
    try {
      // Get today's exercises from weekly plan via API
      try {
        const response = await fetch(getApiUrl(`/get-weekly-plan?user_email=${encodeURIComponent(user.email)}`));
        const data = await response.json();
        
        if (data.success && data.weekly_plan) {
          const weeklyPlan = data.weekly_plan;
          const today = new Date(date);
          const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });
          
          // Find today's plan
          const todayPlan = weeklyPlan.dailyPlans && weeklyPlan.dailyPlans[dayOfWeek];
          
          if (todayPlan && todayPlan.exercises) {
            const exerciseList = todayPlan.exercises.map(ex => {
              return typeof ex === 'string' ? ex : (ex.name || ex.exercise || ex);
            });
            setExercises(exerciseList);
            console.log(`Loaded ${exerciseList.length} exercises for ${dayOfWeek}:`, exerciseList);
          } else {
            console.log(`No exercises found for ${dayOfWeek} or it's a rest day`);
            setExercises([]);
          }
        } else {
          console.log('No weekly plan found, checking localStorage fallback');
          // Fallback to localStorage for backward compatibility
          loadAvailableExercisesFromLocalStorage();
        }
      } catch (apiError) {
        console.error('Error fetching weekly plan from API:', apiError);
        // Fallback to localStorage
        loadAvailableExercisesFromLocalStorage();
      }
    } catch (error) {
      console.error('Error loading available exercises:', error);
      setExercises([]);
    }
  };

  const loadAvailableExercisesFromLocalStorage = () => {
    try {
      // Get today's exercises from weekly plan in localStorage (fallback)
      const userSpecificWeeklyKey = `weeklyFitnessPlan_${user.email}`;
      const weeklyPlanData = localStorage.getItem(userSpecificWeeklyKey);
      
      if (weeklyPlanData) {
        const weeklyPlan = JSON.parse(weeklyPlanData);
        const today = new Date(date);
        const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });
        
        // Find today's plan
        const todayPlan = weeklyPlan.dailyPlans && weeklyPlan.dailyPlans[dayOfWeek];
        
        if (todayPlan && todayPlan.exercises) {
          setExercises(todayPlan.exercises.map(ex => {
            return typeof ex === 'string' ? ex : (ex.name || ex.exercise || ex);
          }));
        } else {
          setExercises([]);
        }
      } else {
        setExercises([]);
      }
    } catch (error) {
      console.error('Error loading exercises from localStorage:', error);
      setExercises([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleExerciseToggle = (exercise) => {
    setFormData(prev => {
      const exercisesCompleted = [...prev.exercisesCompleted];
      
      if (exercisesCompleted.includes(exercise)) {
        return {
          ...prev,
          exercisesCompleted: exercisesCompleted.filter(ex => ex !== exercise)
        };
      } else {
        return {
          ...prev,
          exercisesCompleted: [...exercisesCompleted, exercise]
        };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    try {
      // Save the activity data
      const userActivitiesKey = `userActivities_${user.email}`;
      let activities = [];
      
      const savedActivities = localStorage.getItem(userActivitiesKey);
      if (savedActivities) {
        activities = JSON.parse(savedActivities);
        
        // Check if activity for this date already exists
        const existingIndex = activities.findIndex(
          act => new Date(act.date).toDateString() === new Date(formData.date).toDateString()
        );
        
        if (existingIndex >= 0) {
          // Update existing activity
          activities[existingIndex] = {
            ...activities[existingIndex],
            ...formData,
            lastUpdated: new Date().toISOString()
          };
        } else {
          // Add new activity
          activities.push({
            ...formData,
            completed: formData.exercisesCompleted.length,
            lastUpdated: new Date().toISOString()
          });
        }
      } else {
        // First activity entry
        activities = [{
          ...formData,
          completed: formData.exercisesCompleted.length,
          lastUpdated: new Date().toISOString()
        }];
      }
      
      // Save to localStorage
      localStorage.setItem(userActivitiesKey, JSON.stringify(activities));
      
      // Show success message
      setShowSuccess(true);
      
      // Notify parent component
      if (onSave) {
        onSave(formData);
      }
      
      // Hide success message after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        onHide();
      }, 2000);
      
    } catch (error) {
      console.error('Error saving activity data:', error);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-dumbbell me-2"></i>
          Log Your Activity
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showSuccess && (
          <Alert variant="success" className="mb-3">
            <i className="fas fa-check-circle me-2"></i>
            Activity logged successfully!
          </Alert>
        )}
        
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-4">
            <Form.Label>Exercises Completed</Form.Label>
            {exercises.length > 0 ? (
              <div className="exercise-list p-3 border rounded">
                {exercises.map((exercise, index) => (
                  <Form.Check 
                    key={index}
                    type="checkbox"
                    id={`exercise-${index}`}
                    label={exercise}
                    checked={formData.exercisesCompleted.includes(exercise)}
                    onChange={() => handleExerciseToggle(exercise)}
                    className="mb-2"
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted fst-italic">
                No exercises scheduled for today. Create a weekly plan to see exercises here.
              </p>
            )}
          </Form.Group>
          
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Calories Burned</Form.Label>
                <Form.Control
                  type="number"
                  name="caloriesBurned"
                  placeholder="Optional"
                  value={formData.caloriesBurned}
                  onChange={handleInputChange}
                  min="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Steps</Form.Label>
                <Form.Control
                  type="number"
                  name="steps"
                  placeholder="Optional"
                  value={formData.steps}
                  onChange={handleInputChange}
                  min="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Miles Run/Walked</Form.Label>
                <Form.Control
                  type="number"
                  name="milesRun"
                  placeholder="Optional"
                  value={formData.milesRun}
                  onChange={handleInputChange}
                  min="0"
                  step="0.1"
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Form.Group className="mb-3">
            <Form.Label>How do you feel today?</Form.Label>
            <div className="feeling-rating-container">
              {/* Numerical scale labels */}
              <div className="d-flex justify-content-between mb-2 px-2">
                <small className="text-muted">1 (Poor)</small>
                <small className="text-muted">2 (Fair)</small>
                <small className="text-muted">3 (Good)</small>
                <small className="text-muted">4 (Great)</small>
                <small className="text-muted">5 (Excellent)</small>
              </div>
              
              {/* Slider and current value display */}
              <div className="d-flex align-items-center">
                <Form.Range
                  name="feelingRating"
                  min="1"
                  max="5"
                  value={formData.feelingRating}
                  onChange={handleInputChange}
                  className="me-3 flex-grow-1"
                />
                <div className="mood-indicator d-flex align-items-center">
                  <span className="badge bg-primary me-2 fs-6">{formData.feelingRating}</span>
                  <div>
                    {formData.feelingRating === 1 && <i className="fas fa-sad-tear fa-2x text-danger" title="Poor"></i>}
                    {formData.feelingRating === 2 && <i className="fas fa-frown fa-2x text-warning" title="Fair"></i>}
                    {formData.feelingRating === 3 && <i className="fas fa-meh fa-2x text-secondary" title="Good"></i>}
                    {formData.feelingRating === 4 && <i className="fas fa-smile fa-2x text-info" title="Great"></i>}
                    {formData.feelingRating === 5 && <i className="fas fa-grin-stars fa-2x text-success" title="Excellent"></i>}
                  </div>
                </div>
              </div>
              
              {/* Current selection description */}
              <div className="text-center mt-2">
                <small className="text-muted">
                  Current rating: <strong>
                    {formData.feelingRating === 1 && 'Poor'}
                    {formData.feelingRating === 2 && 'Fair'}
                    {formData.feelingRating === 3 && 'Good'}
                    {formData.feelingRating === 4 && 'Great'}
                    {formData.feelingRating === 5 && 'Excellent'}
                  </strong>
                </small>
              </div>
            </div>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              name="notes"
              rows={3}
              placeholder="How was your workout? Any challenges or achievements? (Optional)"
              value={formData.notes}
              onChange={handleInputChange}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          <i className="fas fa-save me-2"></i>
          Save Activity
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ActivityLogger;
