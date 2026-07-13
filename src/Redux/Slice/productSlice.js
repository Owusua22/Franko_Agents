import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "./AxiosInstance";

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */

const normalizeId = (value) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (lower === "undefined" || lower === "null" || lower === "nan") return "";
  return v;
};

const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.variants)) return data.variants;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const toErrorPayload = (error, fallback) => {
  return (
    error?.response?.data?.responseMessage ||
    error?.response?.data?.message ||
    (typeof error?.response?.data === "string"
      ? error.response.data
      : null) ||
    error?.message ||
    fallback
  );
};

const getSafeTime = (value) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortByNewest = (items = []) => {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const aDate =
      a?.dateCreated || a?.DateCreated || a?.createdAt || a?.CreatedAt || 0;
    const bDate =
      b?.dateCreated || b?.DateCreated || b?.createdAt || b?.CreatedAt || 0;
    return getSafeTime(bDate) - getSafeTime(aDate);
  });
};

/* ════════════════════════════════════════════
   VARIANT NORMALIZATION
════════════════════════════════════════════ */

// Deep clone to avoid proxy/non-enumerable issues
const deepClone = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item));
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
};

// Normalizes a single variant
const normalizeVariant = (variant, fallbackParentId = "") => {
  const raw = deepClone(variant || {});

  // Parent product ID (ctP002ProductId)
  const ctP002ProductId = normalizeId(
    raw.ctP002ProductId ||
      raw.CTP002ProductId ||
      raw.ctp002ProductId ||
      raw.productId ||
      raw.ProductId ||
      raw.parentId ||
      fallbackParentId
  );

  // Variant row ID (ctP001ProductId)
  const ctP001ProductId = normalizeId(
    raw.ctP001ProductId ||
      raw.CTP001ProductId ||
      raw.ctp001ProductId ||
      raw.id ||
      raw.Id ||
      raw.ID ||
      raw.variantRowId ||
      raw.rowId
  );

  // Actual variant ID (the unique ID for this variant row)
  const variantId = normalizeId(
    raw.variantId ||
      raw.VariantId ||
      raw.CTP001ProductId ||
      raw.ctP001ProductId ||
      raw.id ||
      raw.Id ||
      ctP001ProductId ||
      ctP002ProductId
  );

  // Build normalized variant from scratch
  const normalizedVariant = {
    // Basic info
    name: raw.name || raw.variantName || null,
    color: raw.color || raw.Color || null,
    size: raw.size || raw.Size || null,
    imageUrl: raw.imageUrl || raw.image || raw.imagePath || null,

    // Pricing
    price:
      raw.price !== undefined && raw.price !== null ? Number(raw.price) : null,
    sellingPrice:
      raw.sellingPrice !== undefined && raw.sellingPrice !== null
        ? Number(raw.sellingPrice)
        : null,

    // Other
    bCode: raw.bCode || raw.BCode || null,
    status:
      raw.status !== undefined && raw.status !== null ? raw.status : null,

    // IDs
    ctP001ProductId,
    ctP002ProductId,
    variantId,
  };

  // Internal metadata
  normalizedVariant._rowVariantId = ctP001ProductId || variantId;
  normalizedVariant._payloadVariantId = ctP002ProductId;
  normalizedVariant._variantId = variantId;
  normalizedVariant._parentId = ctP002ProductId;

  normalizedVariant._displayName =
    normalizedVariant.name ||
    [normalizedVariant.color, normalizedVariant.size].filter(Boolean).join(" / ") ||
    `Variant ${variantId || ctP001ProductId || ctP002ProductId}`;

  normalizedVariant._price = Number(
    normalizedVariant.sellingPrice ?? normalizedVariant.price ?? 0
  );

  return normalizedVariant;
};

// Merge variants by unique row key
const mergeUniqueVariants = (existing = [], incoming = []) => {
  const map = new Map();
  const allVariants = [...existing, ...incoming];

  allVariants.forEach((variant) => {
    const normalized = normalizeVariant(variant, variant?._parentId);

    const key =
      normalized._rowVariantId ||
      normalized.variantId ||
      normalized.ctP001ProductId ||
      `${normalized.ctP002ProductId}-${normalized._displayName}-${normalized.color || ""}-${normalized.size || ""}`;

    if (map.has(key)) {
      map.set(key, { ...map.get(key), ...normalized });
    } else {
      map.set(key, normalized);
    }
  });

  return Array.from(map.values());
};

