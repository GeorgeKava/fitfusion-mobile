"""
Daily Plan Generator for Fitness Advisor
Generates specific daily exercise plans based on user goals and fitness levels
"""

def generate_daily_exercise_plan(goal, fitness_level="beginner", day_of_week="Monday"):
    """Generate specific daily exercise plan based on goal and fitness level"""
    
    plans = {
        "weight_loss": {
            "Monday": {
                "focus": "HIIT Cardio & Core",
                "exercises": [
                    "5-minute dynamic warm-up (arm circles, leg swings, light marching)",
                    "20-minute HIIT circuit: 30 seconds work, 30 seconds rest",
                    "- Jumping jacks (or step-ups if low impact needed)",
                    "- Bodyweight squats", 
                    "- Push-ups (modified on knees if needed)",
                    "- Mountain climbers (or marching in place)",
                    "10-minute core circuit: 3 sets of 30 seconds each",
                    "- Plank hold (or modified plank on knees)",
                    "- Bicycle crunches",
                    "- Side plank (15 seconds each side)",
                    "5-minute cool-down stretching"
                ]
            },
            "Tuesday": {
                "focus": "Strength Circuit Training",
                "exercises": [
                    "10-minute light cardio warm-up (walking or marching)",
                    "Full body strength circuit: 3 rounds, 12-15 reps each",
                    "- Bodyweight squats (progress to jump squats)",
                    "- Wall or incline push-ups (progress to full push-ups)",
                    "- Lunges (stationary, then walking lunges)",
                    "- Tricep dips using a chair or bench",
                    "- Glute bridges (single or double leg)",
                    "- Standing calf raises",
                    "Rest 60-90 seconds between rounds",
                    "8-minute stretching focusing on major muscle groups"
                ]
            },
            "Wednesday": {
                "focus": "Active Recovery Cardio",
                "exercises": [
                    "30-45 minutes moderate cardio (choose one):",
                    "- Brisk walking (outdoor or treadmill)",
                    "- Light cycling or stationary bike",
                    "- Swimming or water aerobics",
                    "- Dancing to favorite music",
                    "Target heart rate: 60-70% max (moderate intensity)",
                    "5-minute gentle stretching",
                    "Focus on enjoying movement and staying active"
                ]
            },
            "Thursday": {
                "focus": "Upper/Lower Body Split",
                "exercises": [
                    "8-minute dynamic warm-up",
                    "Upper body focus: 3 sets of 10-12 reps",
                    "- Push-ups (modify as needed)",
                    "- Pike push-ups for shoulders",
                    "- Tricep dips",
                    "- Arm circles and shoulder rolls",
                    "Lower body focus: 3 sets of 12-15 reps",
                    "- Squats with pause at bottom",
                    "- Single-leg glute bridges",
                    "- Side-lying leg lifts",
                    "- Calf raises",
                    "6-minute full body stretch"
                ]
            },
            "Friday": {
                "focus": "Cardio + Core Blast",
                "exercises": [
                    "5-minute warm-up: light movement",
                    "25-minute cardio + core intervals:",
                    "- 3 minutes moderate cardio",
                    "- 1 minute core exercise",
                    "Core exercises rotation:",
                    "- Dead bug (alternating arms and legs)",
                    "- Russian twists (with or without weight)",
                    "- Leg raises (bent or straight)",
                    "- Plank variations (standard, side, reverse)",
                    "5-minute relaxing stretch and deep breathing"
                ]
            },
            "Saturday": {
                "focus": "Flexibility & Recreation",
                "exercises": [
                    "20-30 minutes yoga or stretching routine",
                    "Focus areas: hip flexors, hamstrings, shoulders, spine",
                    "Recreational activities (choose one):",
                    "- Hiking or nature walk",
                    "- Dancing",
                    "- Playing sports (tennis, basketball, soccer)",
                    "- Swimming",
                    "- Cycling",
                    "Emphasis on fun and enjoyment of movement"
                ]
            },
            "Sunday": {
                "focus": "Gentle Movement & Recovery",
                "exercises": [
                    "15-20 minutes gentle yoga or tai chi",
                    "Walking meditation: 20 minutes mindful walking",
                    "Light mobility work:",
                    "- Neck and shoulder rolls",
                    "- Hip circles and leg swings", 
                    "- Ankle rotations",
                    "- Gentle spinal twists",
                    "Rest and prepare for the week ahead",
                    "Meal prep and hydration focus"
                ]
            }
        },
        "muscle_gain": {
            "Monday": {
                "focus": "Chest & Triceps (Push Day)",
                "exercises": [
                    "10-minute dynamic warm-up with arm circles and light cardio",
                    "Push-ups: 4 sets of 6-12 reps (modify difficulty as needed)",
                    "- Beginner: Incline push-ups on stairs/bench",
                    "- Intermediate: Standard push-ups",
                    "- Advanced: Decline or diamond push-ups",
                    "Tricep dips: 3 sets of 8-12 reps (using chair/bench)",
                    "Pike push-ups: 3 sets of 6-10 reps (targets shoulders)",
                    "Chest squeeze: 3 sets of 15-20 reps (palms together)",
                    "Tricep push-ups: 3 sets of 5-10 reps (close grip)",
                    "Rest 90-120 seconds between sets",
                    "8-minute stretch focusing on chest and triceps"
                ]
            },
            "Tuesday": {
                "focus": "Back & Biceps (Pull Day)", 
                "exercises": [
                    "8-minute warm-up with arm swings and light movement",
                    "Pull-ups or assisted pull-ups: 4 sets of 3-8 reps",
                    "- Use resistance band or door anchor if no pull-up bar",
                    "Bent-over rows: 3 sets of 10-12 reps",
                    "- Use water jugs, backpack, or resistance band",
                    "Reverse flies: 3 sets of 12-15 reps",
                    "- Arms extended, squeeze shoulder blades",
                    "Bicep curls: 3 sets of 10-15 reps (any available weight)",
                    "Superman holds: 3 sets of 30-45 seconds",
                    "Face pulls: 3 sets of 15 reps (resistance band)",
                    "10-minute stretch for back and biceps"
                ]
            },
            "Wednesday": {
                "focus": "Legs & Glutes Power",
                "exercises": [
                    "10-minute dynamic leg warm-up: leg swings, hip circles",
                    "Bodyweight squats: 4 sets of 12-20 reps",
                    "- Focus on depth and control",
                    "- Progress to jump squats for power",
                    "Lunges: 3 sets of 10 reps per leg",
                    "- Forward, reverse, or lateral lunges",
                    "Single-leg glute bridges: 3 sets of 12 per leg",
                    "Calf raises: 4 sets of 15-25 reps",
                    "- Single leg for advanced",
                    "Wall sit: 3 sets of 30-60 seconds",
                    "Step-ups: 3 sets of 10 per leg (use stairs/bench)",
                    "12-minute leg and hip flexibility routine"
                ]
            },
            "Thursday": {
                "focus": "Shoulders & Arms Focus",
                "exercises": [
                    "8-minute shoulder mobility warm-up",
                    "Overhead press: 4 sets of 8-12 reps",
                    "- Use water bottles, books, or any available weight",
                    "Lateral raises: 3 sets of 12-15 reps",
                    "Front raises: 3 sets of 10-12 reps", 
                    "Upright rows: 3 sets of 10-12 reps",
                    "Shrugs: 3 sets of 15-20 reps",
                    "Arm circles: 2 sets of 20 each direction",
                    "Plank to downward dog: 3 sets of 10 reps",
                    "8-minute shoulder and arm stretching"
                ]
            },
            "Friday": {
                "focus": "Full Body Power & Core",
                "exercises": [
                    "10-minute full body dynamic warm-up",
                    "Burpees: 4 sets of 5-10 reps (modify as needed)",
                    "Mountain climbers: 3 sets of 20 total (10 per leg)",
                    "Plank variations: 3 sets of 30-45 seconds each",
                    "- Standard plank, side planks, plank up-downs",
                    "Bear crawls: 3 sets of 10 steps forward/backward",
                    "Jump squats: 3 sets of 8-12 reps",
                    "Push-up to T: 3 sets of 6-10 reps per side",
                    "Dead bug: 3 sets of 10 per side",
                    "10-minute full body relaxation stretch"
                ]
            },
            "Saturday": {
                "focus": "Active Recovery & Mobility",
                "exercises": [
                    "20-30 minutes gentle movement activity:",
                    "- Light walking or cycling",
                    "- Swimming or water activities", 
                    "- Recreational sports (low intensity)",
                    "15-minute full body mobility routine:",
                    "- Hip flexor stretches",
                    "- Shoulder and chest opening",
                    "- Spinal rotation and extension",
                    "- Hamstring and calf stretches",
                    "Focus on recovery and enjoying movement"
                ]
            },
            "Sunday": {
                "focus": "Rest & Preparation",
                "exercises": [
                    "15-20 minutes gentle yoga or stretching",
                    "Meditation or mindfulness: 10 minutes",
                    "Light walking: 15-20 minutes",
                    "Meal preparation for the week",
                    "Progress photo and measurement check",
                    "Plan and visualize next week's workouts",
                    "Ensure adequate hydration and nutrition",
                    "Early bedtime for optimal recovery"
                ]
            }
        },
        "general": {
            "Monday": {
                "focus": "Full Body Strength Foundation",
                "exercises": [
                    "8-minute dynamic warm-up: joint mobility and light cardio",
                    "Compound movement circuit: 3 rounds",
                    "- Bodyweight squats: 12-15 reps",
                    "- Push-ups (modified as needed): 8-12 reps", 
                    "- Glute bridges: 12-15 reps",
                    "- Plank hold: 20-30 seconds",
                    "- Standing marches: 20 total (10 per leg)",
                    "Rest 60-90 seconds between rounds",
                    "Balance challenge: Single leg stands, 30 seconds each",
                    "6-minute full body stretch routine"
                ]
            },
            "Tuesday": {
                "focus": "Cardiovascular Endurance",
                "exercises": [
                    "30-40 minutes moderate intensity cardio (choose preferred):",
                    "- Brisk walking (outdoor preferred)",
                    "- Cycling or stationary bike",
                    "- Dancing to music",
                    "- Swimming",
                    "- Elliptical or rowing machine",
                    "Target: Able to maintain conversation while exercising",
                    "5-minute cool-down walk",
                    "8-minute stretching focusing on legs and hips"
                ]
            },
            "Wednesday": {
                "focus": "Functional Movement & Flexibility",
                "exercises": [
                    "10-minute gentle warm-up with joint rotations",
                    "Functional movement patterns: 2-3 rounds",
                    "- Sit-to-stand from chair: 10-12 reps",
                    "- Step-ups on stairs: 10 per leg",
                    "- Arm reaches overhead: 15 reps",
                    "- Heel-to-toe walking: 20 steps",
                    "- Hip circles: 10 each direction",
                    "15-20 minutes flexibility routine:",
                    "- Major muscle group stretches",
                    "- Hold each stretch 30-45 seconds",
                    "- Focus on areas that feel tight"
                ]
            },
            "Thursday": {
                "focus": "Strength & Stability",
                "exercises": [
                    "8-minute activation warm-up",
                    "Strength circuit: 3 sets of 10-12 reps each",
                    "- Modified push-ups (wall, incline, or knee)",
                    "- Chair-assisted squats",
                    "- Standing calf raises",
                    "- Seated or standing arm circles",
                    "- Modified lunges (hold onto support)",
                    "Stability challenges:",
                    "- Single leg stands: 30 seconds each",
                    "- Heel-to-toe walking",
                    "- Standing on one foot with eyes closed: 15 seconds",
                    "8-minute relaxation and breathing exercises"
                ]
            },
            "Friday": {
                "focus": "Active Recovery & Enjoyment",
                "exercises": [
                    "20-30 minutes of enjoyable physical activity:",
                    "- Nature walk or park visit",
                    "- Dancing to favorite music",
                    "- Gardening or outdoor activities",
                    "- Playing with pets or family",
                    "- Light cleaning or household tasks",
                    "10-minute gentle stretching",
                    "Focus on movement as enjoyment, not exercise",
                    "Celebrate the week's accomplishments"
                ]
            },
            "Saturday": {
                "focus": "Recreational Activity",
                "exercises": [
                    "45-60 minutes recreational physical activity:",
                    "- Hiking or extended walking",
                    "- Cycling tour or bike ride",
                    "- Swimming for pleasure",
                    "- Playing recreational sports",
                    "- Group fitness class",
                    "- Dancing or social activities",
                    "10-minute post-activity stretching",
                    "Hydration and nutrition focus"
                ]
            },
            "Sunday": {
                "focus": "Restoration & Planning",
                "exercises": [
                    "20-30 minutes gentle movement:",
                    "- Restorative yoga or gentle stretching",
                    "- Meditation walk",
                    "- Tai chi or qigong movements",
                    "Reflection and planning:",
                    "- Review week's progress",
                    "- Set intentions for coming week",
                    "- Prepare for Monday's workout",
                    "Self-care activities:",
                    "- Adequate rest and sleep preparation",
                    "- Meal planning for healthy choices"
                ]
            }
        }
    }
    
    # Get the specific plan or default to general
    goal_plans = plans.get(goal, plans["general"])
    day_plan = goal_plans.get(day_of_week, goal_plans["Monday"])
    
    # Adjust for fitness level
    if fitness_level == "beginner":
        # Keep as is - plans are designed for beginners
        pass
    elif fitness_level == "intermediate":
        # Add intensity modifications
        day_plan["modifications"] = [
            "Increase reps by 2-5 per exercise",
            "Add 5-10 minutes to cardio sessions",
            "Decrease rest time between sets by 15-30 seconds",
            "Add resistance bands or light weights when available"
        ]
    elif fitness_level == "advanced":
        # Add advanced modifications
        day_plan["modifications"] = [
            "Increase reps by 5-10 per exercise",
            "Add plyometric variations (jump squats, explosive push-ups)",
            "Decrease rest time to 45-60 seconds between sets",
            "Add weighted variations using backpack or household items",
            "Extend cardio sessions by 10-15 minutes",
            "Add extra round to circuit training"
        ]
    
    return day_plan

def format_daily_plan_for_recommendation(goal, fitness_level="beginner", day_of_week="Monday"):
    """Format the daily plan for inclusion in fitness recommendations"""
    plan = generate_daily_exercise_plan(goal, fitness_level, day_of_week)
    
    formatted = f"\n**TODAY'S SPECIFIC WORKOUT - {day_of_week.upper()} ({plan['focus']})**\n"
    
    for exercise in plan['exercises']:
        formatted += f"• {exercise}\n"
    
    if 'modifications' in plan:
        formatted += f"\n**{fitness_level.upper()} LEVEL MODIFICATIONS:**\n"
        for mod in plan['modifications']:
            formatted += f"• {mod}\n"
    
    return formatted
