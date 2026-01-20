from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SimpleField,
    SearchFieldDataType,
    SearchableField,
    SearchField,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
    SemanticConfiguration,
    SemanticPrioritizedFields,
    SemanticField,
    SemanticSearch,
    SearchIndex,
    AzureOpenAIVectorizer,
    AzureOpenAIVectorizerParameters
)
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import os
import logging
import threading
from dotenv import load_dotenv, set_key
import base64
import json
from mimetypes import guess_type
import uuid
from mcp_client import get_fitness_recommendation_sync

load_dotenv()

search_service_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
search_api_key = os.getenv("AZURE_SEARCH_ADMIN_KEY") or os.getenv("AZURE_SEARCH_KEY")


azure_endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
api_key = os.getenv("AZURE_OPENAI_API_KEY")
api_version = os.getenv("AZURE_OPENAI_API_VERSION")
model = os.getenv('AZURE_OPENAI_MODEL')

embedding_model = "text-embedding-3-small"

index_name = os.getenv('AZURE_SEARCH_INDEX_NAME')
project_endpoint = os.getenv('PROJECT_ENDPOINT')

env_file_path = '.env'

client = AzureOpenAI(
    api_key=api_key,
    api_version=api_version,
    base_url=f"{azure_endpoint}/openai/deployments/{model}",
)

embedding_client = AzureOpenAI(
    api_key=api_key,
    api_version=api_version,
    base_url=f"{azure_endpoint}/openai/deployments/{embedding_model}",
)

search_client = None
index_client = None

# Only initialize search clients if credentials are available
if search_service_endpoint and search_api_key:
    try:
        search_client = SearchClient(
            endpoint=search_service_endpoint,
            index_name=index_name,
            credential=AzureKeyCredential(search_api_key)
        )

        index_client = SearchIndexClient(
            endpoint=search_service_endpoint,
            credential=AzureKeyCredential(search_api_key)
        )
    except Exception as e:
        print(f"Warning: Could not initialize Azure Search clients: {e}")
        search_client = None
        index_client = None

def create_vector_search():
    vector_search = VectorSearch(
        algorithms=[
            HnswAlgorithmConfiguration(name="myHnsw")
        ],
        profiles=[
            VectorSearchProfile(
                name="myHnswProfile",
                algorithm_configuration_name="myHnsw",
                vectorizer_name="myVectorizer"
            )
        ],
        vectorizers=[
            AzureOpenAIVectorizer(
                vectorizer_name="myVectorizer",
                parameters=AzureOpenAIVectorizerParameters(
                    resource_uri=azure_endpoint,
                    api_key=api_key,
                    deployment_id=embedding_model,
                    model_name=embedding_model
                )
            )
        ]
    )
    return vector_search

def create_index():
    index_schema = SearchIndex(
        name=index_name,
        fields=[
            SimpleField(name="chunk_id", type="Edm.String", sortable=True,
                        filterable=True, facetable=True, key=True),
            SearchableField(name="question", type="Edm.String",
                            searchable=True, retrievable=True),
            SearchableField(name="answer", type="Edm.String", 
                            searchable=False, retrievable=True),
            SearchField(
                name="contentVector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=int(1536),
                vector_search_profile_name="myHnswProfile",
            )
        ]
    )
    try:
        index_schema.vector_search = create_vector_search()
        index_client.create_index(index_schema)
    except Exception as e:
        logging.error(f"Failed to create index: {e}")

def get_fitness_recommendation(image_paths, gender, age, weight, height=None, agent_type="general", health_conditions=""):
    """
    Enhanced fitness recommendation using both GPT-4o vision and MCP tools.
    """
    
    # For faster response, run MCP in background and prioritize vision analysis
    vision_analysis = None
    mcp_recommendations = {}
    
    # Process images for vision analysis first (this is the main feature)
    encoded_images = []
    for img_path in image_paths:
        with open(img_path, "rb") as img_file:
            encoded = base64.b64encode(img_file.read()).decode('utf-8')
            encoded_images.append({
                "filename": os.path.basename(img_path),
                "data": encoded
            })

    # Enhanced prompt for comprehensive fitness analysis
    user_info = f"User: {gender}, {age} years old, {weight} lbs"
    if height:
        user_info += f", {height} inches tall"
    user_info += f", Goal: {agent_type}"
    if health_conditions.strip():
        user_info += f"\nHealth/Exercise Notes: {health_conditions}"
    
    prompt = f"""You are a professional fitness expert and certified personal trainer. Analyze the uploaded images and provide a comprehensive personalized fitness assessment and recommendations.

USER PROFILE:
{user_info}

COMPREHENSIVE ANALYSIS REQUIRED:

## 1. **DETAILED VISUAL ASSESSMENT**
- **Posture Analysis**: Examine posture, alignment, any visible imbalances
- **Body Composition**: Observable muscle development, body type, proportions
- **Physical Condition**: Overall fitness level based on visual cues
- **Form Analysis**: If movement/exercise is shown, analyze technique and form
- **Environment**: Available equipment, space, setting for exercise recommendations

## 2. **WEEKLY EXERCISE STRUCTURE** (Provide 7-day breakdown)
**MONDAY - Upper Body Focus:**
- 3-4 specific exercises with sets/reps (e.g., "3 sets of 8-12 push-ups")
- Target: {agent_type} goals

**TUESDAY - Cardiovascular Training:**
- Cardio recommendations with duration
- Intensity guidelines

**WEDNESDAY - Lower Body & Core:**
- 3-4 specific exercises with sets/reps
- Core strengthening focus

**THURSDAY - Active Recovery/Flexibility:**
- Stretching routine or light activity
- Recovery recommendations

**FRIDAY - Full Body Circuit:**
- Combined movements for {agent_type}
- Challenge progression

**SATURDAY - Goal-Specific Training:**
- Specialized workout for {agent_type} objectives
- Equipment-based or bodyweight options

**SUNDAY - Rest or Light Activity:**
- Optional gentle movement
- Recovery planning

## 3. **NUTRITION GUIDANCE**
- Meal timing recommendations
- Hydration guidelines
- Supplements if appropriate for {agent_type}

## 4. **PROGRESS TRACKING & NEXT STEPS**
- Key metrics to monitor
- When to progress exercises
- Signs of improvement to watch for

**IMPORTANT**: Tailor ALL recommendations specifically for {agent_type} goals and consider any health conditions mentioned. Provide specific, actionable advice that can be implemented immediately.
{' CRITICAL: Address any health conditions/limitations mentioned above in all recommendations.' if health_conditions.strip() else ''}"""

    try:
        # Get vision analysis with shorter response for speed
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": prompt},
                *[
                    {"role": "user", "content": [{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img['data']}"}}]} 
                    for img in encoded_images
                ]
            ],
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "2500")),
            temperature=float(os.getenv("AI_TEMPERATURE", "0.7")),
        )
        
        vision_analysis = response.choices[0].message.content
        
        # Try to get MCP enhancements quickly (with timeout)
        try:
            import threading
            import time
            
            def get_mcp_data():
                return get_fitness_recommendation_sync(
                    images=encoded_images,
                    gender=gender,
                    age=int(age),
                    weight=float(weight),
                    agent_type=agent_type
                )
            
            # Try MCP with 5 second timeout
            thread = threading.Thread(target=lambda: setattr(get_mcp_data, 'result', get_mcp_data()))
            thread.daemon = True
            thread.start()
            thread.join(timeout=5.0)
            
            if hasattr(get_mcp_data, 'result'):
                mcp_recommendations = getattr(get_mcp_data, 'result')
        except Exception as e:
            logging.warning(f"MCP enhancement skipped due to timeout/error: {e}")
        
        # Return the vision analysis immediately (main feature)
        if vision_analysis:
            return vision_analysis
        else:
            return "Analysis complete - please try uploading a clearer image for better recommendations."
            
    except Exception as e:
        logging.error(f"GPT-4o vision API error: {e}")
        return "An error occurred while analyzing your image. Please try again with a different photo."

