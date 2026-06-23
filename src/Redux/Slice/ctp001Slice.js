import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "./AxiosInstance";

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */

const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.result)) return data.result;
  if (data?.response?.data && Array.isArray(data.response.data))
    return data.response.data;
  if (data?.mergedProducts && Array.isArray(data.mergedProducts))
    return data.mergedProducts;
  return [];
};

const toErrorPayload = (error, fallback) => {
  const server =
    error.response?.data?.message ??
    (typeof error.response?.data === "string"
      ? error.response.data
      : null);
  return server || error.message || fallback;
};

const isSuccessResponse = (data) => {
  if (!data || typeof data !== "object") return false;
  return data.responseCode === "0" || data.responseCode === 0;
};

const getResponseMessage = (data) => {
  if (!data || typeof data !== "object") return null;
  return data.responseMessage || data.message || null;
};

const sortByNewest = (items = []) => {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const dateA = new Date(
      a?.dateCreated || a?.DateCreated || a?.createdAt || 0
    );
    const dateB = new Date(
      b?.dateCreated || b?.DateCreated || b?.createdAt || 0
    );
    return dateB - dateA;
  });
};

const getToday = () => new Date().toISOString().split("T")[0];
const DEFAULT_BCODE = "855";

/* ── Name similarity helpers ── */

export const normalizeName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");

export const levenshteinDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

export const getSimilarity = (a, b) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(na, nb) / maxLen;
};

export const areNamesSimilar = (a, b, threshold = 0.7) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return getSimilarity(na, nb) >= threshold;
};

// ✅ FIX: Robust product ID extraction - handles ALL possible field names
const getProductId = (p) => {
  if (!p) return "";
  return (
    p.productID ||
    p.Productid ||
    p.productId ||
    p.ProductId ||
    p.ProductID ||
    p.product_id ||
    p.id ||
    p.Id ||
    p.ID ||
    ""
  );
};

// ✅ FIX: Robust product name extraction
const getProductName = (p) => {
  if (!p) return "";
  return p.productName || p.ProductName || p.product_name || p.name || "";
};

/* ════════════════════════════════════════════
   ASYNC THUNKS
════════════════════════════════════════════ */

// ── Get CTP001 Products with Pagination ──
export const getCTP001Products = createAsyncThunk(
  "ctp001/getCTP001Products",
  async (
    { pageNumber = 1, recordPerPage = 2000 } = {},
    { rejectWithValue }
  ) => {
    try {
      const res = await axiosInstance.get("/", {
        params: {
          endpoint: "/GetCTP001Products",
          pageNumber: Number(pageNumber),
          recordPerPage: Number(recordPerPage),
        },
      });

      const products = toArray(res.data);
      const rawData = res.data;

      const explicitTotal =
        rawData?.total ??
        rawData?.totalCount ??
        rawData?.count ??
        rawData?.totalRecords;
      let total;
      if (typeof explicitTotal === "number") {
        total = explicitTotal;
      } else {
        total =
          products.length === recordPerPage
            ? pageNumber * recordPerPage + 1
            : (pageNumber - 1) * recordPerPage + products.length;
      }

      return {
        products,
        pageNumber: Number(pageNumber),
        recordPerPage: Number(recordPerPage),
        total,
      };
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch CTP001 products")
      );
    }
  }
);

// ── Find Similar CTP002 Products ──
export const findSimilarCTP002Products = createAsyncThunk(
  "ctp001/findSimilarCTP002Products",
  async (ctp001Product, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const ctp002Products = state.products?.products || [];

      if (!ctp002Products.length) {
        return { candidates: [], reason: "no_ctp002_loaded" };
      }

      const ctp001Name = getProductName(ctp001Product);
      if (!ctp001Name) {
        return { candidates: [], reason: "no_name" };
      }

      const candidates = ctp002Products
        .map((ctp2) => {
          const ctp2Name = getProductName(ctp2);
          const similarity = getSimilarity(ctp001Name, ctp2Name);
          const similar = areNamesSimilar(ctp001Name, ctp2Name);
          return {
            product: ctp2,
            productId: getProductId(ctp2),
            productName: ctp2Name,
            similarity,
            similar,
          };
        })
        .filter((c) => c.similar)
        .sort((a, b) => b.similarity - a.similarity);

      return {
        candidates,
        reason: candidates.length ? "found" : "no_match",
      };
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(
          error,
          "Failed to find similar CTP002 products"
        )
      );
    }
  }
);

