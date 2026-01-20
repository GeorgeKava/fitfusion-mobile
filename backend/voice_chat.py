from flask import Blueprint, request, jsonify, current_app
import os
import tempfile
import uuid
import time
import json
from vector_store import vector_store
import logging
import requests
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient  # Missing import
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import ResourceNotFoundError  # Missing import
from azure.ai.documentintelligence import DocumentIntelligenceClient
import openai
from mcp_client import get_fitness_recommendation_with_rag_sync
from dotenv import load_dotenv
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Azure OpenAI Real-Time API Configuration
WEBRTC_URL = os.environ.get("WEBRTC_URL")
SESSIONS_URL = os.environ.get("SESSIONS_URL")
API_KEY = os.environ.get("API_KEY")
DEPLOYMENT = os.environ.get("DEPLOYMENT")
VOICE = os.environ.get("VOICE")
TRANSCRIPTION_MODEL = os.environ.get("AZURE_TRANSCRIPTION_MODEL")
API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION")

# Azure Search Configuration - Define all missing variables
AZURE_SEARCH_ENDPOINT = os.environ.get("AZURE_SEARCH_ENDPOINT")
AZURE_SEARCH_ADMIN_KEY = os.environ.get("AZURE_SEARCH_ADMIN_KEY")
AZURE_SEARCH_INDEX_NAME = os.environ.get("AZURE_SEARCH_INDEX_NAME", "fitness-index")
USER_DATA_INDEX = os.environ.get("AZURE_SEARCH_USER_DATA_INDEX", "user_data")

# Session Configuration (similar to the working version)
SESSION_CONFIGURATION = {
    "instructions": os.getenv("VOICE_CHAT_BASE_INSTRUCTIONS", """
        You are a helpful and knowledgeable fitness assistant. Your goal is to help users with their fitness journey, 
        including workout recommendations, nutrition advice, and motivation.
        
        When users greet you, respond warmly and ask how you can help with their fitness goals.
        Provide clear, actionable advice and always prioritize user safety.
        
        If you need specific information about the user's fitness data or preferences, you can use the available tools.
    """),
    "transcription_model": TRANSCRIPTION_MODEL,
    "turn_detection": {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 350,
        "create_response": True
    },
    "tools": [
        {
            "type": "function",
            "name": "get_fitness_recommendation",
            "description": "Get personalized fitness recommendations based on user preferences and goals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The user's fitness question or goal"
                    }
                },
                "required": ["query"]
            }
        }
    ],
    "tool_choice": "auto"
}

# Log configuration for debugging
logger.info("Voice Chat Configuration:")
logger.info(f"WEBRTC_URL: {WEBRTC_URL}")
logger.info(f"SESSIONS_URL: {SESSIONS_URL}")
logger.info(f"API_KEY: {'Set' if API_KEY else 'Not set'}")
logger.info(f"DEPLOYMENT: {DEPLOYMENT}")
logger.info(f"VOICE: {VOICE}")
logger.info(f"TRANSCRIPTION_MODEL: {TRANSCRIPTION_MODEL}")
logger.info(f"API_VERSION: {API_VERSION}")
logger.info(f"AZURE_SEARCH_ENDPOINT: {AZURE_SEARCH_ENDPOINT}")
logger.info(f"USER_DATA_INDEX: {USER_DATA_INDEX}")

# Create a blueprint for the voice chat routes
voice_chat_bp = Blueprint('voice_chat', __name__)

# Global variable to store current user email for function calls
current_user_email = None

