// src/Redux/Slice/customerSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "./AxiosInstance";

const CUSTOMER_KEY = "customer";

/* ─────────────────────────────────────────────
   Safe Storage Helpers
───────────────────────────────────────────── */
const safeParseJSON = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

const safeGetFromStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    if (typeof data === "object" && data !== null) return data;
    if (typeof data === "string" && data === "[object Object]") {
      localStorage.removeItem(key);
      return null;
    }
    return safeParseJSON(data);
  } catch { return null; }
};

const safeSetToStorage = (key, value) => {
  try {
    if (!value) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch {}
};

const clearStorage = () => {
  try { localStorage.removeItem(CUSTOMER_KEY); } catch {}
};

/* ─────────────────────────────────────────────
   Global 401 / Inactivity Redirect Handler
───────────────────────────────────────────── */
const forceLogoutAndRedirect = (dispatch) => {
  clearStorage();
  if (dispatch) {
    try {
      dispatch({ type: "customer/logoutCustomer" });
    } catch (e) {
      // Ignore dispatch errors during forced logout
    }
  }
  // Hard redirect back to home to prevent bad UX
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
};

const validateCustomerData = (customerData) => {
  if (!customerData || typeof customerData !== "object") return false;
  return !!(
    customerData.contactNumber &&
    typeof customerData.contactNumber === "string" &&
    customerData.contactNumber.trim() !== ""
  );
};

const loadFromStorage = () => {
  const stored = safeGetFromStorage(CUSTOMER_KEY);
  if (!stored || typeof stored !== "object") return null;
  const hasIdentity = stored.contactNumber || stored.customerAccountNumber || stored.accessToken;
  return hasIdentity ? stored : null;
};

const saveToStorage = (customer) => {
  if (!customer) { clearStorage(); return; }
  safeSetToStorage(CUSTOMER_KEY, { ...customer, lastUpdated: Date.now() });
};

/* ─────────────────────────────────────────────
   Backend & Auth Helpers
───────────────────────────────────────────── */
const callBackend = async ({ endpoint, method = "GET", data, extraParams = {}, headers = {} }) => {
  const config = { method, url: "/", params: { endpoint, ...extraParams }, headers };
  if (data) config.data = data;
  return axiosInstance(config);
};

const buildAuthHeaders = (providedToken = null) => {
  const stored = loadFromStorage();
  const accessToken = providedToken || stored?.accessToken;
  const headers = { "Content-Type": "application/json" };
  if (accessToken && typeof accessToken === "string" && accessToken.trim() !== "") {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
};

const refreshCustomerToken = async (refreshToken) => {
  const res = await callBackend({
    endpoint: "/Users/CustomerRefreshToken",
    method: "POST",
    data: { refreshToken },
    headers: { "Content-Type": "application/json" },
  });
  const data = safeParseJSON(res.data);
  if (!res.status || res.status < 200 || res.status >= 300 || data?.response?.responseCode !== "1") {
    throw new Error(data?.response?.responseMessage || "Token refresh failed");
  }
  return data;
};

let refreshPromise = null;

const silentTokenRefresh = async (dispatch) => {
  if (refreshPromise) return refreshPromise;
  try {
    const stored = loadFromStorage();
    const refreshToken = stored?.refreshToken;

    if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim() === "") {
      forceLogoutAndRedirect(dispatch);
      return null;
    }

    refreshPromise = refreshCustomerToken(refreshToken);
    const refreshed = await refreshPromise;

    const updatedTokens = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
    const updatedCustomer = { ...stored, ...updatedTokens, lastTokenRefresh: Date.now() };

    saveToStorage(updatedCustomer);
    if (dispatch) dispatch({ type: "customer/updateToken", payload: updatedTokens });

    refreshPromise = null;
    return updatedTokens.accessToken;
  } catch (error) {
    refreshPromise = null;
    forceLogoutAndRedirect(dispatch);
    return null;
  }
};

/* ─────────────────────────────────────────────
   Request Wrapper with Activity Check & Auto-Refresh
───────────────────────────────────────────── */
const requestWithAutoRefresh = async ({ endpoint, method = "GET", data, extraParams = {}, providedToken = null, dispatch = null }) => {
  let headers = buildAuthHeaders(providedToken);
  let res;

  try {
    res = await callBackend({ endpoint, method, data, extraParams, headers });
  } catch (error) {
    if (error?.response?.status !== 401) throw error;
    res = error.response;
  }

  if (res.status !== 401) return res;

  // 1️⃣ Check User Activity
  const lastActivity = parseInt(localStorage.getItem("lastActivityTimestamp") || "0", 10);
  const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 mins
  const isUserActive = (Date.now() - lastActivity) < INACTIVITY_LIMIT;

  // If inactive → immediate logout & redirect (Bad UX prevention)
  if (!isUserActive) {
    forceLogoutAndRedirect(dispatch);
    throw new Error("SESSION_EXPIRED");
  }

  // 2️⃣ Active user → attempt token refresh
  if (dispatch) {
    const newAccessToken = await silentTokenRefresh(dispatch);
    if (newAccessToken) {
      headers = buildAuthHeaders(newAccessToken);
      const retryRes = await callBackend({ endpoint, method, data, extraParams, headers });
      if (retryRes.status === 401) {
        forceLogoutAndRedirect(dispatch);
        throw new Error("SESSION_EXPIRED");
      }
      return retryRes;
    }
    throw new Error("SESSION_EXPIRED");
  }

  // Fallback for non-Redux calls
  const stored = loadFromStorage();
  const refreshToken = stored?.refreshToken;
  if (!refreshToken) {
    forceLogoutAndRedirect();
    throw new Error("SESSION_EXPIRED");
  }

  try {
    const refreshed = await refreshCustomerToken(refreshToken);
    const updatedTokens = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
    saveToStorage({ ...stored, ...updatedTokens, lastTokenRefresh: Date.now() });

    headers = buildAuthHeaders(updatedTokens.accessToken);
    const retryRes = await callBackend({ endpoint, method, data, extraParams, headers });
    
    if (retryRes.status === 401) {
      forceLogoutAndRedirect();
      throw new Error("SESSION_EXPIRED");
    }
    return retryRes;
  } catch {
    forceLogoutAndRedirect();
    throw new Error("SESSION_EXPIRED");
  }
};

/* ─────────────────────────────────────────────
   Async Thunks
───────────────────────────────────────────── */
export const createCustomer = createAsyncThunk("customer/createCustomer", async (customerData, { rejectWithValue }) => {
  try {
    if (!validateCustomerData(customerData)) return rejectWithValue({ message: "Invalid customer data provided.", responseCode: "0" });
    const res = await callBackend({ endpoint: "/Users/Customer-Post", method: "POST", data: customerData, headers: { "Content-Type": "application/json" } });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300) return rejectWithValue({ message: data?.ResponseMessage || "Registration failed.", responseCode: data?.ResponseCode || String(res.status) });
    return data;
  } catch (error) { return rejectWithValue({ message: error.message || "Registration failed.", responseCode: "0" }); }
});

