// src/Redux/Slice/AxiosInstance.js
import axios from "axios";

const LAMBDA_BASE_URL = import.meta.env.VITE_LAMBDA_BASE_URL;
const LAMBDA_HEADER_NAME = import.meta.env.VITE_LAMBDA_HEADER_NAME || "Identifier";
const LAMBDA_HEADER_VALUE = import.meta.env.VITE_LAMBDA_HEADER_VALUE || "Franko";

if (!LAMBDA_BASE_URL) {
  console.error("❌ VITE_LAMBDA_BASE_URL is not defined");
}

const safeGetFromStorage = (key) => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    if (value === "[object Object]") {
      localStorage.removeItem(key);
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch {
    return null;
  }
};

const getAuthToken = () => {
  try {
    const user = safeGetFromStorage("user");
    const customer = safeGetFromStorage("customer");
    
    // Check user object first, then customer object
    if (user?.accessToken) return { token: user.accessToken, source: 'user' };
    if (customer?.accessToken) return { token: customer.accessToken, source: 'customer' };
    
    // Check standalone tokens
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) return { token: accessToken, source: 'standalone' };
    
    return null;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    
    if (!exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 60; // 1 minute buffer
    
    const isExpired = (exp - bufferTime) <= now;
    
    if (isExpired) {
      console.warn(`⚠️ Token expired at ${new Date(exp * 1000).toLocaleString()}, current time: ${new Date(now * 1000).toLocaleString()}`);
    }
    
    return isExpired;
  } catch (error) {
    console.error("❌ Error decoding token:", error);
    return true;
  }
};

// Store redirect flag to prevent multiple redirects
let isRedirecting = false;

const handleUnauthorized = () => {
  // Prevent multiple redirects
  if (isRedirecting) return;
  
  console.warn("🔐 Session expired or unauthorized - Redirecting to login");
  
  // Set redirect flag
  isRedirecting = true;
  
  // Clear all auth-related data
  localStorage.removeItem("user");
  localStorage.removeItem("customer");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("loginTime");
  localStorage.removeItem("lastActivity");
  localStorage.removeItem("userType");
  
  // Clear any session storage
  sessionStorage.clear();
  
  // Dispatch custom event for Redux store updates
  window.dispatchEvent(new CustomEvent('auth:logout'));
  
  // Check if we're already on the login page to prevent redirect loop
  const currentPath = window.location.pathname;
  const isAuthPage = currentPath === '/' || currentPath === '/auth';
  
  if (!isAuthPage) {
    // Store the intended URL for redirect after login
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    // Redirect to login page
    window.location.href = "/";
  }
  
  // Reset redirect flag after a delay
  setTimeout(() => {
    isRedirecting = false;
  }, 2000);
};

// Check token validity before making requests

const axiosInstance = axios.create({
  baseURL: LAMBDA_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    [LAMBDA_HEADER_NAME]: LAMBDA_HEADER_VALUE,
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    config.headers[LAMBDA_HEADER_NAME] = LAMBDA_HEADER_VALUE;

    // Check token expiration before making request
    const authData = getAuthToken();
    
    if (!config.headers.Authorization && authData) {
      const { token, source } = authData;
      
      // Check if token is expired
      if (isTokenExpired(token)) {
        console.warn(`⚠️ Token from ${source} is expired`);
        handleUnauthorized();
        
        // Create a cancel token to abort the request
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();
        config.cancelToken = source.token;
        source.cancel('Token expired');
        
        return config;
      }
      
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!authData && !config.headers.Authorization) {
      // No auth data found, but some endpoints might be public
      // Only redirect for protected routes
      const publicEndpoints = ['/auth', '/login', '/register', '/public'];
      const isPublicEndpoint = publicEndpoints.some(endpoint => 
        config.url?.includes(endpoint)
      );
      
      if (!isPublicEndpoint) {
        console.warn("⚠️ No auth token found for protected endpoint");
        handleUnauthorized();
        
        // Create a cancel token to abort the request
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();
        config.cancelToken = source.token;
        source.cancel('No auth token');
        
        return config;
      }
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else if (
      config.data &&
      !config.headers["Content-Type"] &&
      typeof config.data === "object"
    ) {
      config.headers["Content-Type"] = "application/json";
    }

    config.params = {
      ...(config.params || {}),
    };

    if (import.meta.env.DEV) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("❌ Request setup failed:", error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`);
    }
    
    // Check if the response contains expired token information
    if (response.data?.tokenExpired || response.data?.sessionExpired) {
      handleUnauthorized();
      return Promise.reject(new Error("Session expired"));
    }
    
    return response;
  },
  (error) => {
    // If the request was cancelled due to token expiration, don't show error
    if (axios.isCancel(error)) {
      console.log("Request cancelled:", error.message);
      return Promise.reject(error);
    }
    
    const status = error.response?.status;

    if (import.meta.env.DEV) {
      console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status || "Network error"}`);
    }

    // Handle 401 Unauthorized
    if (status === 401) {
      // Check if token expired from response headers
      const tokenExpired = error.response?.headers?.['token-expired'] === 'true';
      const sessionExpired = error.response?.data?.message?.toLowerCase().includes('expired');
      
      if (tokenExpired || sessionExpired) {
        console.warn("🔐 Token expired (from response)");
      }
      
      handleUnauthorized();
      return Promise.reject(error);
    }

    // Handle 403 Forbidden (might indicate role change or permission issues)
    if (status === 403) {
      console.warn("🚫 Forbidden access - possible permission issue");
      
      // Check if it's a token-related forbidden
      if (error.response?.data?.message?.toLowerCase().includes('token')) {
        handleUnauthorized();
      }
    }

    // Handle other errors
    if (error.code === "ECONNABORTED") {
      console.error("⏱ Request timed out");
    } else if (error.message === "Network Error") {
      console.error("📡 Network unreachable");
    } else if (status === 429) {
      console.warn("⚠️ Rate limited - too many requests");
    } else if (status >= 500) {
      console.error("💥 Server error");
    }

    return Promise.reject(error);
  }
);

// Add a method to check token validity
axiosInstance.checkTokenValidity = () => {
  const authData = getAuthToken();
  if (!authData) return false;
  
  const { token } = authData;
  return !isTokenExpired(token);
};

// Add a method to manually trigger logout
axiosInstance.logout = () => {
  handleUnauthorized();
};

// Listen for storage events (for multi-tab support)
window.addEventListener('storage', (e) => {
  if (e.key === 'user' || e.key === 'customer' || e.key === 'accessToken') {
    const authData = getAuthToken();
    if (authData && isTokenExpired(authData.token)) {
      handleUnauthorized();
    }
  }
});

export default axiosInstance;