# API Configuration Summary

## Configuration File
Location: `frontend/src/config/api.js`

## Current Settings

### Web Development
- Base URL: `http://localhost:5001`
- API Path: `/api`
- Full URL: `http://localhost:5001/api`

### Mobile (iOS)
- Base URL: `http://192.168.1.214:5001` (Your Mac's local IP)
- API Path: `/api`
- Full URL: `http://192.168.1.214:5001/api`

## How It Works

The app automatically detects if it's running on mobile using Capacitor and switches to the appropriate configuration:

```javascript
// Detects if running on mobile
const isMobile = () => window.Capacitor !== undefined;

// Returns the correct base URL
export const API_BASE_URL = isMobile() ? 
  'http://192.168.1.214:5001' : 
  'http://localhost:5001';
```

## Updated Components

All API calls have been updated to use the `getApiUrl()` helper:

✅ ProfilePage.jsx
✅ ActivityLogger.jsx  
✅ FoodRecommendationsPage.jsx
✅ ProgressPage.jsx
✅ RegisterPage.jsx
✅ IdentifyFoodPage.jsx
✅ FitnessAdvisorPage.jsx
✅ VoiceChatWebRTC.jsx
✅ WeeklyPlanPage.jsx

## Example Usage

```javascript
import { getApiUrl } from '../config/api';

// Before (hardcoded):
fetch('http://localhost:5001/api/fitness_recommendation', ...)

// After (dynamic):
fetch(getApiUrl('/fitness_recommendation'), ...)
```

## Network Requirements

For mobile devices to connect:
- ✅ Backend must be running on your Mac
- ✅ Mac and iPhone must be on the same WiFi network
- ✅ Mac's firewall must allow incoming connections on port 5001

## Production Deployment

For production, update the `MOBILE` configuration in `api.js` to use your cloud backend URL:

```javascript
MOBILE: {
  baseURL: 'https://your-backend.herokuapp.com',
  apiPath: '/api'
}
```

## Testing

To verify the configuration is working:

1. Check backend is accessible:
   ```bash
   curl http://192.168.1.214:5001/api/health-check
   ```

2. On iPhone Safari, navigate to:
   ```
   http://192.168.1.214:5001/api/health-check
   ```

3. Look for API logs in the browser/Xcode console:
   ```
   [API GET] http://192.168.1.214:5001/api/get-user-profile/user@email.com
   ```
