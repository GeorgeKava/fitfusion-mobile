"""
Input Validation Module
Provides comprehensive validation for all API inputs to prevent injection attacks and ensure data integrity
"""

import re
from typing import Tuple, Optional, Any
from flask import jsonify

class InputValidator:
    """Centralized input validation for API endpoints"""
    
    # Allowed values for specific fields
    ALLOWED_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say']
    ALLOWED_AGENT_TYPES = ['general', 'strength', 'cardio', 'weight_loss', 'muscle_gain', 'endurance']
    ALLOWED_ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active']
    
    # Numeric ranges
    AGE_MIN = 13
    AGE_MAX = 120
    WEIGHT_MIN = 20  # kg
    WEIGHT_MAX = 500  # kg
    HEIGHT_MIN = 50  # cm
    HEIGHT_MAX = 300  # cm
    
    # String length limits
    MAX_NAME_LENGTH = 100
    MAX_EMAIL_LENGTH = 255
    MAX_TEXT_LENGTH = 5000
    MAX_HEALTH_CONDITIONS_LENGTH = 2000
    
    @staticmethod
    def validate_required_field(value: Any, field_name: str) -> Tuple[bool, Optional[str]]:
        """Validate that a required field is not empty"""
        if value is None or (isinstance(value, str) and not value.strip()):
            return False, f"{field_name} is required"
        return True, None
    
    @staticmethod
    def validate_integer(value: Any, field_name: str, min_val: int, max_val: int) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Validate integer input within range
        Returns: (is_valid, error_message, parsed_value)
        """
        try:
            # Handle both string and numeric inputs
            if isinstance(value, str):
                value = value.strip()
            
            int_value = int(value)
            
            if int_value < min_val or int_value > max_val:
                return False, f"{field_name} must be between {min_val} and {max_val}", None
            
            return True, None, int_value
            
        except (ValueError, TypeError):
            return False, f"{field_name} must be a valid number", None
    
    @staticmethod
    def validate_float(value: Any, field_name: str, min_val: float, max_val: float) -> Tuple[bool, Optional[str], Optional[float]]:
        """
        Validate float input within range
        Returns: (is_valid, error_message, parsed_value)
        """
        try:
            # Handle both string and numeric inputs
            if isinstance(value, str):
                value = value.strip()
            
            float_value = float(value)
            
            if float_value < min_val or float_value > max_val:
                return False, f"{field_name} must be between {min_val} and {max_val}", None
            
            return True, None, float_value
            
        except (ValueError, TypeError):
            return False, f"{field_name} must be a valid number", None
    
    @staticmethod
    def validate_enum(value: Any, field_name: str, allowed_values: list) -> Tuple[bool, Optional[str]]:
        """Validate that value is in allowed list"""
        if value is None:
            return False, f"{field_name} is required"
        
        value_str = str(value).lower().strip()
        allowed_lower = [str(v).lower() for v in allowed_values]
        
        if value_str not in allowed_lower:
            return False, f"{field_name} must be one of: {', '.join(allowed_values)}"
        
        return True, None
    
    @staticmethod
    def validate_string_length(value: str, field_name: str, max_length: int) -> Tuple[bool, Optional[str]]:
        """Validate string length"""
        if value and len(value) > max_length:
            return False, f"{field_name} exceeds maximum length of {max_length} characters"
        return True, None
    
    @staticmethod
    def sanitize_text(value: str, max_length: int = MAX_TEXT_LENGTH) -> str:
        """
        Sanitize text input to prevent injection attacks
        Removes null bytes, control characters, and limits length
        """
        if not value:
            return ""
        
        # Remove null bytes
        sanitized = value.replace('\x00', '')
        
        # Remove other control characters except newlines and tabs
        sanitized = ''.join(char for char in sanitized if char.isprintable() or char in '\n\r\t')
        
        # Trim whitespace
        sanitized = sanitized.strip()
        
        # Limit length
        return sanitized[:max_length]
    
    @staticmethod
    def validate_email_format(email: str) -> Tuple[bool, Optional[str]]:
        """Basic email format validation"""
        if not email:
            return False, "Email is required"
        
        # Basic email regex pattern
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if not re.match(pattern, email):
            return False, "Invalid email format"
        
        if len(email) > InputValidator.MAX_EMAIL_LENGTH:
            return False, f"Email exceeds maximum length of {InputValidator.MAX_EMAIL_LENGTH}"
        
        return True, None
    
    @staticmethod
    def validate_fitness_profile(data: dict) -> Tuple[bool, Optional[str], Optional[dict]]:
        """
        Validate fitness profile data
        Returns: (is_valid, error_message, sanitized_data)
        """
        sanitized = {}
        
        # Validate gender
        gender = data.get('gender')
        is_valid, error = InputValidator.validate_required_field(gender, 'Gender')
        if not is_valid:
            return False, error, None
        
        is_valid, error = InputValidator.validate_enum(gender, 'Gender', InputValidator.ALLOWED_GENDERS)
        if not is_valid:
            return False, error, None
        sanitized['gender'] = str(gender).lower().strip()
        
        # Validate age
        age = data.get('age')
        is_valid, error = InputValidator.validate_required_field(age, 'Age')
        if not is_valid:
            return False, error, None
        
        is_valid, error, age_value = InputValidator.validate_integer(
            age, 'Age', InputValidator.AGE_MIN, InputValidator.AGE_MAX
        )
        if not is_valid:
            return False, error, None
        sanitized['age'] = age_value
        
        # Validate weight
        weight = data.get('weight')
        is_valid, error = InputValidator.validate_required_field(weight, 'Weight')
        if not is_valid:
            return False, error, None
        
        is_valid, error, weight_value = InputValidator.validate_float(
            weight, 'Weight', InputValidator.WEIGHT_MIN, InputValidator.WEIGHT_MAX
        )
        if not is_valid:
            return False, error, None
        sanitized['weight'] = weight_value
        
        # Validate height
        height = data.get('height')
        is_valid, error = InputValidator.validate_required_field(height, 'Height')
        if not is_valid:
            return False, error, None
        
        is_valid, error, height_value = InputValidator.validate_float(
            height, 'Height', InputValidator.HEIGHT_MIN, InputValidator.HEIGHT_MAX
        )
        if not is_valid:
            return False, error, None
        sanitized['height'] = height_value
        
        # Validate health conditions (optional)
        health_conditions = data.get('health_conditions', '')
        is_valid, error = InputValidator.validate_string_length(
            health_conditions, 'Health conditions', InputValidator.MAX_HEALTH_CONDITIONS_LENGTH
        )
        if not is_valid:
            return False, error, None
        sanitized['health_conditions'] = InputValidator.sanitize_text(
            health_conditions, InputValidator.MAX_HEALTH_CONDITIONS_LENGTH
        )
        
        # Validate agent type (optional, with default)
        agent_type = data.get('agent_type', 'general')
        is_valid, error = InputValidator.validate_enum(
            agent_type, 'Agent type', InputValidator.ALLOWED_AGENT_TYPES
        )
        if not is_valid:
            return False, error, None
        sanitized['agent_type'] = str(agent_type).lower().strip()
        
        return True, None, sanitized
    
    @staticmethod
    def validate_user_profile(data: dict) -> Tuple[bool, Optional[str], Optional[dict]]:
        """
        Validate user profile data for registration
        Returns: (is_valid, error_message, sanitized_data)
        """
        sanitized = {}
        
        # Validate email
        email = data.get('email')
        is_valid, error = InputValidator.validate_email_format(email)
        if not is_valid:
            return False, error, None
        sanitized['email'] = email.lower().strip()
        
        # Validate name
        name = data.get('name')
        is_valid, error = InputValidator.validate_required_field(name, 'Name')
        if not is_valid:
            return False, error, None
        
        is_valid, error = InputValidator.validate_string_length(
            name, 'Name', InputValidator.MAX_NAME_LENGTH
        )
        if not is_valid:
            return False, error, None
        sanitized['name'] = InputValidator.sanitize_text(name, InputValidator.MAX_NAME_LENGTH)
        
        # Validate fitness profile fields
        is_valid, error, fitness_data = InputValidator.validate_fitness_profile(data)
        if not is_valid:
            return False, error, None
        
        sanitized.update(fitness_data)
        
        # Validate fitness goals (optional)
        fitness_goals = data.get('fitness_goals', '')
        is_valid, error = InputValidator.validate_string_length(
            fitness_goals, 'Fitness goals', InputValidator.MAX_TEXT_LENGTH
        )
        if not is_valid:
            return False, error, None
        sanitized['fitness_goals'] = InputValidator.sanitize_text(
            fitness_goals, InputValidator.MAX_TEXT_LENGTH
        )
        
        return True, None, sanitized
    
    @staticmethod
    def validate_file_upload(file, field_name: str, allowed_extensions: list, max_size_mb: int = 10) -> Tuple[bool, Optional[str]]:
        """
        Validate uploaded file
        Returns: (is_valid, error_message)
        """
        if not file:
            return False, f"{field_name} is required"
        
        if file.filename == '':
            return False, f"No file selected for {field_name}"
        
        # Check file extension
        if '.' not in file.filename:
            return False, f"{field_name} must have a file extension"
        
        extension = file.filename.rsplit('.', 1)[1].lower()
        if extension not in allowed_extensions:
            return False, f"{field_name} must be one of: {', '.join(allowed_extensions)}"
        
        # Check file size (if file has seek method)
        if hasattr(file, 'seek') and hasattr(file, 'tell'):
            file.seek(0, 2)  # Seek to end
            size = file.tell()
            file.seek(0)  # Reset to beginning
            
            max_size_bytes = max_size_mb * 1024 * 1024
            if size > max_size_bytes:
                return False, f"{field_name} exceeds maximum size of {max_size_mb}MB"
        
        return True, None
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to prevent directory traversal attacks
        Removes dangerous characters and path components
        """
        if not filename:
            return "unnamed_file"
        
        # Remove path components
        filename = filename.split('/')[-1].split('\\')[-1]
        
        # Remove dangerous characters but keep extension
        import re
        filename = re.sub(r'[^\w\s.-]', '', filename)
        
        # Remove leading/trailing whitespace and dots
        filename = filename.strip('. ')
        
        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:250] + ('.' + ext if ext else '')
        
        return filename or "unnamed_file"
    
    @staticmethod
    def create_error_response(error_message: str, status_code: int = 400):
        """Create standardized error response"""
        return jsonify({
            'success': False,
            'error': error_message,
            'message': 'Invalid input data'
        }), status_code


def validate_request(*validators):
    """
    Decorator to validate request data before processing
    Usage: @validate_request('fitness_profile') or @validate_request('user_profile')
    """
    def decorator(f):
        from functools import wraps
        
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Get request data based on content type
            from flask import request
            
            if request.is_json:
                data = request.get_json()
            else:
                data = request.form.to_dict()
            
            # Run all validators
            for validator_name in validators:
                if validator_name == 'fitness_profile':
                    is_valid, error, sanitized = InputValidator.validate_fitness_profile(data)
                    if not is_valid:
                        return InputValidator.create_error_response(error)
                    # Attach sanitized data to request for use in endpoint
                    request.validated_data = sanitized
                
                elif validator_name == 'user_profile':
                    is_valid, error, sanitized = InputValidator.validate_user_profile(data)
                    if not is_valid:
                        return InputValidator.create_error_response(error)
                    request.validated_data = sanitized
            
            return f(*args, **kwargs)
        
        return wrapper
    return decorator