export const loginCustomer = createAsyncThunk("customer/loginCustomer", async ({ contactNumber, password }, { dispatch, rejectWithValue }) => {
  try {
    if (!contactNumber || !password) return rejectWithValue({ message: "Contact number and password are required.", responseCode: "0", isAccountNotFound: false });
    const res = await callBackend({ endpoint: "/Users/CustomerLogin", method: "POST", data: { contactNumber, password, FullName: "N/A" }, headers: { "Content-Type": "application/json" } });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300) return rejectWithValue({ message: data?.response?.responseMessage || "Login failed.", responseCode: data?.response?.responseCode || String(res.status), isAccountNotFound: false });
    if (data?.response?.responseCode !== "1") return rejectWithValue({ message: data?.response?.responseMessage || "Access Denied", responseCode: data?.response?.responseCode || "0", isAccountNotFound: false });
    
    const tempCustomer = { contactNumber, accessToken: data.accessToken, refreshToken: data.refreshToken, loginStatus: true, isAuthenticated: true, loginTime: Date.now() };
    saveToStorage(tempCustomer);

    try {
      const profile = await dispatch(getCustomerById({ contactNumber, accessToken: data.accessToken })).unwrap();
      const mergedCustomer = { ...profile, ...tempCustomer };
      saveToStorage(mergedCustomer);
      return mergedCustomer;
    } catch {
      saveToStorage(tempCustomer);
      return tempCustomer;
    }
  } catch (error) { return rejectWithValue({ message: error.message || "Login failed.", responseCode: "0", isAccountNotFound: false }); }
});

export const fetchCustomers = createAsyncThunk("customer/fetchCustomers", async (_, { rejectWithValue, dispatch }) => {
  try {
    const res = await requestWithAutoRefresh({ endpoint: "/Users/Customer-Get", method: "GET", dispatch });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300) return rejectWithValue({ message: data?.ResponseMessage || "Failed to fetch customers.", responseCode: data?.ResponseCode || String(res.status) });
    return Array.isArray(data) ? data : [data].filter(Boolean);
  } catch (error) { return rejectWithValue({ message: error.message || "Failed to fetch customers.", responseCode: error.message === "SESSION_EXPIRED" ? "401" : "0" }); }
});

