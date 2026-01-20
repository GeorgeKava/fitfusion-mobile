# API Security Update - Authentication Required

## Overview
All main API endpoints now require JWT authentication. Users must be logged in to access these features.

## Endpoints Requiring Authentication (✅ Protected)

### Fitness & Workout Endpoints
- **POST** `/api/fitness_recommendation` - Get AI fitness recommendations
- **GET** `/api/get-weekly-plan` - Get weekly workout plan
- **POST** `/api/generate-weekly-plan` - Generate new weekly plan

### Food & Nutrition Endpoints
- **POST** `/api/food_recommendations` - Get personalized food recommendations
- **POST** `/api/identify_food` - Identify food from image

### User Management Endpoints
- **GET** `/api/get-user-profile/<email>` - Get user profile (already had auth)
- **DELETE** `/api/delete-account` - Delete user account (already had auth)

### Admin/Debug Endpoints
- **POST** `/api/search-users` - Semantic search for users
- **GET** `/api/vector-store/stats` - Get vector store statistics
- **GET** `/api/vector-store/test` - Test vector store functionality
- **GET** `/api/list-all-users` - List all users in database

## Public Endpoints (No Authentication Required)

### Authentication Endpoints
- **POST** `/api/create-user-profile` - Register new user
- **POST** `/api/login` - User login

### Utility Endpoints
- **GET** `/favicon.ico` - Favicon
- **GET** `/video_feed` - Video feed (if used)

## Security Benefits

✅ **Prevents Unauthorized API Usage**
- Anonymous users cannot generate expensive AI recommendations
- Protects against API abuse and excessive costs

✅ **User Data Protection**
- Users can only access their own data
- Prevents data leakage between users

✅ **Rate Limiting**
- Rate limits now tied to authenticated users
- Prevents single user from overwhelming the system

✅ **Audit Trail**
- All API calls are now tied to a specific user
- Better logging and monitoring capabilities

## How Authentication Works

1. User registers or logs in → Receives JWT token
2. Frontend stores token in `localStorage`
3. All API requests include token in `Authorization` header:
   ```
   Authorization: Bearer <jwt-token>
   ```
4. Backend validates token using `@require_auth` decorator
5. If valid, request proceeds; if invalid, returns 401 Unauthorized

## Testing Authentication

### Valid Request (with token):
```bash
curl -X POST http://localhost:5001/api/fitness_recommendation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gender": "male", "age": "25", "weight": "70", "height": "175"}'
```

### Invalid Request (no token):
```bash
curl -X POST http://localhost:5001/api/fitness_recommendation \
  -H "Content-Type: application/json" \
  -d '{"gender": "male", "age": "25", "weight": "70", "height": "175"}'
# Returns: 401 Unauthorized
```

## Implementation Details

- **Decorator Used:** `@require_auth` from `auth_utils.py`
- **Token Algorithm:** HS256 (HMAC with SHA-256)
- **Token Expiration:** 24 hours
- **Token Storage:** Client-side in localStorage
- **Validation:** On every protected endpoint request

## Next Steps for Production

1. ✅ Enable HTTPS (encrypt tokens in transit)
2. ✅ Rotate JWT secret key regularly
3. ✅ Implement token refresh mechanism
4. ✅ Add token revocation on logout
5. ✅ Monitor failed authentication attempts

---

**Last Updated:** December 9, 2025
**Status:** ✅ Implemented and Active