// ═══════════════════════════════════════════════════════════
// ✅ FIXED: Manual Merge Single CTP001 with CTP002
// ═══════════════════════════════════════════════════════════
export const mergeSingleCTP001WithCTP002 = createAsyncThunk(
  "ctp001/mergeSingleCTP001WithCTP002",
  async ({ ctp001Product, ctp002Product }, { rejectWithValue }) => {
    try {
      console.log("═══════════════════════════════════════");
      console.log("🔵 THUNK: mergeSingleCTP001WithCTP002 STARTED");
      console.log("🔵 Raw ctp001Product:", ctp001Product);
      console.log("🔵 Raw ctp002Product:", ctp002Product);

      // ✅ FIX: Extract names with fallback chain
      const ctp1Name = getProductName(ctp001Product);
      const ctp2Name = getProductName(ctp002Product);

      console.log("🔵 ctp1Name:", ctp1Name);
      console.log("🔵 ctp2Name:", ctp2Name);

      // ✅ FIX: Extract IDs with fallback chain
      const ctp1Id = String(getProductId(ctp001Product) || "").trim();
      const ctp2Id = String(getProductId(ctp002Product) || "").trim();

      console.log("🔵 ctp1Id:", ctp1Id);
      console.log("🔵 ctp2Id:", ctp2Id);

      if (!ctp1Id) {
        console.error("❌ CTP001 Product ID is empty!");
        console.error(
          "❌ Available keys on ctp001Product:",
          Object.keys(ctp001Product || {})
        );
        return rejectWithValue(
          `Missing Sales Mate Product ID. Available fields: ${Object.keys(
            ctp001Product || {}
          ).join(", ")}`
        );
      }

      if (!ctp2Id) {
        console.error("❌ CTP002 Product ID is empty!");
        console.error(
          "❌ Available keys on ctp002Product:",
          Object.keys(ctp002Product || {})
        );
        return rejectWithValue(
          `Missing Website Product ID. Available fields: ${Object.keys(
            ctp002Product || {}
          ).join(", ")}`
        );
      }

      // ✅ Build payload matching the API's expected format
      const payload = {
        ctP001ProductId: ctp1Id,
        ctP001ProductName: ctp1Name,
        ctP002ProductId: ctp2Id,
        ctP002ProductName: ctp2Name,
      };

      console.log("🔵 Final payload:", JSON.stringify(payload, null, 2));
      console.log("🔵 Sending POST to /MergeCTO001_N_CTP002Products...");

      // ✅ FIX: Send as array (matching the bulk endpoint format from the sample)
      const res = await axiosInstance.post("/", [payload], {
        params: { endpoint: "/MergeCTO001_N_CTP002Products" },
        headers: { "Content-Type": "application/json" },
      });

      console.log("🟢 Response status:", res.status);
      console.log("🟢 Response data:", JSON.stringify(res.data, null, 2));

      const rawData = res.data;
      const msg = getResponseMessage(rawData) || "Merged successfully";

      return {
        success: true,
        message: msg,
        mergedPair: payload,
        ctp001ProductId: ctp1Id,
        ctp002ProductId: ctp2Id,
        response: rawData,
      };
    } catch (error) {
      console.error("═══════════════════════════════════════");
      console.error("❌ THUNK ERROR:", error);
      console.error("❌ Error response:", error.response?.data);
      console.error("❌ Error status:", error.response?.status);
      console.error("❌ Error message:", error.message);

      // ✅ Check if it's a network error vs server error
      if (!error.response) {
        console.error("❌ NETWORK ERROR - No response received");
        return rejectWithValue(
          "Network error: Could not reach the server. Check your connection."
        );
      }

      return rejectWithValue(
        toErrorPayload(error, "Failed to merge products")
      );
    }
  }
);

