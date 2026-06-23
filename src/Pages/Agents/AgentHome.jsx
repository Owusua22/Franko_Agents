import React, { useState, useMemo } from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  AppstoreAddOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider, Content, Header } = Layout;
const { Title } = Typography;

// Green color palette
const GREEN_PRIMARY = '#1a6b3c';
const GREEN_SECONDARY = '#145c32';
const GREEN_LIGHT = '#f0faf4';
const GREEN_ACCENT = '#22c55e';

const SIDEBAR_WIDTH = 240;
const COLLAPSED_WIDTH = 80;

const AgentHome = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapse = () => setCollapsed((c) => !c);

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/order-placement')) return '3';
    if (path.includes('/orders')) return '2';
    return '1';
  }, [location.pathname]);

  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined style={{ fontSize: 18 }} />,
      label: 'Dashboard',
      onClick: () => navigate('/agent/dashboard'),
    },
    {
      key: '2',
      icon: <ShoppingOutlined style={{ fontSize: 18 }} />,
      label: 'Orders',
      onClick: () => navigate('/agent/orders'),
    },
    {
      key: '3',
      icon: <AppstoreAddOutlined style={{ fontSize: 18 }} />,
      label: 'Order Placement',
      onClick: () => navigate('/agent/order-placement'),
    },
  ].map((item) => ({ ...item, className: 'agent-menu-item' }));

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <style>{`
        html { scroll-behavior: smooth; }

        .agent-menu-item {
          margin: 6px 12px !important;
          width: calc(100% - 24px) !important;
          border-radius: 8px !important;
          transition: background 0.2s ease, transform 0.2s ease !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }

        .agent-menu-item:not(.ant-menu-item-selected):hover {
          background-color: rgba(255, 255, 255, 0.12) !important;
          color: #ffffff !important;
          transform: translateX(3px);
        }

        .agent-menu-item.ant-menu-item-selected {
          background-color: #ffffff !important;
          color: ${GREEN_PRIMARY} !important;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .agent-menu-item.ant-menu-item-selected .anticon {
          color: ${GREEN_PRIMARY} !important;
        }

        .toggle-btn:hover {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }
      `}</style>

      {/* SIDEBAR */}
      <Sider
        width={SIDEBAR_WIDTH}
        collapsedWidth={COLLAPSED_WIDTH}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: `linear-gradient(180deg, ${GREEN_PRIMARY} 0%, ${GREEN_SECONDARY} 100%)`,
          boxShadow: '4px 0 16px rgba(0, 0, 0, 0.08)',
          zIndex: 100,
          overflow: 'hidden',
        }}
        theme="dark"
      >
        {/* Logo / Header */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            whiteSpace: 'nowrap',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: GREEN_ACCENT,
                  boxShadow: `0 0 8px ${GREEN_ACCENT}`,
                }}
              />
              <Title
                level={4}
                style={{ margin: 0, color: 'white', fontWeight: 700, letterSpacing: '0.5px' }}
              >
                Agent Panel
              </Title>
            </div>
          )}
          <Button
            type="text"
            className="toggle-btn"
            onClick={toggleCollapse}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            style={{
              color: 'white',
              fontSize: 16,
              width: 36,
              height: 36,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>

        {/* Nav Menu */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{
            marginTop: 12,
            borderRight: 0,
            backgroundColor: 'transparent',
          }}
        />
      </Sider>

      {/* MAIN LAYOUT */}
      <Layout
        style={{
          marginLeft: collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          transition: 'margin-left 0.2s ease',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Header */}
        <Header
          style={{
            padding: 0,
            background: '#ffffff',
            height: 64,
            boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              height: 3,
              background: `linear-gradient(90deg, ${GREEN_PRIMARY}, ${GREEN_ACCENT}, ${GREEN_PRIMARY})`,
            }}
          />
        </Header>

        {/* Content */}
        <Content style={{ margin: '24px', flex: '1 0 auto' }}>
          <div
            style={{
              padding: 24,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
              border: `1px solid ${GREEN_LIGHT}`,
              minHeight: 'calc(100vh - 136px)',
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AgentHome;