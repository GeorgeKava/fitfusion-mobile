from flask import Flask, Response, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import cv2
import os
import uuid
import logging
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from ai import get_fitness_recommendation, identify_food_from_image, get_food_recommendations
from ai_fast import get_fast_fitness_recommendation
from mcp_client import (get_fitness_recommendation_mcp, get_fitness_recommendation_with_rag, 
                       get_fitness_recommendation_hybrid, get_fallback_fitness_recommendation)
from voice_chat import voice_chat_bp, store_user_data_in_azure_search, store_weekly_plan_in_azure_search, store_food_recommendations_in_azure_search
from vector_store import vector_store
from auth_utils import (
    PasswordHasher, TokenManager, Validator, 
    require_auth, optional_auth, email_to_search_id
)
from input_validator import InputValidator

load_dotenv()

app = Flask(__name__)

# Secure CORS Configuration
# Only allow requests from your frontend domains
# Load from environment variable or use defaults for development
CORS_ORIGINS_ENV = os.getenv('CORS_ALLOWED_ORIGINS', '')
if CORS_ORIGINS_ENV:
    ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_ENV.split(',')]
else:
    # Default development origins
    ALLOWED_ORIGINS = [
        'http://localhost:3000',           # React development server
        'http://localhost:5001',           # Local testing
        'http://127.0.0.1:3000',           # Alternative localhost
        'http://127.0.0.1:5001',           # Alternative localhost
        'http://192.168.1.214:5001',       # Mobile/iOS testing on local network
        'capacitor://localhost',           # Capacitor iOS app
        'ionic://localhost',               # Ionic/Capacitor
        'http://localhost',                # Generic localhost for Capacitor
    ]

print(f"🔒 CORS enabled for origins: {ALLOWED_ORIGINS}")

CORS(app, 
     resources={r"/api/*": {
         "origins": ALLOWED_ORIGINS,
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600  # Cache preflight requests for 1 hour
     }})

# Initialize rate limiter with configurable limits
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[
        os.getenv("RATE_LIMIT_DEFAULT_PER_DAY", "200 per day"),
        os.getenv("RATE_LIMIT_DEFAULT_PER_HOUR", "50 per hour")
    ],
    storage_uri="memory://"
)
# Initialize camera instance if needed for other parts, but not for frontend capture processing
# camera = cv2.VideoCapture(0) 
capture_folder = 'captured_images'

# Register the voice chat blueprint - DISABLED to save tokens
# app.register_blueprint(voice_chat_bp, url_prefix='/api')

# Configure basic logging if you don't have it set up elsewhere
# For Flask debug mode, output usually goes to console anyway.
# logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

if not os.path.exists(capture_folder):
    os.makedirs(capture_folder)
    logging.info(f"Created capture_folder: {capture_folder}")

