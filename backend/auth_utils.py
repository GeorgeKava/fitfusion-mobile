"""
Authentication and Security Utilities
Provides password hashing, JWT tokens, and auth decorators
"""

import bcrypt
import jwt
import re
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from email_validator import validate_email, EmailNotValidError
import os
from dotenv import load_dotenv

load_dotenv()

# Secret key for JWT - should be in .env file
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

class PasswordHasher:
    """Handles password hashing and verification using bcrypt"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        if not password:
            raise ValueError("Password cannot be empty")
        
        # Generate salt and hash password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Return as string for storage
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        if not password or not hashed_password:
            return False
        
        try:
            # Convert string back to bytes if needed
            if isinstance(hashed_password, str):
                hashed_password = hashed_password.encode('utf-8')
            
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password)
        except Exception as e:
            print(f"Password verification error: {e}")
            return False

class TokenManager:
    """Handles JWT token generation and verification"""
    
    @staticmethod
    def generate_token(email: str, additional_data: dict = None) -> str:
        """Generate a JWT token for a user"""
        payload = {
            'email': email,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        }
        
        # Add any additional data to token
        if additional_data:
            payload.update(additional_data)
        
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return token
    
    @staticmethod
    def verify_token(token: str) -> dict:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return {'valid': True, 'payload': payload}
        except jwt.ExpiredSignatureError:
            return {'valid': False, 'error': 'Token has expired'}
        except jwt.InvalidTokenError as e:
            return {'valid': False, 'error': f'Invalid token: {str(e)}'}

class Validator:
    """Input validation utilities"""
    
    @staticmethod
    def validate_email_format(email: str) -> tuple[bool, str]:
        """Validate email format"""
        if not email:
            return False, "Email is required"
        
        try:
            # Validate and normalize email
            valid = validate_email(email)
            return True, valid.email
        except EmailNotValidError as e:
            return False, str(e)
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        """
        Validate password meets security requirements:
        - At least 8 characters
        - At least 1 uppercase letter
        - At least 1 lowercase letter
        - At least 1 number
        """
        if not password:
            return False, "Password is required"
        
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter"
        
        if not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter"
        
        if not re.search(r'\d', password):
            return False, "Password must contain at least one number"
        
        return True, "Password is valid"
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 255) -> str:
        """Sanitize string input"""
        if not value:
            return ""
        
        # Remove any null bytes and trim
        sanitized = value.replace('\x00', '').strip()
        
        # Limit length
        return sanitized[:max_length]

def require_auth(f):
    """
    Decorator to protect endpoints requiring authentication.
    Extracts and verifies JWT token from Authorization header.
    Stores user email in g.current_user for use in endpoint.
    
    Usage:
        @app.route('/api/protected')
        @require_auth
        def protected_endpoint():
            user_email = g.current_user
            return jsonify({'message': f'Hello {user_email}'})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import request, jsonify, g
        import logging
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            logging.warning(f"Missing Authorization header for {request.path}")
            return jsonify({
                'success': False,
                'error': 'Authorization header is required'
            }), 401
        
        # Extract token (format: "Bearer <token>")
        try:
            token_type, token = auth_header.split(' ')
            if token_type.lower() != 'bearer':
                logging.warning(f"Invalid token type: {token_type}")
                return jsonify({
                    'success': False,
                    'error': 'Invalid authorization type. Use Bearer token'
                }), 401
        except ValueError:
            logging.warning(f"Malformed Authorization header: {auth_header[:50]}")
            return jsonify({
                'success': False,
                'error': 'Invalid authorization header format'
            }), 401
        
        # Verify token
        result = TokenManager.verify_token(token)
        
        if not result['valid']:
            logging.warning(f"Token verification failed: {result['error']}")
            return jsonify({
                'success': False,
                'error': result['error']
            }), 401
        
        # Store user info in g for use in endpoint
        g.current_user = result['payload']['email']
        g.token_payload = result['payload']
        
        return f(*args, **kwargs)
    
    return decorated_function

def optional_auth(f):
    """
    Decorator that allows but doesn't require authentication.
    If token is present and valid, stores user in g.current_user.
    If no token or invalid token, g.current_user is None.
    
    Useful for endpoints that work for both logged-in and anonymous users.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token_type, token = auth_header.split(' ')
                if token_type.lower() == 'bearer':
                    result = TokenManager.verify_token(token)
                    if result['valid']:
                        g.current_user = result['payload']['email']
                        g.token_payload = result['payload']
                        return f(*args, **kwargs)
            except (ValueError, KeyError):
                pass
        
        # No valid token - set as None
        g.current_user = None
        g.token_payload = None
        
        return f(*args, **kwargs)
    
    return decorated_function

# Utility function to convert email to Azure Search ID
def email_to_search_id(email: str) -> str:
    """Convert email to Azure Search compatible ID"""
    return email.replace('@', '_at_').replace('.', '_dot_')