export const getCustomerById = createAsyncThunk("customer/getCustomerById", async ({ contactNumber, accessToken = null }, { rejectWithValue, dispatch }) => {
  try {
    const res = await requestWithAutoRefresh({ endpoint: "/Users/GetCustomerById", method: "GET", extraParams: { contactNumber }, providedToken: accessToken, dispatch });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300) return rejectWithValue({ message: data?.ResponseMessage || "Failed to fetch customer.", responseCode: data?.ResponseCode || String(res.status) });
    const customer = Array.isArray(data) ? data[0] : data;
    return customer;
  } catch (error) { return rejectWithValue({ message: error.message || "Failed to fetch customer.", responseCode: error.message === "SESSION_EXPIRED" ? "401" : "0" }); }
});

export const updateCustomerPassword = createAsyncThunk("customer/updateCustomerPassword", async ({ contactNumber, oldPassword, newPassword }, { rejectWithValue, dispatch }) => {
  try {
    const res = await requestWithAutoRefresh({ endpoint: "/Users/UpdateCustomerPassword", method: "POST", data: { contactNumber, oldPassword, newPassword }, dispatch });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300 || data?.ResponseCode !== "1") return rejectWithValue({ message: data?.ResponseMessage || "Password update failed.", responseCode: data?.ResponseCode || String(res.status) });
    return data;
  } catch (error) { return rejectWithValue({ message: error.message || "Password update failed.", responseCode: error.message === "SESSION_EXPIRED" ? "401" : "0" }); }
});

export const updateAccountStatus = createAsyncThunk("customer/updateAccountStatus", async (_, { getState, rejectWithValue, dispatch }) => {
  try {
    const customer = getState().customer.currentCustomer;
    const res = await requestWithAutoRefresh({ endpoint: "/Users/Customer-Status", method: "POST", data: { accountNumber: customer.customerAccountNumber, accountStatus: "0" }, dispatch });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300) return rejectWithValue({ message: data?.ResponseMessage || "Status update failed.", responseCode: data?.ResponseCode || String(res.status) });
    clearStorage();
    return data;
  } catch (error) { return rejectWithValue({ message: error.message || "Status update failed.", responseCode: error.message === "SESSION_EXPIRED" ? "401" : "0" }); }
});

export const forgotPassword = createAsyncThunk("customer/forgotPassword", async ({ contactNumber, email }, { rejectWithValue }) => {
  try {
    const res = await callBackend({ endpoint: "/Users/ForgotPassword", method: "POST", data: { contactNumber, email }, headers: { "Content-Type": "application/json" } });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300 || data?.ResponseCode !== "1") return rejectWithValue({ message: data?.ResponseMessage || "Password reset request failed.", responseCode: data?.ResponseCode || String(res.status) });
    return data;
  } catch (error) { return rejectWithValue({ message: error.message || "Password reset request failed.", responseCode: "0" }); }
});

export const resetPassword = createAsyncThunk("customer/resetPassword", async ({ contactNumber, token, newPassword }, { rejectWithValue }) => {
  try {
    const res = await callBackend({ endpoint: "/Users/ResetPassword", method: "POST", data: { contactNumber, token, newPassword }, headers: { "Content-Type": "application/json" } });
    const data = safeParseJSON(res.data);
    if (res.status < 200 || res.status >= 300 || data?.ResponseCode !== "1") return rejectWithValue({ message: data?.ResponseMessage || "Password reset failed.", responseCode: data?.ResponseCode || String(res.status) });
    return data;
  } catch (error) { return rejectWithValue({ message: error.message || "Password reset failed.", responseCode: "0" }); }
});