def normalize_weekly_plan_structure(plan):
    """
    Ensure all days in the weekly plan have the correct structure
    """
    if not plan or 'dailyPlans' not in plan:
        return plan
    
    for day, day_data in plan['dailyPlans'].items():
        if day_data:
            # Ensure exercises is always a list
            if 'exercises' not in day_data:
                day_data['exercises'] = []
            elif day_data['exercises'] is None:
                day_data['exercises'] = []
            
            # Ensure goals is always a list
            if 'goals' not in day_data:
                day_data['goals'] = []
            elif day_data['goals'] is None:
                day_data['goals'] = []
            
            # Ensure activities is properly handled based on rest day status
            is_rest_day = day_data.get('isRestDay', False)
            if is_rest_day:
                if 'activities' not in day_data:
                    day_data['activities'] = []
                elif day_data['activities'] is None:
                    day_data['activities'] = []
            else:
                # Non-rest days should have activities as None or not present
                if 'activities' not in day_data:
                    day_data['activities'] = None
            
            # Ensure other required fields exist
            if 'focus' not in day_data:
                day_data['focus'] = ''
            if 'notes' not in day_data:
                day_data['notes'] = ''
            if 'isRestDay' not in day_data:
                day_data['isRestDay'] = False
    
    return plan

def generate_weekly_fitness_plan(user_profile, base_recommendation):
    """
    Generate a comprehensive weekly fitness plan based on user profile and base recommendation
    """
    
    # Extract user details
    gender = user_profile.get('gender', 'Unknown')
    age = user_profile.get('age', 'Unknown') 
    weight = user_profile.get('weight', 'Unknown')
    agent_type = user_profile.get('agentType', 'general')
    health_conditions = user_profile.get('healthConditions', '')
    user_email = user_profile.get('email', 'Unknown')
    
    logging.info(f"🎯 GENERATING WEEKLY PLAN FOR USER: {user_email} | Gender: {gender} | Age: {age} | Weight: {weight} | Goal: {agent_type}")
    
    # Get specific exercises from ChromaDB
    chromadb_exercises = []
    try:
        enable_agentic_rag = os.getenv("ENABLE_AGENTIC_RAG", "false").lower() == "true"
        
        if enable_agentic_rag:
            from vector_store import FitnessVectorStore
            from mcp_client import get_fallback_fitness_recommendation
            
            logging.info("🔍 Fetching specific exercises from ChromaDB for weekly plan")
            
            # Initialize ChromaDB
            vector_store = FitnessVectorStore()
            
            # Search for exercises based on agent type
            search_terms = {
                'weight_loss': ['cardio exercises', 'fat burning workouts', 'HIIT exercises'],
                'cardio': ['running exercises', 'cardio workouts', 'endurance training'],
                'muscle_gain': ['strength training', 'muscle building', 'hypertrophy exercises'],
                'strength': ['powerlifting', 'strength exercises', 'compound movements'],
                'general': ['full body exercises', 'fitness workouts', 'balanced training']
            }
            
            terms = search_terms.get(agent_type, search_terms['general'])
            
            # Search for exercises
            all_exercises = []
            for term in terms:
                try:
                    exercises = vector_store.search_exercises(
                        query=term,
                        filters=None,
                        top_k=8
                    )
                    all_exercises.extend(exercises[:3])  # Top 3 per category
                except Exception as e:
                    logging.error(f"Error searching for '{term}': {e}")
            
            # Format exercises for the prompt
            if all_exercises:
                chromadb_exercises = []
                for i, exercise in enumerate(all_exercises[:15], 1):  # Limit to 15 exercises
                    metadata = exercise.get('metadata', {})
                    exercise_name = metadata.get('title', 'Unknown Exercise')
                    exercise_type = metadata.get('type', 'general')
                    body_part = metadata.get('body_part', 'full body')
                    equipment = metadata.get('equipment', 'body weight')
                    
                    chromadb_exercises.append({
                        'name': exercise_name,
                        'type': exercise_type,
                        'body_part': body_part,
                        'equipment': equipment
                    })
                
                logging.info(f"✅ Found {len(chromadb_exercises)} specific exercises from ChromaDB for user {user_email}")
                # Log first 5 exercise names for debugging
                exercise_names = [ex['name'] for ex in chromadb_exercises[:5]]
                logging.info(f"   Sample exercises: {', '.join(exercise_names)}")
            else:
                logging.warning(f"❌ No exercises found in ChromaDB for user {user_email}")
    except Exception as e:
        logging.error(f"Error fetching ChromaDB exercises for user {user_email}: {e}")
    
    # Create comprehensive prompt for weekly plan generation
    user_info = f"User: {gender}, {age} years old, {weight} lbs, Goal: {agent_type}"
    if health_conditions.strip():
        user_info += f"\nHealth/Exercise Notes: {health_conditions}"
    
    # Add ChromaDB exercises section
    chromadb_section = ""
    if chromadb_exercises:
        chromadb_section = "\n\n🎯 MANDATORY: USE THESE SPECIFIC EXERCISES FROM DATABASE:\n"
        for ex in chromadb_exercises:
            chromadb_section += f"- {ex['name']} ({ex['body_part']}, {ex['equipment']})\n"
        chromadb_section += "\n⚠️ CRITICAL: You MUST use these specific exercise names in your daily plans. Do NOT use generic terms like 'dynamic movements', 'core strengthening', or 'strength exercises'. Instead, specify EXACTLY which exercises from the list above (e.g., '3 sets of 10-15 Bulgarian Split Squats' or '20 minutes Treadmill Running'). Add appropriate sets/reps/duration based on the user's fitness level."
    
    # Define rest day strategy based on agent type
    rest_days_info = {
        'weight_loss': '1 rest day (recommend Thursday or Sunday)',
        'cardio': '1 rest day (recommend Thursday or Sunday)', 
        'muscle_gain': '1-2 rest days (recommend Wednesday and Sunday)',
        'strength': '1-2 rest days (recommend Wednesday and Sunday)',
        'general': '1-2 rest days (recommend Wednesday and Sunday)'
    }
    
    prompt = f"""You are a professional fitness trainer creating a balanced 7-day weekly fitness plan.

{user_info}

Based on the following recommendation:
{base_recommendation[:800]}
{chromadb_section}

Create a BALANCED weekly plan that distributes exercises evenly across the week. Follow this EXACT structure:

WEEKLY_OVERVIEW: Write a clear, motivational 2-3 sentence summary (under 200 characters) about this week's main training focus for {agent_type} goals. Avoid listing specific exercises - focus on the overall theme and benefits.

WEEKLY_GOALS:
- Goal 1 specific to {agent_type} objectives
- Goal 2 specific to {agent_type} objectives  
- Goal 3 specific to {agent_type} objectives

MONDAY_UPPER_BODY:
EXERCISES:
- Exercise 1 with SPECIFIC NAME from database (e.g., "3 sets of 10 push-ups" NOT "bodyweight exercises")
- Exercise 2 with SPECIFIC NAME from database (e.g., "2 sets of 15 arm circles" NOT "upper body work")
- Exercise 3 with SPECIFIC NAME from database (e.g., "3 sets of 8 tricep dips" NOT "strength training")
GOALS:
- Build upper body strength
- Improve posture and alignment
NOTES: Focus on proper form over speed

TUESDAY_CARDIO:
EXERCISES:
- Exercise 1 with SPECIFIC NAME from database (e.g., "20 minutes brisk walking" NOT "cardio activity")
- Exercise 2 with SPECIFIC NAME from database (e.g., "3 sets of 30-second jumping jacks" NOT "dynamic movements")
- Exercise 3 with SPECIFIC NAME from database (e.g., "2 sets of 15 high knees" NOT "cardio work")
GOALS:
- Improve cardiovascular endurance
- Burn calories effectively
NOTES: Monitor heart rate and stay hydrated

WEDNESDAY_LOWER_BODY:
EXERCISES:
- Exercise 1 with SPECIFIC NAME from database (e.g., "3 sets of 12 squats" NOT "leg exercises")
- Exercise 2 with SPECIFIC NAME from database (e.g., "3 sets of 10 lunges each leg" NOT "lower body work")
- Exercise 3 with SPECIFIC NAME from database (e.g., "2 sets of 20 calf raises" NOT "leg strengthening")
GOALS:
- Strengthen leg muscles
- Improve balance and stability
NOTES: Keep knees aligned with toes

THURSDAY_ACTIVE_RECOVERY:
ACTIVITIES:
- Light stretching routine (10-15 minutes)
- Gentle walking (15-20 minutes)
- Deep breathing exercises (5 minutes)
GOALS:
- Promote muscle recovery
- Maintain daily movement
NOTES: Keep intensity very low and relaxed

FRIDAY_FULL_BODY:
EXERCISES:
- Exercise 1 with SPECIFIC NAME from database (e.g., "2 sets of 8 modified burpees" NOT "full body work")
- Exercise 2 with SPECIFIC NAME from database (e.g., "3 sets of 10 mountain climbers" NOT "functional movements")
- Exercise 3 with SPECIFIC NAME from database (e.g., "2 sets of 12 wall sits" NOT "compound exercises")
GOALS:
- Combine strength and cardio
- Work multiple muscle groups
NOTES: Take breaks as needed between exercises

SATURDAY_FLEXIBILITY:
EXERCISES:
- Exercise 1 with SPECIFIC NAME (e.g., "5 minutes dynamic stretching" NOT "flexibility work")
- Exercise 2 with SPECIFIC NAME (e.g., "10 minutes yoga flow" NOT "stretching routine")
- Exercise 3 with SPECIFIC NAME (e.g., "5 minutes static stretching" NOT "mobility work")
GOALS:
- Improve flexibility and mobility
- Reduce muscle tension
NOTES: Hold stretches for 20-30 seconds

SUNDAY_REST:
ACTIVITIES:
- Optional gentle yoga (15-20 minutes)
- Light household activities
- Meal preparation for the week
GOALS:
- Complete rest and recovery
- Prepare for upcoming week
NOTES: Complete rest is also perfectly fine

CRITICAL REQUIREMENTS:
1. Each workout day must have exactly 2-4 exercises (not more, not less)
2. Each exercise MUST be a SPECIFIC exercise name from the database above, NOT generic terms
3. FORBIDDEN generic terms: "dynamic movements", "core strengthening", "strength exercises", "cardio activity", "functional movements"
4. Each exercise must include specific sets/reps or duration
5. Rest days should have 1-3 gentle activities
6. Use {rest_days_info.get(agent_type, '1-2 rest days')} but allow flexibility
7. Make exercises suitable for {agent_type} goals
8. Consider health conditions: {health_conditions if health_conditions.strip() else "None mentioned"}
9. Keep the plan realistic and achievable for beginners to intermediate

Follow this structure EXACTLY with proper EXERCISES/ACTIVITIES sections."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": prompt}
            ],
            max_tokens=int(os.getenv("AI_FORMATTING_MAX_TOKENS", "3000")),
            temperature=float(os.getenv("AI_FORMATTING_TEMPERATURE", "0.3"))
        )
        
        weekly_plan_text = response.choices[0].message.content
        
        # Log the raw AI response for debugging
        logging.info(f"📋 Weekly Plan AI Response (first 1000 chars):\n{weekly_plan_text[:1000]}")
        
        # Parse the response into structured format
        parsed_plan = parse_weekly_plan_response_improved(weekly_plan_text, agent_type)
        
        # FORCE REPLACE generic terms with specific ChromaDB exercises
        if chromadb_exercises and 'dailyPlans' in parsed_plan:
            logging.info("🔧 Post-processing: Replacing generic terms with specific exercises")
            generic_terms = [
                'dynamic movements', 'core strengthening', 'strength exercises',
                'cardio activity', 'functional movements', 'bodyweight exercises',
                'upper body work', 'lower body work', 'leg exercises',
                'cardio work', 'flexibility work', 'stretching routine',
                'mobility work', 'compound exercises', 'full body work'
            ]
            
            exercise_pool = [ex['name'] for ex in chromadb_exercises]
            exercise_index = 0
            
            for day, plan in parsed_plan['dailyPlans'].items():
                if 'exercises' in plan:
                    for i, exercise in enumerate(plan['exercises']):
                        exercise_lower = exercise.lower()
                        # Check if exercise contains any generic term
                        has_generic = any(term in exercise_lower for term in generic_terms)
                        if has_generic and exercise_index < len(exercise_pool):
                            # Replace with specific exercise from ChromaDB
                            specific_exercise = exercise_pool[exercise_index]
                            # Keep the sets/reps part if it exists
                            parts = exercise.split(' ')
                            if len(parts) > 0 and any(char.isdigit() for char in parts[0]):
                                # Has sets/reps like "3 sets of..."
                                plan['exercises'][i] = f"{parts[0]} {parts[1] if len(parts) > 1 else ''} {specific_exercise}"
                            else:
                                plan['exercises'][i] = specific_exercise
                            logging.info(f"   Replaced '{exercise[:50]}' with '{plan['exercises'][i]}'")
                            exercise_index = (exercise_index + 1) % len(exercise_pool)
        
        # Log parsed exercises for debugging
        if 'dailyPlans' in parsed_plan:
            for day, plan in parsed_plan.get('dailyPlans', {}).items():
                exercise_count = len(plan.get('exercises', []))
                logging.info(f"📅 {day}: {exercise_count} exercises parsed")
                if exercise_count > 0:
                    logging.info(f"   First exercise: {plan['exercises'][0][:100]}")
        
        # Normalize the plan structure to ensure consistency
        parsed_plan = normalize_weekly_plan_structure(parsed_plan)
        
        # Add generation timestamp
        from datetime import datetime
        parsed_plan['generated_at'] = datetime.utcnow().isoformat()
        parsed_plan['uses_chromadb'] = len(chromadb_exercises) > 0
        parsed_plan['chromadb_exercise_count'] = len(chromadb_exercises)
        
        logging.info(f"✅ Weekly plan generated with {len(chromadb_exercises)} ChromaDB exercises at {parsed_plan['generated_at']}")
        
        # Validate the plan has balanced content
        if not validate_weekly_plan(parsed_plan):
            logging.warning("AI generated unbalanced plan, using fallback")
            fallback_plan = get_fallback_weekly_plan(agent_type)
            return normalize_weekly_plan_structure(fallback_plan)
        
        return parsed_plan
        
    except Exception as e:
        logging.error(f"Error generating weekly plan: {e}")
        # Return fallback plan based on agent type
        fallback_plan = get_fallback_weekly_plan(agent_type)
        return normalize_weekly_plan_structure(fallback_plan)

def parse_weekly_plan_response_improved(plan_text, agent_type):
    """
    Improved parsing function that's more robust and handles the new format
    """
    
    # Initialize the plan structure
    parsed_plan = {
        'weeklyOverview': '',
        'weeklyGoals': [],
        'dailyPlans': {}
    }
    
    lines = plan_text.split('\n')
    current_day = None
    current_section = None
    current_day_data = {}
    
    day_mapping = {
        'MONDAY': 'Monday',
        'TUESDAY': 'Tuesday', 
        'WEDNESDAY': 'Wednesday',
        'THURSDAY': 'Thursday',
        'FRIDAY': 'Friday',
        'SATURDAY': 'Saturday',
        'SUNDAY': 'Sunday'
    }
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Extract weekly overview
        if 'WEEKLY_OVERVIEW:' in line.upper():
            current_section = 'overview'
            content = line.split(':', 1)[1].strip() if ':' in line else ''
            if content:
                parsed_plan['weeklyOverview'] = content
            continue
        elif current_section == 'overview' and not line.upper().startswith(('WEEKLY_GOALS', 'MONDAY', 'TUESDAY')):
            if not parsed_plan['weeklyOverview']:
                parsed_plan['weeklyOverview'] = line
            else:
                parsed_plan['weeklyOverview'] += ' ' + line
            continue
            
        # Extract weekly goals
        elif 'WEEKLY_GOALS:' in line.upper():
            current_section = 'goals'
            continue
        elif current_section == 'goals' and line.startswith('-'):
            parsed_plan['weeklyGoals'].append(line[1:].strip())
            continue
        elif current_section == 'goals' and any(day in line.upper() for day in day_mapping.keys()):
            current_section = None
            
        # Check for daily sections
        day_found = None
        for day_key, day_name in day_mapping.items():
            if day_key in line.upper() and ('_' in line or ':' in line):
                day_found = day_name
                break
                
        if day_found:
            # Save previous day if exists
            if current_day and current_day_data:
                parsed_plan['dailyPlans'][current_day] = current_day_data
            
            # Start new day
            current_day = day_found
            current_section = 'day'
            
            # Check if it's a rest day
            is_rest_day = 'REST' in line.upper() or 'RECOVERY' in line.upper() or 'ACTIVE_RECOVERY' in line.upper()
            
            current_day_data = {
                'exercises': [],
                'goals': [],
                'focus': '',
                'notes': '',
                'isRestDay': is_rest_day,
                'activities': [] if is_rest_day else None
            }
            
            # Extract focus from line
            if '_' in line:
                focus_part = line.split('_', 1)[1].replace(':', '').strip()
                current_day_data['focus'] = focus_part.replace('_', ' ').title()
            elif '-' in line:
                focus_part = line.split('-', 1)[1].strip().rstrip(':')
                current_day_data['focus'] = focus_part
            
            continue
    
        # Extract daily content
        if current_day and current_section == 'day':
            if 'EXERCISES:' in line.upper():
                current_section = 'exercises'
                continue
            elif 'ACTIVITIES:' in line.upper():
                current_section = 'activities'
                continue
            elif 'GOALS:' in line.upper():
                current_section = 'day_goals'
                continue
            elif 'NOTES:' in line.upper():
                current_section = 'notes'
                notes_content = line.split(':', 1)[1].strip() if ':' in line else ''
                if notes_content:
                    current_day_data['notes'] = notes_content
                continue
            elif line.startswith('-'):
                if current_section == 'exercises':
                    current_day_data['exercises'].append(line[1:].strip())
                elif current_section == 'activities':
                    if current_day_data['activities'] is not None:
                        current_day_data['activities'].append(line[1:].strip())
                elif current_section == 'day_goals':
                    current_day_data['goals'].append(line[1:].strip())
    
    # Don't forget the last day
    if current_day and current_day_data:
        parsed_plan['dailyPlans'][current_day] = current_day_data
    
    # Add fallback content if parsing didn't capture enough
    if len(parsed_plan['weeklyGoals']) == 0:
        parsed_plan['weeklyGoals'] = get_weekly_goals_for_agent(agent_type)
    
    if not parsed_plan['weeklyOverview']:
        parsed_plan['weeklyOverview'] = f"A comprehensive 7-day fitness plan designed for {agent_type.replace('_', ' ')} goals, balancing training intensity with adequate recovery."
    else:
        # Ensure the overview is concise and readable (max 250 characters)
        overview = parsed_plan['weeklyOverview']
        if len(overview) > 250:
            # Find the end of the second sentence or truncate at 250 chars
            sentences = overview.split('. ')
            if len(sentences) >= 2:
                parsed_plan['weeklyOverview'] = '. '.join(sentences[:2]) + '.'
            else:
                parsed_plan['weeklyOverview'] = overview[:247] + '...'
    
    # Ensure all 7 days are present with fallbacks
    if len(parsed_plan['dailyPlans']) < 7:
        fallback_plans = get_fallback_daily_plans(agent_type)
        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
            if day not in parsed_plan['dailyPlans']:
                parsed_plan['dailyPlans'][day] = fallback_plans.get(day, {
                    'exercises': ['Light bodyweight movement', 'Gentle stretching routine', '15-20 minutes walking'],
                    'goals': ['Stay active', 'Listen to your body'],
                    'focus': 'Active Recovery',
                    'notes': 'Adjust intensity based on how you feel',
                    'isRestDay': False,
                    'activities': None
                })
    
    # Ensure all existing days have the required structure
    for day, day_data in parsed_plan['dailyPlans'].items():
        if day_data:
            # Ensure exercises is always a list
            if 'exercises' not in day_data or day_data['exercises'] is None:
                day_data['exercises'] = []
            
            # Ensure goals is always a list
            if 'goals' not in day_data or day_data['goals'] is None:
                day_data['goals'] = []
            
            # Ensure activities is properly handled for rest days
            if day_data.get('isRestDay'):
                if 'activities' not in day_data or day_data['activities'] is None:
                    day_data['activities'] = []
            else:
                if 'activities' not in day_data:
                    day_data['activities'] = None
            
            # Ensure other required fields exist
            if 'focus' not in day_data:
                day_data['focus'] = ''
            if 'notes' not in day_data:
                day_data['notes'] = ''
            if 'isRestDay' not in day_data:
                day_data['isRestDay'] = False
    
    return parsed_plan

def validate_weekly_plan(plan):
    """
    Validate that the weekly plan is balanced and complete with more realistic criteria
    """
    if not plan or 'dailyPlans' not in plan:
        return False
    
    daily_plans = plan['dailyPlans']
    
    # Check that we have 7 days
    if len(daily_plans) != 7:
        return False
    
    # Check each day has content
    total_exercises_week = 0
    days_with_content = 0
    rest_days = 0
    workout_days_with_content = 0
    
    for day, day_data in daily_plans.items():
        if not day_data:
            continue
            
        # Safely get exercises and activities with proper None handling
        exercises = day_data.get('exercises') or []
        activities = day_data.get('activities') or []
        
        # Count exercises/activities
        exercise_count = len(exercises) if exercises is not None else 0
        activity_count = len(activities) if activities is not None else 0
        
        if day_data.get('isRestDay'):
            rest_days += 1
            # Rest days need at least 1 activity (was 2, too strict)
            if activity_count >= 1:
                days_with_content += 1
        else:
            # Workout days need at least 2 exercises (was 3, too strict)
            if exercise_count >= 2:
                days_with_content += 1
                workout_days_with_content += 1
                total_exercises_week += exercise_count
    
    # Relaxed validation rules:
    # 1. At least 4 days should have meaningful content (was 5)
    # 2. Should have 1-3 rest days (was 1-2, allow more flexibility)
    # 3. At least 3 workout days should have content (realistic minimum)
    # 4. No single day should have more than 10 exercises (was 8, allow more)
    # 5. Total exercises for the week should be reasonable (10-40, was 15-35)
    
    if days_with_content < 4:
        return False
    
    if rest_days < 1 or rest_days > 3:
        return False
    
    if workout_days_with_content < 3:
        return False
    
    # Check for exercise dumping (one day having too many)
    for day, day_data in daily_plans.items():
        if not day_data or day_data.get('isRestDay'):
            continue
        exercises = day_data.get('exercises') or [] if day_data else []
        exercise_count = len(exercises) if exercises is not None else 0
        if exercise_count > 10:  # Allow up to 10 exercises per day
            return False
    
    # More flexible total exercise range
    if total_exercises_week < 10 or total_exercises_week > 40:
        return False
    
    return True

def parse_weekly_plan_response(plan_text, agent_type):
    """
    Parse the AI response into a structured weekly plan format
    """
    
    days_of_week = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    
    # Initialize the plan structure
    parsed_plan = {
        'weeklyOverview': '',
        'weeklyGoals': [],
        'dailyPlans': {}
    }
    
    # Split by sections and process
    sections = plan_text.split('**')
    
    current_section = None
    current_day = None
    current_day_data = {}
    
    for section in sections:
        section = section.strip()
        if not section:
            continue
            
        # Check for weekly overview
        if 'WEEKLY OVERVIEW' in section.upper():
            current_section = 'overview'
            # Extract content after the header
            content = section.split(':')[-1].strip()
            if content:
                parsed_plan['weeklyOverview'] = content
            continue
            
        # Check for weekly goals
        elif 'WEEKLY GOALS' in section.upper():
            current_section = 'goals'
            # Extract goals from the content after this section
            continue
            
        # Check for daily sections
        day_found = None
        for day in days_of_week:
            if day in section.upper() and ('-' in section or ':' in section):
                day_found = day.capitalize()
                break
                
        if day_found:
            # Save previous day if exists
            if current_day and current_day_data:
                parsed_plan['dailyPlans'][current_day] = current_day_data
            
            # Start new day
            current_day = day_found
            current_section = 'day'
            
            # Check if it's a rest day
            is_rest_day = 'REST DAY' in section.upper() or 'RECOVERY' in section.upper()
            
            current_day_data = {
                'exercises': [],
                'goals': [],
                'focus': '',
                'notes': '',
                'isRestDay': is_rest_day,
                'activities': [] if is_rest_day else None
            }
            
            # Extract focus from day header
            if '-' in section:
                focus_part = section.split('-', 1)[1].strip().rstrip(':')
                current_day_data['focus'] = focus_part
            
            continue
    
    # Process the remaining content line by line for better extraction
    lines = plan_text.split('\n')
    
    in_goals_section = False
    in_exercises_section = False
    in_daily_goals_section = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Weekly goals extraction
        if 'WEEKLY GOALS:' in line.upper():
            in_goals_section = True
            continue
        elif in_goals_section and line.startswith('-'):
            parsed_plan['weeklyGoals'].append(line[1:].strip())
            continue
        elif in_goals_section and any(day in line.upper() for day in days_of_week):
            in_goals_section = False
            
        # Extract weekly overview if not found in sections
        if not parsed_plan['weeklyOverview'] and 'WEEKLY OVERVIEW:' in line.upper():
            # Look for content in the next lines
            continue
        elif not parsed_plan['weeklyOverview'] and not line.startswith('**') and not line.startswith('-') and len(line) > 20:
            if not any(keyword in line.upper() for keyword in ['WEEKLY GOALS', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']):
                parsed_plan['weeklyOverview'] = line
                continue
                
        # Daily content extraction
        if current_day:
            if 'EXERCISES:' in line.upper():
                in_exercises_section = True
                in_daily_goals_section = False
                continue
            elif 'GOALS:' in line.upper():
                in_exercises_section = False
                in_daily_goals_section = True
                continue
            elif 'NOTES:' in line.upper():
                in_exercises_section = False
                in_daily_goals_section = False
                notes_content = line.split(':', 1)[1].strip() if ':' in line else ''
                if notes_content:
                    current_day_data['notes'] = notes_content
                continue
            elif line.startswith('-') and in_exercises_section:
                exercise = line[1:].strip()
                if current_day_data['isRestDay']:
                    current_day_data['activities'].append(exercise)
                else:
                    current_day_data['exercises'].append(exercise)
            elif line.startswith('-') and in_daily_goals_section:
                current_day_data['goals'].append(line[1:].strip())
    
    # Don't forget the last day
    if current_day and current_day_data:
        parsed_plan['dailyPlans'][current_day] = current_day_data
    
    # Add fallback content if parsing didn't capture enough
    if len(parsed_plan['weeklyGoals']) == 0:
        parsed_plan['weeklyGoals'] = get_weekly_goals_for_agent(agent_type)
    
    if not parsed_plan['weeklyOverview']:
        parsed_plan['weeklyOverview'] = f"A comprehensive 7-day fitness plan designed for {agent_type.replace('_', ' ')} goals, balancing training intensity with adequate recovery."
    
    if len(parsed_plan['dailyPlans']) < 7:
        # Fill in missing days with fallbacks
        fallback_plans = get_fallback_daily_plans(agent_type)
        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
            if day not in parsed_plan['dailyPlans']:
                parsed_plan['dailyPlans'][day] = fallback_plans.get(day, {
                    'exercises': ['Light activity as tolerated'],
                    'goals': ['Listen to your body', 'Stay active'],
                    'focus': 'Flexible training',
                    'notes': 'Adjust based on how you feel',
                    'isRestDay': False
                })
    
    return parsed_plan

def get_weekly_goals_for_agent(agent_type):
    """Get appropriate weekly goals based on agent type"""
    goals_map = {
        'weight_loss': [
            'Create a sustainable calorie deficit through exercise and activity',
            'Build lean muscle to boost metabolism',
            'Establish consistent daily movement habits',
            'Focus on progressive cardio endurance improvements'
        ],
        'muscle_gain': [
            'Progressive overload in strength training exercises',
            'Maintain adequate protein intake and recovery',
            'Build functional strength across all muscle groups',
            'Achieve consistent training intensity with proper form'
        ],
        'cardio': [
            'Improve cardiovascular endurance and VO2 max',
            'Build aerobic capacity through varied cardio training',
            'Establish sustainable exercise intensity zones',
            'Enhance overall stamina and heart health'
        ],
        'strength': [
            'Increase maximal strength in compound movements',
            'Perfect lifting technique and movement patterns',
            'Build functional strength for daily activities',
            'Achieve progressive strength gains week over week'
        ],
        'general': [
            'Establish consistent exercise habits and routine',
            'Improve overall fitness and energy levels',
            'Build balanced strength, cardio, and flexibility',
            'Create sustainable long-term wellness practices'
        ]
    }
    
    return goals_map.get(agent_type, goals_map['general'])

def get_fallback_daily_plans(agent_type):
    """Get balanced fallback daily plans based on agent type when parsing fails"""
    
    if agent_type == 'weight_loss':
        return {
            'Monday': {
                'focus': 'Full Body Circuit Training',
                'exercises': [
                    '3 sets of 12-15 bodyweight squats',
                    '3 sets of 8-12 push-ups (modified as needed)',
                    '3 sets of 30-45 second planks',
                    '20 minutes brisk walking'
                ],
                'goals': [
                    'Burn calories through compound movements',
                    'Establish weekly workout routine'
                ],
                'notes': 'Start the week strong but listen to your body',
                'isRestDay': False
            },
            'Tuesday': {
                'focus': 'Cardio Endurance',
                'exercises': [
                    '25-30 minutes steady-state cardio',
                    '3 sets of 15 jumping jacks',
                    '3 sets of 20 high knees',
                    '10 minutes stretching'
                ],
                'goals': [
                    'Improve cardiovascular fitness',
                    'Burn maximum calories'
                ],
                'notes': 'Maintain conversational pace for steady cardio',
                'isRestDay': False
            },
            'Wednesday': {
                'focus': 'Strength & Core',
                'exercises': [
                    '3 sets of 10 wall push-ups',
                    '3 sets of 45-60 second wall sits',
                    '3 sets of 15 crunches',
                    '15 minutes walking'
                ],
                'goals': [
                    'Build lean muscle mass',
                    'Strengthen core stability'
                ],
                'notes': 'Focus on controlled movements',
                'isRestDay': False
            },
            'Thursday': {
                'focus': 'Active Recovery',
                'activities': [
                    '20-30 minutes gentle walking',
                    '10 minutes stretching routine',
                    'Light household activities',
                    'Deep breathing exercises'
                ],
                'goals': [
                    'Promote muscle recovery',
                    'Maintain daily movement'
                ],
                'notes': 'Keep moving but at a relaxed pace',
                'isRestDay': True
            },
            'Friday': {
                'focus': 'High-Intensity Fat Burning',
                'exercises': [
                    '3 sets of 8 burpees (modified as needed)',
                    '3 sets of 20 mountain climbers',
                    '3 sets of 15 squat jumps',
                    '20 minutes interval walking'
                ],
                'goals': [
                    'Maximize calorie burn',
                    'Challenge cardiovascular system'
                ],
                'notes': 'Push yourself but maintain proper form',
                'isRestDay': False
            },
            'Saturday': {
                'focus': 'Fun Active Day',
                'exercises': [
                    '45-60 minutes recreational activity',
                    'Dancing, hiking, or sports',
                    '15 minutes stretching',
                    'Active family time'
                ],
                'goals': [
                    'Enjoy physical activity',
                    'Stay active socially'
                ],
                'notes': 'Make fitness fun and sustainable',
                'isRestDay': False
            },
            'Sunday': {
                'focus': 'Recovery & Planning',
                'activities': [
                    '30 minutes gentle yoga',
                    '20 minutes nature walk',
                    'Meal prep for the week',
                    'Goal setting and reflection'
                ],
                'goals': [
                    'Prepare for the upcoming week',
                    'Promote full body recovery'
                ],
                'notes': 'Focus on rest and preparation',
                'isRestDay': True
            }
        }
    
    elif agent_type == 'muscle_gain':
        return {
            'Monday': {
                'focus': 'Upper Body Strength',
                'exercises': [
                    '4 sets of 6-8 push-ups',
                    '3 sets of 8-10 tricep dips',
                    '3 sets of 12 resistance band rows',
                    '3 sets of 10 shoulder presses'
                ],
                'goals': [
                    'Build upper body muscle mass',
                    'Focus on progressive overload'
                ],
                'notes': 'Increase difficulty or reps weekly',
                'isRestDay': False
            },
            'Tuesday': {
                'focus': 'Lower Body Power',
                'exercises': [
                    '4 sets of 8-12 bodyweight squats',
                    '3 sets of 10 lunges each leg',
                    '3 sets of 12 calf raises',
                    '3 sets of 10 glute bridges'
                ],
                'goals': [
                    'Develop lower body strength',
                    'Build functional leg muscles'
                ],
                'notes': 'Add resistance or increase range of motion',
                'isRestDay': False
            },
            'Wednesday': {
                'focus': 'Active Recovery',
                'activities': [
                    '20-30 minutes gentle walking',
                    '15 minutes stretching',
                    'Light mobility work',
                    'Foam rolling if available'
                ],
                'goals': [
                    'Promote muscle recovery',
                    'Maintain flexibility'
                ],
                'notes': 'Focus on areas that feel tight',
                'isRestDay': True
            },
            'Thursday': {
                'focus': 'Core & Stability',
                'exercises': [
                    '4 sets of 30-60 second planks',
                    '3 sets of 15 Russian twists',
                    '3 sets of 12 leg raises',
                    '3 sets of 10 dead bugs each side'
                ],
                'goals': [
                    'Build core strength',
                    'Improve spinal stability'
                ],
                'notes': 'Quality over quantity - focus on form',
                'isRestDay': False
            },
            'Friday': {
                'focus': 'Full Body Circuit',
                'exercises': [
                    '3 sets of 8-10 compound squats',
                    '3 sets of 6-8 push-up variations',
                    '3 sets of 10 inverted rows',
                    '3 sets of 8 step-ups each leg'
                ],
                'goals': [
                    'Combine all muscle groups',
                    'Build functional strength'
                ],
                'notes': 'Focus on compound movements',
                'isRestDay': False
            },
            'Saturday': {
                'focus': 'Isolation & Conditioning',
                'exercises': [
                    '3 sets of 12 bicep curls',
                    '3 sets of 15 lateral raises',
                    '3 sets of 20 calf raises',
                    '20 minutes light cardio'
                ],
                'goals': [
                    'Target specific muscle groups',
                    'Improve muscle definition'
                ],
                'notes': 'Lighter weights, higher reps',
                'isRestDay': False
            },
            'Sunday': {
                'focus': 'Complete Rest',
                'activities': [
                    'Gentle stretching or yoga',
                    'Leisurely walk in nature',
                    'Meal prep and planning',
                    'Complete rest and recovery'
                ],
                'goals': [
                    'Allow full muscle recovery',
                    'Prepare for next week'
                ],
                'notes': 'Essential for muscle growth',
                'isRestDay': True
            }
        }
    
    elif agent_type == 'cardio':
        return {
            'Monday': {
                'focus': 'Steady State Cardio',
                'exercises': [
                    '30-40 minutes moderate cardio',
                    '5 minutes warm-up',
                    '5 minutes cool-down',
                    'Light stretching routine'
                ],
                'goals': [
                    'Build aerobic base',
                    'Improve endurance'
                ],
                'notes': 'Maintain steady, comfortable pace',
                'isRestDay': False
            },
            'Tuesday': {
                'focus': 'Interval Training',
                'exercises': [
                    '20 minutes interval training',
                    '5 sets of 2-minute high intensity',
                    '1-minute recovery between sets',
                    '10 minutes cool-down'
                ],
                'goals': [
                    'Improve VO2 max',
                    'Build speed and power'
                ],
                'notes': 'Push hard during intervals',
                'isRestDay': False
            },
            'Wednesday': {
                'focus': 'Cross Training',
                'exercises': [
                    '25 minutes different cardio activity',
                    '10 minutes core strengthening',
                    '10 minutes flexibility work',
                    'Light bodyweight exercises'
                ],
                'goals': [
                    'Prevent overuse injuries',
                    'Build overall fitness'
                ],
                'notes': 'Try swimming, cycling, or rowing',
                'isRestDay': False
            },
            'Thursday': {
                'focus': 'Active Recovery',
                'activities': [
                    '20-30 minutes easy walking',
                    '15 minutes gentle stretching',
                    'Light yoga or mobility',
                    'Breathing exercises'
                ],
                'goals': [
                    'Enhance recovery',
                    'Maintain movement'
                ],
                'notes': 'Very easy pace today',
                'isRestDay': True
            },
            'Friday': {
                'focus': 'Tempo Training',
                'exercises': [
                    '25 minutes tempo cardio',
                    'Comfortably hard pace',
                    '5 minutes warm-up',
                    '5 minutes cool-down'
                ],
                'goals': [
                    'Improve lactate threshold',
                    'Build stamina'
                ],
                'notes': 'Pace you could maintain for 1 hour',
                'isRestDay': False
            },
            'Saturday': {
                'focus': 'Long Steady Distance',
                'exercises': [
                    '45-60 minutes easy cardio',
                    'Conversational pace',
                    'Focus on form and breathing',
                    'Extended cool-down'
                ],
                'goals': [
                    'Build endurance base',
                    'Improve fat burning'
                ],
                'notes': 'Should be able to hold conversation',
                'isRestDay': False
            },
            'Sunday': {
                'focus': 'Recovery Day',
                'activities': [
                    'Gentle movement only',
                    'Stretching or yoga',
                    'Easy nature walk',
                    'Complete rest option'
                ],
                'goals': [
                    'Complete recovery',
                    'Prepare for next week'
                ],
                'notes': 'Listen to your body',
                'isRestDay': True
            }
        }
    
    elif agent_type == 'strength':
        return {
            'Monday': {
                'focus': 'Upper Body Push',
                'exercises': [
                    '4 sets of 5-8 push-up progressions',
                    '3 sets of 8-10 overhead presses',
                    '3 sets of 10-12 tricep exercises',
                    '3 sets of 8-12 chest exercises'
                ],
                'goals': [
                    'Build pushing strength',
                    'Increase upper body power'
                ],
                'notes': 'Focus on progressive overload',
                'isRestDay': False
            },
            'Tuesday': {
                'focus': 'Lower Body Strength',
                'exercises': [
                    '4 sets of 5-8 squat variations',
                    '3 sets of 8-10 deadlift patterns',
                    '3 sets of 10-12 lunges',
                    '3 sets of 12-15 calf raises'
                ],
                'goals': [
                    'Build leg and glute strength',
                    'Improve functional movement'
                ],
                'notes': 'Emphasize proper form',
                'isRestDay': False
            },
            'Wednesday': {
                'focus': 'Active Recovery',
                'activities': [
                    'Light movement and stretching',
                    'Mobility work',
                    'Gentle walking',
                    'Foam rolling'
                ],
                'goals': [
                    'Promote recovery',
                    'Maintain flexibility'
                ],
                'notes': 'Essential for strength gains',
                'isRestDay': True
            },
            'Thursday': {
                'focus': 'Upper Body Pull',
                'exercises': [
                    '4 sets of 5-8 pulling exercises',
                    '3 sets of 8-10 rows',
                    '3 sets of 10-12 bicep curls',
                    '3 sets of 8-12 reverse flies'
                ],
                'goals': [
                    'Build pulling strength',
                    'Balance push/pull ratio'
                ],
                'notes': 'Focus on back and biceps',
                'isRestDay': False
            },
            'Friday': {
                'focus': 'Full Body Power',
                'exercises': [
                    '3 sets of 6-8 compound movements',
                    '3 sets of 8-10 multi-joint exercises',
                    '3 sets of 10-12 functional patterns',
                    'Power-focused movements'
                ],
                'goals': [
                    'Integrate strength gains',
                    'Build explosive power'
                ],
                'notes': 'Quality over quantity',
                'isRestDay': False
            },
            'Saturday': {
                'focus': 'Core & Stabilization',
                'exercises': [
                    '4 sets of planks and variations',
                    '3 sets of anti-rotation exercises',
                    '3 sets of stability challenges',
                    'Balance and coordination work'
                ],
                'goals': [
                    'Build core strength',
                    'Improve stability'
                ],
                'notes': 'Foundation for all strength',
                'isRestDay': False
            },
            'Sunday': {
                'focus': 'Complete Rest',
                'activities': [
                    'Complete rest or gentle yoga',
                    'Light stretching',
                    'Meal prep',
                    'Recovery activities'
                ],
                'goals': [
                    'Full recovery',
                    'Prepare for next week'
                ],
                'notes': 'Rest is when you get stronger',
                'isRestDay': True
            }
        }
    
    else:  # general fitness
        return {
            'Monday': {
                'focus': 'Full Body Fitness',
                'exercises': [
                    '3 sets of 10-15 bodyweight squats',
                    '3 sets of 8-12 push-ups',
                    '3 sets of 30-45 second planks',
                    '20 minutes moderate cardio'
                ],
                'goals': [
                    'Build overall fitness',
                    'Establish routine'
                ],
                'notes': 'Start week with balanced workout',
                'isRestDay': False
            },
            'Tuesday': {
                'focus': 'Cardio & Flexibility',
                'exercises': [
                    '25-30 minutes cardio activity',
                    '3 sets of dynamic movements',
                    '15 minutes stretching',
                    'Balance exercises'
                ],
                'goals': [
                    'Improve cardiovascular health',
                    'Increase flexibility'
                ],
                'notes': 'Focus on movements you enjoy',
                'isRestDay': False
            },
            'Wednesday': {
                'focus': 'Strength & Core',
                'exercises': [
                    '3 sets of bodyweight exercises',
                    '3 sets of core strengthening',
                    '3 sets of functional movements',
                    'Light resistance work'
                ],
                'goals': [
                    'Build functional strength',
                    'Strengthen core'
                ],
                'notes': 'Focus on proper form',
                'isRestDay': False
            },
            'Thursday': {
                'focus': 'Active Recovery',
                'activities': [
                    '20-30 minutes easy walking',
                    'Gentle stretching',
                    'Light household activities',
                    'Relaxation exercises'
                ],
                'goals': [
                    'Promote recovery',
                    'Stay active'
                ],
                'notes': 'Listen to your body',
                'isRestDay': True
            },
            'Friday': {
                'focus': 'Mixed Training',
                'exercises': [
                    '20 minutes varied cardio',
                    '3 sets of strength exercises',
                    '10 minutes flexibility work',
                    'Fun movement activities'
                ],
                'goals': [
                    'Combine all fitness elements',
                    'End week strong'
                ],
                'notes': 'Mix up activities to stay engaged',
                'isRestDay': False
            },
            'Saturday': {
                'focus': 'Recreation & Fun',
                'exercises': [
                    '45-60 minutes fun activity',
                    'Sports, dancing, or hiking',
                    'Social fitness activities',
                    'Outdoor adventures'
                ],
                'goals': [
                    'Enjoy being active',
                    'Build positive associations'
                ],
                'notes': 'Make fitness enjoyable',
                'isRestDay': False
            },
            'Sunday': {
                'focus': 'Rest & Preparation',
                'activities': [
                    'Gentle yoga or stretching',
                    'Leisurely walk',
                    'Meal prep for week',
                    'Plan upcoming workouts'
                ],
                'goals': [
                    'Prepare for success',
                    'Rest and recover'
                ],
                'notes': 'Set yourself up for the week ahead',
                'isRestDay': True
            }
        }

def get_fallback_weekly_plan(agent_type):
    """Return a complete fallback weekly plan when AI generation fails"""
    return {
        'weeklyOverview': f'A comprehensive 7-day fitness plan designed for {agent_type.replace("_", " ")} goals. This plan balances training intensity with adequate recovery to promote sustainable progress.',
        'weeklyGoals': get_weekly_goals_for_agent(agent_type),
        'dailyPlans': get_fallback_daily_plans(agent_type)
    }

def get_food_recommendations(gender, age, weight, height, fitness_goal, dietary_restrictions='', meal_preferences='', user_email=''):
    """Generate personalized food recommendations based on user profile and fitness goals"""
    try:
        # Calculate BMR and TDEE for caloric needs
        if gender.lower() == 'male':
            bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
        else:
            bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
        
        # Assume moderate activity level (can be adjusted based on user's fitness level)
        tdee = bmr * 1.55
        
        # Adjust calories based on fitness goal
        if fitness_goal == 'weight_loss':
            target_calories = tdee - 500
            goal_description = "weight loss"
        elif fitness_goal == 'muscle_gain':
            target_calories = tdee + 300
            goal_description = "muscle building"
        else:
            target_calories = tdee
            goal_description = "maintenance"
        
        # Create the prompt for AI food recommendations
        prompt = f"""
        Create personalized food recommendations for a {age}-year-old {gender} who weighs {weight}kg and is {height}cm tall.
        
        Goals: {goal_description}
        Target daily calories: {int(target_calories)}
        Dietary restrictions: {dietary_restrictions if dietary_restrictions else 'None'}
        Meal preferences: {meal_preferences if meal_preferences else 'No specific preferences'}
        
        Please provide:
        1. Daily meal plan with breakfast, lunch, dinner, and 2 snacks
        2. Macronutrient breakdown (protein, carbs, fats)
        3. Portion sizes and calorie estimates for each meal
        4. Food substitutions for variety
        5. Meal prep tips
        6. Hydration recommendations
        
        Format the response as a structured JSON with the following structure:
        {{
            "daily_calories": target_calories,
            "macronutrient_targets": {{
                "protein": "protein_grams",
                "carbohydrates": "carb_grams", 
                "fat": "fat_grams"
            }},
            "meal_plan": {{
                "breakfast": {{
                    "meal": "meal_description",
                    "calories": estimated_calories,
                    "protein": protein_grams,
                    "carbs": carb_grams,
                    "fat": fat_grams,
                    "ingredients": ["ingredient1", "ingredient2"],
                    "preparation": "preparation_instructions"
                }},
                "lunch": {{ ... }},
                "dinner": {{ ... }},
                "snack1": {{ ... }},
                "snack2": {{ ... }}
            }},
            "food_substitutions": {{
                "protein_sources": ["option1", "option2"],
                "carb_sources": ["option1", "option2"],
                "healthy_fats": ["option1", "option2"]
            }},
            "meal_prep_tips": ["tip1", "tip2", "tip3"],
            "hydration": "daily_water_intake_recommendation",
            "notes": "additional_nutritional_advice"
        }}
        
        Make sure all recommendations align with the {goal_description} goal and respect the dietary restrictions.
        """
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert nutritionist and dietitian specializing in sports nutrition and meal planning. Provide accurate, science-based nutritional advice."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.7
        )
        
        # Extract and parse the JSON response
        response_text = response.choices[0].message.content
        
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                food_recommendations = json.loads(json_match.group())
                return food_recommendations
            except json.JSONDecodeError:
                pass
        
        # Fallback if JSON parsing fails
        return {
            "daily_calories": int(target_calories),
            "response": response_text,
            "goal": goal_description,
            "user_profile": {
                "gender": gender,
                "age": age,
                "weight": weight,
                "height": height
            }
        }
        
    except Exception as e:
        logging.error(f"Error generating food recommendations: {e}")
        return get_fallback_food_recommendations(fitness_goal, target_calories)

def identify_food_from_image(image_path, analysis_type='food', fitness_goal='general', dietary_restrictions='', user_email=''):
    """Identify food/ingredient from an image and provide analysis or recipe suggestions"""
    try:
        # Get user's food recommendations for context
        user_food_recommendations = None
        if user_email:
            try:
                from voice_chat import get_user_food_recommendations_for_context
                user_food_recommendations = get_user_food_recommendations_for_context(user_email)
            except Exception as e:
                logging.warning(f"Could not get user food recommendations: {e}")
        
        # Encode image to base64
        with open(image_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Determine the MIME type
        mime_type, _ = guess_type(image_path)
        if mime_type is None:
            mime_type = 'image/jpeg'  # Default fallback
        
        if analysis_type == 'food':
            prompt = f"""
            Analyze the prepared food/meal in this image and provide a comprehensive nutritional assessment.
            
            User context:
            - Fitness goal: {fitness_goal}
            - Dietary restrictions: {dietary_restrictions if dietary_restrictions else 'None specified'}
            {f"- User's current food recommendations: {user_food_recommendations}" if user_food_recommendations else ""}
            
            Please provide:
            1. Food identification (what foods/dishes you can see)
            2. Estimated portion sizes
            3. Nutritional breakdown (calories, macronutrients, vitamins, minerals)
            4. Health assessment for the user's fitness goal
            5. Recommendations based on their food plan (should they eat it, portion adjustments, alternatives)
            6. Timing suggestions (best time to eat this food)
            
            Format as JSON:
            {{
                "identified_foods": ["food1", "food2"],
                "portion_estimate": "estimated portion description",
                "nutrition": {{
                    "calories": estimated_calories,
                    "protein": protein_grams,
                    "carbohydrates": carb_grams,
                    "fat": fat_grams,
                    "fiber": fiber_grams,
                    "sugar": sugar_grams,
                    "sodium": sodium_mg
                }},
                "health_assessment": {{
                    "overall_rating": "excellent/good/moderate/poor",
                    "fitness_goal_alignment": "how_well_it_aligns_with_goal",
                    "nutritional_quality": "assessment_of_nutritional_value",
                    "food_plan_compatibility": "how_well_it_fits_users_food_recommendations"
                }},
                "recommendations": {{
                    "should_eat": true_or_false,
                    "portion_advice": "portion_recommendation",
                    "alternatives": ["healthier_alternative1", "healthier_alternative2"],
                    "timing": "best_time_to_consume",
                    "modifications": "suggested_modifications"
                }},
                "detailed_analysis": "comprehensive_explanation",
                "confidence": "confidence_level_in_identification"
            }}
            
            Be specific about the foods you can identify and honest about uncertainty.
            """
        
        else:  # analysis_type == 'ingredient'
            prompt = f"""
            Analyze the ingredient(s) in this image and suggest healthy recipes that can be made using them.
            
            IMPORTANT: Even if you see multiple ingredients, analyze them collectively and provide recipes that use one or more of them.
            
            User context:
            - Fitness goal: {fitness_goal}
            - Dietary restrictions: {dietary_restrictions if dietary_restrictions else 'None specified'}
            {f"- User's current food recommendations: {user_food_recommendations}" if user_food_recommendations else ""}
            
            Please provide:
            1. Ingredient identification (list all ingredients you can see)
            2. At least 3 healthy recipe suggestions using these ingredients (recipes can use one or multiple ingredients)
            3. Nutritional benefits of the ingredients
            4. How recipes align with user's fitness goals and food plan
            
            CRITICAL: Return ONLY valid JSON. Do not include any text before or after the JSON.
            
            Format as JSON:
            {{
                "identified_ingredients": ["ingredient1", "ingredient2", "ingredient3"],
                "ingredient_benefits": {{
                    "nutritional_value": "key nutritional benefits of the identified ingredients",
                    "health_properties": "health benefits and properties",
                    "fitness_relevance": "how these ingredients support the user's fitness goals"
                }},
                "recipes": [
                    {{
                        "name": "Recipe Name 1",
                        "description": "Brief description of the recipe",
                        "ingredients": ["main_ingredient_from_image", "additional ingredient 1", "additional ingredient 2"],
                        "instructions": "Clear step-by-step cooking instructions",
                        "nutrition_per_serving": {{
                            "calories": 250,
                            "protein": 15,
                            "carbohydrates": 30,
                            "fat": 8
                        }},
                        "prep_time": "20 minutes",
                        "difficulty": "easy",
                        "fitness_benefits": "Why this recipe supports the user's fitness goal"
                    }},
                    {{
                        "name": "Recipe Name 2",
                        "description": "Brief description of the second recipe",
                        "ingredients": ["ingredient_from_image", "complementary ingredient 1", "complementary ingredient 2"],
                        "instructions": "Clear step-by-step cooking instructions",
                        "nutrition_per_serving": {{
                            "calories": 300,
                            "protein": 20,
                            "carbohydrates": 25,
                            "fat": 12
                        }},
                        "prep_time": "30 minutes",
                        "difficulty": "medium",
                        "fitness_benefits": "Why this recipe supports the user's fitness goal"
                    }},
                    {{
                        "name": "Recipe Name 3",
                        "description": "Brief description of the third recipe",
                        "ingredients": ["primary_ingredient", "supporting ingredient 1", "supporting ingredient 2"],
                        "instructions": "Clear step-by-step cooking instructions",
                        "nutrition_per_serving": {{
                            "calories": 200,
                            "protein": 12,
                            "carbohydrates": 20,
                            "fat": 6
                        }},
                        "prep_time": "15 minutes",
                        "difficulty": "easy",
                        "fitness_benefits": "Why this recipe supports the user's fitness goal"
                    }}
                ],
                "usage_tips": "Practical tips for using these ingredients effectively",
                "storage_advice": "How to properly store these ingredients",
                "confidence": "High/Medium/Low - your confidence level in ingredient identification"
            }}
            
            Ensure all recipe objects have all required fields. Use realistic nutritional values.
            """
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert nutritionist and food scientist with extensive knowledge of food identification, nutritional analysis, and dietary recommendations. IMPORTANT: Always return valid JSON only. Do not include any text before or after the JSON. Ensure all JSON is properly formatted with correct quotes and no trailing commas."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_data}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1500,
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        response_text = response.choices[0].message.content
        logging.info(f"AI Response for {analysis_type} analysis: ```json\n{response_text[:500]}...")
        
        # Try to extract JSON from the response
        import re
        
        # Remove markdown code blocks if present
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)
        
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                json_str = json_match.group()
                # Try to fix common JSON issues
                json_str = json_str.replace('\n', ' ')
                json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
                json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
                
                food_analysis = json.loads(json_str)
                
                # Validate and fix common issues with the response
                if analysis_type == 'ingredient':
                    # Ensure recipes is an array
                    if 'recipes' not in food_analysis:
                        food_analysis['recipes'] = []
                    elif not isinstance(food_analysis['recipes'], list):
                        food_analysis['recipes'] = []
                    
                    # Ensure identified_ingredients is an array
                    if 'identified_ingredients' not in food_analysis:
                        food_analysis['identified_ingredients'] = ["Unknown ingredient"]
                    elif not isinstance(food_analysis['identified_ingredients'], list):
                        food_analysis['identified_ingredients'] = [str(food_analysis['identified_ingredients'])]
                    
                    # Validate each recipe has required fields
                    valid_recipes = []
                    for recipe in food_analysis.get('recipes', []):
                        if isinstance(recipe, dict):
                            # Ensure required fields exist
                            recipe.setdefault('name', 'Unnamed Recipe')
                            recipe.setdefault('description', 'No description provided')
                            recipe.setdefault('ingredients', [])
                            recipe.setdefault('instructions', 'No instructions provided')
                            recipe.setdefault('prep_time', 'Unknown')
                            recipe.setdefault('difficulty', 'medium')
                            recipe.setdefault('fitness_benefits', 'Supports healthy eating')
                            
                            # Ensure nutrition is an object
                            if 'nutrition_per_serving' not in recipe or not isinstance(recipe['nutrition_per_serving'], dict):
                                recipe['nutrition_per_serving'] = {
                                    'calories': 'N/A',
                                    'protein': 'N/A',
                                    'carbohydrates': 'N/A',
                                    'fat': 'N/A'
                                }
                            
                            valid_recipes.append(recipe)
                    
                    food_analysis['recipes'] = valid_recipes
                
                elif analysis_type == 'food':
                    # Ensure identified_foods is an array
                    if 'identified_foods' not in food_analysis:
                        food_analysis['identified_foods'] = ["Unknown food"]
                    elif not isinstance(food_analysis['identified_foods'], list):
                        food_analysis['identified_foods'] = [str(food_analysis['identified_foods'])]
                
                # Ensure confidence field exists
                food_analysis.setdefault('confidence', 'Medium')
                
                return food_analysis
                
            except json.JSONDecodeError as e:
                logging.error(f"JSON parsing error: {e}")
                logging.error(f"Problematic JSON: {json_match.group()[:200]}...")
        
        # Fallback if JSON parsing fails
        if analysis_type == 'ingredient':
            return {
                "identified_ingredients": ["Unable to identify ingredients"],
                "recipes": [],
                "ingredient_benefits": {
                    "nutritional_value": "Analysis failed",
                    "health_properties": "Unable to determine",
                    "fitness_relevance": "Unknown"
                },
                "usage_tips": "Please try with a clearer image",
                "storage_advice": "Standard storage recommendations apply",
                "confidence": "Low - JSON parsing failed",
                "raw_response": response_text
            }
        else:
            return {
                "identified_foods": ["Unable to identify specific foods"],
                "nutrition": {"calories": "Unknown", "note": "Could not analyze nutrition"},
                "analysis": response_text,
                "confidence": "Low - JSON parsing failed"
            }
        
    except Exception as e:
        logging.error(f"Error identifying food from image: {e}")
        return {
            "error": str(e),
            "identified_foods": ["Error in food identification"],
            "recommendations": {
                "should_eat": None,
                "message": "Unable to analyze food due to technical error"
            }
        }

def get_fallback_food_recommendations(fitness_goal, target_calories):
    """Provide fallback food recommendations when AI generation fails"""
    
    base_recommendations = {
        "daily_calories": int(target_calories),
        "goal": fitness_goal,
        "meal_plan": {
            "breakfast": {
                "meal": "Greek yogurt with berries and granola",
                "calories": 350,
                "protein": 20,
                "carbs": 45,
                "fat": 8
            },
            "lunch": {
                "meal": "Grilled chicken salad with mixed vegetables",
                "calories": 450,
                "protein": 35,
                "carbs": 25,
                "fat": 18
            },
            "dinner": {
                "meal": "Baked salmon with quinoa and steamed broccoli",
                "calories": 500,
                "protein": 40,
                "carbs": 35,
                "fat": 20
            },
            "snack1": {
                "meal": "Apple with almond butter",
                "calories": 200,
                "protein": 6,
                "carbs": 25,
                "fat": 12
            },
            "snack2": {
                "meal": "Protein smoothie",
                "calories": 250,
                "protein": 25,
                "carbs": 20,
                "fat": 8
            }
        },
        "hydration": "Aim for 8-10 glasses of water daily",
        "notes": "Fallback meal plan - consult with a nutritionist for personalized advice"
    }
    
    # Adjust for specific goals
    if fitness_goal == 'weight_loss':
        base_recommendations["notes"] += ". Focus on portion control and high-fiber foods."
    elif fitness_goal == 'muscle_gain':
        base_recommendations["notes"] += ". Increase protein intake and post-workout nutrition."
    
    return base_recommendations