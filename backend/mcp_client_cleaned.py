"""
Cleaned MCP Client - Essential functions only
Keeps only the functions actually used by the application
"""

import os
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# Check if Azure Search is available
AZURE_SEARCH_AVAILABLE = False
try:
    from azure.search.documents import SearchClient
    from azure.core.credentials import AzureKeyCredential
    AZURE_SEARCH_AVAILABLE = True
except ImportError:
    logger.warning("Azure Search not available")

# Check if MCP is available
MCP_AVAILABLE = False
try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    MCP_AVAILABLE = True
except ImportError:
    logger.warning("MCP not available")


class FitnessMCPClient:
    """Simplified MCP Client for Azure Search integration only"""
    
    def __init__(self):
        self.session = None
        self.search_client = self._init_search_client()
    
    def _init_search_client(self):
        """Initialize Azure Search client"""
        if not AZURE_SEARCH_AVAILABLE:
            return None
            
        try:
            endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
            key = os.getenv("AZURE_SEARCH_ADMIN_KEY") or os.getenv("AZURE_SEARCH_KEY")
            index_name = os.getenv("AZURE_SEARCH_INDEX_NAME", "fitness-index")
            
            if endpoint and key:
                search_client = SearchClient(
                    endpoint=endpoint,
                    index_name=index_name,
                    credential=AzureKeyCredential(key)
                )
                logger.info("Azure Search client initialized successfully")
                return search_client
            else:
                logger.warning("Azure Search credentials not found")
                return None
        except Exception as e:
            logger.error(f"Failed to initialize Azure Search client: {e}")
            return None


# MAIN FUNCTIONS USED BY APP.PY

async def get_fitness_recommendation_mcp(images, gender, age, weight, height, agent_type, health_conditions=""):
    """Get MCP-enhanced fitness recommendation with fallback"""
    
    # Check if MCP is disabled via environment variable
    if os.getenv("DISABLE_MCP", "false").lower() == "true":
        logger.info("MCP disabled via environment variable, using fallback")
        user_data = {
            'gender': gender,
            'age': age,
            'weight': weight,
            'height': height,
            'health_conditions': health_conditions,
            'agent_type': agent_type
        }
        return get_fallback_fitness_recommendation(user_data, images)
    
    try:
        user_data = {
            'gender': gender,
            'age': age,
            'weight': weight,
            'height': height,
            'health_conditions': health_conditions,
            'agent_type': agent_type
        }
        
        # Since MCP is typically not available, go directly to fallback
        return get_fallback_fitness_recommendation(user_data, images)
        
    except Exception as e:
        logger.error(f"MCP recommendation failed: {e}")
        user_data = {
            'gender': gender,
            'age': age,
            'weight': weight,
            'height': height,
            'health_conditions': health_conditions,
            'agent_type': agent_type
        }
        return get_fallback_fitness_recommendation(user_data, images)


