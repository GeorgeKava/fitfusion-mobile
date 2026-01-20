# Input Validation Implementation

## Overview
Comprehensive input validation has been implemented across all API endpoints to prevent injection attacks, data corruption, and ensure data integrity.

## Validation Module: `input_validator.py`

### Key Features

#### 1. **Data Type Validation**
- **Integers**: Age (13-120), with range checks
- **Floats**: Weight (20-500 kg), Height (50-300 cm)
- **Enums**: Gender, Agent Type, Activity Levels
- **Strings**: Max lengths enforced, dangerous characters removed

#### 2. **Security Measures**
✅ **SQL/NoSQL Injection Prevention**
- Removes null bytes (`\x00`)
- Strips control characters
- Validates data types before database operations

✅ **XSS Prevention**
- Sanitizes text input
- Removes unprintable characters (except newlines/tabs)
- Enforces maximum lengths

✅ **Path Traversal Prevention**
- Sanitizes filenames
- Removes `../` and `..\\` patterns
- Validates file extensions

✅ **File Upload Security**
- Validates file extensions (only allowed: jpg, jpeg, png, gif, bmp, webp)
- Enforces file size limits (10MB max)
- Generates safe filenames with UUID

#### 3. **Business Logic Validation**
- Age: 13-120 years
- Weight: 20-500 kg
- Height: 50-300 cm
- Gender: male, female, other, prefer_not_to_say
- Agent types: general, strength, cardio, weight_loss, muscle_gain, endurance
- Name: max 100 characters
- Email: max 255 characters, proper format
- Health conditions: max 2000 characters
- General text: max 5000 characters

## Protected Endpoints

### ✅ `/api/fitness_recommendation` (POST)
**Validates:**
- Gender (required, enum)
- Age (required, 13-120)
- Weight (required, 20-500 kg)
- Height (required, 50-300 cm)
- Health conditions (optional, max 2000 chars, sanitized)
- Agent type (optional, enum, default: general)

**Prevents:**
- Invalid numeric values
- Out-of-range values
- SQL injection in text fields
- Malformed requests

### ✅ `/api/create-user-profile` (POST)
**Validates:**
- Email (required, proper format, max 255 chars)
- Password (required, 8+ chars, complexity rules)
- Name (required, max 100 chars, sanitized)
- Age (optional, 13-120)
- Weight (optional, 20-500 kg)
- Height (optional, 50-300 cm)
- Gender (optional, enum)

**Prevents:**
- Weak passwords
- Invalid email formats
- Injection attacks in name fields
- Malicious profile data

### ✅ `/api/food_recommendations` (POST)
**Validates:**
- Same as fitness_recommendation (gender, age, weight, height)
- Fitness goal (optional, sanitized, max 100 chars)
- Dietary restrictions (optional, sanitized, max 5000 chars)
- Meal preferences (optional, sanitized, max 5000 chars)

**Prevents:**
- Injection attacks in dietary restrictions
- Malformed meal preferences
- Invalid fitness data

### ✅ `/api/identify_food` (POST)
**Validates:**
- Image file (required)
- File extension (jpg, jpeg, png, gif, bmp, webp only)
- File size (max 10MB)
- Filename (sanitized to prevent path traversal)
- Fitness goal (optional, sanitized)
- Dietary restrictions (optional, sanitized)

**Prevents:**
- Malicious file uploads
- Path traversal attacks (`../../../etc/passwd`)
- Executable files disguised as images
- Oversized files (DoS attacks)

### ✅ `/api/login` (POST)
**Already Protected:**
- Email validation (format, normalization)
- Password presence check
- Rate limiting (5/minute)
- Timing attack prevention (same error for non-existent users and wrong passwords)

## Validation Examples

### ✅ Valid Request
```json
{
  "gender": "male",
  "age": 25,
  "weight": 70.5,
  "height": 175,
  "health_conditions": "None",
  "agent_type": "strength"
}
```

### ❌ Invalid Requests (Rejected)

**Out of range age:**
```json
{
  "gender": "male",
  "age": 150,  // ❌ Age must be between 13 and 120
  "weight": 70,
  "height": 175
}
```
**Response:** `400 Bad Request - "Age must be between 13 and 120"`

**Invalid gender:**
```json
{
  "gender": "alien",  // ❌ Not in allowed values
  "age": 25,
  "weight": 70,
  "height": 175
}
```
**Response:** `400 Bad Request - "Gender must be one of: male, female, other, prefer_not_to_say"`

**SQL injection attempt:**
```json
{
  "gender": "male",
  "age": 25,
  "weight": 70,
  "height": 175,
  "health_conditions": "'; DROP TABLE users; --"  // ❌ Sanitized
}
```
**Result:** Special characters removed, text sanitized before processing

**Malicious file upload:**
```
POST /api/identify_food
File: evil_script.exe
```
**Response:** `400 Bad Request - "Image must be one of: jpg, jpeg, png, gif, bmp, webp"`

## Error Responses

All validation errors return consistent format:
```json
{
  "success": false,
  "error": "Specific error message",
  "message": "Invalid input data"
}
```

## Security Benefits

### 1. **Injection Attack Prevention**
- ✅ SQL injection blocked by type validation and sanitization
- ✅ NoSQL injection blocked by type checking
- ✅ Command injection blocked by input sanitization

### 2. **Data Integrity**
- ✅ Only valid data enters the database
- ✅ Consistent data types enforced
- ✅ Business rules validated before processing

### 3. **DoS Prevention**
- ✅ File size limits prevent storage exhaustion
- ✅ String length limits prevent memory exhaustion
- ✅ Numeric range checks prevent calculation errors

### 4. **XSS Prevention**
- ✅ Dangerous characters removed from text
- ✅ Control characters stripped
- ✅ Safe for display in frontend

## Testing Validation

### Test Invalid Age
```bash
curl -X POST http://localhost:5001/api/fitness_recommendation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "gender=male" \
  -F "age=200" \
  -F "weight=70" \
  -F "height=175"

# Expected: 400 - "Age must be between 13 and 120"
```

### Test Invalid File Type
```bash
curl -X POST http://localhost:5001/api/identify_food \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@malicious.exe"

# Expected: 400 - "Image must be one of: jpg, jpeg, png, gif, bmp, webp"
```

### Test SQL Injection
```bash
curl -X POST http://localhost:5001/api/fitness_recommendation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "gender=male" \
  -F "age=25" \
  -F "weight=70" \
  -F "height=175" \
  -F "health_conditions='; DROP TABLE users; --"

# Expected: Input sanitized, no SQL executed
```

## Implementation Details

- **Module:** `backend/input_validator.py`
- **Import:** Added to `backend/app.py`
- **Validation:** Applied to all user input endpoints
- **Sanitization:** Automatic for all text fields
- **Error Handling:** Consistent error responses

## Next Steps for Production

1. ✅ **Completed:** Input validation
2. ⏭️ **Consider:** Add Content Security Policy (CSP) headers
3. ⏭️ **Consider:** Implement request signing for API calls
4. ⏭️ **Consider:** Add honeypot fields for bot detection

---

**Last Updated:** December 10, 2025  
**Status:** ✅ Implemented and Active
