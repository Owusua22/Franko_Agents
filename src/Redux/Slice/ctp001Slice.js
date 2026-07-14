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

export const getMergedProducts = createAsyncThunk(
  "ctp/getMergedProducts",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/", {
        params: {
          endpoint: "/GetMergedProducts",
        },
      });

      return toArray(res.data);
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch merged products")
      );
    }
  }
);

// Place Order
// Endpoint: POST /PlaceOrder
// Payload: Array of orders 
export const placeOrder = createAsyncThunk(
  "ctp/placeOrder",
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

      // Validate - Make sure variantId exists
      const missingVariant = payload.find(
        (p) => !p.variantId || p.variantId === ""
      );

      if (missingVariant) {
        return rejectWithValue("Variant is required to place an order");
      }

      const res = await axiosInstance.post("/", payload, {
        params: {
          endpoint: "/PlaceOrder",
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseData = res.data;

      // API returns responseCode "0" when it fails
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

      return {
        data: responseData,
        orders: payload,
      };
    } catch (error) {
      return rejectWithValue(toErrorPayload(error, "Failed to place order"));
    }
  }
);

/* ════════════════════════════════════════════
   INITIAL STATE (Same as before, just cleaner)
════════════════════════════════════════════ */

const initialState = {
  mergedProducts: [],
  orders: [],
  currentOrder: null,
  lastOrderResponse: null,

  loading: {
    mergedProducts: false,
    placeOrder: false,
  },

  error: {
    mergedProducts: null,
    placeOrder: null,
  },
};

const ctpSlice = createSlice({
  name: "ctp",
  initialState,
  reducers: {
    clearMergedProducts: (state) => {
      state.mergedProducts = [];
      state.error.mergedProducts = null;
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
          state.currentOrder = orders[0];
        }
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.loading.placeOrder = false;
        state.error.placeOrder = action.payload;
      });
  },
});

export const {
  clearMergedProducts,
  clearOrders,
  clearPlaceOrderError,
} = ctpSlice.actions;

export const selectMergedProducts = (state) => state.ctp.mergedProducts;
export const selectMergedProductsLoading = (state) =>
  state.ctp.loading.mergedProducts;
export const selectMergedProductsError = (state) => state.ctp.error.mergedProducts;

export const selectPlaceOrderLoading = (state) =>
  state.ctp.loading.placeOrder;
export const selectPlaceOrderError = (state) => state.ctp.error.placeOrder;
export const selectOrders = (state) => state.ctp.orders;

export default ctpSlice.reducer;