def get_fallback_fitness_recommendation(user_data, images):
    """Provide comprehensive fitness recommendation using Azure Search and Agentic RAG when MCP is not available"""
    age = int(user_data.get('age', 30))
    gender = user_data.get('gender', 'male')
    weight = float(user_data.get('weight', 150))
    height = user_data.get('height')  # Height in inches
    agent_type = user_data.get('agent_type', 'general')
    health_conditions = user_data.get('health_conditions', '')
    
    # Check if Agentic RAG is enabled
    enable_agentic = os.getenv("ENABLE_AGENTIC_RAG", "false").lower() == "true"
    
    if enable_agentic and AZURE_SEARCH_AVAILABLE:
        try:
            logger.info("🤖 Using Agentic RAG for intelligent fitness recommendations")
            
            # Initialize search client for Agentic RAG
            endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
            key = os.getenv("AZURE_SEARCH_ADMIN_KEY") or os.getenv("AZURE_SEARCH_KEY")
            
            if endpoint and key:
                from azure.search.documents import SearchClient
                from azure.core.credentials import AzureKeyCredential
                search_client = SearchClient(
                    endpoint=endpoint,
                    index_name=os.getenv("AZURE_SEARCH_INDEX_NAME", "fitness-index"),
                    credential=AzureKeyCredential(key)
                )
                
                # Initialize Azure OpenAI client for image analysis
                azure_openai_client = None
                try:
                    from openai import AzureOpenAI
                    azure_openai_client = AzureOpenAI(
                        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview"),
                        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
                    )
                except Exception as e:
                    logger.warning(f"Azure OpenAI client not available: {e}")
                
                from agentic_rag import AgenticFitnessRAG
                agentic_agent = AgenticFitnessRAG(search_client, azure_openai_client)
                
                # Generate agentic recommendation using thread-based execution
                import threading
                import queue
                
                def run_agentic_in_thread():
                    result_queue = queue.Queue()
                    def agentic_worker():
                        try:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            result = loop.run_until_complete(
                                agentic_agent.generate_recommendation(user_data, images)
                            )
                            result_queue.put(("success", result))
                        except Exception as e:
                            result_queue.put(("error", str(e)))
                        finally:
                            loop.close()
                    
                    thread = threading.Thread(target=agentic_worker)
                    thread.start()
                    thread.join(timeout=60)  # 60 second timeout
                    
                    if thread.is_alive():
                        logger.error("Agentic RAG timeout")
                        return None
                    
                    if not result_queue.empty():
                        status, result = result_queue.get()
                        if status == "success":
                            return result
                        else:
                            logger.error(f"Agentic RAG error: {result}")
                    return None
                
                try:
                    agentic_result = run_agentic_in_thread()
                    if agentic_result:
                        return agentic_result
                        
                except Exception as e:
                    logger.warning(f"Agentic RAG execution failed: {e}")
                
                # Fallback to sync version if agentic fails
                logger.info("Using sync enhanced fallback")
                client = FitnessMCPClient()
                return get_azure_search_enhanced_fallback_sync(user_data, images, client)
            
        except Exception as e:
            logger.warning(f"Agentic RAG failed: {e}, falling back to enhanced RAG")
    
    # Initialize Azure Search for enhanced fallback (non-agentic)
    try:
        client = FitnessMCPClient()
        if client.search_client:
            logger.info("Using Azure Search enhanced fallback recommendations")
            return get_azure_search_enhanced_fallback_sync(user_data, images, client)
    except Exception as e:
        logger.warning(f"Azure Search fallback failed: {e}")
    
    # Basic fallback if Azure Search also fails
    return get_basic_fallback_recommendation(user_data, images)


def get_azure_search_enhanced_fallback_sync(user_data, images, mcp_client):
    """Enhanced fallback using Azure Search RAG capabilities - synchronous version"""
    age = int(user_data.get('age', 30))
    gender = user_data.get('gender', 'male')
    weight = float(user_data.get('weight', 150))
    height = user_data.get('height', None)
    agent_type = user_data.get('agent_type', 'general')
    health_conditions = user_data.get('health_conditions', '')
    
    # Build user profile for search
    user_profile = {
        "age": age,
        "gender": gender,
        "weight": weight,
        "goal": agent_type,
        "fitness_level": "beginner",  # Default
        "available_equipment": ["bodyweight", "dumbbells"],
        "exercise_type": agent_type
    }
    
    # Add height to profile if provided and not empty
    if height and str(height).strip():
        try:
            user_profile["height"] = float(height)
        except (ValueError, TypeError):
            pass  # Skip if height conversion fails
    
    # Search for relevant exercises using Azure Search (sync version)
    relevant_exercises = []
    performance_benchmarks = []
    
    try:
        # Search based on user goals
        if agent_type == 'weight_loss':
            search_terms = ['cardio', 'fat burning', 'HIIT', 'bodyweight']
        elif agent_type == 'muscle_gain':
            search_terms = ['strength', 'muscle building', 'hypertrophy']
        elif agent_type == 'cardio':
            search_terms = ['cardio', 'endurance', 'running', 'cycling']
        elif agent_type == 'strength':
            search_terms = ['strength', 'powerlifting', 'heavy']
        else:
            search_terms = ['beginner', 'general fitness', 'bodyweight']
        
        # Search for exercises (sync version)
        for term in search_terms[:2]:  # Limit searches
            exercises = search_exercises_sync(mcp_client.search_client, term, user_profile)
            relevant_exercises.extend(exercises[:3])  # Top 3 per search
        
        # Search for performance benchmarks (sync version)
        performance_benchmarks = search_performance_benchmarks_sync(
            mcp_client.search_client, agent_type, user_profile
        )
        
    except Exception as e:
        logger.error(f"Azure Search queries failed: {e}")
    
    # Generate recommendation based on agent type
    if agent_type == 'weight_loss':
        return generate_weight_loss_recommendation(age, gender, weight, height, health_conditions, relevant_exercises, performance_benchmarks, images)
    elif agent_type == 'muscle_gain':
        return generate_muscle_gain_recommendation(age, gender, weight, height, relevant_exercises, images)
    else:
        return generate_general_fitness_recommendation(age, weight, height, relevant_exercises, images)