// Group variants by parent product ID (ctP002ProductId)
const groupVariantsByParent = (variants = []) => {
  const grouped = {};

  variants.forEach((variant) => {
    const normalized = normalizeVariant(variant, variant?._parentId);
    const parentId = normalized.ctP002ProductId;

    if (!parentId) {
      return;
    }

    if (!grouped[parentId]) {
      grouped[parentId] = [];
    }

    grouped[parentId].push(normalized);
  });

  return grouped;
};

/* ════════════════════════════════════════════
   ASYNC THUNKS
════════════════════════════════════════════ */

export const fetchAllProducts = createAsyncThunk(
  "products/fetchAllProducts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/Product-Get" },
      });

      const products = toArray(response.data);
      return sortByNewest(products);
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch all products")
      );
    }
  }
);

export const fetchProducts = createAsyncThunk(
  "products/fetchProducts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/Product-Get" },
      });

      const products = toArray(response.data).filter(
        (product) => Number(product?.status) === 1
      );

      return sortByNewest(products);
    } catch (error) {
      return rejectWithValue(toErrorPayload(error, "Failed to fetch products"));
    }
  }
);

export const fetchProduct = createAsyncThunk(
  "products/fetchProduct",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/Product-Get" },
      });

      const activeProducts = toArray(response.data).filter(
        (product) => Number(product?.status) === 1
      );

      return sortByNewest(activeProducts).slice(0, 24);
    } catch (error) {
      return rejectWithValue(toErrorPayload(error, "Failed to fetch product"));
    }
  }
);

export const fetchProductById = createAsyncThunk(
  "products/fetchProductById",
  async (productId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: `/Product/Product-Get-by-Product_ID/${productId}` },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch product by ID")
      );
    }
  }
);

export const fetchActiveProducts = createAsyncThunk(
  "products/fetchActiveProducts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/Product-Get-Active" },
      });

      const products = toArray(response.data);
      return sortByNewest(products);
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch active products")
      );
    }
  }
);

export const fetchInactiveProducts = createAsyncThunk(
  "products/fetchInactiveProducts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/Product-Get-0" },
      });

      const products = toArray(response.data);
      return sortByNewest(products);
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch inactive products")
      );
    }
  }
);

export const fetchProductsWithoutVariants = createAsyncThunk(
  "products/fetchProductsWithoutVariants",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/GetProductsWithoutVariants" },
      });

      const products = toArray(response.data);
      return sortByNewest(products);
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch products without variants")
      );
    }
  }
);

export const createProductVariantAndMerge = createAsyncThunk(
  "products/createProductVariantAndMerge",
  async (variantData, { rejectWithValue }) => {
    try {
      const now = new Date().toISOString();

      const variantsArray = Array.isArray(variantData?.variants)
        ? variantData.variants
        : [];

      const enrichedVariants = variantsArray.map((variant) => ({
        ...variant,
        createdAt: variant?.createdAt || now,
        updatedAt: variant?.updatedAt || now,
      }));

      const payload = {
        ...variantData,
        variants: enrichedVariants,
      };

      const response = await axiosInstance.post("/", payload, {
        params: { endpoint: "/Product/CreateProductVariantAndMerge" },
        headers: {
          accept: "text/plain",
          "Content-Type": "application/json",
        },
      });

      return {
        ctP002ProductId: normalizeId(variantData?.ctP002ProductId),
        createdVariants: enrichedVariants,
        raw: response.data,
      };
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to create product variant and merge")
      );
    }
  }
);

export const fetchCTP002ProductVariants = createAsyncThunk(
  "products/fetchCTP002ProductVariants",
  async (ctp002ProductId, { rejectWithValue }) => {
    try {
      const productId = normalizeId(ctp002ProductId);

      const response = await axiosInstance.get("/", {
        params: {
          endpoint: `/Product/GetCTP002ProductVariants/${productId}`,
        },
      });

      const rawVariants = toArray(response.data);

      const normalizedVariants = rawVariants.map((variant) =>
        normalizeVariant(variant, productId)
      );

      return {
        ctp002ProductId: productId,
        variants: normalizedVariants,
      };
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch CTP002 product variants")
      );
    }
  }
);

