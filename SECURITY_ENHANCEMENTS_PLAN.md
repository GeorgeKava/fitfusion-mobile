# Security Enhancements & Delete Account Plan

## 🚨 Critical Security Issues Found

### 1. **Password Storage - CRITICAL**
- ❌ **Current**: Passwords stored in **plain text** in Azure Search and ChromaDB
- ❌ **Risk**: Complete account takeover if database is compromised
- ✅ **Fix**: Hash passwords using bcrypt/argon2

### 2. **Password Logging - HIGH**
- ❌ **Current**: Passwords logged in plain text (line 675: `logging.info(f"Password in Azure: {user.get('password')}")`)
- ❌ **Risk**: Passwords visible in log files
- ✅ **Fix**: Remove all password logging immediately

### 3. **No Authentication/Authorization - CRITICAL**
- ❌ **Current**: No JWT tokens, no session management
- ❌ **Risk**: Any user can access any endpoint without verification
- ✅ **Fix**: Implement JWT-based authentication

### 4. **No Rate Limiting - HIGH**
- ❌ **Current**: Login endpoint can be brute-forced
- ❌ **Risk**: Unlimited password guessing attempts
- ✅ **Fix**: Add rate limiting (Flask-Limiter)

### 5. **CORS Wide Open - MEDIUM**
- ❌ **Current**: `CORS(app, resources={r"/api/*": {"origins": "*"}})`
- ❌ **Risk**: Any website can make requests to your API
- ✅ **Fix**: Restrict to specific origins (your iOS app)

### 6. **No Input Validation - MEDIUM**
- ❌ **Current**: No email format validation, weak password requirements
- ❌ **Risk**: SQL injection, invalid data, weak passwords
- ✅ **Fix**: Add validation layer

### 7. **No HTTPS Enforcement - HIGH**
- ❌ **Current**: HTTP only (192.168.1.214:5001)
- ❌ **Risk**: Passwords transmitted in plain text over network
- ✅ **Fix**: Use HTTPS in production

## 🎯 Priority Implementation Plan

### Phase 1: IMMEDIATE (Do Today)
1. ✅ **Hash passwords** - Use bcrypt
2. ✅ **Remove password logging**
3. ✅ **Add delete account endpoint**
4. ✅ **Add rate limiting to login**

### Phase 2: SHORT-TERM (This Week)
5. ✅ **JWT authentication** - Token-based auth
6. ✅ **Email validation**
7. ✅ **Password strength requirements**
8. ✅ **Protected endpoints** - Require auth tokens

### Phase 3: MEDIUM-TERM (Before Production)
9. ✅ **CORS restrictions** - Lock down origins
10. ✅ **HTTPS setup** - SSL certificates
11. ✅ **Account lockout** - After failed login attempts
12. ✅ **Password reset flow** - Email-based reset

## 🔨 Implementation Details

### 1. Password Hashing (bcrypt)
```python
import bcrypt

# On registration:
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# On login:
if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
    # Success
```

### 2. JWT Authentication
```python
import jwt
from datetime import datetime, timedelta

# Generate token on login:
token = jwt.encode({
    'email': user_email,
    'exp': datetime.utcnow() + timedelta(hours=24)
}, SECRET_KEY, algorithm='HS256')

# Protect endpoints:
@require_auth
def protected_endpoint():
    user_email = g.current_user
```

### 3. Delete Account Endpoint
```python
@app.route('/api/delete-account', methods=['DELETE'])
@require_auth
def delete_account():
    """
    - Verify user owns the account
    - Delete from ChromaDB
    - Delete from Azure Search
    - Delete related data (plans, recommendations)
    - Return confirmation
    """
```

### 4. Rate Limiting
```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")  # Max 5 login attempts per minute
def login():
    ...
```

### 5. Input Validation
```python
import re

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    # Min 8 chars, 1 uppercase, 1 lowercase, 1 number
    return (len(password) >= 8 and 
            any(c.isupper() for c in password) and
            any(c.islower() for c in password) and
            any(c.isdigit() for c in password))
```

## 📋 Delete Account Flow

### Backend Endpoint
```python
@app.route('/api/delete-account', methods=['DELETE'])
@require_auth  # JWT token required
def delete_account():
    try:
        user_email = g.current_user  # From JWT token
        
        # 1. Delete from ChromaDB
        vector_store.delete_user_profile(user_email)
        
        # 2. Delete from Azure Search
        user_data_search_client.delete_documents([{
            'id': email_to_id(user_email)
        }])
        
        # 3. Delete related data
        # - Workout plans
        # - Food recommendations
        # - Activity logs
        
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

### Frontend Flow
```jsx
// In ProfilePage.jsx
const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure? This action cannot be undone.')) {
        const secondConfirm = window.prompt(
            'Type "DELETE" to confirm account deletion'
        );
        
        if (secondConfirm === 'DELETE') {
            try {
                const response = await fetch(`${getApiUrl('/delete-account')}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    // Clear local storage
                    localStorage.clear();
                    // Redirect to login
                    window.location.href = '/login';
                } else {
                    alert('Failed to delete account');
                }
            } catch (error) {
                console.error('Delete error:', error);
            }
        }
    }
};
```

## 🔐 Recommended Security Libraries

```bash
pip install bcrypt
pip install PyJWT
pip install Flask-Limiter
pip install email-validator
```

## ⚠️ Important Notes

1. **Backup before deletion**: Consider soft-delete (mark as deleted) instead of hard-delete
2. **GDPR compliance**: User has right to delete data
3. **Audit logging**: Log all security events (logins, deletions)
4. **2FA**: Consider adding two-factor authentication
5. **Password reset**: Email-based reset flow
6. **Session management**: Implement logout, token refresh

## 📝 Next Steps

Would you like me to:
1. ✅ Implement password hashing immediately (bcrypt)
2. ✅ Add delete account endpoint
3. ✅ Set up JWT authentication
4. ✅ Add rate limiting to login
5. ✅ All of the above

**Recommendation**: Start with #1 (password hashing) and #2 (delete account) today, then add JWT (#3) and rate limiting (#4) this week.