def search_exercises_sync(search_client, search_term, user_profile):
    """Synchronous version of exercise search"""
    if not search_client:
        return []
    
    try:
        # Build search query based on user profile and search term
        query = f"{search_term}"
        
        # Add user-specific filters
        if user_profile.get('goal'):
            goal = user_profile['goal']
            if goal == 'weight_loss':
                query += " fat burning cardio HIIT"
            elif goal == 'muscle_gain':
                query += " strength muscle building hypertrophy"
            elif goal == 'cardio':
                query += " cardio endurance running cycling"
            elif goal == 'strength':
                query += " strength powerlifting heavy lifting"
        
        # Search parameters (no need to filter member data since index only contains exercises)
        search_params = {
            "search_text": query,
            "top": 10,
            "search_mode": "any",
            "query_type": "simple"
        }
        
        # Execute search
        results = search_client.search(**search_params)
        
        exercises = []
        for result in results:
            # Additional filter to ensure we only get actual exercises
            result_type = result.get("type", "")
            title = result.get("title", "")
            
            # Skip if this is member data or has member-like title pattern
            if (result_type == "member_data" or 
                "Member " in title or 
                " - " in title and "Training" in title):
                continue
                
            exercise = {
                "title": title,
                "target": result.get("target", "General"),
                "equipment": result.get("equipment", "Unknown"),
                "instructions": result.get("instructions", ""),
                "difficulty": result.get("difficulty", "intermediate"),
                "category": result.get("category", "general"),
                "bodyPart": result.get("bodyPart", ""),
                "type": result.get("type", "exercise")
            }
            exercises.append(exercise)
        
        logger.info(f"Found {len(exercises)} exercises for '{search_term}' and profile {user_profile.get('goal', 'general')}")
        return exercises
        
    except Exception as e:
        logger.error(f"Error searching exercises: {e}")
        return []


def search_performance_benchmarks_sync(search_client, goal_type, user_profile):
    """Synchronous version of performance benchmark search"""
    if not search_client:
        return []
    
    try:
        # Build query for performance data
        query = f"performance benchmark {goal_type}"
        
        # Add demographic filters
        age = user_profile.get('age', 30)
        gender = user_profile.get('gender', 'male')
        
        # Age range query
        age_range = "young" if age < 30 else "middle" if age < 50 else "mature"
        query += f" {age_range} {gender}"
        
        search_params = {
            "search_text": query,
            "top": 5,
            "search_mode": "any"
        }
        
        results = search_client.search(**search_params)
        
        benchmarks = []
        for result in results:
            benchmark = {
                "caloriesBurned": result.get("caloriesBurned", 300),
                "sessionDuration": result.get("sessionDuration", 45),
                "difficulty": result.get("difficulty", "intermediate"),
                "userAge": result.get("userAge", age),
                "userGender": result.get("userGender", gender),
                "goalType": result.get("goalType", goal_type)
            }
            benchmarks.append(benchmark)
        
        logger.info(f"Found {len(benchmarks)} performance benchmarks for {goal_type}")
        return benchmarks
        
    except Exception as e:
        logger.error(f"Error searching performance benchmarks: {e}")
        return []


