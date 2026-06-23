// store.js
import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";

import orderReducer from "./Slice/orderSlice";
import customerReducer from "./Slice/customerSlice";
import ctp001Reducer from "./Slice/ctp001Slice";

// Combine all reducers
const rootReducer = combineReducers({
  orders: orderReducer,
  ctp001: ctp001Reducer,
  customer: customerReducer,
});

// Configure store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});