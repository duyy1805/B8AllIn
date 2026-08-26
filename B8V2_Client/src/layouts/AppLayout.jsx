import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();

  const selectedKey =
    location.pathname.startsWith('/processes') ? '/processes' :
      location.pathname.startsWith('/products') ? '/products' :
      location.pathname.startsWith('/my-documents') ? '/processes' :
        location.pathname.startsWith('/settings') ? '/settings/users' :
        '/';

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    ...(['DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW','PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE'].some(permission => hasPermission(permission)) ? [{ key: '/processes', icon: <FileTextOutlined />, label: 'Quy trình' }] : []),
    ...(['DOCUMENT_VIEW_ALL','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE','DOCUMENT_CREATE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'].some(permission => hasPermission(permission)) ? [{ key: '/products', icon: <AppstoreOutlined />, label: 'Sản phẩm' }] : []),
    ...(hasPermission('RBAC_VIEW') ? [{ key: '/settings/users', icon: <SettingOutlined />, label: 'Cấu hình' }] : [])
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null}>
        <div className="brand">{collapsed ? 'B8' : 'B8 Document'}</div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header className="app-header">
          <Space className="header-collapse-zone">
            <button type="button" className="collapse-btn" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} onClick={() => setCollapsed(v => !v)}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </Space>

          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Đăng xuất',
                  onClick: () => { logout(); navigate('/login'); }
                }
              ]
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <div className="user-summary">
                <Typography.Text strong>{user?.fullName || user?.username}</Typography.Text>
                <Typography.Text type="secondary" className="user-role">
                  {(user?.roles || []).join(', ')}
                </Typography.Text>
              </div>
            </Space>
          </Dropdown>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