def generate_weight_loss_recommendation(age, gender, weight, height, health_conditions, exercises, benchmarks, images):
    """Generate weight loss recommendation with vision status"""
    # Use provided height or default values if height is not provided
    height_cm = 170  # Default height in cm
    height_display = None
    
    if height and str(height).strip():  # Check for non-empty value
        try:
            height_inches = float(height)
            height_cm = height_inches * 2.54  # Convert inches to cm
            height_display = height_inches
        except (ValueError, TypeError):
            height_cm = 170  # Fallback default
            height_display = None
    
    # Calculate BMR and daily calories using actual height
    if gender.lower() == 'male':
        bmr = 88.362 + (13.397 * weight * 0.453592) + (4.799 * height_cm) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight * 0.453592) + (3.098 * height_cm) - (4.330 * age)
    
    daily_calories = int(bmr * 1.55)
    target_calories = daily_calories - 500
    protein_grams = int(target_calories * 0.30 / 4)
    carb_grams = int(target_calories * 0.40 / 4)
    fat_grams = int(target_calories * 0.30 / 9)
    
    # Build exercise recommendations from search results
    exercise_suggestions = ""
    if exercises:
        exercise_suggestions = "\n**🎯 RECOMMENDED EXERCISES (from fitness database):**\n"
        for i, exercise in enumerate(exercises[:5], 1):
            title = exercise.get('title', 'Unknown Exercise')
            target = exercise.get('target', 'General')
            equipment = exercise.get('equipment', 'Unknown')
            exercise_suggestions += f"- **{title}** (Targets: {target}, Equipment: {equipment})\n"
    
    benchmark_info = ""
    if benchmarks:
        avg_calories = sum(b.get('caloriesBurned', 0) for b in benchmarks) / len(benchmarks)
        avg_duration = sum(b.get('sessionDuration', 0) for b in benchmarks) / len(benchmarks)
        benchmark_info = f"\n**📊 PERFORMANCE BENCHMARKS (from similar users):**\n- Average calories burned per session: {int(avg_calories)}\n- Average workout duration: {int(avg_duration)} minutes\n"
    
    # Add image analysis status at the top
    image_status = "❌ NO IMAGES ANALYZED"
    if images and len(images) > 0:
        image_status = f"📸 {len(images)} IMAGE(S) PROVIDED FOR ANALYSIS"
    
    recommendation = f"""## 📸 VISION ANALYSIS STATUS: {image_status}
*(Note: Advanced vision analysis requires Agentic RAG mode)*

**🔥 Enhanced Weight Loss Recommendation**
*Powered by Azure AI Search + Advanced Calculations*

**📊 YOUR PROFILE ANALYSIS:**
- Age: {age} years
- Gender: {gender}
- Weight: {weight} lbs ({weight * 0.453592:.1f} kg)
- Height: {str(height_display) + " inches" if height_display else "Not specified"} ({height_cm:.1f} cm)
- Health conditions: {health_conditions or 'None specified'}
- Goal: Weight Loss & Fat Burning

**🔥 METABOLIC CALCULATIONS:**
- Basal Metabolic Rate (BMR): {int(bmr)} calories/day
- Total Daily Energy Expenditure: {daily_calories} calories/day
- Target Daily Calories: {target_calories} calories/day
- Daily Caloric Deficit: {daily_calories - target_calories} calories

**🍽️ NUTRITION PLAN:**
- Protein: {protein_grams}g daily (30% of calories)
- Carbohydrates: {carb_grams}g daily (40% of calories)
- Fat: {fat_grams}g daily (30% of calories)
- Water intake: {int(weight * 0.453592 * 35)}ml per day

{exercise_suggestions}

**🏃 WEEKLY WORKOUT SCHEDULE:**

**Monday - HIIT Cardio:**
- Warm-up: 5 minutes light movement
- HIIT Circuit: 20 minutes (30 sec work / 30 sec rest)
- Cool-down: 5 minutes stretching
- Target heart rate: {int((220 - age) * 0.75)}-{int((220 - age) * 0.85)} bpm

**Tuesday - Strength Circuit:**
- Full body resistance training: 30-40 minutes
- Focus on compound movements
- 3 sets of 12-15 reps per exercise

**Wednesday - Active Recovery:**
- 30-45 minutes moderate cardio
- Walking, light cycling, or swimming
- Target heart rate: {int((220 - age) * 0.60)}-{int((220 - age) * 0.70)} bpm

**Thursday - Strength Training:**
- Upper/Lower body split: 35-45 minutes
- Progressive overload focus
- 3-4 sets of 8-12 reps

**Friday - Cardio + Core:**
- 25-30 minutes steady-state cardio
- 15 minutes core strengthening
- Focus on endurance building

**Weekend - Flexibility & Recreation:**
- Yoga or stretching: 20-30 minutes
- Recreational activities (hiking, sports, dancing)

{benchmark_info}

**📈 WEIGHT LOSS PROGRESSION:**
- Expected loss: 1-2 lbs per week
- Measurements: Take weekly progress photos
- Energy levels: Should improve within 2 weeks
- Strength gains: Noticeable in 4-6 weeks

**🎯 MONTHLY MILESTONES:**
- Week 1: Establish routine, focus on consistency
- Week 2: Increase workout intensity by 10%
- Week 3: Add one extra workout day
- Week 4: Reassess and adjust plan based on progress

**⚠️ SAFETY & RECOVERY:**
{f"- Health considerations: {health_conditions}" if health_conditions else "- Listen to your body and rest when needed"}
- Stay hydrated: Drink water before, during, and after workouts
- Sleep: Aim for 7-9 hours per night for optimal recovery
- Nutrition timing: Eat within 30 minutes post-workout

*This enhanced recommendation combines Azure AI Search database insights with advanced metabolic calculations for optimal results.*
"""
    
    return {
        "recommendation": recommendation,
        "fallback_mode": True,
        "enhanced_with": ["azure_search_rag", "comprehensive_calculations", "database_driven_exercises"],
        "features": [
            "Azure AI Search exercise database integration",
            "Performance benchmarks from similar users",
            "BMR and calorie calculations",
            "Heart rate training zones",
            "Evidence-based exercise selection",
            "Progressive programming",
            "Goal-specific workout design"
        ],
        "data_sources": [
            f"Found {len(exercises)} relevant exercises from database",
            f"Performance data from {len(benchmarks)} similar users",
            "Advanced metabolic calculations",
            "Evidence-based training protocols"
        ]
    }