// ── Merge CTP001 and CTP002 Products (Bulk) ──
export const mergeCTP001AndCTP002Products = createAsyncThunk(
  "ctp001/mergeCTP001AndCTP002Products",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const ctp001Products = state.ctp001?.ctp001Products || [];
      const ctp002Products = state.products?.products || [];

      const mergePairs = [];
      ctp001Products.forEach((ctp1) => {
        const ctp1Name = getProductName(ctp1);
        if (!ctp1Name) return;
        const matchedCtp2 = ctp002Products.find((ctp2) => {
          const ctp2Name = getProductName(ctp2);
          return (
            areNamesSimilar(ctp1Name, ctp2Name) &&
            getSimilarity(ctp1Name, ctp2Name) === 1
          );
        });
        if (matchedCtp2) {
          mergePairs.push({
            ctP001ProductId: String(getProductId(ctp1)),
            ctP001ProductName: getProductName(ctp1),
            ctP002ProductId: String(getProductId(matchedCtp2)),
            ctP002ProductName: getProductName(matchedCtp2),
          });
        }
      });

      if (!mergePairs.length) {
        return {
          success: true,
          message:
            "No exact name matches found to merge automatically.",
          products: [],
          nothingToMerge: true,
          mergePairs: [],
        };
      }

      const res = await axiosInstance.post("/", mergePairs, {
        params: { endpoint: "/MergeCTO001_N_CTP002Products" },
        headers: { "Content-Type": "application/json" },
      });

      const rawData = res.data;
      if (isSuccessResponse(rawData)) {
        const msg = getResponseMessage(rawData);
        return {
          success: true,
          message: msg || "Merge completed",
          products: toArray(rawData),
          nothingToMerge:
            msg?.toLowerCase().includes("no products") ||
            toArray(rawData).length === 0,
          mergePairs,
        };
      }

      return {
        success: true,
        message: "Products merged successfully",
        products: toArray(rawData),
        nothingToMerge: toArray(rawData).length === 0,
        mergePairs,
      };
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to merge products")
      );
    }
  }
);

// ── Get Merged Products ──
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
        toErrorPayload(error, "Failed to get merged products")
      );
    }
  }
);

// ── Place 1N1 Order ──
export const placeOrder = createAsyncThunk(
  "ctp001/placeOrder",
  async (
    {
      cartId = "",
      productId,
      price = 0,
      quantity,
      customerId,
      customerName,
      contactNumber,
      deliveryAddress,
      geolocation = "345",
      paymentMode = "",
      paymentService = "",
      paymentAccountNumber = "",
      customerAccountType = "",
      bCode = DEFAULT_BCODE,
    },
    { rejectWithValue }
  ) => {
    try {
      if (!productId) throw new Error("Product ID is required.");
      if (price === undefined || price === null || Number(price) < 0)
        throw new Error("Price must be 0 or greater.");
      if (!quantity || Number(quantity) <= 0)
        throw new Error("Quantity must be greater than 0.");
      if (!customerId) throw new Error("Customer ID is required.");
      if (!customerName)
        throw new Error("Customer name is required.");
      if (!contactNumber)
        throw new Error("Contact number is required.");
      if (!deliveryAddress)
        throw new Error("Delivery address is required.");
      if (!paymentMode)
        throw new Error("Payment mode is required.");
      if (!paymentService)
        throw new Error("Payment service is required.");
      if (!customerAccountType)
        throw new Error("Customer account type is required.");

      const payload = {
        cartId: String(cartId || ""),
        productId: String(productId),
        price: Number(price),
        quantity: Number(quantity),
        customerId: String(customerId),
        customerName: String(customerName),
        contactNumber: String(contactNumber),
        deliveryAddress: String(deliveryAddress),
        geolocation: String(geolocation || "345"),
        orderDate: getToday(),
        paymentMode: String(paymentMode),
        paymentService: String(paymentService),
        paymentAccountNumber: String(paymentAccountNumber || ""),
        customerAccountType: String(customerAccountType),
        bCode: String(bCode || DEFAULT_BCODE),
      };

      const res = await axiosInstance.post("/", [payload], {
        params: { endpoint: "/PlaceOrder" },
        headers: { "Content-Type": "application/json" },
      });

      return res.data;
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to place order")
      );
    }
  }
);