export const fetchMultipleCTP002ProductVariants = createAsyncThunk(
  "products/fetchMultipleCTP002ProductVariants",
  async (ctp002ProductIds, { rejectWithValue }) => {
    try {
      const ids = Array.isArray(ctp002ProductIds)
        ? ctp002ProductIds.map((id) => normalizeId(id)).filter(Boolean)
        : [];

      if (ids.length === 0) {
        return { ctp002ProductIds: [], variants: [] };
      }

      const response = await axiosInstance.post("/", ids, {
        params: { endpoint: "/Product/GetMultiplyCTP002ProductVariants" },
        headers: {
          accept: "text/plain",
          "Content-Type": "application/json",
        },
      });

      let normalizedVariants = [];

      if (Array.isArray(response.data)) {
        normalizedVariants = response.data.map((variant) =>
          normalizeVariant(variant)
        );
      } else if (response.data && typeof response.data === "object") {
        Object.entries(response.data).forEach(([parentId, variantList]) => {
          if (Array.isArray(variantList)) {
            variantList.forEach((variant) => {
              normalizedVariants.push(normalizeVariant(variant, parentId));
            });
          }
        });
      }

      return {
        ctp002ProductIds: ids,
        variants: normalizedVariants,
      };
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch multiple CTP002 product variants")
      );
    }
  }
);

export const fetchAllCTP002ProductVariants = createAsyncThunk(
  "products/fetchAllCTP002ProductVariants",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/", {
        params: { endpoint: "/Product/GetAllCTP002ProductVariants" },
      });

      let rawVariants = [];

      if (Array.isArray(response.data)) {
        rawVariants = response.data;
      } else if (Array.isArray(response.data?.data)) {
        rawVariants = response.data.data;
      } else if (Array.isArray(response.data?.variants)) {
        rawVariants = response.data.variants;
      } else if (response.data && typeof response.data === "object") {
        Object.entries(response.data).forEach(([parentId, variantList]) => {
          if (Array.isArray(variantList)) {
            variantList.forEach((variant) => {
              rawVariants.push({ ...variant, _parentId: parentId });
            });
          }
        });
      }

      const normalizedVariants = rawVariants.map((variant) =>
        normalizeVariant(variant, variant?._parentId)
      );

      return normalizedVariants;
    } catch (error) {
      return rejectWithValue(
        toErrorPayload(error, "Failed to fetch all CTP002 product variants")
      );
    }
  }
);

/* ════════════════════════════════════════════
   INITIAL STATE
════════════════════════════════════════════ */

const initialState = {
  // Products
  products: [],
  filteredProducts: [],
  brandProducts: [],
  productsByShowroom: {},
  productsByCategory: {},
  currentProduct: null,
  activeProducts: [],
  inactiveProducts: [],
  productsWithoutVariants: [],

  // Pagination
  currentPage: 1,

  // Variants
  ctp002ProductVariants: {},
  allCTP002ProductVariants: [],

  // Combined
  productVariants: {},
  multipleProductVariants: [],
  allProductVariants: [],

  // Operations
  variantMergeResult: null,

  // Loading
  loading: false,
  error: null,

  // Per-product variant loading
  ctp002ProductVariantsLoading: {},
  ctp002ProductVariantsError: {},

  // Bulk
  multipleCTP002ProductVariantsLoading: false,
  multipleCTP002ProductVariantsError: null,

  allCTP002ProductVariantsLoading: false,
  allCTP002ProductVariantsError: null,
};

/* ════════════════════════════════════════════
   SLICE
════════════════════════════════════════════ */

const productSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    setPage: (state, action) => {
      state.currentPage = action.payload;
    },
    clearProducts: (state) => {
      state.products = [];
      state.filteredProducts = [];
      state.brandProducts = [];
      state.productsByShowroom = {};
      state.productsByCategory = {};
      state.currentProduct = null;
      state.activeProducts = [];
      state.inactiveProducts = [];
      state.productsWithoutVariants = [];
      state.error = null;
    },
    resetProducts: (state) => {
      state.products = [];
    },
    clearCurrentProduct: (state) => {
      state.currentProduct = null;
    },
    clearVariantMergeResult: (state) => {
      state.variantMergeResult = null;
    },
    clearProductVariants: (state) => {
      state.productVariants = {};
      state.multipleProductVariants = [];
      state.allProductVariants = [];
      state.ctp002ProductVariants = {};
      state.allCTP002ProductVariants = [];
      state.ctp002ProductVariantsLoading = {};
      state.ctp002ProductVariantsError = {};
      state.multipleCTP002ProductVariantsLoading = false;
      state.multipleCTP002ProductVariantsError = null;
      state.allCTP002ProductVariantsLoading = false;
      state.allCTP002ProductVariantsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProducts
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload || [];
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // fetchProduct
      .addCase(fetchProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload || [];
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // fetchAllProducts
      .addCase(fetchAllProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload || [];
      })
      .addCase(fetchAllProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // fetchProductById
      .addCase(fetchProductById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProduct = action.payload || null;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // fetchActiveProducts
      .addCase(fetchActiveProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.activeProducts = action.payload || [];
      })
      .addCase(fetchActiveProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // fetchInactiveProducts
      .addCase(fetchInactiveProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInactiveProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.inactiveProducts = action.payload || [];
      })
      .addCase(fetchInactiveProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // fetchProductsWithoutVariants
      .addCase(fetchProductsWithoutVariants.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductsWithoutVariants.fulfilled, (state, action) => {
        state.loading = false;
        state.productsWithoutVariants = action.payload || [];
      })
      .addCase(fetchProductsWithoutVariants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || null;
      })

      // createProductVariantAndMerge
      .addCase(createProductVariantAndMerge.pending, (state) => {
        state.variantMergeResult = null;
      })
      .addCase(createProductVariantAndMerge.fulfilled, (state, action) => {
        const { ctP002ProductId, createdVariants } = action.payload || {};
        const parentId = normalizeId(ctP002ProductId);

        if (parentId && Array.isArray(createdVariants) && createdVariants.length) {
          const existingVariants = state.ctp002ProductVariants[parentId] || [];

          const normalizedCreated = createdVariants.map((variant) =>
            normalizeVariant(variant, parentId)
          );

          state.ctp002ProductVariants[parentId] = mergeUniqueVariants(
            existingVariants,
            normalizedCreated
          );
        }

        state.variantMergeResult = {
          success: true,
          message: action.payload?.raw?.responseMessage || "Variants created successfully",
        };
      })
      .addCase(createProductVariantAndMerge.rejected, (state, action) => {
        state.variantMergeResult = {
          success: false,
          message: action.payload || "Failed to create product variants",
        };
      })

      // fetchCTP002ProductVariants
      .addCase(fetchCTP002ProductVariants.pending, (state, action) => {
        const productId = normalizeId(action.meta.arg);
        state.ctp002ProductVariantsLoading[productId] = true;
        state.ctp002ProductVariantsError[productId] = null;
      })
      .addCase(fetchCTP002ProductVariants.fulfilled, (state, action) => {
        const { ctp002ProductId, variants } = action.payload || {};
        const productId = normalizeId(ctp002ProductId);

        state.ctp002ProductVariantsLoading[productId] = false;
        state.ctp002ProductVariantsError[productId] = null;

        state.ctp002ProductVariants[productId] = mergeUniqueVariants(
          [],
          Array.isArray(variants) ? variants : []
        );
      })
      .addCase(fetchCTP002ProductVariants.rejected, (state, action) => {
        const productId = normalizeId(action.meta.arg);
        state.ctp002ProductVariantsLoading[productId] = false;
        state.ctp002ProductVariantsError[productId] =
          action.payload || action.error?.message || "Failed to fetch variants";
      })

      // fetchMultipleCTP002ProductVariants
      .addCase(fetchMultipleCTP002ProductVariants.pending, (state, action) => {
        state.multipleCTP002ProductVariantsLoading = true;
        state.multipleCTP002ProductVariantsError = null;

        const requestedIds = Array.isArray(action.meta.arg)
          ? action.meta.arg
          : [];

        requestedIds.forEach((id) => {
          const key = normalizeId(id);
          if (key) {
            state.ctp002ProductVariantsLoading[key] = true;
            state.ctp002ProductVariantsError[key] = null;
          }
        });
      })
      .addCase(fetchMultipleCTP002ProductVariants.fulfilled, (state, action) => {
        state.multipleCTP002ProductVariantsLoading = false;
        state.multipleCTP002ProductVariantsError = null;

        const { variants } = action.payload || {};
        const allVariants = Array.isArray(variants) ? variants : [];

        const groupedVariants = groupVariantsByParent(allVariants);

        Object.entries(groupedVariants).forEach(([parentId, variantList]) => {
          state.ctp002ProductVariantsLoading[parentId] = false;
          state.ctp002ProductVariantsError[parentId] = null;

          const existing = state.ctp002ProductVariants[parentId] || [];
          state.ctp002ProductVariants[parentId] = mergeUniqueVariants(
            existing,
            variantList
          );
        });

        state.multipleProductVariants = allVariants;
      })
      .addCase(fetchMultipleCTP002ProductVariants.rejected, (state, action) => {
        state.multipleCTP002ProductVariantsLoading = false;
        state.multipleCTP002ProductVariantsError =
          action.payload || action.error?.message || "Failed to fetch multiple variants";

        const requestedIds = Array.isArray(action.meta.arg)
          ? action.meta.arg
          : [];

        requestedIds.forEach((id) => {
          const key = normalizeId(id);
          if (key) {
            state.ctp002ProductVariantsLoading[key] = false;
            state.ctp002ProductVariantsError[key] =
              action.payload || "Failed to fetch variants";
          }
        });
      })

      // fetchAllCTP002ProductVariants
      .addCase(fetchAllCTP002ProductVariants.pending, (state) => {
        state.allCTP002ProductVariantsLoading = true;
        state.allCTP002ProductVariantsError = null;
      })
      .addCase(fetchAllCTP002ProductVariants.fulfilled, (state, action) => {
        state.allCTP002ProductVariantsLoading = false;
        state.allCTP002ProductVariantsError = null;

        const allVariants = Array.isArray(action.payload) ? action.payload : [];

        state.allCTP002ProductVariants = mergeUniqueVariants([], allVariants);

        const groupedVariants = groupVariantsByParent(allVariants);

        Object.entries(groupedVariants).forEach(([parentId, variantList]) => {
          state.ctp002ProductVariantsLoading[parentId] = false;
          state.ctp002ProductVariantsError[parentId] = null;

          const existing = state.ctp002ProductVariants[parentId] || [];
          state.ctp002ProductVariants[parentId] = mergeUniqueVariants(
            existing,
            variantList
          );
        });
      })
      .addCase(fetchAllCTP002ProductVariants.rejected, (state, action) => {
        state.allCTP002ProductVariantsLoading = false;
        state.allCTP002ProductVariantsError =
          action.payload || action.error?.message || "Failed to fetch all variants";
      });
  },
});

