import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  InboxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const selectedKey =
    location.pathname.startsWith('/processes') ? '/processes' :
    location.pathname.startsWith('/my-documents') ? '/my-documents' :
    '/';

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/processes', icon: <FileTextOutlined />, label: 'Quy trình' },
    { key: '/my-documents', icon: <InboxOutlined />, label: 'Tài liệu của tôi' }
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
          <Space>
            <span className="collapse-btn" onClick={() => setCollapsed(v => !v)}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
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