def generate_muscle_gain_recommendation(age, gender, weight, height, exercises, images):
    """Generate muscle gain recommendation with vision status"""
    # Use provided height or default values if height is not provided
    height_cm = 170  # Default height in cm
    height_display = None
    
    if height and str(height).strip():  # Check for non-empty value
        try:
            height_inches = float(height)
            height_cm = height_inches * 2.54  # Convert inches to cm
            height_display = height_inches
        except (ValueError, TypeError):
            height_cm = 170  # Fallback default
            height_display = None
    
    # Muscle building calculations using actual height
    if gender.lower() == 'male':
        bmr = 88.362 + (13.397 * weight * 0.453592) + (4.799 * height_cm) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight * 0.453592) + (3.098 * height_cm) - (4.330 * age)
    
    daily_calories = int(bmr * 1.725)  # Activity factor for muscle building
    surplus_calories = daily_calories + 300
    protein_grams = int(weight * 0.453592 * 2.2)  # 2.2g per kg for muscle gain
    
    # Build exercise recommendations from search results
    exercise_suggestions = ""
    if exercises:
        exercise_suggestions = "\n**💪 RECOMMENDED EXERCISES (from fitness database):**\n"
        for i, exercise in enumerate(exercises[:6], 1):
            title = exercise.get('title', 'Unknown Exercise')
            target = exercise.get('target', 'General')
            equipment = exercise.get('equipment', 'Unknown')
            exercise_suggestions += f"- **{title}** (Targets: {target}, Equipment: {equipment})\n"
    
    # Add image analysis status
    image_status = "❌ NO IMAGES ANALYZED"
    if images and len(images) > 0:
        image_status = f"📸 {len(images)} IMAGE(S) PROVIDED FOR ANALYSIS"
    
    recommendation = f"""## 📸 VISION ANALYSIS STATUS: {image_status}
*(Note: Advanced vision analysis requires Agentic RAG mode)*

**💪 Enhanced Muscle Building Recommendation**
*Powered by Azure AI Search + Scientific Programming*

**📊 YOUR MUSCLE BUILDING PROFILE:**
- Age: {age} years
- Gender: {gender}
- Weight: {weight} lbs ({weight * 0.453592:.1f} kg)
- Height: {str(height_display) + " inches" if height_display else "Not specified"} ({height_cm:.1f} cm)
- Goal: Muscle Growth & Strength Development

**🔥 MUSCLE BUILDING CALCULATIONS:**
- Daily Calories for Growth: {surplus_calories} calories
- High Protein Target: {protein_grams}g daily (2.2g per kg bodyweight)
- Training Frequency: 4-5 days per week
- Progressive Overload Protocol: Increase load weekly

**🍽️ MUSCLE BUILDING NUTRITION:**
- Protein: {protein_grams}g (35% - muscle protein synthesis)
- Carbohydrates: {int(surplus_calories * 0.45 / 4)}g (45% - workout fuel)
- Fat: {int(surplus_calories * 0.20 / 9)}g (20% - hormone production)
- Meal timing: Protein every 3-4 hours

{exercise_suggestions}

**🏋️ MUSCLE BUILDING WORKOUT SPLIT:**

**Day 1 - Chest & Triceps (Push):**
- Compound movements: 4 sets of 6-8 reps
- Isolation exercises: 3 sets of 10-12 reps
- Focus: Progressive overload on main lifts
- Rest between sets: 2-3 minutes

**Day 2 - Back & Biceps (Pull):**
- Vertical pulling: 4 sets of 6-10 reps
- Horizontal pulling: 4 sets of 8-10 reps
- Bicep specialization: 4 sets of 10-12 reps
- Emphasis: Full range of motion

**Day 3 - Legs & Glutes:**
- Squats/Leg Press: 4 sets of 8-12 reps
- Deadlift variations: 4 sets of 6-8 reps
- Unilateral work: 3 sets of 10 per leg
- Calf training: 4 sets of 15-20 reps

**Day 4 - Shoulders & Arms:**
- Overhead pressing: 4 sets of 8-10 reps
- Lateral movements: 4 sets of 12-15 reps
- Rear delt focus: 3 sets of 12-15 reps
- Arms superset: 3 sets of 10-12 reps

**Day 5 - Full Body Power:**
- Compound movements only
- Lower rep ranges: 3-6 reps
- Explosive movements when possible
- Focus on strength development

**📈 MUSCLE BUILDING PRINCIPLES:**
- Progressive Overload: Increase weight 2.5-5 lbs weekly
- Time Under Tension: Control eccentric phase
- Recovery: 48-72 hours between training same muscles
- Volume: 10-20 sets per muscle group per week

**🎯 EXPECTED RESULTS:**
- Beginner gains: 1-2 lbs muscle per month
- Strength increases: 5-15% monthly improvements
- Visible changes: 6-8 weeks with proper nutrition
- Advanced gains: 0.5-1 lb muscle per month

*This recommendation leverages exercise database insights and evidence-based muscle building protocols.*
"""
    
    return {
        "recommendation": recommendation,
        "fallback_mode": True,
        "enhanced_with": ["azure_search_rag", "muscle_building_protocols"],
        "data_sources": [f"Found {len(exercises)} relevant exercises from database"]
    }


