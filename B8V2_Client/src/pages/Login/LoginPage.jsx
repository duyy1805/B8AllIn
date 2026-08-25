import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      navigate('/');
    } catch (e) {
      message.error(e.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Title level={2}>B8 Document Management</Typography.Title>
        <Typography.Paragraph type="secondary">
          Đăng nhập bằng tài khoản hệ thống.
        </Typography.Paragraph>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Tài khoản" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button htmlType="submit" type="primary" block loading={loading}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
