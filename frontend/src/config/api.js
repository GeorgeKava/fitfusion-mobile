// API Configuration for Web and Mobile
const API_CONFIG = {
  // Development configuration
  DEV: {
    baseURL: 'http://localhost:5001',
    apiPath: '/api'
  },
  
  // Mobile development (local network)
  MOBILE: {
    baseURL: 'http://192.168.1.214:5001', // Your Mac's local IP
    apiPath: '/api'
  },
  
  // Production configuration - Direct Azure Backend  
  PRODUCTION: {
    baseURL: process.env.REACT_APP_API_URL || 'http://4.157.57.254:8000',
    apiPath: '/api'
  }
};

// Detect if running on mobile (Capacitor)
const isMobile = () => {
  return window.Capacitor !== undefined;
};

// Get the appropriate configuration
const getConfig = () => {
  // Production mode (both web and mobile)
  if (process.env.NODE_ENV === 'production') {
    return API_CONFIG.PRODUCTION;
  }
  
  // Mobile development
  if (isMobile()) {
    return API_CONFIG.MOBILE;
  }
  
  // Local development
  return API_CONFIG.DEV;
};

// Export the base URL for API calls
export const API_BASE_URL = getConfig().baseURL;
export const API_PATH = getConfig().apiPath;
export const getApiUrl = (endpoint) => `${API_BASE_URL}${API_PATH}${endpoint}`;

// Helper to log API calls in development
export const logApiCall = (endpoint, method = 'GET') => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API ${method}] ${getApiUrl(endpoint)}`);
  }
};

export default {
  API_BASE_URL,
  API_PATH,
  getApiUrl,
  isMobile,
  logApiCall
};