def generate_general_fitness_recommendation(age, weight, height, exercises, images):
    """Generate general fitness recommendation with vision status"""
    # Use provided height or default values if height is not provided
    height_cm = 170  # Default height in cm
    height_display = None
    
    if height and str(height).strip():  # Check for non-empty value
        try:
            height_inches = float(height)
            height_cm = height_inches * 2.54  # Convert inches to cm
            height_display = height_inches
        except (ValueError, TypeError):
            height_cm = 170  # Fallback default
            height_display = None
    
    # Add image analysis status
    image_status = "❌ NO IMAGES ANALYZED"
    if images and len(images) > 0:
        image_status = f"📸 {len(images)} IMAGE(S) PROVIDED FOR ANALYSIS"
    
    exercise_suggestions = ""
    if exercises:
        exercise_suggestions = "\n**🎯 RECOMMENDED EXERCISES (from fitness database):**\n"
        for i, exercise in enumerate(exercises[:4], 1):
            title = exercise.get('title', 'Unknown Exercise')
            target = exercise.get('target', 'General')
            equipment = exercise.get('equipment', 'Unknown')
            exercise_suggestions += f"- **{title}** (Targets: {target}, Equipment: {equipment})\n"
    
    recommendation = f"""## 📸 VISION ANALYSIS STATUS: {image_status}
*(Note: Advanced vision analysis requires Agentic RAG mode)*

**🌟 Enhanced General Fitness Program**
*Powered by Azure AI Search + Balanced Training Approach*

**👤 YOUR FITNESS PROFILE:**
- Age: {age} years
- Weight: {weight} lbs
- Height: {str(height_display) + " inches" if height_display else "Not specified"} ({height_cm:.1f} cm)
- Goal: Complete fitness and health optimization
- Approach: Balanced training for all fitness components

{exercise_suggestions}

**🏃 COMPREHENSIVE WEEKLY STRUCTURE:**
- 4-5 exercise sessions per week
- Strength, cardio, and flexibility components
- Progressive difficulty increases
- Active recovery emphasis

**Monday - Full Body Strength:**
- Compound movements: 40-45 minutes
- Upper and lower body integration
- Core strengthening focus
- 3 sets of 10-15 reps

**Tuesday - Cardiovascular Endurance:**
- Moderate intensity: 30-40 minutes
- Heart rate zone: {int((220 - age) * 0.65)}-{int((220 - age) * 0.75)} bpm
- Variety: Walking, cycling, swimming
- Enjoyable activities encouraged

**Wednesday - Functional Movement:**
- Movement patterns: 35-40 minutes
- Balance and coordination
- Flexibility and mobility
- Bodyweight exercises

**Thursday - Strength & Power:**
- Progressive resistance: 40 minutes
- Focus on major muscle groups
- Power development
- 3-4 sets of 8-12 reps

**Friday - Active Recovery:**
- Light movement: 30 minutes
- Yoga or stretching
- Recreational activities
- Stress relief focus

**📊 WEEKLY GOALS & PROGRESSION:**
- Consistency: Complete 4-5 planned sessions
- Intensity: Gradually increase challenge
- Recovery: Prioritize sleep and nutrition
- Assessment: Weekly progress evaluation

**🎯 MONTHLY OBJECTIVES:**
- Week 1: Establish routine and form
- Week 2: Increase duration by 10%
- Week 3: Add complexity or intensity
- Week 4: Test improvements and plan ahead

**🌟 HOLISTIC HEALTH BENEFITS:**
- Improved cardiovascular health
- Enhanced strength and endurance
- Better flexibility and mobility
- Stress reduction and mental wellness
- Increased daily energy levels

*This program combines database-driven exercise selection with comprehensive fitness principles for optimal health outcomes.*
"""
    
    return {
        "recommendation": recommendation,
        "fallback_mode": True,
        "enhanced_with": ["azure_search_rag", "general_fitness"],
        "data_sources": [f"Found {len(exercises)} relevant exercises from database"]
    }


