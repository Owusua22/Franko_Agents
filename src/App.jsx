import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthPage from "./Pages/AuthPage";

import AgentHome from "./Pages/Agents/AgentHome";
import AgentDashboard from "./Pages/Agents/AgentPage/AgentDashboard";
import AgentOrders from "./Pages/Agents/AgentPage/AgentOrders";
import MergedProducts from "./Pages/Agents/AgentPage/MergedProducts";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing / Authentication */}
        <Route path="/" element={<AuthPage />} />

        {/* Agent Layout */}
        <Route
          path="/agent"
          element={
            <AgentHome>
              <Navigate to="/agent/dashboard" replace />
            </AgentHome>
          }
        />

        <Route
          path="/agent/dashboard"
          element={
            <AgentHome>
              <AgentDashboard />
            </AgentHome>
          }
        />

        <Route
          path="/agent/orders"
          element={
            <AgentHome>
              <AgentOrders />
            </AgentHome>
          }
        />
            <Route
          path="/agent/products"
          element={
            <AgentHome>
              <MergedProducts />
            </AgentHome>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;