/* ════════════════════════════════════════════
   SELECTORS
════════════════════════════════════════════ */

export const selectAllProducts = (state) => state.products?.products || [];
export const selectProductsLoading = (state) => Boolean(state.products?.loading);
export const selectProductsError = (state) => state.products?.error || null;

export const selectCurrentProduct = (state) => state.products?.currentProduct || null;

export const selectActiveProducts = (state) => state.products?.activeProducts || [];
export const selectInactiveProducts = (state) => state.products?.inactiveProducts || [];
export const selectProductsWithoutVariants = (state) =>
  state.products?.productsWithoutVariants || [];

export const selectCurrentPage = (state) => state.products?.currentPage || 1;

export const selectCTP002VariantsMap = (state) =>
  state.products?.ctp002ProductVariants || {};

export const selectCTP002VariantsByProductId = (state, ctp002ProductId) => {
  const productId = normalizeId(ctp002ProductId);
  return state.products?.ctp002ProductVariants?.[productId] || [];
};

export const selectCTP002VariantsLoadingMap = (state) =>
  state.products?.ctp002ProductVariantsLoading || {};

export const selectCTP002VariantsErrorMap = (state) =>
  state.products?.ctp002ProductVariantsError || {};

export const selectCTP002VariantsLoadingByProductId = (state, ctp002ProductId) => {
  const productId = normalizeId(ctp002ProductId);
  return Boolean(state.products?.ctp002ProductVariantsLoading?.[productId]);
};

export const selectCTP002VariantsErrorByProductId = (state, ctp002ProductId) => {
  const productId = normalizeId(ctp002ProductId);
  return state.products?.ctp002ProductVariantsError?.[productId] || null;
};

export const selectMultipleCTP002ProductVariantsLoading = (state) =>
  Boolean(state.products?.multipleCTP002ProductVariantsLoading);

export const selectMultipleCTP002ProductVariantsError = (state) =>
  state.products?.multipleCTP002ProductVariantsError || null;

export const selectAllCTP002ProductVariants = (state) =>
  state.products?.allCTP002ProductVariants || [];

export const selectAllCTP002ProductVariantsLoading = (state) =>
  Boolean(state.products?.allCTP002ProductVariantsLoading);

export const selectAllCTP002ProductVariantsError = (state) =>
  state.products?.allCTP002ProductVariantsError || null;

export const selectVariantMergeResult = (state) =>
  state.products?.variantMergeResult || null;

export const {
  clearProducts,
  setPage,
  clearCurrentProduct,
  resetProducts,
  clearVariantMergeResult,
  clearProductVariants,
} = productSlice.actions;

export default productSlice.reducer;