# Define the session configuration
SESSION_CONFIGURATION = {
    "instructions": """
        You are a friendly and helpful voice assistant specializing in fitness advice.
        
        When a user starts a conversation, you should:
        1. First try to get their profile information using the get_user_profile function
        2. If profile exists, greet them by name and reference their fitness goals
        3. If no profile exists, ask them to tell you about their fitness goals and current level
        
        Always be conversational, motivational and encouraging.
        Keep responses concise and focused for voice interaction.
        
        You have access to these functions:
        - get_user_profile: Get user's fitness profile and goals
        - get_existing_recommendations: Retrieve user's saved fitness recommendations (latest/most recent)
        - get_fitness_recommendations: Generate NEW personalized workout recommendations  
        - get_food_recommendations: Generate personalized meal plans and nutrition advice
        - get_existing_food_recommendations: Retrieve user's saved food recommendations and meal plans
        - get_progress_data: Get user's workout history and progress
        - get_todays_plan: Get today's workout plan from weekly schedule
        - generate_weekly_plan: Create a new weekly fitness plan
        
        IMPORTANT: When users ask about their fitness recommendations:
        - Use get_existing_recommendations to show their saved recommendations 
        - Only use get_fitness_recommendations to generate completely NEW recommendations
        - Always prioritize showing their latest/most recent data when they have multiple items
        
        For nutrition and food questions:
        - Use get_existing_food_recommendations to show their saved meal plans first
        - Use get_food_recommendations for generating NEW meal planning and nutritional advice
        - Consider user's fitness goals when providing food recommendations
    """,
    "transcription_model": "whisper-1",
    "input_audio_transcription": {
        "model": "whisper-1"
    },
    "turn_detection": {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 350,
        "create_response": True
    },
    "tools": [
        {
            "type": "function",
            "name": "get_user_profile",
            "description": "Get the user's fitness profile information including goals, fitness level, and preferences",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "type": "function",
            "name": "get_existing_recommendations",
            "description": "Retrieve the user's existing saved fitness recommendations (shows the latest/most recent ones)",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "type": "function", 
            "name": "get_fitness_recommendations",
            "description": "Generate NEW personalized fitness recommendations based on user's profile and specific request",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The user's specific fitness question or request"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "type": "function",
            "name": "get_progress_data",
            "description": "Get the user's recent workout history and progress data",
            "parameters": {
                "type": "object",
                "properties": {
                    "timeframe": {
                        "type": "string", 
                        "description": "Time period for progress data (week, month, all)",
                        "default": "week"
                    }
                },
                "required": []
            }
        },
        {
            "type": "function",
            "name": "get_todays_plan",
            "description": "Get the user's fitness plan for today or this week, including scheduled workouts and recommendations",
            "parameters": {
                "type": "object",
                "properties": {
                    "day": {
                        "type": "string",
                        "description": "Specific day to get plan for (today, tomorrow, or day name like 'monday')",
                        "default": "today"
                    }
                },
                "required": []
            }
        },
        {
            "type": "function",
            "name": "get_food_recommendations",
            "description": "Generate personalized meal plans and nutrition recommendations based on user's fitness goals",
            "parameters": {
                "type": "object",
                "properties": {
                    "fitness_goal": {
                        "type": "string",
                        "description": "User's fitness goal (weight_loss, muscle_gain, maintenance)",
                        "default": "maintenance"
                    },
                    "dietary_restrictions": {
                        "type": "string",
                        "description": "Any dietary restrictions or allergies",
                        "default": ""
                    },
                    "meal_preferences": {
                        "type": "string", 
                        "description": "Meal preferences like vegetarian, vegan, keto, etc.",
                        "default": ""
                    }
                },
                "required": []
            }
        },
        {
            "type": "function",
            "name": "get_existing_food_recommendations",
            "description": "Get user's existing saved food recommendations and meal plans",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "type": "function",
            "name": "generate_weekly_plan",
            "description": "Generate a new weekly fitness plan for the user based on their existing recommendations and profile",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    ],
    "tool_choice": "auto"
}

# Azure Search client setup with proper error handling
search_credential = AzureKeyCredential(AZURE_SEARCH_ADMIN_KEY) if AZURE_SEARCH_ADMIN_KEY else None

# Initialize Azure Search client for fitness data (existing fitness-index)
fitness_search_client = SearchClient(
    endpoint=AZURE_SEARCH_ENDPOINT,
    index_name=AZURE_SEARCH_INDEX_NAME,
    credential=search_credential
) if AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_ADMIN_KEY else None

# Initialize Azure Search client for user data (separate user_data index)
user_data_search_client = SearchClient(
    endpoint=AZURE_SEARCH_ENDPOINT,
    index_name=USER_DATA_INDEX,
    credential=search_credential
) if AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_ADMIN_KEY else None

# Initialize Azure Search Index client for creating indexes
index_client = SearchIndexClient(
    endpoint=AZURE_SEARCH_ENDPOINT,
    credential=search_credential
) if AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_ADMIN_KEY else None

# Optional - Use Azure OpenAI for voice transcription if available
use_azure_openai = os.environ.get("USE_AZURE_OPENAI", "false").lower() == "true"
if use_azure_openai:
    openai.api_type = "azure"
    openai.api_base = os.environ.get("AZURE_OPENAI_ENDPOINT")
    openai.api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2023-05-15")
    openai.api_key = os.environ.get("AZURE_OPENAI_API_KEY")

# Health check endpoint
@voice_chat_bp.route('/health-check', methods=['GET'])
def health_check():
    """Check if the voice chat service is available"""
    missing_configs = []
    
    # Check for critical configuration variables
    if not API_KEY:
        missing_configs.append("API_KEY")
    if not DEPLOYMENT:
        missing_configs.append("DEPLOYMENT")
    if not WEBRTC_URL:
        missing_configs.append("WEBRTC_URL")
    if not SESSIONS_URL:
        missing_configs.append("SESSIONS_URL")
    if not AZURE_SEARCH_ENDPOINT:
        missing_configs.append("AZURE_SEARCH_ENDPOINT")
    if not AZURE_SEARCH_ADMIN_KEY:
        missing_configs.append("AZURE_SEARCH_ADMIN_KEY")
    
    if missing_configs:
        return jsonify({
            "status": "error", 
            "message": f"Configuration missing: {', '.join(missing_configs)}",
            "config_status": {
                "api_key": bool(API_KEY),
                "deployment": bool(DEPLOYMENT),
                "webrtc_url": bool(WEBRTC_URL),
                "sessions_url": bool(SESSIONS_URL),
                "azure_search_endpoint": bool(AZURE_SEARCH_ENDPOINT),
                "azure_search_key": bool(AZURE_SEARCH_ADMIN_KEY),
                "voice": bool(VOICE)
            }
        }), 500
    
    return jsonify({
        "status": "ok", 
        "service": "voice-chat",
        "config_status": {
            "api_key": True,
            "deployment": DEPLOYMENT,
            "webrtc_url": bool(WEBRTC_URL),
            "sessions_url": bool(SESSIONS_URL),
            "azure_search_endpoint": bool(AZURE_SEARCH_ENDPOINT),
            "azure_search_key": True,
            "voice": VOICE,
            "user_data_index": USER_DATA_INDEX
        }
    }), 200

# Get session configuration endpoint
@voice_chat_bp.route('/get-session-configuration', methods=['GET'])
def get_session_configuration():
    """Serve the session configuration for the voice chat"""
    return jsonify(SESSION_CONFIGURATION)

# Helper functions for Azure Search operations
def store_user_data_in_azure_search(user_email, user_profile, progress_data, recommendations):
    """Store user data in Azure Search user_data index"""
    try:
        if not user_data_search_client:
            logger.warning("Azure Search client not configured")
            return False
        
        # Ensure the index exists
        if not create_user_data_index():
            logger.error("Failed to create or access user_data index")
            return False
        
        documents = []
        timestamp = datetime.utcnow().isoformat() + "Z"  # Azure Search requires timezone offset
        
        # Store user profile
        if user_profile:
            profile_doc = {
                "id": f"profile_{user_email.replace('@', '_at_').replace('.', '_dot_')}",
                "user_email": user_email,
                "data_type": "profile",
                "content": json.dumps(user_profile),
                "created_at": timestamp,
                "updated_at": timestamp,
                "name": user_profile.get("name", ""),
                "age": int(user_profile.get("age", 0)) if user_profile.get("age") else None,
                "weight": float(user_profile.get("weight", 0)) if user_profile.get("weight") else None,
                "height": float(user_profile.get("height", 0)) if user_profile.get("height") else None,
                "gender": user_profile.get("gender", ""),
                "fitness_level": user_profile.get("fitnessLevel", ""),
                "agent_type": user_profile.get("agentType", "personal_trainer"),
                "medical_conditions": user_profile.get("medicalConditions", []) if isinstance(user_profile.get("medicalConditions"), list) else [],
                "is_active": True
            }
            documents.append(profile_doc)
        
        # Store progress data
        if progress_data:
            progress_doc = {
                "id": f"progress_{user_email.replace('@', '_at_').replace('.', '_dot_')}_{int(time.time())}",
                "user_email": user_email,
                "data_type": "progress",
                "content": json.dumps(progress_data),
                "created_at": timestamp,
                "updated_at": timestamp,
                "is_active": True
            }
            documents.append(progress_doc)
        
        # Store recommendations
        if recommendations:
            for i, recommendation in enumerate(recommendations[-5:]):  # Store last 5 recommendations
                rec_doc = {
                    "id": f"recommendation_{user_email.replace('@', '_at_').replace('.', '_dot_')}_{int(time.time())}_{i}",
                    "user_email": user_email,
                    "data_type": "recommendation",
                    "content": json.dumps(recommendation),
                    "created_at": timestamp,
                    "updated_at": timestamp,
                    "is_active": True
                }
                documents.append(rec_doc)
        
        # Upload documents to Azure Search
        if documents:
            result = user_data_search_client.upload_documents(documents)
            success_count = sum(1 for r in result if r.succeeded)
            logger.info(f"Successfully stored {success_count}/{len(documents)} documents for {user_email}")
            return success_count > 0
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing user data in Azure Search: {e}")
        return False

def store_food_recommendations_in_azure_search(user_email, recommendations_data):
    """Store food recommendations in Azure Search"""
    try:
        if not user_data_search_client:
            logger.warning("Azure Search client not configured")
            return False
            
        # Encode email for safe use in document ID (replace @ and . with underscores)
        safe_email = user_email.replace("@", "_at_").replace(".", "_dot_")
        
        # Create document for food recommendations
        document = {
            "id": f"{safe_email}_food_recommendations_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "user_email": user_email,
            "data_type": "food_recommendations",
            "content": json.dumps(recommendations_data),
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        
        # Upload to Azure Search
        result = user_data_search_client.upload_documents([document])
        if result and len(result) > 0 and result[0].succeeded:
            logger.info(f"Successfully stored food recommendations for {user_email}")
            return True
        else:
            logger.error(f"Failed to store food recommendations for {user_email}")
            return False
            
    except Exception as e:
        logger.error(f"Error storing food recommendations in Azure Search: {e}")
        return False

def get_user_data_from_azure_search(user_email):
    """Retrieve user data from Azure Search user_data index, sorted by latest first"""
    try:
        if not user_data_search_client:
            logger.warning("Azure Search client not configured")
            return {}
        
        # Search for all user data, ordered by created_at descending (latest first)
        search_results = user_data_search_client.search(
            search_text="*",
            filter=f"user_email eq '{user_email}'",
            select="*",
            order_by=["created_at desc"]
        )
        
        user_data = {
            "profile": {},
            "progress": [],
            "recommendations": [],
            "weekly_plan": {},
            "food_recommendations": []
        }
        
        # Track latest timestamps for each data type to ensure we get the most recent
        latest_timestamps = {
            "profile": None,
            "weekly_plan": None
        }
        
        for result in search_results:
            data_type = result.get("data_type", "")
            content = json.loads(result.get("content", "{}"))
            created_at = result.get("created_at")
            
            if data_type == "profile":
                # Only use the latest profile (first one due to ordering)
                if latest_timestamps["profile"] is None:
                    user_data["profile"] = content
                    latest_timestamps["profile"] = created_at
            elif data_type == "progress":
                # Add all progress data, they're already sorted by latest first
                user_data["progress"].append(content)
            elif data_type == "recommendation":
                # Add all recommendations, they're already sorted by latest first
                user_data["recommendations"].append(content)
            elif data_type == "weekly_plan":
                # Only use the latest weekly plan (first one due to ordering)
                if latest_timestamps["weekly_plan"] is None:
                    user_data["weekly_plan"] = content
                    latest_timestamps["weekly_plan"] = created_at
            elif data_type == "food_recommendations":
                # Add all food recommendations, they're already sorted by latest first
                user_data["food_recommendations"].append(content)
        
        logger.info(f"🔍 Retrieved user data for {user_email}: {len(user_data['recommendations'])} fitness recommendations, {len(user_data['progress'])} progress entries, {len(user_data['food_recommendations'])} food recommendations")
        
        return user_data
        
    except Exception as e:
        logger.error(f"Error retrieving user data from Azure Search: {e}")
        return {}

def get_user_profile_from_storage(user_email):
    """Get user profile from Azure Search or return empty dict"""
    try:
        user_data = get_user_data_from_azure_search(user_email)
        return user_data.get("profile", {})
    except Exception as e:
        logger.error(f"Error getting user profile from storage: {e}")
        return {}

def get_latest_recommendation_from_storage(user_email):
    """Get the latest/most recent recommendation from Azure Search"""
    try:
        user_data = get_user_data_from_azure_search(user_email)
        recommendations = user_data.get("recommendations", [])
        
        # Since get_user_data_from_azure_search now sorts by latest first,
        # the first recommendation is the most recent
        if recommendations:
            logger.info(f"📋 Found {len(recommendations)} recommendations, returning the latest one")
            return recommendations[0]  # Most recent
        return {}
    except Exception as e:
        logger.error(f"Error getting latest recommendation from storage: {e}")
        return {}

def get_latest_weekly_plan_from_storage(user_email):
    """Get the latest/most recent weekly plan from Azure Search"""
    try:
        user_data = get_user_data_from_azure_search(user_email)
        weekly_plan = user_data.get("weekly_plan", {})
        
        # Since get_user_data_from_azure_search now uses order_by created_at desc,
        # we get the latest weekly_plan automatically
        if weekly_plan:
            logger.info(f"🗓️ Found latest weekly plan for user: {user_email}")
            return weekly_plan
        
        # If no weekly plan exists, try to get it from latest recommendation
        logger.info("🗓️ No weekly_plan found, checking latest recommendation")
        latest_recommendation = get_latest_recommendation_from_storage(user_email)
        if latest_recommendation and isinstance(latest_recommendation, dict):
            weekly_plan = latest_recommendation.get("weekly_plan", {})
            if weekly_plan:
                logger.info(f"🗓️ Weekly plan found in latest recommendation")
                return weekly_plan
        
        logger.info(f"🗓️ No weekly plan found for user: {user_email}")
        return {}
    except Exception as e:
        logger.error(f"🗓️ Error getting latest weekly plan from storage: {e}")
        return {}

def get_progress_data_from_storage(user_email, timeframe="week"):
    """Get progress data from Azure Search or return empty dict"""
    try:
        user_data = get_user_data_from_azure_search(user_email)
        progress_list = user_data.get("progress", [])
        
        # Since progress data is now sorted by latest first, 
        # return the most recent progress data
        if progress_list:
            return progress_list[0]  # Most recent
        return {}
    except Exception as e:
        logger.error(f"Error getting progress data from storage: {e}")
        return {}

def get_weekly_plan_from_storage(user_email):
    """Get weekly fitness plan from Azure Search or return empty dict"""
    try:
        logger.info(f"🗓️ Looking for weekly plan for user: {user_email}")
        
        # Use the new function that gets the latest weekly plan
        weekly_plan = get_latest_weekly_plan_from_storage(user_email)
        
        logger.info(f"🗓️ Final weekly plan to return: {weekly_plan}")
        return weekly_plan
    except Exception as e:
        logger.error(f"🗓️ Error getting weekly plan from storage: {e}")
        return {}

def generate_weekly_plan_for_user(user_email, user_profile, agent_type):
    """Generate a weekly plan using the main AI system"""
    try:
        from ai import generate_weekly_fitness_plan
        
        logger.info(f"🏋️ Generating weekly plan for {user_email} with agent_type: {agent_type}")
        
        # Use the existing function from ai.py that generates weekly plans
        # It expects a user profile and base recommendation
        base_recommendation = f"Create a weekly fitness plan for {agent_type} goals"
        
        # Generate weekly plan using the main AI system
        weekly_plan = generate_weekly_fitness_plan(user_profile, base_recommendation)
        
        logger.info(f"🏋️ Generated weekly plan: {weekly_plan}")
        return weekly_plan
        
    except Exception as e:
        logger.error(f"🏋️ Error generating weekly plan: {e}")
        # Fallback to a simple weekly plan from ai.py
        try:
            from ai import get_fallback_weekly_plan
            fallback_plan = get_fallback_weekly_plan(agent_type)
            logger.info(f"🏋️ Using fallback weekly plan: {fallback_plan}")
            return fallback_plan
        except Exception as fallback_error:
            logger.error(f"🏋️ Error with fallback plan: {fallback_error}")
            return {}

def store_weekly_plan_in_azure_search(user_email, weekly_plan):
    """Store weekly plan in Azure Search user_data index"""
    try:
        if not user_data_search_client:
            logger.warning("Azure Search client not configured")
            return False
            
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        # Create weekly plan document
        plan_doc = {
            "id": f"weekly_plan_{user_email.replace('@', '_at_').replace('.', '_dot_')}",
            "user_email": user_email,
            "data_type": "weekly_plan",
            "content": json.dumps(weekly_plan),
            "created_at": timestamp,
            "updated_at": timestamp,
            "is_active": True
        }
        
        # Upload to Azure Search
        result = user_data_search_client.upload_documents([plan_doc])
        logger.info(f"🗓️ Stored weekly plan for {user_email}: {result}")
        return True
        
    except Exception as e:
        logger.error(f"🗓️ Error storing weekly plan: {e}")
        return False

# Start session endpoint
@voice_chat_bp.route('/start-session', methods=['POST'])
def start_session():
    """
    Start a new session with Azure OpenAI Real-Time API
    Returns the session ID and ephemeral client secret
    """
    data = request.json
    user_email = data.get('user_email')
    agent_type = data.get('agent_type', 'general')
    
    # Debug logging
    logger.info(f"🎤 START SESSION REQUEST - User Email: {user_email}")
    logger.info(f"🎤 Request Data Keys: {list(data.keys()) if data else 'No data'}")
    logger.info(f"🎤 Full Request Data: {data}")
    
    # Get localStorage data passed from frontend
    user_profile_from_frontend = data.get('user_profile', {})
    progress_data_from_frontend = data.get('progress_data', {})
    recommendations_from_frontend = data.get('recommendations', [])
    
    if not user_email:
        logger.error("🎤 No user email provided in request")
        return jsonify({"error": "No user email provided"}), 400
    
    # Store the user email in session for function calls to use
    global current_user_email
    current_user_email = user_email
    
    # Store the localStorage data in Azure Search for persistence
    if user_profile_from_frontend or progress_data_from_frontend or recommendations_from_frontend:
        store_success = store_user_data_in_azure_search(
            user_email,
            user_profile_from_frontend,
            progress_data_from_frontend,
            recommendations_from_frontend
        )
        if store_success:
            logger.info(f"Successfully stored user data for {user_email} in Azure Search")
    
    # Create agent-specific instructions
    agent_prefix = ""
    if agent_type == "personal_trainer":
        agent_prefix = os.getenv("VOICE_CHAT_PERSONAL_TRAINER_PREFIX", "You are a certified personal trainer with broad expertise in general fitness and wellness. ")
    elif agent_type == "strength_coach":
        agent_prefix = os.getenv("VOICE_CHAT_STRENGTH_COACH_PREFIX", "You are a professional strength coach with expertise in strength training and muscle development. ")
    elif agent_type == "cardio_specialist":
        agent_prefix = "You are a cardio specialist with deep knowledge of endurance training and cardiovascular health. "
    elif agent_type == "nutrition_expert":
        agent_prefix = "You are a certified nutrition expert with expertise in diet planning and nutritional guidance for fitness goals. "
    elif agent_type == "weight_loss_coach":
        agent_prefix = "You are a specialized weight loss coach with expertise in fat loss strategies and metabolic optimization. "
    elif agent_type == "muscle_building_coach":
        agent_prefix = "You are a muscle building coach specializing in hypertrophy training and muscle development programs. "
    else:
        agent_prefix = "You are a general fitness coach with broad knowledge across exercise types. "
    
    # Create custom instructions that encourage the assistant to get user data
    custom_instructions = agent_prefix + SESSION_CONFIGURATION["instructions"] + f"""
    
    IMPORTANT: The user's email is {user_email}. When the conversation starts, immediately try to get their profile using the get_user_profile function to personalize your responses.
    
    If you successfully retrieve their profile, greet them by name and reference their specific fitness goals.
    If no profile is found, politely ask them about their fitness goals and current fitness level.
    """
    
    # Create payload - don't include user data directly, let functions handle it
    payload = {
        "model": DEPLOYMENT,
        "voice": VOICE,
        "instructions": custom_instructions,
        "turn_detection": SESSION_CONFIGURATION["turn_detection"],
        "tools": SESSION_CONFIGURATION["tools"],
        "tool_choice": "auto"
    }
    
    # Ensure proper headers are set
    headers = {
        "api-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        # Log request details for debugging (excluding sensitive data)
        logger.info(f"Making request to Sessions URL: {SESSIONS_URL}")
        logger.info(f"Using model: {DEPLOYMENT}")
        logger.info(f"Using voice: {VOICE}")
        
        # Make the API request
        resp = requests.post(SESSIONS_URL, json=payload, headers=headers)
        
        # Handle response
        if resp.status_code != 200:
            error_message = f"Error from Azure OpenAI: {resp.text}"
            logger.error(error_message)
            return jsonify({"error": error_message}), resp.status_code
        
        # Extract and return session data
        response_data = resp.json()
        
        # Check if we have the expected fields
        session_id = response_data.get("session_id") or response_data.get("id")
        ephemeral_key_obj = response_data.get("ephemeral_key") or response_data.get("client_secret") or response_data.get("ephemeral_client_secret")
        
        # Extract the actual key value if it's an object
        ephemeral_key = ephemeral_key_obj
        if isinstance(ephemeral_key_obj, dict) and 'value' in ephemeral_key_obj:
            ephemeral_key = ephemeral_key_obj['value']
        
        logger.info(f"Session created successfully: {session_id}")
        
        return jsonify({
            "session_id": session_id,
            "ephemeral_key": ephemeral_key
        })
                
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        return jsonify({"error": f"Error starting session: {str(e)}"}), 500

# WebSocket connection endpoint for Azure OpenAI Real-Time API
@voice_chat_bp.route('/websocket-connect', methods=['POST'])
def websocket_connect():
    """
    Provide WebSocket connection URL for Azure OpenAI Real-Time API
    """
    data = request.json
    ephemeral_key = data.get('ephemeral_key')
    
    if not ephemeral_key:
        return jsonify({"error": "Missing ephemeral_key"}), 400
    
    try:
        # Azure OpenAI Real-Time API uses WebSocket, not WebRTC
        # The correct WebSocket URL format for Azure OpenAI Real-Time API
        # Based on Azure documentation, we connect to the resource endpoint directly
        # Use the same API version as the sessions API for consistency
        # TEMPORARY: Use main API key instead of ephemeral key for testing
        import urllib.parse
        # encoded_key = urllib.parse.quote(ephemeral_key, safe='')
        encoded_key = urllib.parse.quote(API_KEY, safe='')
        websocket_url = f"wss://sash-mafig80z-swedencentral.openai.azure.com/openai/realtime?api-version=2025-04-01-preview&deployment={DEPLOYMENT}&api-key={encoded_key}"
        
        logger.info(f"Generated WebSocket URL for Real-Time API connection")
        
        return jsonify({
            "websocket_url": websocket_url,
            "ephemeral_key": ephemeral_key,
            "model": DEPLOYMENT
        })
                
    except Exception as e:
        logger.error(f"Error generating WebSocket connection: {e}")
        return jsonify({"error": f"Error generating WebSocket connection: {str(e)}"}), 500

# Keep the WebRTC SDP exchange endpoint for fallback
@voice_chat_bp.route('/webrtc-sdp', methods=['POST'])
def webrtc_sdp():
    """
    Handle WebRTC SDP exchange with Azure OpenAI Real-Time API
    """
    data = request.json
    ephemeral_key = data.get('ephemeral_key')
    offer_sdp = data.get('offer_sdp')
    
    if not ephemeral_key or not offer_sdp:
        return jsonify({"error": "Missing ephemeral_key or offer_sdp"}), 400
    
    headers = {
        "Authorization": f"Bearer {ephemeral_key}",
        "Content-Type": "application/sdp"
    }
    
    # Make sure to include the model parameter in the URL
    url = f"{WEBRTC_URL}?model={DEPLOYMENT}"
    
    try:
        # Log the URL and headers (without the actual bearer token) for debugging
        logger.info(f"Making request to WebRTC URL: {url}")
        logger.info(f"Headers: Content-Type: {headers.get('Content-Type')}")
        logger.info(f"SDP Offer length: {len(offer_sdp)} characters")
        logger.info(f"SDP Offer first 200 chars: {offer_sdp[:200]}")
        
        # Send the SDP offer directly as the body content
        resp = requests.post(url, data=offer_sdp, headers=headers)
        
        logger.info(f"WebRTC response status: {resp.status_code}")
        logger.info(f"WebRTC response headers: {dict(resp.headers)}")
        logger.info(f"WebRTC response content type: {resp.headers.get('Content-Type', 'unknown')}")
        
        # Azure OpenAI RTC API returns 201 (Created) for successful SDP exchange
        if resp.status_code not in [200, 201]:
            error_message = f"Error from Azure OpenAI RTC: {resp.text}"
            logger.error(error_message)
            logger.error(f"Full response details - Status: {resp.status_code}, Headers: {dict(resp.headers)}")
            return jsonify({"error": error_message}), resp.status_code
        
        # Return the SDP answer from Azure
        answer_sdp = resp.text
        logger.info(f"SDP Answer length: {len(answer_sdp)} characters")
        logger.info(f"SDP Answer first 200 chars: {answer_sdp[:200]}")
        logger.info(f"SDP Answer looks like valid SDP: {answer_sdp.startswith('v=')}")
        
        return jsonify({"answer_sdp": answer_sdp})
                
    except Exception as e:
        logger.error(f"Error in WebRTC SDP exchange: {e}")
        return jsonify({"error": f"Error in WebRTC SDP exchange: {str(e)}"}), 500

# Test endpoint for Azure Search user data
@voice_chat_bp.route('/test-user-data', methods=['POST'])
def test_user_data():
    """Test endpoint to store and retrieve user data from Azure Search"""
    try:
        data = request.json
        user_email = data.get('user_email', 'test@example.com')
        
        # Test data
        test_profile = {
            "name": "Test User",
            "age": 30,
            "goals": ["Weight Loss"],
            "fitnessLevel": "Beginner"
        }
        
        test_progress = {
            "workoutsCompleted": 5,
            "totalCaloriesBurned": 1200
        }
        
        test_recommendations = [
            {"date": "2025-08-19", "recommendation": "Start with cardio"}
        ]
        
        # Store test data
        store_success = store_user_data_in_azure_search(
            user_email, test_profile, test_progress, test_recommendations
        )
        
        if not store_success:
            return jsonify({"error": "Failed to store data"}), 500
        
        # Retrieve test data
        retrieved_data = get_user_data_from_azure_search(user_email)
        
        return jsonify({
            "message": "Test successful",
            "stored_data": {
                "profile": test_profile,
                "progress": test_progress,
                "recommendations": test_recommendations
            },
            "retrieved_data": retrieved_data
        })
        
    except Exception as e:
        logger.error(f"Error in test endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@voice_chat_bp.route('/functions/get_user_profile', methods=['POST'])
def handle_get_user_profile():
    """Handle get_user_profile function call from the assistant"""
    try:
        global current_user_email
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"👤 Getting user profile for: {current_user_email}")
            
        # Get the user profile from Azure Search
        user_profile = get_user_profile_from_storage(current_user_email)
        
        if not user_profile:
            return jsonify({
                "error": "No profile found",
                "message": f"No fitness profile found for user. Please provide your fitness goals and current fitness level so I can help you better.",
                "profile": None
            })
        
        # Check if user has a weekly plan and recommendations (using latest data)
        weekly_plan = get_weekly_plan_from_storage(current_user_email)
        user_data = get_user_data_from_azure_search(current_user_email)
        recommendations = user_data.get("recommendations", [])
        food_recommendations = user_data.get("food_recommendations", [])
        
        # Build response message based on what data exists
        message_parts = [f"Found profile for {user_profile.get('name', 'user')}"]
        
        if weekly_plan:
            message_parts.append("You have your latest weekly fitness plan ready!")
        elif recommendations:
            message_parts.append(f"You have {len(recommendations)} fitness recommendation(s), with the most recent one available. I can help you access your latest recommendations.")
        else:
            message_parts.append("You'll need to get fitness recommendations first to create a weekly plan.")
            
        if food_recommendations:
            message_parts.append(f"You also have {len(food_recommendations)} food recommendation(s) available, including meal plans and nutrition guidance.")
        
        return jsonify({
            "success": True,
            "message": ". ".join(message_parts),
            "profile": user_profile,
            "has_weekly_plan": bool(weekly_plan),
            "has_recommendations": bool(recommendations),
            "has_food_recommendations": bool(food_recommendations),
            "latest_food_recommendations": food_recommendations[0] if food_recommendations else None,
            "data_summary": {
                "weekly_plan_available": bool(weekly_plan),
                "recommendations_count": len(recommendations) if recommendations else 0,
                "food_recommendations_count": len(food_recommendations) if food_recommendations else 0
            }
        })
    except Exception as e:
        logger.error(f"Error retrieving user profile: {e}")
        return jsonify({
            "error": f"Error retrieving profile: {str(e)}",
            "profile": None
        })

@voice_chat_bp.route('/functions/get_existing_recommendations', methods=['POST'])
def handle_get_existing_recommendations():
    """Handle get_existing_recommendations function call from the assistant to retrieve saved recommendations"""
    try:
        global current_user_email
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"📋 Getting existing recommendations for: {current_user_email}")
        
        # Get latest recommendation from storage
        latest_recommendation = get_latest_recommendation_from_storage(current_user_email)
        
        if not latest_recommendation:
            return jsonify({
                "success": False,
                "message": "You don't have any fitness recommendations yet. Would you like me to generate personalized recommendations for you?",
                "recommendations": {},
                "suggestion": "I can create fitness recommendations based on your profile and goals."
            })
        
        # Get user profile for context
        user_profile = get_user_profile_from_storage(current_user_email)
        user_name = user_profile.get('name', 'you') if user_profile else 'you'
        
        # Check how many total recommendations the user has
        user_data = get_user_data_from_azure_search(current_user_email)
        total_recommendations = len(user_data.get("recommendations", []))
        
        return jsonify({
            "success": True,
            "message": f"Here are your latest fitness recommendations, {user_name}! You have {total_recommendations} recommendation(s) in total, and I'm showing you the most recent one.",
            "recommendations": latest_recommendation,
            "total_count": total_recommendations,
            "is_latest": True,
            "suggestion": "Based on these recommendations, would you like me to help you create a weekly plan or answer any questions about your fitness program?"
        })
        
    except Exception as e:
        logger.error(f"📋 Error retrieving existing recommendations: {e}")
        return jsonify({
            "error": f"Error getting recommendations: {str(e)}",
            "recommendations": {},
            "success": False
        })

@voice_chat_bp.route('/functions/get_fitness_recommendations', methods=['POST'])
def handle_get_fitness_recommendations():
    """Handle get_fitness_recommendations function call from the assistant"""
    try:
        global current_user_email
        print(current_user_email)
        data = request.json
        query = data.get('query', 'general fitness recommendations')
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"💪 Getting fitness recommendations for: {current_user_email}")
        
        # Get user profile to provide personalized recommendations
        user_profile = get_user_profile_from_storage(current_user_email)
        
        if not user_profile:
            # Provide general recommendations if no profile found
            return jsonify({
                "success": True,
                "message": "I'd love to give you personalized recommendations! Could you tell me about your fitness goals, current fitness level, age, and any specific areas you'd like to work on?",
                "recommendations": {
                    "general_advice": "Start with basic bodyweight exercises like push-ups, squats, and planks. Aim for 3-4 workouts per week with rest days in between.",
                    "suggestion": "Create a profile first for personalized recommendations"
                },
                "query": query
            })
        
        # Import the main AI recommendation function
        from ai import get_fitness_recommendation
        
        # Extract user profile data
        gender = user_profile.get('gender', 'unspecified')
        age = user_profile.get('age', 25)
        weight = user_profile.get('weight', 150)
        height = user_profile.get('height')
        agent_type = user_profile.get('agentType', 'personal_trainer')
        health_conditions = user_profile.get('medicalConditions', '')
        
        # Convert medical conditions list to string if needed
        if isinstance(health_conditions, list):
            health_conditions = ', '.join(health_conditions) if health_conditions else ''
        
        # Since this is voice chat without images, create an empty list for image_paths
        # The AI function will provide text-based recommendations
        try:
            # Get comprehensive fitness recommendations using the main AI system
            recommendations = get_fitness_recommendation(
                image_paths=[],  # No images for voice chat
                gender=gender,
                age=age,
                weight=weight,
                height=height,
                agent_type=agent_type,
                health_conditions=health_conditions
            )
            
            # Generate and store weekly plan
            logger.info(f"💪 Generating weekly plan for user: {current_user_email}")
            weekly_plan = generate_weekly_plan_for_user(current_user_email, user_profile, agent_type)
            
            # Store the generated weekly plan in Azure Search
            if weekly_plan:
                store_weekly_plan_in_azure_search(current_user_email, weekly_plan)
                logger.info(f"💪 Successfully stored weekly plan for {current_user_email}")
            
            # The recommendations come as a string, so parse it properly
            if isinstance(recommendations, str):
                # Try to extract structured information from the response
                response_data = {
                    "message": f"Here are personalized recommendations for {user_profile.get('name', 'you')} with a new weekly plan",
                    "recommendations": recommendations,
                    "weekly_plan": weekly_plan,
                    "user_context": {
                        "agent_type": agent_type,
                        "fitness_level": user_profile.get('fitnessLevel', 'unknown'),
                        "gender": gender,
                        "age": age
                    }
                }
            else:
                # If it's already structured data
                response_data = {
                    "message": f"Here are personalized recommendations for {user_profile.get('name', 'you')} with a new weekly plan",
                    "recommendations": recommendations,
                    "weekly_plan": weekly_plan,
                    "user_context": {
                        "agent_type": agent_type,
                        "fitness_level": user_profile.get('fitnessLevel', 'unknown')
                    }
                }
            
            return jsonify({
                "success": True,
                **response_data,
                "query": query
            })
            
        except Exception as ai_error:
            logger.error(f"Error calling main AI recommendation system: {ai_error}")
            
            # Fallback to MCP system
            try:
                response = get_fitness_recommendation_with_rag_sync([], {
                    "email": current_user_email,
                    "query": query,
                    "useRag": True
                })
                
                return jsonify({
                    "success": True,
                    "message": "Generated recommendations using fallback system",
                    "recommendations": response,
                    "query": query
                })
            except Exception as mcp_error:
                logger.error(f"Error with MCP fallback: {mcp_error}")
                raise ai_error  # Re-raise the original error
        
    except Exception as e:
        logger.error(f"Error retrieving fitness recommendations: {e}")
        return jsonify({
            "error": f"Error getting recommendations: {str(e)}",
            "recommendations": []
        })

@voice_chat_bp.route('/functions/get_existing_food_recommendations', methods=['POST'])
def handle_get_existing_food_recommendations():
    """Handle get_existing_food_recommendations function call from the assistant to retrieve saved food recommendations"""
    try:
        global current_user_email
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"🍎 Getting existing food recommendations for: {current_user_email}")
        
        # Get user data including food recommendations
        user_data = get_user_data_from_azure_search(current_user_email)
        food_recommendations = user_data.get("food_recommendations", [])
        
        if not food_recommendations:
            return jsonify({
                "success": False,
                "message": "You don't have any food recommendations yet. Would you like me to generate personalized meal plans for you?",
                "food_recommendations": {},
                "suggestion": "I can create nutrition recommendations based on your fitness goals and dietary preferences."
            })
        
        # Get the latest food recommendations (first in list since they're sorted by latest first)
        latest_food_recs = food_recommendations[0]
        
        # Get user profile for context
        user_profile = get_user_profile_from_storage(current_user_email)
        user_name = user_profile.get('name', 'you') if user_profile else 'you'
        
        return jsonify({
            "success": True,
            "message": f"Here are your latest food recommendations, {user_name}! You have {len(food_recommendations)} food recommendation(s) in total, and I'm showing you the most recent one.",
            "food_recommendations": latest_food_recs,
            "total_count": len(food_recommendations),
            "is_latest": True,
            "suggestion": "I can help you with specific meal questions, food substitutions, or creating shopping lists based on these recommendations."
        })
        
    except Exception as e:
        logger.error(f"🍎 Error retrieving existing food recommendations: {e}")
        return jsonify({
            "error": f"Error getting food recommendations: {str(e)}",
            "food_recommendations": {},
            "success": False
        })
        