def get_basic_fallback_recommendation(user_data, images):
    """Basic fallback when both MCP and Azure Search fail"""
    age = int(user_data.get('age', 30))
    gender = user_data.get('gender', 'male')
    weight = float(user_data.get('weight', 150))
    height = user_data.get('height', None)
    agent_type = user_data.get('agent_type', 'general')
    
    # Process height for display
    height_display = None
    height_cm = 170  # Default height in cm
    
    if height and str(height).strip():  # Check for non-empty value
        try:
            height_inches = float(height)
            height_cm = height_inches * 2.54  # Convert inches to cm
            height_display = height_inches
        except (ValueError, TypeError):
            height_cm = 170  # Fallback default
            height_display = None
    
    # Add image analysis status
    image_status = "❌ NO IMAGES ANALYZED"
    if images and len(images) > 0:
        image_status = f"📸 {len(images)} IMAGE(S) PROVIDED FOR ANALYSIS"
    
    return {
        "recommendation": f"""## 📸 VISION ANALYSIS STATUS: {image_status}
*(Note: Advanced vision analysis requires Agentic RAG mode)*

**Basic Fitness Recommendation**
*Simplified approach when advanced features are unavailable*

**Your Profile:** {gender}, age {age}, weight {weight} lbs
- Height: {str(height_display) + " inches" if height_display else "Not specified"} ({height_cm:.1f} cm)
**Goal:** {agent_type.replace('_', ' ').title()}

**Weekly Exercise Plan:**
- 3-4 exercise sessions per week
- Mix of cardiovascular and strength training
- 30-45 minutes per session
- Focus on consistency over intensity

**Basic Guidelines:**
- Start slowly and progress gradually
- Stay hydrated throughout the day
- Get adequate sleep for recovery
- Consult healthcare providers for specific conditions

**Note:** This is a simplified recommendation. For enhanced personalized guidance with exercise database insights and advanced calculations, ensure your system components are properly configured.
        """,
        "fallback_mode": True,
        "enhanced_with": ["basic_guidelines"]
    }


