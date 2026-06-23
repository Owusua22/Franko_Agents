
import { useLocation, Navigate } from 'react-router-dom';

import AgentDashboard from './AgentDashboard';
import AgentOrders from './AgentOrders';
import AgentHome from '../AgentHome';
import CTP001ProductsPage from './CTP001ProductsPage';

const AgentPage = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Function to render content based on the current path
  const renderContent = () => {
    switch (currentPath) {
      case '/agent/dashboard':
        return <AgentDashboard />;
      case '/agent/orders':
        return <AgentOrders />;
      case '/agent':
        return <Navigate to="/agent/dashboard" />;
      default:
        return <Navigate to="/agent/dashboard" />;
      case '/agent/order-placement':
        return <CTP001ProductsPage />;
    }
  };

  return (
    <AgentHome>
      <div style={{ padding: 5, width: '100%' }}>
        {renderContent()}
      </div>
    </AgentHome>
  );
};

export default AgentPage;
