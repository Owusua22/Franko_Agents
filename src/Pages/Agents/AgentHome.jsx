import { useState, useMemo } from 'react';
import {
  Layout,
  Menu,
  Button,
  Typography,
  Avatar,
  Popconfirm,
  Tag,
  Tooltip,

} from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  IdcardOutlined,

  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutCustomer } from '../../Redux/Slice/customerSlice';

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;

/* ── Theme ── */
const THEME = {
  primary: '#1a6b3c',
  secondary: '#145c32',
  accent: '#22c55e',
  accentSoft: '#16a34a',
  light: '#f0faf4',
  border: '#d1fae5',
  surface: '#ffffff',
  muted: 'rgba(255,255,255,0.55)',
  menuHover: 'rgba(255,255,255,0.10)',
  menuSelected: '#ffffff',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  dangerBorder: '#fecaca',
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
  },
};

const SIDEBAR_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

const SidebarBrand = ({ collapsed, onToggle }) => (
  <div
    style={{
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'space-between',
      padding: collapsed ? '0 16px' : '0 16px 0 20px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0,
      gap: 8,
    }}
  >
    {!collapsed && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Logo mark */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.accentSoft})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 12px rgba(34,197,94,0.35)`,
            flexShrink: 0,
          }}
        >
          <SafetyOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div>
          <Title
            level={5}
            style={{
              margin: 0,
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              lineHeight: 1.2,
              letterSpacing: '0.3px',
            }}
          >
            Agent Portal
          </Title>
          <Text style={{ color: THEME.muted, fontSize: 10, letterSpacing: '0.5px' }}>
            MANAGEMENT SYSTEM
          </Text>
        </div>
      </div>
    )}

    {collapsed && (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.accentSoft})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px rgba(34,197,94,0.3)`,
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <SafetyOutlined style={{ color: '#fff', fontSize: 16 }} />
      </div>
    )}

    {!collapsed && (
      <Button
        type="text"
        onClick={onToggle}
        icon={<MenuFoldOutlined style={{ fontSize: 16 }} />}
        style={{
          color: THEME.muted,
          width: 32,
          height: 32,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'color 0.2s',
        }}
      />
    )}
  </div>
);

/* ────────────────────────────────────────────
   Main Component
──────────────────────────────────────────── */
const AgentHome = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const currentCustomer = useSelector((state) => state.customer.currentCustomerDetails);
  const isAuthenticated = useSelector((state) => state.customer.isAuthenticated);

  const toggleCollapse = () => setCollapsed((c) => !c);

  /* Derived values */
  const firstName = currentCustomer?.firstName || '';
  const lastName = currentCustomer?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Agent';
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'AG';
  const n1UId = currentCustomer?.n1UId || null;
  const contactNumber = currentCustomer?.contactNumber || '';

  const loginStatus = currentCustomer?.loginStatus ?? false;
  const authStatus = isAuthenticated && loginStatus;

  const handleLogout = () => {
    dispatch(logoutCustomer());
    navigate('/', { replace: true });
  };
