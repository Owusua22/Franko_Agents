// src/Redux/Slice/AxiosInstance.js
import axios from "axios";

const LAMBDA_BASE_URL = import.meta.env.VITE_LAMBDA_BASE_URL;
const LAMBDA_HEADER_NAME = import.meta.env.VITE_LAMBDA_HEADER_NAME || "Identifier";
const LAMBDA_HEADER_VALUE = import.meta.env.VITE_LAMBDA_HEADER_VALUE || "Franko";

if (!LAMBDA_BASE_URL) {
  console.error("❌ VITE_LAMBDA_BASE_URL is not defined");
}

const PUBLIC_ENDPOINTS = [
  "/Users/CustomerLogin",
  "/Users/CustomerRefreshToken",
  "/Users/ForgotPassword",
  "/Users/ResetPassword",
  "/Users/Customer-Post",
];

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

    if (user?.accessToken) {
      return { token: user.accessToken, source: "user" };
    }

    if (customer?.accessToken) {
      return { token: customer.accessToken, source: "customer" };
    }

    const accessToken = localStorage.getItem("accessToken");

    if (accessToken) {
      return { token: accessToken, source: "standalone" };
    }

    return null;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return true;
    }

    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;

    if (!exp) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 60;

    const expired = exp - bufferTime <= now;

    if (expired) {
      console.warn(
        `⚠️ Token expired at ${new Date(exp * 1000).toLocaleString()}`
      );
    }

    return expired;
  } catch (error) {
    console.error("❌ Error decoding token:", error);
    return true;
  }
};

let isRedirecting = false;

const handleUnauthorized = () => {
  if (isRedirecting) return;

  console.warn("🔐 Session expired or unauthorized - Redirecting to login");

  isRedirecting = true;

  localStorage.removeItem("user");
  localStorage.removeItem("customer");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("loginTime");
  localStorage.removeItem("lastActivity");
  localStorage.removeItem("lastActivityTimestamp");
  localStorage.removeItem("userType");

  sessionStorage.clear();

  window.dispatchEvent(new CustomEvent("auth:logout"));

  const currentPath = window.location.pathname;
  const isAuthPage = currentPath === "/" || currentPath === "/auth";

  if (!isAuthPage) {
    sessionStorage.setItem("redirectAfterLogin", currentPath);
    window.location.href = "/";
  }

  setTimeout(() => {
    isRedirecting = false;
  }, 2000);
};

const getRequestEndpoint = (config) => {
  return config?.params?.endpoint || config?.url || "";
};

const isPublicEndpoint = (config) => {
  if (config?.skipAuth === true) return true;

  const requestEndpoint = getRequestEndpoint(config).toLowerCase();

  return PUBLIC_ENDPOINTS.some((endpoint) =>
    requestEndpoint.includes(endpoint.toLowerCase())
  );
};

const cancelRequest = (message) => {
  return Promise.reject(new axios.CanceledError(message));
};

const axiosInstance = axios.create({
  baseURL: LAMBDA_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    [LAMBDA_HEADER_NAME]: LAMBDA_HEADER_VALUE,
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    config.headers[LAMBDA_HEADER_NAME] = LAMBDA_HEADER_VALUE;

    const authData = getAuthToken();
    const publicEndpoint = isPublicEndpoint(config);

    /**
     * Important:
     * Login/register/forgot-password endpoints must be allowed without token.
     */
    if (publicEndpoint) {
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      } else if (
        config.data &&
        !config.headers["Content-Type"] &&
        typeof config.data === "object"
      ) {
        config.headers["Content-Type"] = "application/json";
      }

      if (import.meta.env.DEV) {
        console.log(
          `📤 PUBLIC ${config.method?.toUpperCase()} ${getRequestEndpoint(config)}`
        );
      }

      return config;
    }

    /**
     * Protected endpoint.
     * If caller supplied Authorization manually, respect it.
     */
    if (config.headers.Authorization) {
      return config;
    }

    /**
     * No token found.
     *
     * If skipAutoLogout is true, allow request to continue.
     * This lets customerSlice handle 401 and token refresh.
     */
    if (!authData?.token) {
      if (config.skipAutoLogout === true) {
        return config;
      }

      console.warn("⚠️ No auth token found for protected endpoint");
      handleUnauthorized();
      return cancelRequest("No auth token");
    }

    const { token, source } = authData;

    /**
     * Expired token.
     *
     * If skipAutoLogout is true, let request go to backend.
     * customerSlice can then refresh token after receiving 401.
     */
    if (isTokenExpired(token)) {
      console.warn(`⚠️ Token from ${source} is expired`);

      if (config.skipAutoLogout === true) {
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      }

      handleUnauthorized();
      return cancelRequest("Token expired");
    }

    config.headers.Authorization = `Bearer ${token}`;

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else if (
      config.data &&
      !config.headers["Content-Type"] &&
      typeof config.data === "object"
    ) {
      config.headers["Content-Type"] = "application/json";
    }

    if (import.meta.env.DEV) {
      console.log(
        `📤 ${config.method?.toUpperCase()} ${getRequestEndpoint(config)}`
      );
    }

    return config;
  },
  (error) => {
    console.error("❌ Request setup failed:", error);
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(
        `✅ ${response.config.method?.toUpperCase()} ${getRequestEndpoint(
          response.config
        )} → ${response.status}`
      );
    }

    if (
      response.data?.tokenExpired ||
      response.data?.sessionExpired
    ) {
      if (response.config?.skipAutoLogout === true) {
        return Promise.reject(new Error("Session expired"));
      }

      handleUnauthorized();
      return Promise.reject(new Error("Session expired"));
    }

    return response;
  },
  (error) => {
    if (axios.isCancel(error)) {
      console.log("Request cancelled:", error.message);
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const config = error.config || {};

    if (import.meta.env.DEV) {
      console.error(
        `❌ ${config.method?.toUpperCase()} ${getRequestEndpoint(config)} → ${
          status || "Network error"
        }`
      );
    }

    /**
     * Let Redux/customerSlice handle 401 when requested.
     * This is needed for token refresh logic.
     */
    if (status === 401) {
      if (config.skipAutoLogout === true) {
        return Promise.reject(error);
      }

      handleUnauthorized();
      return Promise.reject(error);
    }

    if (status === 403) {
      console.warn("🚫 Forbidden access");

      if (
        !config.skipAutoLogout &&
        error.response?.data?.message?.toLowerCase?.().includes("token")
      ) {
        handleUnauthorized();
      }
    }

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

axiosInstance.checkTokenValidity = () => {
  const authData = getAuthToken();

  if (!authData?.token) return false;

  return !isTokenExpired(authData.token);
};

axiosInstance.logout = () => {
  handleUnauthorized();
};

window.addEventListener("storage", (e) => {
  if (e.key === "user" || e.key === "customer" || e.key === "accessToken") {
    const authData = getAuthToken();

    if (authData?.token && isTokenExpired(authData.token)) {
      handleUnauthorized();
    }
  }
});

export default axiosInstance;