@voice_chat_bp.route('/functions/get_progress_data', methods=['POST'])
def handle_get_progress_data():
    """Handle get_progress_data function call from the assistant"""
    try:
        global current_user_email
        data = request.json
        timeframe = data.get('timeframe', 'week')
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"📊 Getting progress data for: {current_user_email}")
            
        # Get progress data from Azure Search
        progress_data = get_progress_data_from_storage(current_user_email, timeframe)
        
        if not progress_data:
            return jsonify({
                "message": "No progress data found yet",
                "progress": {},
                "suggestion": "Start logging your workouts to track progress!"
            })
        
        return jsonify({
            "success": True,
            "message": f"Retrieved {timeframe} progress data",
            "progress": progress_data,
            "timeframe": timeframe
        })
    except Exception as e:
        logger.error(f"Error retrieving progress data: {e}")
        return jsonify({
            "error": f"Error getting progress: {str(e)}",
            "progress": {}
        })

@voice_chat_bp.route('/functions/get_todays_plan', methods=['POST'])
def handle_get_todays_plan():
    """Handle get_todays_plan function call from the assistant"""
    try:
        global current_user_email
        data = request.json
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"🗓️ Getting today's plan for: {current_user_email}")
        
        logger.info(f"🎯 get_todays_plan called with data: {data}")
        logger.info(f"🎯 current_user_email: {current_user_email}")
            
        # Get today's date and day of week
        from datetime import datetime
        today = datetime.now()
        day_of_week = today.strftime('%A').lower()
        today_str = today.strftime('%Y-%m-%d')
        
        logger.info(f"🎯 Today is {day_of_week} ({today_str})")
        
        # Get user's latest weekly plan from Azure Search
        weekly_plan = get_weekly_plan_from_storage(current_user_email)
        
        logger.info(f"🎯 Retrieved latest weekly plan: {weekly_plan}")
        
        if not weekly_plan:
            logger.info("🎯 No weekly plan found, checking if user has recommendations...")
            
            # Check if user has any fitness recommendations to base a plan on
            user_data = get_user_data_from_azure_search(current_user_email)
            recommendations = user_data.get("recommendations", [])
            
            if recommendations:
                # Get user profile to check if we can auto-generate a plan
                user_profile = get_user_profile_from_storage(current_user_email)
                agent_type = user_profile.get('agentType', 'personal_trainer') if user_profile else 'personal_trainer'
                
                # Auto-generate a weekly plan for the user
                logger.info(f"🎯 Auto-generating weekly plan for user with {len(recommendations)} recommendations")
                try:
                    weekly_plan = generate_weekly_plan_for_user(current_user_email, user_profile, agent_type)
                    
                    if weekly_plan:
                        # Store the generated plan
                        store_weekly_plan_in_azure_search(current_user_email, weekly_plan)
                        logger.info(f"🎯 Successfully auto-generated and stored weekly plan")
                        
                        # Get today's workout from the new plan
                        from datetime import datetime
                        today = datetime.now()
                        day_of_week = today.strftime('%A').lower()
                        todays_workout = weekly_plan.get('dailyPlans', {}).get(day_of_week.title(), {})
                        
                        if todays_workout:
                            return jsonify({
                                "success": True,
                                "message": f"I just generated a personalized weekly plan for you! Here's what you should do today ({day_of_week.title()}):",
                                "plan": todays_workout,
                                "full_weekly_plan": weekly_plan,
                                "date": today.strftime('%Y-%m-%d'),
                                "day": day_of_week,
                                "auto_generated": True
                            })
                except Exception as gen_error:
                    logger.error(f"🎯 Error auto-generating weekly plan: {gen_error}")
                
                # Fallback if auto-generation fails
                return jsonify({
                    "message": f"I found your latest fitness recommendations (you have {len(recommendations)} total), but I had trouble generating a weekly plan automatically. You can create one by visiting the 'Weekly Plan' page, and then I'll be able to tell you what to do each day.",
                    "plan": {},
                    "has_recommendations": True,
                    "recommendations_count": len(recommendations),
                    "suggestion": "Try visiting the Weekly Plan page to generate your personalized workout schedule."
                })
            else:
                return jsonify({
                    "message": "No weekly fitness plan found. To create one, you'll need to first get fitness recommendations by uploading photos and filling out your profile on the 'Fitness Advisor' page.",
                    "plan": {},
                    "has_recommendations": False,
                    "suggestion": "Start by getting personalized fitness recommendations, then I can help you create a structured weekly plan."
                })
        
        # Extract today's workout
        todays_workout = weekly_plan.get('dailyPlans', {}).get(day_of_week.title(), {})
        
        logger.info(f"🎯 Today's workout for {day_of_week.title()}: {todays_workout}")
        
        if not todays_workout:
            return jsonify({
                "message": f"No specific plan found for {day_of_week.title()}",
                "plan": {},
                "suggestion": "Check your weekly plan or let me create a custom workout for today."
            })
        
        return jsonify({
            "success": True,
            "message": f"Here's your latest fitness plan for {day_of_week.title()}",
            "plan": todays_workout,
            "full_weekly_plan": weekly_plan,
            "date": today_str,
            "day": day_of_week
        })
    except Exception as e:
        logger.error(f"🎯 Error retrieving today's plan: {e}")
        return jsonify({
            "error": f"Error getting today's plan: {str(e)}",
            "plan": {}
        })

