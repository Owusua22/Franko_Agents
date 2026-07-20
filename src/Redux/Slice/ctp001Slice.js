import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "./AxiosInstance";

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */

const getToday = () => new Date().toISOString().split("T")[0];

const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.mergedProducts)) return data.mergedProducts;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.response?.data)) return data.response.data;

  return [];
};

const toErrorPayload = (error, fallback) => {
  const serverError =
    error?.response?.data?.responseMessage ||
    error?.response?.data?.message ||
    (typeof error?.response?.data === "string" ? error.response.data : null);

  return serverError || error?.message || fallback;
};


const cleanQuery = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

const selectN1UIdFromState = (state) =>
  state?.customer?.currentCustomerDetails?.n1UId ||
  state?.customer?.currentCustomer?.n1UId ||
  "";

/* 

/* ════════════════════════════════════════════
   THUNKS
════════════════════════════════════════════ */

// Get Merged Products
export const getMergedProducts = createAsyncThunk(
  "ctp001/getMergedProducts",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/", {
        params: { endpoint: "/GetMergedProducts" },
      });
      return toArray(res.data);
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch merged products")
      );
    }
  }
);

// Get CTP001 Orders

export const getCTP001Orders = createAsyncThunk(
  "ctp001/getCTP001Orders",
  async (
    { CustomerName, CartId, BCode, StartDate, EndDate } = {},
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState();
      const n1UId = String(selectN1UIdFromState(state) || "").trim();

      if (!n1UId) {
        return rejectWithValue("Missing customer n1UId in redux state.");
      }

      const res = await axiosInstance.get("/", {
        params: cleanQuery({
          endpoint: "/GetCTP001Orders",
          CustomerId: n1UId, // ✅ enforce logged-in customer id
          CustomerName,
          CartId,
          BCode,
          StartDate,
          EndDate,
        }),
      });

      return toArray(res.data);
    } catch (error) {
      return rejectWithValue(toErrorPayload(error, "Failed to fetch CTP001 orders"));
    }
  }
);

// Place Order
// Endpoint: POST /PlaceOrder
// Payload: Array of orders
export const placeOrder = createAsyncThunk(
  "ctp001/placeOrder",
  async (orderData, { rejectWithValue }) => {
    try {
      const orders = Array.isArray(orderData) ? orderData : [orderData];

      if (orders.length === 0) {
        return rejectWithValue("Order data cannot be empty");
      }

      const payload = orders.map((order) => ({
        cartId: String(order.cartId ?? ""),
        variantId: String(order.variantId ?? ""),
        price: Number(order.price),
        quantity: Number(order.quantity),
        customerId: String(order.customerId ?? ""),
        customerName: String(order.customerName ?? ""),
        contactNumber: String(order.contactNumber ?? ""),
        deliveryAddress: String(order.deliveryAddress ?? ""),
        geolocation: String(order.geolocation ?? ""),
        orderDate: order.orderDate || getToday(),
        paymentMode: String(order.paymentMode ?? ""),
        paymentService: String(order.paymentService ?? ""),
        paymentAccountNumber: String(order.paymentAccountNumber ?? ""),
        customerAccountType: String(order.customerAccountType ?? ""),
        bCode: String(order.bCode ?? ""),
      }));

      const missingVariant = payload.find((p) => !p.variantId || p.variantId === "");
      if (missingVariant) {
        return rejectWithValue("Variant is required to place an order");
      }

      const res = await axiosInstance.post("/", payload, {
        params: { endpoint: "/PlaceOrder" },
        headers: { "Content-Type": "application/json" },
      });

      const responseData = res.data;

      if (
        responseData &&
        (responseData.responseCode === "0" || responseData.responseCode === 0)
      ) {
        return rejectWithValue(
          responseData.responseMessage ||
            responseData.message ||
            "Failed to place order"
        );
      }

      return { data: responseData, orders: payload };
    } catch (error) {
      return rejectWithValue(toErrorPayload(error, "Failed to place order"));
    }
  }
);

/* ════════════════════════════════════════════
   INITIAL STATE
════════════════════════════════════════════ */

const initialState = {
  mergedProducts: [],
  ctp001Orders: [],
  lastQuery: null,

  orders: [],
  currentOrder: null,
  lastOrderResponse: null,

  loading: {
    mergedProducts: false,
    ctp001Orders: false,
    placeOrder: false,
  },

  error: {
    mergedProducts: null,
    ctp001Orders: null,
    placeOrder: null,
  },
};