/* ════════════════════════════════════════════
   LOADING / ERROR HELPERS
════════════════════════════════════════════ */

const getInitialLoading = () => ({
  ctp001Products: false,
  mergedProducts: false,
  mergeAction: false,
  singleMerge: false,
  findSimilar: false,
  placeOrder: false,
});

const getInitialError = () => ({
  ctp001Products: null,
  mergedProducts: null,
  mergeAction: null,
  singleMerge: null,
  findSimilar: null,
  placeOrder: null,
});

/* ════════════════════════════════════════════
   INITIAL STATE
════════════════════════════════════════════ */

const initialState = {
  ctp001Products: [],
  ctp001Pagination: { pageNumber: 1, recordPerPage: 10, total: 0 },
  mergedProducts: [],
  ctp001MergedProducts: [],
  mergedProductMap: {},
  manualMerges: [],
  similarCandidates: [],
  mergeResult: null,
  orders: [],
  currentOrder: null,
  loading: getInitialLoading(),
  error: getInitialError(),
};

/* ════════════════════════════════════════════
   SLICE
════════════════════════════════════════════ */

const ctp001Slice = createSlice({
  name: "ctp001",
  initialState,
  reducers: {
    clearCTP001Data: (state) => {
      Object.assign(state, {
        ctp001Products: [],
        mergedProducts: [],
        ctp001MergedProducts: [],
        mergedProductMap: {},
        manualMerges: [],
        similarCandidates: [],
        mergeResult: null,
        orders: [],
        currentOrder: null,
        ctp001Pagination: {
          pageNumber: 1,
          recordPerPage: 10,
          total: 0,
        },
        loading: getInitialLoading(),
        error: getInitialError(),
      });
    },
    clearProducts: (state) => {
      state.ctp001Products = [];
      state.mergedProducts = [];
      state.ctp001MergedProducts = [];
    },
    clearOrders: (state) => {
      state.orders = [];
      state.currentOrder = null;
    },
    clearError: (state) => {
      state.error = getInitialError();
    },
    clearSpecificError: (state, action) => {
      const key = action.payload;
      if (key && state.error[key] !== undefined)
        state.error[key] = null;
    },
    clearMergeResult: (state) => {
      state.mergeResult = null;
    },
    clearAllLoading: (state) => {
      state.loading = getInitialLoading();
    },
    resetLoading: (state, action) => {
      const key = action.payload;
      if (key && state.loading[key] !== undefined)
        state.loading[key] = false;
    },
    setPagination: (state, action) => {
      state.ctp001Pagination = {
        ...state.ctp001Pagination,
        ...action.payload,
      };
    },
    setCurrentOrder: (state, action) => {
      state.currentOrder = action.payload;
    },
    addOrder: (state, action) => {
      state.orders.push(action.payload);
    },
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
    },
    clearSimilarCandidates: (state) => {
      state.similarCandidates = [];
    },
    removeManualMerge: (state, action) => {
      const ctp001Id = action.payload;
      if (ctp001Id && state.mergedProductMap[ctp001Id]) {
        delete state.mergedProductMap[ctp001Id];
        state.manualMerges = state.manualMerges.filter(
          (m) => m.ctp001ProductId !== ctp001Id
        );
      }
    },
  },

  extraReducers: (builder) => {
    builder
      // ── getCTP001Products ──
      .addCase(getCTP001Products.pending, (state) => {
        state.loading.ctp001Products = true;
        state.error.ctp001Products = null;
      })
      .addCase(getCTP001Products.fulfilled, (state, action) => {
        state.loading.ctp001Products = false;
        const { products, pageNumber, recordPerPage, total } =
          action.payload || {};
        state.ctp001Products = sortByNewest(products || []);
        state.ctp001Pagination = {
          pageNumber: pageNumber || 1,
          recordPerPage: recordPerPage || 10,
          total: total || (products || []).length,
        };
      })
      .addCase(getCTP001Products.rejected, (state, action) => {
        state.loading.ctp001Products = false;
        state.error.ctp001Products =
          action.payload || "Failed to fetch CTP001 products";
      })

      // ── findSimilarCTP002Products ──
      .addCase(findSimilarCTP002Products.pending, (state) => {
        state.loading.findSimilar = true;
        state.error.findSimilar = null;
        state.similarCandidates = [];
      })
      .addCase(
        findSimilarCTP002Products.fulfilled,
        (state, action) => {
          state.loading.findSimilar = false;
          state.similarCandidates =
            action.payload?.candidates || [];
        }
      )
      .addCase(
        findSimilarCTP002Products.rejected,
        (state, action) => {
          state.loading.findSimilar = false;
          state.error.findSimilar =
            action.payload || "Failed to find similar products";
          state.similarCandidates = [];
        }
      )

      // ── mergeSingleCTP001WithCTP002 ──
      .addCase(mergeSingleCTP001WithCTP002.pending, (state) => {
        state.loading.singleMerge = true;
        state.error.singleMerge = null;
      })
      .addCase(
        mergeSingleCTP001WithCTP002.fulfilled,
        (state, action) => {
          state.loading.singleMerge = false;
          const {
            ctp001ProductId,
            ctp002ProductId,
            mergedPair,
            message: msg,
          } = action.payload;

          // Update the merged product map
          state.mergedProductMap[ctp001ProductId] = ctp002ProductId;

          // Add to manual merges
          state.manualMerges.push({
            ctp001ProductId,
            ctp002ProductId,
            ctP001ProductName: mergedPair.ctP001ProductName,
            ctP002ProductName: mergedPair.ctP002ProductName,
            mergedAt: new Date().toISOString(),
          });

          state.mergeResult = {
            success: true,
            message: msg || "Merged successfully",
            nothingToMerge: false,
            count: 1,
          };
        }
      )
      .addCase(
        mergeSingleCTP001WithCTP002.rejected,
        (state, action) => {
          state.loading.singleMerge = false;
          state.error.singleMerge =
            action.payload || "Failed to merge products";
          state.mergeResult = {
            success: false,
            message:
              action.payload || "Failed to merge products",
            nothingToMerge: false,
            count: 0,
          };
        }
      )

      // ── mergeCTP001AndCTP002Products (Bulk) ──
      .addCase(
        mergeCTP001AndCTP002Products.pending,
        (state) => {
          state.loading.mergeAction = true;
          state.error.mergeAction = null;
          state.mergeResult = null;
        }
      )
      .addCase(
        mergeCTP001AndCTP002Products.fulfilled,
        (state, action) => {
          state.loading.mergeAction = false;
          const result = action.payload || {};
          const products = result.products || [];
          state.ctp001MergedProducts = Array.isArray(products)
            ? products
            : [];
          state.mergeResult = {
            success: result.success || false,
            message: result.message || "",
            nothingToMerge: result.nothingToMerge || false,
            count: products.length,
          };
        }
      )
      .addCase(
        mergeCTP001AndCTP002Products.rejected,
        (state, action) => {
          state.loading.mergeAction = false;
          state.mergeResult = {
            success: false,
            message:
              action.payload || "Failed to merge products",
            nothingToMerge: false,
            count: 0,
          };
          state.error.mergeAction =
            action.payload || "Failed to merge products";
        }
      )

      // ── getMergedProducts ──
      .addCase(getMergedProducts.pending, (state) => {
        state.loading.mergedProducts = true;
        state.error.mergedProducts = null;
      })
      .addCase(getMergedProducts.fulfilled, (state, action) => {
        state.loading.mergedProducts = false;
        const fetchedProducts = Array.isArray(action.payload)
          ? action.payload
          : [];
        state.mergedProducts = fetchedProducts;

        const newMap = { ...state.mergedProductMap };
        fetchedProducts.forEach((m) => {
          const id1 =
            m.ctP001ProductId ||
            m.CTP001ProductId ||
            m.ctp001ProductId;
          const id2 =
            m.ctP002ProductId ||
            m.CTP002ProductId ||
            m.ctp002ProductId;
          if (id1 && id2) newMap[id1] = id2;
        });
        state.mergedProductMap = newMap;
      })
      .addCase(getMergedProducts.rejected, (state, action) => {
        state.loading.mergedProducts = false;
        state.error.mergedProducts =
          action.payload || "Failed to get merged products";
      })

      // ── placeOrder ──
      .addCase(placeOrder.pending, (state) => {
        state.loading.placeOrder = true;
        state.error.placeOrder = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.loading.placeOrder = false;
        const orderResult = action.payload;
        if (orderResult) {
          if (Array.isArray(orderResult)) {
            state.orders.push(...orderResult);
            state.currentOrder = orderResult[0];
          } else {
            state.orders.push(orderResult);
            state.currentOrder = orderResult;
          }
        }
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.loading.placeOrder = false;
        state.error.placeOrder =
          action.payload || "Failed to place order";
      });
  },
});