@voice_chat_bp.route('/functions/generate_weekly_plan', methods=['POST'])
def handle_generate_weekly_plan():
    """Handle generate_weekly_plan function call from the assistant"""
    try:
        global current_user_email
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"🏗️ Generating weekly plan for: {current_user_email}")
        
        # Get user profile
        user_profile = get_user_profile_from_storage(current_user_email)
        
        if not user_profile:
            return jsonify({
                "error": "No profile found",
                "message": "I need your fitness profile to generate a weekly plan. Please set up your profile first.",
                "success": False
            })
        
        # Check if user has recommendations (using latest data)
        user_data = get_user_data_from_azure_search(current_user_email)
        recommendations = user_data.get("recommendations", [])
        
        if not recommendations:
            return jsonify({
                "error": "No recommendations found",
                "message": "I need your fitness recommendations to create a weekly plan. Please get fitness recommendations first by uploading photos and completing your assessment.",
                "success": False
            })
        
        logger.info(f"🏗️ Found {len(recommendations)} recommendations, using the latest one for weekly plan generation")
        
        # Generate weekly plan using latest recommendation
        agent_type = user_profile.get('agentType', 'personal_trainer')
        weekly_plan = generate_weekly_plan_for_user(current_user_email, user_profile, agent_type)
        
        if not weekly_plan:
            return jsonify({
                "error": "Generation failed",
                "message": "I had trouble generating your weekly plan. Please try again or check your profile completeness.",
                "success": False
            })
        
        # Store the generated weekly plan
        store_success = store_weekly_plan_in_azure_search(current_user_email, weekly_plan)
        
        if store_success:
            return jsonify({
                "success": True,
                "message": f"Great! I've generated and saved your personalized weekly fitness plan based on your latest recommendations. It includes {len(weekly_plan.get('dailyPlans', {}))} days of structured workouts tailored to your goals.",
                "weekly_plan": weekly_plan,
                "plan_overview": weekly_plan.get('weeklyOverview', 'Comprehensive weekly training plan'),
                "storage_status": "saved"
            })
        else:
            return jsonify({
                "success": True,
                "message": "I've generated your weekly plan, but had trouble saving it. Here's your plan for now:",
                "weekly_plan": weekly_plan,
                "storage_status": "not_saved"
            })
            
    except Exception as e:
        logger.error(f"🏗️ Error generating weekly plan: {e}")
        return jsonify({
            "error": f"Error generating weekly plan: {str(e)}",
            "success": False
        })