/* ════════════════════════════════════════════
   SLICE
════════════════════════════════════════════ */

const ctp001Slice = createSlice({
  name: "ctp001",
  initialState,
  reducers: {
    clearMergedProducts: (state) => {
      state.mergedProducts = [];
      state.error.mergedProducts = null;
    },

  clearCTP001Orders(state) {
      state.ctp001Orders = [];
      state.loading.ctp001Orders = false;
      state.error.ctp001Orders = null;
      state.lastQuery = null;
    },

    clearOrders: (state) => {
      state.orders = [];
      state.currentOrder = null;
      state.lastOrderResponse = null;
      state.error.placeOrder = null;
    },

    clearPlaceOrderError: (state) => {
      state.error.placeOrder = null;
    },

    clearAllErrors: (state) => {
      state.error.mergedProducts = null;
      state.error.ctp001Orders = null;
      state.error.placeOrder = null;
    },

    resetCtp001State: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Get Merged Products
      .addCase(getMergedProducts.pending, (state) => {
        state.loading.mergedProducts = true;
        state.error.mergedProducts = null;
      })
      .addCase(getMergedProducts.fulfilled, (state, action) => {
        state.loading.mergedProducts = false;
        state.mergedProducts = action.payload || [];
      })
      .addCase(getMergedProducts.rejected, (state, action) => {
        state.loading.mergedProducts = false;
        state.error.mergedProducts = action.payload;
      })

      // Get CTP001 Orders
  .addCase(getCTP001Orders.pending, (state, action) => {
        state.loading.ctp001Orders = true;
        state.error.ctp001Orders = null;
        state.lastQuery = action.meta.arg || {};
      })
      .addCase(getCTP001Orders.fulfilled, (state, action) => {
        state.loading.ctp001Orders = false;
        state.ctp001Orders = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getCTP001Orders.rejected, (state, action) => {
        state.loading.ctp001Orders = false;
        state.error.ctp001Orders = action.payload || "Request failed";
      })


      // Place Order
      .addCase(placeOrder.pending, (state) => {
        state.loading.placeOrder = true;
        state.error.placeOrder = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.loading.placeOrder = false;
        state.error.placeOrder = null;

        const { data, orders } = action.payload;
        state.lastOrderResponse = data;

        if (Array.isArray(orders)) {
          state.orders = [...state.orders, ...orders];
          state.currentOrder = orders[0] || null;
        }
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.loading.placeOrder = false;
        state.error.placeOrder = action.payload;
      });
  },
});

/* ════════════════════════════════════════════
   ACTIONS
════════════════════════════════════════════ */

export const {
  clearMergedProducts,
  clearCTP001Orders,
  clearOrders,
  clearPlaceOrderError,
  clearAllErrors,
  resetCtp001State,
} = ctp001Slice.actions;

/* ════════════════════════════════════════════
   SELECTORS (match store key: ctp001)
════════════════════════════════════════════ */

// Merged Products
export const selectMergedProducts = (state) =>
  state?.ctp001?.mergedProducts ?? [];
export const selectMergedProductsLoading = (state) =>
  state?.ctp001?.loading?.mergedProducts ?? false;
export const selectMergedProductsError = (state) =>
  state?.ctp001?.error?.mergedProducts ?? null;

// CTP001 Orders
export const selectCTP001Orders = (state) =>
  state?.ctp001?.ctp001Orders ?? [];
export const selectCTP001OrdersLoading = (state) =>
  state?.ctp001?.loading?.ctp001Orders ?? false;
export const selectCTP001OrdersError = (state) =>
  state?.ctp001?.error?.ctp001Orders ?? null;

// Place Order
export const selectPlaceOrderLoading = (state) =>
  state?.ctp001?.loading?.placeOrder ?? false;
export const selectPlaceOrderError = (state) =>
  state?.ctp001?.error?.placeOrder ?? null;
export const selectOrders = (state) => state?.ctp001?.orders ?? [];
export const selectCurrentOrder = (state) => state?.ctp001?.currentOrder ?? null;
export const selectLastOrderResponse = (state) =>
  state?.ctp001?.lastOrderResponse ?? null;

export default ctp001Slice.reducer;