/* ════════════════════════════════════════════
   ACTIONS & SELECTORS
════════════════════════════════════════════ */

export const {
  clearCTP001Data,
  clearProducts,
  clearOrders,
  clearError,
  clearSpecificError,
  clearMergeResult,
  clearAllLoading,
  resetLoading,
  setPagination,
  setCurrentOrder,
  clearCurrentOrder,
  addOrder,
  clearSimilarCandidates,
  removeManualMerge,
} = ctp001Slice.actions;

export const selectCTP001GlobalLoading = (state) =>
  Object.values(state.ctp001.loading).some(Boolean);
export const selectCTP001GlobalError = (state) =>
  Object.values(state.ctp001.error).find(Boolean) || null;

export const selectCTP001Products = (state) =>
  state.ctp001.ctp001Products;
export const selectCTP001Pagination = (state) =>
  state.ctp001.ctp001Pagination;
export const selectMergedProducts = (state) =>
  state.ctp001.mergedProducts;
export const selectCTP001MergedProducts = (state) =>
  state.ctp001.ctp001MergedProducts;
export const selectMergedProductMap = (state) =>
  state.ctp001.mergedProductMap;
export const selectManualMerges = (state) =>
  state.ctp001.manualMerges;
export const selectSimilarCandidates = (state) =>
  state.ctp001.similarCandidates;