@voice_chat_bp.route('/functions/get_food_recommendations', methods=['POST'])
def handle_get_food_recommendations():
    """Handle get_food_recommendations function call from the assistant"""
    try:
        global current_user_email
        data = request.json
        
        # For testing purposes, use test user if no current user is set
        if not current_user_email:
            current_user_email = "test@example.com"
            logger.info(f"🔧 Using test user for demo: {current_user_email}")
        
        logger.info(f"🍎 Getting food recommendations for: {current_user_email}")
        
        # Get parameters from request
        fitness_goal = data.get('fitness_goal', 'maintenance')
        dietary_restrictions = data.get('dietary_restrictions', '')
        meal_preferences = data.get('meal_preferences', '')
        
        # Get user profile for nutrition calculations
        user_profile = get_user_profile_from_storage(current_user_email)
        
        if not user_profile:
            return jsonify({
                "error": "No profile found",
                "message": "I need your fitness profile (age, weight, height, gender) to calculate your nutritional needs. Please set up your profile first.",
                "success": False
            })
        
        # Extract required profile data
        gender = user_profile.get('gender')
        age = user_profile.get('age')
        weight = user_profile.get('weight')
        height = user_profile.get('height')
        
        if not all([gender, age, weight, height]):
            return jsonify({
                "error": "Incomplete profile",
                "message": "Your profile is missing some required information (age, weight, height, or gender). Please complete your profile for personalized nutrition recommendations.",
                "success": False
            })
        
        # Import the food recommendations function
        from ai import get_food_recommendations
        
        # Generate food recommendations
        try:
            food_recommendations = get_food_recommendations(
                gender=gender,
                age=int(age),
                weight=float(weight),
                height=float(height),
                fitness_goal=fitness_goal,
                dietary_restrictions=dietary_restrictions,
                meal_preferences=meal_preferences,
                user_email=current_user_email
            )
            
            # Store food recommendations in Azure Search
            if food_recommendations:
                store_success = store_food_recommendations_in_azure_search(
                    user_email=current_user_email,
                    recommendations_data={
                        "gender": gender,
                        "age": int(age),
                        "weight": float(weight),
                        "height": float(height),
                        "fitness_goal": fitness_goal,
                        "dietary_restrictions": dietary_restrictions,
                        "meal_preferences": meal_preferences,
                        "recommendations": food_recommendations,
                        "created_at": datetime.utcnow().isoformat()
                    }
                )
                logger.info(f"🍎 Stored food recommendations for {current_user_email}: {store_success}")
            
            user_name = user_profile.get('name', 'you')
            
            return jsonify({
                "success": True,
                "message": f"Here are personalized nutrition recommendations for {user_name} based on your {fitness_goal.replace('_', ' ')} goals!",
                "food_recommendations": food_recommendations,
                "fitness_goal": fitness_goal,
                "daily_calories": food_recommendations.get('daily_calories', 'Calculated'),
                "storage_status": "saved" if food_recommendations else "not_saved"
            })
            
        except Exception as ai_error:
            logger.error(f"🍎 Error generating food recommendations: {ai_error}")
            return jsonify({
                "error": "Generation failed",
                "message": "I had trouble generating your food recommendations. Please try again or check your profile information.",
                "success": False
            })
            
    except Exception as e:
        logger.error(f"🍎 Error in food recommendations handler: {e}")
        return jsonify({
            "error": f"Error getting food recommendations: {str(e)}",
            "success": False
        })

