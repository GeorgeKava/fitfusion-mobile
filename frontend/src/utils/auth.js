/**
 * Authentication Helper Functions
 * Handles JWT token storage, retrieval, and authenticated requests
 */

/**
 * Store authentication token and user data in localStorage
 */
export const login = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('userEmail', user.user_email || user.email);
};

/**
 * Clear authentication data from localStorage
 */
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('userEmail');
};

/**
 * Get stored authentication token
 */
export const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Get stored user data
 */
export const getUser = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('Failed to parse user data:', e);
      return null;
    }
  }
  return null;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  return !!getToken();
};

/**
 * Get headers for authenticated requests
 */
export const getAuthHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/**
 * Make an authenticated fetch request
 * Automatically includes auth token and handles 401 responses
 */
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  
  // Log warning if making authenticated request without token
  if (!token) {
    console.warn('[authFetch] No token found in localStorage for request:', url);
  }
  
  const headers = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });
  
  // If unauthorized, clear auth and redirect to login
  // BUT don't redirect if this is a delete-account request that succeeded
  if (response.status === 401 && !options.skipAuthRedirect) {
    console.warn('[authFetch] 401 Unauthorized - clearing auth and redirecting to login');
    logout();
    window.location.href = '/login';
    throw new Error('Authentication required');
  }
  
  return response;
};

/**
 * Decode JWT token (basic - doesn't verify signature)
 * Used to check token expiration on client side
 */
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode token:', e);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = () => {
  const token = getToken();
  if (!token) return true;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // Check if token expires in next 5 minutes (add buffer)
  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  
  return expirationTime < now + (5 * 60 * 1000);
};