# OTHER REQUIRED FUNCTIONS FOR COMPATIBILITY

async def get_fitness_recommendation_with_rag(images, user_data):
    """Get RAG-enhanced fitness recommendation with fallback"""
    try:
        # This is now handled by the fallback system
        return get_fallback_fitness_recommendation(user_data, images)
    except Exception as e:
        logger.error(f"RAG recommendation failed: {e}")
        return get_fallback_fitness_recommendation(user_data, images)


async def get_fitness_recommendation_hybrid(images, user_data):
    """Hybrid recommendation approach - delegates to fallback"""
    try:
        # Use the main fallback system which includes Agentic RAG
        return get_fallback_fitness_recommendation(user_data, images)
    except Exception as e:
        logger.error(f"Hybrid recommendation failed: {e}")
        return get_fallback_fitness_recommendation(user_data, images)


# Sync wrappers for backward compatibility
def get_fitness_recommendation_sync(images, gender, age, weight, agent_type):
    """Synchronous wrapper for basic MCP fitness recommendation"""
    return asyncio.run(get_fitness_recommendation_mcp(images, gender, age, weight, agent_type))


def get_fitness_recommendation_with_rag_sync(images, user_data):
    """Synchronous wrapper for RAG-enhanced fitness recommendation"""
    return asyncio.run(get_fitness_recommendation_with_rag(images, user_data))


def get_fitness_recommendation_hybrid_sync(images, user_data):
    """Synchronous wrapper for hybrid fitness recommendation"""
    return asyncio.run(get_fitness_recommendation_hybrid(images, user_data))