# Azure Search index management
def create_user_data_index():
    """Enhanced user_data index creation to support user profiles and activity data"""
    try:
        if not index_client:
            logger.error("Index client not configured")
            return False
            
        # Check if index exists
        try:
            existing_index = index_client.get_index(USER_DATA_INDEX)
            logger.info(f"Index {USER_DATA_INDEX} already exists")
            
            # Verify that the index has the required fields
            existing_fields = [field.name for field in existing_index.fields]
            required_fields = ["id", "user_email", "data_type", "content", "created_at", "updated_at", 
                             "name", "age", "weight", "height", "gender", "fitness_level", 
                             "agent_type", "medical_conditions", "is_active"]
            
            missing_fields = [field for field in required_fields if field not in existing_fields]
            if missing_fields:
                logger.warning(f"Index {USER_DATA_INDEX} exists but missing fields: {missing_fields}")
                logger.info("Attempting to recreate index with correct schema...")
                
                # Delete and recreate the index
                index_client.delete_index(USER_DATA_INDEX)
                logger.info(f"Deleted existing index {USER_DATA_INDEX}")
                
                # Continue to create new index
            else:
                return True
                
        except ResourceNotFoundError:
            logger.info(f"Index {USER_DATA_INDEX} does not exist, creating new one...")
        
        # Enhanced index schema for both user profiles and activity data
        from azure.search.documents.indexes.models import (
            SearchIndex, SimpleField, SearchFieldDataType, ComplexField
        )
        
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SimpleField(name="user_email", type=SearchFieldDataType.String, searchable=True, filterable=True),
            SimpleField(name="data_type", type=SearchFieldDataType.String, filterable=True),  # "profile", "progress", "activity"
            SimpleField(name="content", type=SearchFieldDataType.String, searchable=True),
            SimpleField(name="created_at", type=SearchFieldDataType.DateTimeOffset, sortable=True),
            SimpleField(name="updated_at", type=SearchFieldDataType.DateTimeOffset, sortable=True),
            
            # User profile specific fields
            SimpleField(name="name", type=SearchFieldDataType.String, searchable=True),
            SimpleField(name="age", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="weight", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="height", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="gender", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="fitness_level", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="agent_type", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="medical_conditions", type=SearchFieldDataType.Collection(SearchFieldDataType.String), searchable=True),
            SimpleField(name="is_active", type=SearchFieldDataType.Boolean, filterable=True),
        ]
        
        index = SearchIndex(name=USER_DATA_INDEX, fields=fields)
        
        try:
            index_client.create_index(index)
            logger.info(f"Successfully created enhanced index: {USER_DATA_INDEX}")
            return True
        except Exception as e:
            logger.error(f"Error creating index {USER_DATA_INDEX}: {e}")
            return False
    except Exception as e:
        logger.error(f"Error checking/creating index {USER_DATA_INDEX}: {e}")
        return False