@app.route('/api/fitness_recommendation', methods=['POST'])
@limiter.limit(os.getenv("RATE_LIMIT_FITNESS_RECOMMENDATION", "10 per hour"))  # Limit AI-powered fitness recommendations to prevent token abuse
@require_auth
def fitness_recommendation():
    logging.info("--- Fitness Recommendation Endpoint Hit ---")
    logging.debug(f"Request.method: {request.method}")
    logging.debug(f"Request.headers: {request.headers}")
    logging.debug(f"Request.files: {request.files}")
    logging.debug(f"Request.form: {request.form}")

    # Validate input data
    form_data = request.form.to_dict()
    is_valid, error, validated_data = InputValidator.validate_fitness_profile(form_data)
    
    if not is_valid:
        logging.warning(f"Input validation failed: {error}")
        return InputValidator.create_error_response(error)
    
    # Use validated and sanitized data
    gender = validated_data['gender']
    age = validated_data['age']
    weight = validated_data['weight']
    height = validated_data['height']
    health_conditions = validated_data.get('health_conditions', '')
    agent_type = validated_data.get('agent_type', 'general')
    
    # Additional flags (not validated as they're optional booleans)
    user_email = request.form.get('user_email', g.current_user)  # Use authenticated user's email
    fast_mode = request.form.get('fast_mode', 'false').lower() == 'true'
    use_rag = request.form.get('use_rag', 'false').lower() == 'true'
    use_mcp = request.form.get('use_mcp', 'false').lower() == 'true'
    use_hybrid = request.form.get('use_hybrid', 'false').lower() == 'true'
    
    logging.info(f"✅ Validated user data: Gender={gender}, Age={age}, Weight={weight}, Height={height}, Agent={agent_type}, FastMode={fast_mode}")
    logging.info(f"🔧 AI Mode Flags: use_rag={use_rag}, use_mcp={use_mcp}, use_hybrid={use_hybrid}, fast_mode={fast_mode}")
    logging.info(f"📝 Raw form values: use_rag='{request.form.get('use_rag')}', use_mcp='{request.form.get('use_mcp')}', use_hybrid='{request.form.get('use_hybrid')}')")

    images = []
    
    if 'images' in request.files:
        files = request.files.getlist('images')
        
        if not files or all(not f.filename for f in files): # Check if files list is empty or all files are empty
            logging.warning("Key 'images' in request.files but getlist('images') is empty or files have no names.")
            return jsonify({'error': 'No image files found or files are invalid.'}), 400

        logging.info(f"Found {len(files)} file(s) in request.files['images']")

        for i, file_storage in enumerate(files):
            if file_storage and file_storage.filename:
                original_filename = file_storage.filename
                # Sanitize filename and create a unique path
                # Using a simple UUID for the main part of the filename for simplicity and uniqueness
                safe_filename_base = str(uuid.uuid4())
                _, extension = os.path.splitext(original_filename)
                if not extension: # Ensure there's an extension, default to .jpg if not
                    extension = '.jpg'
                
                safe_filename = f"{safe_filename_base}{extension}"
                img_path = os.path.join(capture_folder, safe_filename)
                
                try:
                    file_storage.save(img_path)
                    logging.info(f"Successfully saved image {i+1} ('{original_filename}') to {img_path}")
                    images.append(img_path)
                except Exception as e:
                    logging.error(f"Failed to save image '{original_filename}' to {img_path}: {e}")
                    return jsonify({'error': f'Failed to save image: {original_filename}. Error: {str(e)}'}), 500
            else:
                logging.warning(f"File {i+1} in request.files['images'] is invalid (no file_storage or no filename). Skipping.")
    
    # This elif block for server-side camera capture is likely not what's being used by your frontend's capture.
    # The frontend sends the captured image as a file upload.
    # elif request.args.get('capture') == 'true':
    #     logging.info("Attempting server-side camera capture based on 'capture=true' arg.")
    #     # ... (your existing server-side cv2 capture logic) ...
    #     # This part would need its own error handling and appending to `images`
    #     pass # Placeholder for brevity

    if not images:
        logging.error("No images were successfully processed and saved from the request. 'images' key might be missing or all files failed processing.")
        return jsonify({'error': 'No valid image files were provided or an error occurred while saving images.'}), 400

    logging.info(f"Processing {len(images)} image(s): {images}")
    
    # Check if MCP is disabled in environment
    disable_mcp = os.getenv("DISABLE_MCP", "false").lower() == "true"
    
    try:
        # Determine which AI processing mode to use
        if disable_mcp:
            # MCP is disabled, use enhanced fallback with Agentic RAG
            logging.info("MCP disabled, using enhanced fallback with Agentic RAG")
            user_data = {
                'gender': gender,
                'age': age,
                'weight': weight,
                'height': height,
                'health_conditions': health_conditions,
                'agent_type': agent_type
            }
            result = get_fallback_fitness_recommendation(user_data, images)
        elif use_hybrid or (use_rag and use_mcp):
            # Use Hybrid RAG + MCP for ultimate recommendations
            logging.info("Using Hybrid RAG + MCP mode for comprehensive recommendation")
            logging.info(f"🖼️ Images being passed to hybrid function: {images} (count: {len(images)})")
            for i, img_path in enumerate(images):
                logging.info(f"  Image {i+1}: {img_path} (exists: {os.path.exists(img_path)})")
            user_data = {
                'gender': gender,
                'age': age,
                'weight': weight,
                'height': height,
                'health_conditions': health_conditions,
                'agent_type': agent_type
            }
            result = asyncio.run(get_fitness_recommendation_hybrid(images, user_data))
        elif use_rag:
            # Use ChromaDB RAG for enhanced recommendations
            logging.info("Using ChromaDB vector store RAG mode for recommendation")
            user_data = {
                'gender': gender,
                'age': age,
                'weight': weight,
                'height': height,
                'health_conditions': health_conditions,
                'agent_type': agent_type
            }
            result = asyncio.run(get_fitness_recommendation_with_rag(images, user_data))
        elif use_mcp:
            # Use MCP (Model Context Protocol) for structured recommendations
            logging.info("Using MCP mode for recommendation")
            result = asyncio.run(get_fitness_recommendation_mcp(images, gender, age, weight, height, agent_type, health_conditions))
        elif fast_mode:
            # Use fast mode for quicker responses
            result = get_fast_fitness_recommendation(images, gender, age, weight, height, agent_type, health_conditions)
            logging.info("Using fast mode for recommendation")
            
            # Check if fast mode failed and fallback to enhanced RAG
            if isinstance(result, str) and ("Quick analysis complete!" in result or "error" in result.lower()):
                logging.info("Fast mode failed, falling back to enhanced RAG system")
                user_data = {
                    'gender': gender,
                    'age': age,
                    'weight': weight,
                    'height': height,
                    'health_conditions': health_conditions,
                    'agent_type': agent_type
                }
                result = get_fallback_fitness_recommendation(user_data, images)
        else:
            # Use standard enhanced mode
            result = get_fitness_recommendation(images, gender, age, weight, height, agent_type, health_conditions)
            logging.info("Using enhanced mode for recommendation")
            
            # Check if enhanced mode failed and fallback to enhanced RAG
            if isinstance(result, str) and "An error occurred" in result:
                logging.info("Enhanced mode failed, falling back to enhanced RAG system")
                user_data = {
                    'gender': gender,
                    'age': age,
                    'weight': weight,
                    'height': height,
                    'health_conditions': health_conditions,
                    'agent_type': agent_type
                }
                result = get_fallback_fitness_recommendation(user_data, images)
            
        # ai.py's get_fitness_recommendation returns a string "An error occurred..." on its internal errors.
        # This is currently returned as part of a 200 OK.
        
        # Handle different result types from various processing modes
        recommendation_text = result
        
        # Extract string recommendation from complex objects (RAG/MCP/Hybrid modes)
        if isinstance(result, dict):
            if 'recommendation' in result:
                recommendation_text = result['recommendation']
            elif 'error' in result:
                recommendation_text = result.get('error', 'An error occurred during processing')
            else:
                # Convert complex object to readable string
                recommendation_text = f"Processed your request successfully. Here are your results:\n\n{str(result)}"
        
        # Ensure we always have a string for the frontend
        if not isinstance(recommendation_text, str):
            recommendation_text = str(recommendation_text)
        
        if isinstance(recommendation_text, str) and "An error occurred" in recommendation_text:
            logging.warning(f"AI processing indicated an error: {recommendation_text}")
            # If you want this to be a server error that triggers frontend's catch:
            # return jsonify({'error': recommendation_text, 'source': 'ai_processing'}), 500
        
        # Store user profile and recommendations in Azure Search if user_email is provided
        if user_email and user_email.strip():
            try:
                user_profile = {
                    'email': user_email,
                    'name': user_email.split('@')[0],  # Use email prefix as name if no name provided
                    'age': int(age) if age else None,
                    'weight': int(weight) if weight else None,
                    'height': int(height) if height else None,
                    'gender': gender,
                    'fitnessLevel': 'beginner',  # Default value
                    'agentType': agent_type,
                    'medicalConditions': [health_conditions] if health_conditions else [],
                    'createdAt': datetime.now().isoformat() + 'Z',
                    'isActive': True,
                    'lastLoginAt': datetime.now().isoformat() + 'Z'
                }
                
                # Store the profile and recommendation in Azure Search
                success = store_user_data_in_azure_search(
                    user_email=user_email,
                    user_profile=user_profile,
                    progress_data=[],  # No progress data from web interface
                    recommendations=[{
                        'content': recommendation_text,
                        'timestamp': datetime.now().isoformat() + 'Z',
                        'agent_type': agent_type
                    }]
                )
                
                if success:
                    logging.info(f"Successfully stored user data in Azure Search for {user_email}")
                else:
                    logging.warning(f"Failed to store user data in Azure Search for {user_email}")
                    
            except Exception as e:
                logging.error(f"Error storing user data in Azure Search: {e}")
        
        logging.info(f"Recommendation result: {recommendation_text}")
        return jsonify({'recommendation': recommendation_text})
    except Exception as e:
        logging.error(f"Unexpected error during recommendation generation: {e}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred while generating recommendations.'}), 500

@app.route('/api/get-weekly-plan', methods=['GET'])
@require_auth
def get_weekly_plan():
    """Get the latest weekly plan for a user from ChromaDB"""
    logging.info("--- Get Weekly Plan Endpoint Hit ---")
    
    try:
        user_email = request.args.get('user_email')
        if not user_email:
            return jsonify({"error": "User email is required"}), 400
        
        logging.info(f"Fetching weekly plan from ChromaDB for: {user_email}")
        
        # Get weekly plan from ChromaDB
        from vector_store import FitnessVectorStore
        vector_store = FitnessVectorStore()
        weekly_plan = vector_store.get_weekly_plan(user_email)
        
        if weekly_plan:
            logging.info(f"✅ Found weekly plan for user: {user_email}")
            return jsonify({
                "success": True,
                "weekly_plan": weekly_plan
            })
        else:
            logging.info(f"❌ No weekly plan found for user: {user_email}")
            return jsonify({
                "success": False,
                "message": "No weekly plan found. Create a weekly plan first."
            })
        
    except Exception as e:
        logging.error(f"Error getting weekly plan: {e}", exc_info=True)
        return jsonify({
            "error": f"Failed to get weekly plan: {str(e)}"
        }), 500

@app.route('/api/delete-weekly-plan', methods=['DELETE'])
@require_auth
def delete_weekly_plan():
    """Delete the weekly plan for a user from ChromaDB"""
    logging.info("--- Delete Weekly Plan Endpoint Hit ---")
    
    try:
        user_email = request.args.get('user_email')
        if not user_email:
            return jsonify({"error": "User email is required"}), 400
        
        logging.info(f"Deleting weekly plan from ChromaDB for: {user_email}")
        
        # Delete weekly plan from ChromaDB
        from vector_store import FitnessVectorStore
        vector_store = FitnessVectorStore()
        success = vector_store.delete_weekly_plan(user_email)
        
        if success:
            logging.info(f"✅ Successfully deleted weekly plan for user: {user_email}")
            return jsonify({
                "success": True,
                "message": "Weekly plan deleted successfully"
            })
        else:
            logging.warning(f"❌ Failed to delete weekly plan for user: {user_email}")
            return jsonify({
                "success": False,
                "message": "Failed to delete weekly plan"
            }), 500
        
    except Exception as e:
        logging.error(f"Error deleting weekly plan: {e}", exc_info=True)
        return jsonify({
            "error": f"Failed to delete weekly plan: {str(e)}"
        }), 500

@app.route('/api/generate-weekly-plan', methods=['POST'])
@limiter.limit(os.getenv("RATE_LIMIT_WEEKLY_PLAN", "5 per hour"))  # Limit weekly plan generation - expensive AI operation
@require_auth
def generate_weekly_plan():
    logging.info("--- Weekly Plan Generation Endpoint Hit ---")
    
    try:
        data = request.get_json()
        user_profile = data.get('userProfile')
        base_recommendation = data.get('baseRecommendation')
        
        if not user_profile or not base_recommendation:
            return jsonify({'error': 'User profile and base recommendation are required'}), 400
        
        logging.info(f"Generating weekly plan for user: {user_profile.get('agentType', 'general')}")
        
        # Import the weekly plan generation function
        from ai import generate_weekly_fitness_plan
        
        weekly_plan = generate_weekly_fitness_plan(user_profile, base_recommendation)
        
        # Log ChromaDB exercise count
        chromadb_count = weekly_plan.get('chromadb_exercise_count', 0)
        uses_chromadb = weekly_plan.get('uses_chromadb', False)
        logging.info(f"✅ Weekly plan generated - Uses ChromaDB: {uses_chromadb}, Exercise count: {chromadb_count}")
        
        # Log sample of dailyPlans
        if 'dailyPlans' in weekly_plan:
            for day, plan in list(weekly_plan['dailyPlans'].items())[:2]:  # First 2 days
                exercise_count = len(plan.get('exercises', []))
                logging.info(f"   {day}: {exercise_count} exercises")
                if exercise_count > 0:
                    logging.info(f"      Sample: {plan['exercises'][0][:80]}")
        
        # Store weekly plan in ChromaDB if user email is provided
        user_email = user_profile.get('email')
        if user_email and user_email.strip():
            try:
                from vector_store import FitnessVectorStore
                vector_store = FitnessVectorStore()
                vector_store.store_weekly_plan(user_email, weekly_plan)
                logging.info(f"✅ Successfully stored weekly plan in ChromaDB for {user_email}")
            except Exception as e:
                logging.error(f"Error storing weekly plan in ChromaDB: {e}")
        
        return jsonify(weekly_plan)
        
    except Exception as e:
        logging.error(f"Error generating weekly plan: {e}", exc_info=True)
        return jsonify({'error': 'Failed to generate weekly plan'}), 500

@app.route('/api/food_recommendations', methods=['POST'])
@limiter.limit(os.getenv("RATE_LIMIT_FOOD_RECOMMENDATIONS", "15 per hour"))  # Limit food recommendations to control AI costs
@require_auth
def food_recommendations():
    """Get personalized food recommendations based on user's fitness goals and current recommendations"""
    logging.info("--- Food Recommendations Endpoint Hit ---")
    
    try:
        # Validate fitness profile data
        form_data = request.form.to_dict()
        is_valid, error, validated_data = InputValidator.validate_fitness_profile(form_data)
        
        if not is_valid:
            logging.warning(f"Food recommendations validation failed: {error}")
            return InputValidator.create_error_response(error)
        
        # Use validated data
        gender = validated_data['gender']
        age = validated_data['age']
        weight = validated_data['weight']
        height = validated_data['height']
        
        # Sanitize optional fields
        user_email = request.form.get('user_email', g.current_user)
        fitness_goal = InputValidator.sanitize_text(
            request.form.get('fitness_goal', 'general'), 100
        )
        dietary_restrictions = InputValidator.sanitize_text(
            request.form.get('dietary_restrictions', ''), InputValidator.MAX_TEXT_LENGTH
        )
        meal_preferences = InputValidator.sanitize_text(
            request.form.get('meal_preferences', ''), InputValidator.MAX_TEXT_LENGTH
        )
        
        # Get food recommendations (age, weight, height are already integers/floats from validation)
        food_recommendations = get_food_recommendations(
            gender=gender,
            age=age,
            weight=weight,
            height=height,
            fitness_goal=fitness_goal,
            dietary_restrictions=dietary_restrictions,
            meal_preferences=meal_preferences,
            user_email=user_email
        )
        
        # Store food recommendations in Azure Search if user email provided
        if user_email and food_recommendations:
            try:
                store_food_recommendations_in_azure_search(
                    user_email=user_email,
                    recommendations_data={
                        "gender": gender,
                        "age": int(age),
                        "weight": float(weight),
                        "height": float(height),
                        "fitness_goal": fitness_goal,
                        "dietary_restrictions": dietary_restrictions,
                        "meal_preferences": meal_preferences,
                        "recommendations": food_recommendations,
                        "created_at": datetime.now().isoformat()
                    }
                )
                logging.info(f"Stored food recommendations for user: {user_email}")
            except Exception as storage_error:
                logging.error(f"Failed to store food recommendations: {storage_error}")
        
        return jsonify({
            "success": True,
            "food_recommendations": food_recommendations
        })
        
    except Exception as e:
        logging.error(f"Error in food recommendations: {e}")
        return jsonify({
            "error": f"Failed to generate food recommendations: {str(e)}"
        }), 500

@app.route('/api/identify_food', methods=['POST'])
@limiter.limit(os.getenv("RATE_LIMIT_FOOD_IDENTIFICATION", "20 per hour"))  # Limit food image identification with vision models
@require_auth
def identify_food():
    """Identify food/ingredient from uploaded image and provide analysis or recipes"""
    logging.info("--- Food Identification Endpoint Hit ---")
    
    try:
        # Validate image upload
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        image_file = request.files['image']
        
        # Validate file
        allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        is_valid, error = InputValidator.validate_file_upload(
            image_file, 'Image', allowed_extensions, max_size_mb=10
        )
        if not is_valid:
            logging.warning(f"File validation failed: {error}")
            return jsonify({"error": error}), 400
        
        # Sanitize filename and save
        safe_filename = InputValidator.sanitize_filename(image_file.filename)
        _, extension = os.path.splitext(safe_filename)
        image_filename = f"food_identification_{uuid.uuid4()}{extension}"
        image_path = os.path.join(capture_folder, image_filename)
        
        image_file.save(image_path)
        logging.info(f"✅ Image saved: {image_path}")
        
        # Get and sanitize user context
        user_email = request.form.get('user_email', g.current_user)
        fitness_goal = InputValidator.sanitize_text(
            request.form.get('fitness_goal', 'general'), 100
        )
        dietary_restrictions = InputValidator.sanitize_text(
            request.form.get('dietary_restrictions', ''), InputValidator.MAX_TEXT_LENGTH
        )
        analysis_type = InputValidator.sanitize_text(
            request.form.get('analysis_type', 'food'), 50
        )
        
        # Identify the food/ingredient and get analysis or recipes
        food_analysis = identify_food_from_image(
            image_path=image_path,
            analysis_type=analysis_type,
            fitness_goal=fitness_goal,
            dietary_restrictions=dietary_restrictions,
            user_email=user_email
        )
        
        # Clean up the temporary image file
        try:
            os.remove(image_path)
        except Exception as cleanup_error:
            logging.warning(f"Failed to cleanup temporary image: {cleanup_error}")
        
        return jsonify({
            "success": True,
            "analysis_type": analysis_type,
            "food_analysis": food_analysis
        })
        
    except Exception as e:
        logging.error(f"Error in food identification: {e}")
        return jsonify({
            "error": f"Failed to identify food: {str(e)}"
        }), 500

@app.route('/video_feed')
def video_feed():
    # This is for streaming server's camera, not directly related to frontend capture processing
    camera_device = cv2.VideoCapture(0) # Ensure camera is initialized here if used
    def gen_frames():
        while True:
            success, frame = camera_device.read() # Use the local camera_device
            if not success:
                logging.warning("Failed to read frame from server camera for video_feed.")
                break
            else:
                ret, buffer = cv2.imencode('.jpg', frame)
                if not ret:
                    logging.warning("Failed to encode frame for video_feed.")
                    continue
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        camera_device.release() # Release camera when done
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/favicon.ico')
def favicon():
    return '', 204

# User Management Endpoints
@app.route('/api/create-user-profile', methods=['POST'])
@limiter.limit("5 per minute")  # Rate limit registration
def create_user_profile():
    """Create a new user profile with password hashing - stores in ChromaDB (fast) and optionally in Azure Search"""
    try:
        from datetime import datetime
        
        data = request.json
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        email = data.get('email')
        password = data.get('password', '')
        
        logging.info(f"Creating user profile for: {email}")
        
        # Validate email format
        is_valid_email, email_or_error = Validator.validate_email_format(email)
        if not is_valid_email:
            return jsonify({
                'success': False,
                'error': email_or_error
            }), 400
        
        email = email_or_error  # Use normalized email
        
        # Validate password strength
        is_valid_password, password_error = Validator.validate_password_strength(password)
        if not is_valid_password:
            logging.warning(f"Password validation failed for {email}: {password_error}")
            return jsonify({
                'success': False,
                'error': password_error
            }), 400
        
        # Validate name
        first_name = InputValidator.sanitize_text(data.get('firstName', ''), InputValidator.MAX_NAME_LENGTH)
        last_name = InputValidator.sanitize_text(data.get('lastName', ''), InputValidator.MAX_NAME_LENGTH)
        
        if not data.get('name') and not first_name and not last_name:
            return jsonify({
                'success': False,
                'error': 'Name is required (either name or firstName/lastName)'
            }), 400
        
        # Validate age if provided
        age_value = data.get('age')
        if age_value:
            is_valid, error, age_int = InputValidator.validate_integer(
                age_value, 'Age', InputValidator.AGE_MIN, InputValidator.AGE_MAX
            )
            if not is_valid:
                return jsonify({'success': False, 'error': error}), 400
        
        # Validate weight if provided
        weight_value = data.get('weight')
        if weight_value:
            is_valid, error, weight_float = InputValidator.validate_float(
                weight_value, 'Weight', InputValidator.WEIGHT_MIN, InputValidator.WEIGHT_MAX
            )
            if not is_valid:
                return jsonify({'success': False, 'error': error}), 400
        
        # Validate height if provided
        height_value = data.get('height')
        if height_value:
            is_valid, error, height_float = InputValidator.validate_float(
                height_value, 'Height', InputValidator.HEIGHT_MIN, InputValidator.HEIGHT_MAX
            )
            if not is_valid:
                return jsonify({'success': False, 'error': error}), 400
        
        # Validate gender if provided
        gender_value = data.get('gender') or data.get('sex', '')
        if gender_value:
            is_valid, error = InputValidator.validate_enum(
                gender_value, 'Gender', InputValidator.ALLOWED_GENDERS
            )
            if not is_valid:
                return jsonify({'success': False, 'error': error}), 400
        
        # Hash the password
        hashed_password = PasswordHasher.hash_password(password)
        
        first_name = data.get('firstName', '')
        last_name = data.get('lastName', '')
        
        if not data.get('name') and not first_name and not last_name:
            return jsonify({
                'success': False,
                'error': 'Name is required (either name or firstName/lastName)'
            }), 400
        
        # Handle name field (legacy) or new firstName/lastName fields
        full_name = data.get('name')
        if not full_name:
            middle_name = data.get('middleName', '')
            full_name = f"{first_name} {middle_name} {last_name}".strip()
        
        # PRIORITY 1: Store in ChromaDB first (fast, local)
        try:
            vector_data = {
                'email': email,
                'username': data.get('username', ''),
                'firstName': first_name,
                'middleName': data.get('middleName', ''),
                'lastName': last_name,
                'name': full_name,
                'age': int(data.get('age', 0)) if data.get('age') else 0,
                'weight': float(data.get('weight', 0)) if data.get('weight') else 0,
                'height': float(data.get('height', 0)) if data.get('height') else 0,
                'gender': data.get('gender') or data.get('sex', ''),
                'fitnessLevel': data.get('fitnessLevel', ''),
                'agentType': data.get('agentType') or data.get('fitnessAgent', 'personal_trainer'),
                'medicalConditions': data.get('medicalConditions', []) if isinstance(data.get('medicalConditions'), list) else [],
                'password': hashed_password  # Store hashed password in ChromaDB
            }
            vector_store.store_user_profile(vector_data)
            logging.info(f"✅ User profile stored in ChromaDB: {email}")
        except Exception as ve:
            logging.error(f"Failed to store in ChromaDB: {str(ve)}")
            return jsonify({
                'success': False,
                'error': 'Failed to store user profile'
            }), 500
        
        # Azure Search is optional now - passwords are stored in ChromaDB
        # (Azure Search can be used for other user data if needed)
        
        # Generate JWT token for immediate login
        token = TokenManager.generate_token(email, {
            'name': data.get('name', ''),
            'fitness_level': data.get('fitnessLevel', '')
        })
        
        # Return success with JWT token for auto-login
        return jsonify({
            'success': True,
            'message': 'User profile created successfully',
            'token': token,
            'user': {
                'email': email,
                'name': data.get('name', ''),
                'fitness_level': data.get('fitnessLevel', '')
            }
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating user profile: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-user-profile/<email>', methods=['GET'])
@require_auth
def get_user_profile(email):
    """
    Retrieve user profile from ChromaDB
    Requires authentication - users can only access their own profile
    """
    try:
        # Normalize both emails for comparison (lowercase, strip whitespace)
        current_user_email = g.current_user.lower().strip()
        requested_email = email.lower().strip()
        
        logging.info(f"Profile request - Token email: '{current_user_email}', Requested: '{requested_email}'")
        
        # Security: Users can only access their own profile
        if current_user_email != requested_email:
            logging.warning(f"Unauthorized profile access attempt: {current_user_email} tried to access {requested_email}")
            return jsonify({
                'success': False,
                'error': 'Unauthorized to access this profile'
            }), 403
        
        # Get user from ChromaDB
        user = vector_store.get_user_by_email(email)
        
        if user:
            # Remove password from response
            user_data = dict(user)
            user_data.pop('password', None)
            return jsonify({
                'success': True,
                'user': user_data
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
            
    except Exception as e:
        logging.error(f"Error retrieving user profile: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")  # Prevent brute force attacks
def login():
    """Authenticate user with password verification and return JWT token"""
    try:
        from datetime import datetime
        
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({
                'success': False,
                'error': 'Email and password are required'
            }), 400
        
        # Validate email format
        is_valid_email, email_or_error = Validator.validate_email_format(email)
        if not is_valid_email:
            return jsonify({
                'success': False,
                'error': 'Invalid email format'
            }), 400
        
        email = email_or_error  # Use normalized email
        
        # Get user from ChromaDB (where passwords are now stored)
        user = vector_store.get_user_by_email(email)
        
        if not user:
            logging.warning(f"No user found for: {email}")
            # Return same error as wrong password to prevent user enumeration
            return jsonify({
                'success': False,
                'error': 'Invalid email or password'
            }), 401
        
        # Verify password using bcrypt
        stored_hash = user.get('password', '')
        if not stored_hash:
            logging.error(f"No password found for user: {email}")
            return jsonify({
                'success': False,
                'error': 'Invalid email or password'
            }), 401
            
        if not PasswordHasher.verify_password(password, stored_hash):
            logging.warning(f"Failed login attempt for: {email}")
            return jsonify({
                'success': False,
                'error': 'Invalid email or password'
            }), 401
        
        # Password is correct - generate JWT token
        token = TokenManager.generate_token(email, {
            'name': user.get('name', ''),
            'fitness_level': user.get('fitness_level', '')
        })
        
        # Update last login time in ChromaDB
        timestamp = datetime.utcnow().isoformat() + "Z"
        user['updated_at'] = timestamp
        user['last_login'] = timestamp
        
        # Update user in ChromaDB
        try:
            vector_store.store_user_profile(user)
            logging.info(f"✅ Updated last login in ChromaDB for: {email}")
        except Exception as update_error:
            logging.warning(f"Failed to update last login in ChromaDB: {update_error}")
        
        # Remove password from response
        user_data = dict(user)
        user_data.pop('password', None)
        
        logging.info(f"✅ Successful login for: {email}")
        return jsonify({
            'success': True,
            'token': token,
            'user': user_data
        }), 200
            
    except Exception as e:
        logging.error(f"Error during login: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'An error occurred during login'
        }), 500

@app.route('/api/delete-account', methods=['DELETE'])
@require_auth
def delete_account():
    """
    Delete user account and all associated data (HARD DELETE)
    Requires authentication - user can only delete their own account
    """
    try:
        from voice_chat import user_data_search_client
        
        # Get authenticated user from JWT token
        user_email = g.current_user
        logging.info(f"Delete account request for: {user_email}")
        
        # Verify user provided password for extra security
        data = request.json or {}
        password = data.get('password', '')
        
        if not password:
            return jsonify({
                'success': False,
                'error': 'Password confirmation is required to delete account'
            }), 400
        
        # Verify password before deletion using ChromaDB
        user = vector_store.get_user_by_email(user_email)
        
        if not user:
            logging.error(f"User not found in ChromaDB: {user_email}")
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        stored_hash = user.get('password', '')
        if not stored_hash or not PasswordHasher.verify_password(password, stored_hash):
            logging.warning(f"Failed password verification for account deletion: {user_email}")
            return jsonify({
                'success': False,
                'error': 'Invalid password'
            }), 401
        
        # Delete from ChromaDB vector store (all user data)
        try:
            vector_store.delete_user_data(user_email)
            logging.info(f"✅ Deleted ChromaDB data for: {user_email}")
        except Exception as ve:
            logging.error(f"Failed to delete from ChromaDB: {str(ve)}")
            # Continue with Azure deletion even if ChromaDB fails
        
        # Delete from Azure Search
        if user_data_search_client:
            try:
                # Delete user credentials document
                user_data_search_client.delete_documents([{
                    'id': email_to_search_id(user_email)
                }])
                logging.info(f"✅ Deleted Azure Search data for: {user_email}")
            except Exception as azure_error:
                logging.error(f"Failed to delete from Azure Search: {str(azure_error)}")
        
        logging.info(f"🗑️ Account completely deleted: {user_email}")
        return jsonify({
            'success': True,
            'message': 'Account and all associated data have been permanently deleted'
        }), 200
        
    except Exception as e:
        logging.error(f"Error deleting account: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'An error occurred while deleting account'
        }), 500

@app.route('/api/search-users', methods=['POST'])
@require_auth
def search_users():
    """Semantic search for users using ChromaDB vector store"""
    try:
        data = request.json
        query = data.get('query', '')
        n_results = data.get('n_results', 5)
        
        if not query:
            return jsonify({
                'success': False,
                'error': 'Query is required'
            }), 400
        
        results = vector_store.semantic_search_users(query, n_results=n_results)
        
        return jsonify({
            'success': True,
            'results': results
        }), 200
        
    except Exception as e:
        logging.error(f"Error searching users: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/vector-store/stats', methods=['GET'])
@require_auth
def vector_store_stats():
    """Get vector store database statistics"""
    try:
        stats = vector_store.get_stats()
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
    except Exception as e:
        logging.error(f"Error getting vector store stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/vector-store/test', methods=['GET'])
@require_auth
def test_vector_store():
    """Test endpoint to verify vector store is working"""
    try:
        stats = vector_store.get_stats()
        return jsonify({
            'success': True,
            'message': 'Vector store is operational',
            'storage_location': '📦 ./chroma_db (local storage)',
            'stats': stats
        }), 200
    except Exception as e:
        logging.error(f"Vector store test failed: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Vector store is not operational'
        }), 500

@app.route('/api/list-all-users', methods=['GET'])
# @require_auth  # Temporarily disabled
def list_all_users():
    """Admin endpoint to list all users in ChromaDB"""
    try:
        # Access the users_collection directly from vector_store
        results = vector_store.users_collection.get()
        
        users = []
        if results and results['ids']:
            for idx, user_id in enumerate(results['ids']):
                metadata = results['metadatas'][idx] if results['metadatas'] else {}
                users.append({
                    'id': user_id,
                    'email': metadata.get('email', 'N/A'),
                    'username': metadata.get('username', 'N/A'),
                    'name': metadata.get('name', 'N/A'),
                    'age': metadata.get('age', 'N/A'),
                    'gender': metadata.get('gender', 'N/A'),
                    'fitnessLevel': metadata.get('fitnessLevel', 'N/A'),
                    'createdAt': metadata.get('createdAt', 'N/A')
                })
        
        return jsonify({
            'success': True,
            'count': len(users),
            'users': users
        }), 200
        
    except Exception as e:
        logging.error(f"Error listing users: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to retrieve users from database'
        }), 500

if __name__ == '__main__':
    # Get configuration from environment
    debug_mode = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('PORT', os.getenv('FLASK_PORT', 5001)))
    
    # Production security settings
    if not debug_mode:
        # Disable Flask debug mode in production
        app.config['DEBUG'] = False
        
        # Enable secure session cookies
        app.config['SESSION_COOKIE_SECURE'] = True  # Only send cookie over HTTPS
        app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent JavaScript access
        app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF protection
        
        print("🔒 Running in PRODUCTION mode")
        print("⚠️  Make sure you're using a production WSGI server (Gunicorn, uWSGI)")
        print("⚠️  Flask development server is NOT suitable for production!")
    else:
        print("🔧 Running in DEVELOPMENT mode")
    
    # Run Flask app (use Gunicorn for production!)
    app.run(debug=debug_mode, host=host, port=port)