export const selectMergeResult = (state) =>
  state.ctp001.mergeResult;
export const selectOrders = (state) => state.ctp001.orders;
export const selectCurrentOrder = (state) =>
  state.ctp001.currentOrder;

export const selectCTP001ProductsLoading = (state) =>
  state.ctp001.loading.ctp001Products;
export const selectMergedProductsLoading = (state) =>
  state.ctp001.loading.mergedProducts;
export const selectMergeActionLoading = (state) =>
  state.ctp001.loading.mergeAction;
export const selectSingleMergeLoading = (state) =>
  state.ctp001.loading.singleMerge;
export const selectFindSimilarLoading = (state) =>
  state.ctp001.loading.findSimilar;
export const selectPlaceOrderLoading = (state) =>
  state.ctp001.loading.placeOrder;

export const selectCTP001ProductsError = (state) =>
  state.ctp001.error.ctp001Products;
export const selectMergedProductsError = (state) =>
  state.ctp001.error.mergedProducts;
export const selectMergeActionError = (state) =>
  state.ctp001.error.mergeAction;
export const selectSingleMergeError = (state) =>
  state.ctp001.error.singleMerge;
export const selectFindSimilarError = (state) =>
  state.ctp001.error.findSimilar;
export const selectPlaceOrderError = (state) =>
  state.ctp001.error.placeOrder;

export default ctp001Slice.reducer;