def store_user_profile_in_user_data_index(user_data):
    """Store user profile in the existing user_data index"""
    try:
        # Ensure the index exists
        if not create_user_data_index():
            raise Exception("Failed to create or access user_data index")
        
        user_email = user_data.get("email", "")
        
        # Prepare document for the user_data index
        document = {
            "id": f"profile_{user_email.replace('@', '_at_').replace('.', '_dot_')}",
            "user_email": user_email,
            "data_type": "profile",
            "content": json.dumps(user_data),  # Store complete profile as JSON
            "created_at": datetime.utcnow().isoformat() + "Z",  # Azure Search requires timezone offset
            "updated_at": datetime.utcnow().isoformat() + "Z",  # Azure Search requires timezone offset
            
            # Profile-specific fields for better search and filtering
            "name": user_data.get("name", ""),
            "age": int(user_data.get("age", 0)) if user_data.get("age") and str(user_data.get("age")).strip() else None,
            "weight": float(user_data.get("weight", 0)) if user_data.get("weight") and str(user_data.get("weight")).strip() else None,
            "height": float(user_data.get("height", 0)) if user_data.get("height") and str(user_data.get("height")).strip() else None,
            "gender": user_data.get("gender", ""),
            "fitness_level": user_data.get("fitnessLevel", ""),
            "agent_type": user_data.get("agentType", "personal_trainer"),
            "medical_conditions": [user_data.get("medicalConditions", "")] if user_data.get("medicalConditions") and isinstance(user_data.get("medicalConditions"), str) else user_data.get("medicalConditions", []) if isinstance(user_data.get("medicalConditions"), list) else [],
            "is_active": True
        }
        
        # Log the document structure for debugging
        logger.info(f"Attempting to upload document with structure: {list(document.keys())}")
        
        # Upload document to Azure Search
        result = user_data_search_client.upload_documents([document])
        
        if result[0].succeeded:
            logger.info(f"Successfully stored user profile in user_data index for {user_email}")
            return {"success": True, "message": "User profile stored successfully in user_data index"}
        else:
            logger.error(f"Failed to store user profile: {result[0].error_message}")
            return {"success": False, "error": result[0].error_message}
            
    except Exception as e:
        logger.error(f"Error storing user profile in user_data index: {e}")
        logger.error(f"Document structure attempted: {document.keys() if 'document' in locals() else 'Document not created'}")
        return {"success": False, "error": str(e)}