const selectedKey = useMemo(() => {
  const path = location.pathname;
  if (path.includes('/orders')) return '2';
  if (path.includes('/products')) return '3';
  return '1'; // dashboard
}, [location.pathname]);
  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined style={{ fontSize: 17 }} />,
      label: 'Dashboard',
      onClick: () => navigate('/agent/dashboard'),
    },
    {
      key: '2',
      icon: <ShoppingOutlined style={{ fontSize: 17 }} />,
      label: 'Orders',
      onClick: () => navigate('/agent/orders'),
    },
 {
      key: '3',
      icon: <ShoppingOutlined style={{ fontSize: 17 }} />,
      label: 'Products',
      onClick: () => navigate('/agent/products'),
    },
  ].map((item) => ({ ...item, className: 'agent-nav-item' }));


  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
      {/* ── Global Styles ── */}
      <style>{`
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }

        /* Nav items */
        .agent-nav-item {
          margin: 3px 10px !important;
          width: calc(100% - 20px) !important;
          border-radius: 10px !important;
          color: rgba(255,255,255,0.72) !important;
          font-size: 14px !important;
          transition: all 0.2s ease !important;
          height: 44px !important;
          line-height: 44px !important;
        }
        .agent-nav-item:not(.ant-menu-item-selected):hover {
          background: ${THEME.menuHover} !important;
          color: #ffffff !important;
          padding-left: 18px !important;
        }
        .agent-nav-item.ant-menu-item-selected {
          background: rgba(255,255,255,0.15) !important;
          color: #ffffff !important;
          font-weight: 600 !important;
          border-left: 3px solid ${THEME.accent} !important;
        }
        .agent-nav-item.ant-menu-item-selected .anticon {
          color: ${THEME.accent} !important;
        }
        .ant-menu-inline-collapsed .agent-nav-item {
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /* Logout sidebar button */
        .logout-sidebar-btn {
          width: calc(100% - 24px) !important;
          margin: 4px 12px 0 !important;
          border-radius: 10px !important;
          color: rgba(255,255,255,0.72) !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          transition: all 0.2s ease !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          background: rgba(255,255,255,0.04) !important;
          height: 44px !important;
          font-size: 14px !important;
        }
        .logout-sidebar-btn:hover {
          background: rgba(239,68,68,0.18) !important;
          color: #fca5a5 !important;
          border-color: rgba(239,68,68,0.3) !important;
        }

        /* Popconfirm ok button */
        .logout-confirm-popup .ant-btn-primary {
          background: ${THEME.danger} !important;
          border-color: ${THEME.danger} !important;
          border-radius: 6px !important;
        }
        .logout-confirm-popup .ant-btn-primary:hover {
          background: #dc2626 !important;
        }
        .logout-confirm-popup .ant-btn-default {
          border-radius: 6px !important;
        }

        /* Header logout button */
        .header-logout-btn {
          border-radius: 8px !important;
          font-weight: 500 !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          height: 36px !important;
          padding: 0 14px !important;
          background: ${THEME.dangerSoft} !important;
          border: 1px solid ${THEME.dangerBorder} !important;
          color: ${THEME.danger} !important;
          transition: all 0.2s ease !important;
        }
        .header-logout-btn:hover {
          background: ${THEME.danger} !important;
          color: #ffffff !important;
          border-color: ${THEME.danger} !important;
          box-shadow: 0 4px 12px rgba(239,68,68,0.3) !important;
          transform: translateY(-1px) !important;
        }

        /* Scrollbar for sidebar if needed */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      {/* ══════════════════════════════
          SIDEBAR
      ══════════════════════════════ */}
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
          background: `linear-gradient(175deg, #1e7a45 0%, ${THEME.primary} 40%, ${THEME.secondary} 100%)`,
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        theme="dark"
      >
        {/* Brand */}
        <SidebarBrand collapsed={collapsed} onToggle={toggleCollapse} />

      
      

        {/* Nav Menu */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{
            borderRight: 0,
            backgroundColor: 'transparent',
            flex: 1,
            paddingBottom: 8,
          }}
          inlineCollapsed={collapsed}
        />

        {/* ── Bottom: User info + Logout ── */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 12,
            paddingBottom: 12,
            flexShrink: 0,
          }}
        >
      
        
        </div>
      </Sider>

      {/* ══════════════════════════════
          MAIN LAYOUT
      ══════════════════════════════ */}
      <Layout
        style={{
          marginLeft: collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#f1f5f9',
        }}
      >
        {/* ── Top Header ── */}
        <Header
          style={{
            padding: 0,
            background: THEME.surface,
            height: 64,
            boxShadow: '0 1px 0 #e2e8f0, 0 2px 8px rgba(0,0,0,0.04)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          {/* Left accent bar */}
          <div
            style={{
              width: 4,
              background: `linear-gradient(180deg, ${THEME.accent}, ${THEME.primary})`,
              flexShrink: 0,
            }}
          />

          {/* Expand toggle (shown when collapsed) */}
          {collapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 16,
              }}
            >
              <Button
                type="text"
                onClick={toggleCollapse}
                icon={<MenuUnfoldOutlined style={{ fontSize: 18, color: THEME.primary }} />}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: THEME.light,
                  border: `1px solid ${THEME.border}`,
                }}
              />
            </div>
          )}

          {/* Page breadcrumb area (left) */}
          {!collapsed && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 24,
              }}
            >
              <Text
                style={{
                  color: THEME.text.muted,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {selectedKey === '1' ? '🏠 Dashboard' : '📦 Orders'}
              </Text>
            </div>
          )}

          {/* Right side: Agent info + Logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingRight: 24,
              marginLeft: 'auto',
            }}
          >
            {/* Agent info card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '6px 14px 6px 10px',
                borderRadius: 12,
                background: THEME.light,
                border: `1px solid ${THEME.border}`,
              }}
            >
              {/* Avatar with status dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  size={36}
                  style={{
                    background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary})`,
                    fontWeight: 700,
                    fontSize: 13,
                    boxShadow: '0 2px 6px rgba(26,107,60,0.35)',
                  }}
                >
                  {initials}
                </Avatar>
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: authStatus ? THEME.accent : THEME.danger,
                    border: `2px solid ${THEME.surface}`,
                  }}
                />
              </div>

              {/* Name + badges */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: THEME.text.primary,
                      lineHeight: 1,
                    }}
                  >
                    {fullName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: THEME.text.secondary,
                      lineHeight: 1,
                    }}
                  >
                    · {contactNumber}
                  </Text>
                </div>

                {/* Badges row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {/* N1UID */}
                  <Tooltip title="N1 User ID">
                    <Tag
                      icon={<IdcardOutlined />}
                      style={{
                        margin: 0,
                        fontSize: 10,
                        height: 18,
                        lineHeight: '16px',
                        borderRadius: 6,
                        padding: '0 6px',
                        background: n1UId ? '#eff6ff' : '#fefce8',
                        color: n1UId ? '#1d4ed8' : '#a16207',
                        border: n1UId ? '1px solid #bfdbfe' : '1px solid #fde68a',
                        fontWeight: 500,
                      }}
                    >
                      {n1UId ?? 'No N1UID'}
                    </Tag>
                  </Tooltip>

                  {/* Auth status */}
                  <Tooltip title={authStatus ? 'Session is active' : 'Session has expired'}>
                    <Tag
                      icon={
                        authStatus ? (
                          <CheckCircleFilled style={{ fontSize: 9 }} />
                        ) : (
                          <CloseCircleFilled style={{ fontSize: 9 }} />
                        )
                      }
                      style={{
                        margin: 0,
                        fontSize: 10,
                        height: 18,
                        lineHeight: '16px',
                        borderRadius: 6,
                        padding: '0 6px',
                        background: authStatus ? '#f0fdf4' : THEME.dangerSoft,
                        color: authStatus ? '#15803d' : '#b91c1c',
                        border: authStatus ? '1px solid #bbf7d0' : `1px solid ${THEME.dangerBorder}`,
                        fontWeight: 500,
                      }}
                    >
                      {authStatus ? 'Active' : 'Expired'}
                    </Tag>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Logout button */}
            <Popconfirm
              overlayClassName="logout-confirm-popup"
              title={
                <span style={{ fontWeight: 600 }}>Confirm Sign Out</span>
              }
              description="Your session will end and you'll be redirected to the home page."
              onConfirm={handleLogout}
              okText="Sign Out"
              cancelText="Stay"
              placement="bottomRight"
              icon={<LogoutOutlined style={{ color: THEME.danger }} />}
            >
              <Button className="header-logout-btn" icon={<LogoutOutlined />}>
                Sign Out
              </Button>
            </Popconfirm>
          </div>
        </Header>

        {/* ── Page Content ── */}
        <Content style={{ margin: '24px', flex: '1 0 auto' }}>
          <div
            style={{
              padding: 28,
              background: THEME.surface,
              borderRadius: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
              border: '1px solid #e2e8f0',
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