/* ─────────────────────────────────────────────
   Slice & Reducers
───────────────────────────────────────────── */
const hydrated = loadFromStorage();
const initialState = {
  currentCustomer: hydrated,
  currentCustomerDetails: hydrated,
  customerList: [],
  loading: false,
  error: null,
  isAuthenticated: !!(hydrated?.accessToken && typeof hydrated.accessToken === "string" && hydrated.accessToken.trim() !== ""),
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    logoutCustomer: (state) => {
      state.currentCustomer = null;
      state.currentCustomerDetails = null;
      state.customerList = [];
      state.error = null;
      state.isAuthenticated = false;
      clearStorage();
    },
    setCurrentCustomer: (state, action) => {
      const customer = action.payload;
      if (customer && validateCustomerData(customer)) {
        state.currentCustomer = customer;
        state.currentCustomerDetails = customer;
        state.isAuthenticated = !!(customer.accessToken && typeof customer.accessToken === "string" && customer.accessToken.trim() !== "");
        saveToStorage(customer);
      } else {
        state.currentCustomer = null;
        state.currentCustomerDetails = null;
        state.isAuthenticated = false;
        clearStorage();
      }
    },
    clearError: (state) => { state.error = null; },
    updateToken: (state, action) => {
      if (state.currentCustomer && action.payload?.accessToken && action.payload?.refreshToken) {
        const updatedCustomer = {
          ...state.currentCustomer,
          accessToken: action.payload.accessToken,
          refreshToken: action.payload.refreshToken,
          lastTokenRefresh: Date.now(),
        };
        state.currentCustomer = updatedCustomer;
        state.currentCustomerDetails = updatedCustomer;
        state.isAuthenticated = true;
        saveToStorage(updatedCustomer);
      }
    },
    syncWithStorage: (state) => {
      const stored = loadFromStorage();
      if (stored && validateCustomerData(stored)) {
        state.currentCustomer = stored;
        state.currentCustomerDetails = stored;
        state.isAuthenticated = !!(stored.accessToken && typeof stored.accessToken === "string" && stored.accessToken.trim() !== "");
      } else {
        state.currentCustomer = null;
        state.currentCustomerDetails = null;
        state.isAuthenticated = false;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // createCustomer
      .addCase(createCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(createCustomer.fulfilled, (state) => { state.loading = false; state.error = null; })
      .addCase(createCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || "Registration failed."; })

      // loginCustomer
      .addCase(loginCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginCustomer.fulfilled, (state, action) => {
        state.loading = false; state.error = null;
        if (action.payload?.requiresPasswordChange) {
          state.currentCustomer = null; state.currentCustomerDetails = null; state.isAuthenticated = false; return;
        }
        if (validateCustomerData(action.payload)) {
          state.currentCustomer = action.payload;
          state.currentCustomerDetails = action.payload;
          state.isAuthenticated = !!action.payload?.accessToken;
        }
      })
      .addCase(loginCustomer.rejected, (state, action) => {
        state.loading = false; state.error = action.payload?.message || "Login failed.";
        state.currentCustomer = null; state.currentCustomerDetails = null; state.isAuthenticated = false; clearStorage();
      })

      // fetchCustomers
      .addCase(fetchCustomers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCustomers.fulfilled, (state, action) => { state.loading = false; state.customerList = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false; state.error = action.payload?.message || "Failed to fetch customers.";
        if (action.payload?.responseCode === "401") {
          state.currentCustomer = null; state.currentCustomerDetails = null; state.isAuthenticated = false; clearStorage();
        }
      })

      // getCustomerById
      .addCase(getCustomerById.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getCustomerById.fulfilled, (state, action) => { state.loading = false; if (validateCustomerData(action.payload)) state.currentCustomerDetails = action.payload; })
      .addCase(getCustomerById.rejected, (state, action) => {
        state.loading = false; state.error = action.payload?.message || "Failed to fetch customer details.";
        if (action.payload?.responseCode === "401") {
          state.currentCustomer = null; state.currentCustomerDetails = null; state.isAuthenticated = false; clearStorage();
        }
      })

      // updateCustomerPassword
      .addCase(updateCustomerPassword.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateCustomerPassword.fulfilled, (state) => {
        state.loading = false;
        if (state.currentCustomer) {
          const updated = { ...state.currentCustomer, lastPasswordChange: Date.now() };
          state.currentCustomer = updated; state.currentCustomerDetails = updated; saveToStorage(updated);
        }
      })
      .addCase(updateCustomerPassword.rejected, (state, action) => {
        state.loading = false; state.error = action.payload?.message || "Password update failed.";
        if (action.payload?.responseCode === "401") {
          state.currentCustomer = null; state.currentCustomerDetails = null; state.isAuthenticated = false; clearStorage();
        }
      })

      // updateAccountStatus
      .addCase(updateAccountStatus.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateAccountStatus.fulfilled, (state) => { state.loading = false; state.currentCustomer = null; state.currentCustomerDetails = null; state.isAuthenticated = false; })
      .addCase(updateAccountStatus.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || "Status update failed."; })

      // forgotPassword
      .addCase(forgotPassword.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(forgotPassword.fulfilled, (state) => { state.loading = false; })
      .addCase(forgotPassword.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || "Password reset request failed."; })

      // resetPassword
      .addCase(resetPassword.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(resetPassword.fulfilled, (state) => { state.loading = false; })
      .addCase(resetPassword.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || "Password reset failed."; });
  },
});

export const { logoutCustomer, setCurrentCustomer, clearError, updateToken, syncWithStorage } = customerSlice.actions;
export { silentTokenRefresh, loadFromStorage, saveToStorage, clearStorage, validateCustomerData };
export default customerSlice.reducer;