def get_user_profile_from_user_data_index(user_email):
    """Retrieve user profile from the user_data index"""
    try:
        if not user_data_search_client:
            return {"success": False, "error": "Azure Search client not configured"}
            
        # Search for user profile by email and data_type
        search_results = user_data_search_client.search(
            search_text="*",
            filter=f"user_email eq '{user_email}' and data_type eq 'profile'",
            select="*"
        )
        
        for result in search_results:
            # Parse the stored profile data
            profile_data = json.loads(result.get("content", "{}"))
            profile_data.update({
                "created_at": result.get("created_at"),
                "updated_at": result.get("updated_at"),
                "is_active": result.get("is_active", True)
            })
            return {"success": True, "profile": profile_data}
        
        return {"success": False, "error": "User profile not found in user_data index"}
        
    except Exception as e:
        logger.error(f"Error retrieving user profile from user_data index for {user_email}: {e}")
        return {"success": False, "error": str(e)}

def update_user_profile_in_user_data_index(user_email, updated_data):
    """Update user profile in the user_data index"""
    try:
        # Get existing profile
        existing_profile = get_user_profile_from_user_data_index(user_email)
        if not existing_profile["success"]:
            # If profile doesn't exist, create it
            return store_user_profile_in_user_data_index(updated_data)
        
        # Merge existing data with updates
        profile_data = existing_profile["profile"]
        profile_data.update(updated_data)
        profile_data["updated_at"] = datetime.utcnow().isoformat() + "Z"  # Azure Search requires timezone offset
        
        # Prepare updated document
        document = {
            "id": f"profile_{user_email.replace('@', '_at_').replace('.', '_dot_')}",
            "user_email": user_email,
            "data_type": "profile",
            "content": json.dumps(profile_data),
            "created_at": profile_data.get("created_at"),
            "updated_at": profile_data["updated_at"],
            
            # Updated profile-specific fields
            "name": profile_data.get("name", ""),
            "age": int(profile_data.get("age", 0)) if profile_data.get("age") else None,
            "weight": float(profile_data.get("weight", 0)) if profile_data.get("weight") else None,
            "height": float(profile_data.get("height", 0)) if profile_data.get("height") else None,
            "gender": profile_data.get("gender", ""),
            "fitness_level": profile_data.get("fitnessLevel", ""),
            "agent_type": profile_data.get("agentType", "general"),
            "medical_conditions": profile_data.get("medicalConditions", []),
            "is_active": profile_data.get("is_active", True)
        }
        
        # Update document in Azure Search
        result = user_data_search_client.merge_or_upload_documents([document])
        
        if result[0].succeeded:
            logger.info(f"Successfully updated user profile in user_data index for {user_email}")
            return {"success": True, "message": "User profile updated successfully in user_data index"}
        else:
            logger.error(f"Failed to update user profile: {result[0].error_message}")
            return {"success": False, "error": result[0].error_message}
            
    except Exception as e:
        logger.error(f"Error updating user profile in user_data index: {e}")
        return {"success": False, "error": str(e)}

# Add new endpoints to the existing voice_chat blueprint
# NOTE: This endpoint is now in app.py with JWT/password hashing support
# @voice_chat_bp.route('/create-user-profile', methods=['POST'])
def create_user_profile_OLD():
    """DEPRECATED: Use the endpoint in app.py instead - this is kept for reference only"""
    try:
        data = request.json
        
        # Validate email is present
        if not data.get('email'):
            return jsonify({"error": "Missing required field: email"}), 400
        
        # Accept either legacy 'name' field OR new firstName/lastName fields
        if not data.get('name') and not data.get('firstName') and not data.get('lastName'):
            return jsonify({"error": "Missing required field: name (either 'name' or 'firstName'/'lastName')"}), 400
        
        # Store user profile in the user_data index
        result = store_user_profile_in_user_data_index(data)
        
        if result["success"]:
            # Also store in ChromaDB vector store for semantic search
            try:
                medical_conditions = data.get('medicalConditions', [])
                # Convert list to comma-separated string for ChromaDB
                medical_conditions_str = ', '.join(medical_conditions) if isinstance(medical_conditions, list) else str(medical_conditions)
                
                vector_data = {
                    'email': data.get('email'),
                    'username': data.get('username', ''),
                    'firstName': data.get('firstName', ''),
                    'middleName': data.get('middleName', ''),
                    'lastName': data.get('lastName', ''),
                    'age': int(data.get('age', 0)) if data.get('age') else 0,
                    'weight': float(data.get('weight', 0)) if data.get('weight') else 0,
                    'height': float(data.get('height', 0)) if data.get('height') else 0,
                    'gender': data.get('gender', ''),
                    'fitnessLevel': data.get('fitnessLevel', ''),
                    'agentType': data.get('agentType', ''),
                    'medicalConditions': medical_conditions_str  # Store as string
                }
                vector_store.store_user_profile(vector_data)
                logger.info(f"✅ User profile stored in vector database: {data.get('email')}")
            except Exception as ve:
                logger.warning(f"Vector store failed (non-critical): {str(ve)}")
            
            return jsonify({
                "message": "User profile created successfully in user_data index",
                "profile": data
            }), 201
        else:
            return jsonify({"error": result["error"]}), 500
            
    except Exception as e:
        logger.error(f"Error creating user profile: {e}")
        return jsonify({"error": str(e)}), 500

@voice_chat_bp.route('/get-user-profile/<email>', methods=['GET'])
def get_user_profile_endpoint(email):
    """Get user profile from the user_data index"""
    try:
        result = get_user_profile_from_user_data_index(email)
        
        if result["success"]:
            return jsonify(result["profile"]), 200
        else:
            return jsonify({"error": result["error"]}), 404
            
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        return jsonify({"error": str(e)}), 500

@voice_chat_bp.route('/update-user-profile/<email>', methods=['PUT'])
def update_user_profile_endpoint(email):
    """Update user profile in the user_data index"""
    try:
        data = request.json
        
        result = update_user_profile_in_user_data_index(email, data)
        
        if result["success"]:
            return jsonify({"message": result["message"]}), 200
        else:
            return jsonify({"error": result["error"]}), 500
            
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        return jsonify({"error": str(e)}), 500

# Initialize the index on startup
try:
    create_user_data_index()
except Exception as e:
    logger.error(f"Failed to initialize user_data index on startup: {e}")

def get_user_food_recommendations_for_context(user_email):
    """Get user's food recommendations for context in food analysis"""
    try:
        search_client = SearchClient(
            endpoint=AZURE_SEARCH_ENDPOINT,
            index_name=USER_DATA_INDEX,
            credential=AzureKeyCredential(AZURE_SEARCH_ADMIN_KEY)
        )
        
        # Search for user's food recommendations
        safe_email = user_email.replace('@', '_at_').replace('.', '_dot_')
        
        results = search_client.search(
            search_text="",
            filter=f"user_email eq '{safe_email}' and data_type eq 'food_recommendations'",
            order_by=["created_at desc"],
            top=1
        )
        
        for result in results:
            if 'data' in result:
                return result['data']
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting user food recommendations for context: {e}")
        return None
