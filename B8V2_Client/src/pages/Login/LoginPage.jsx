import { useState } from 'react';
import { Button, Checkbox, Form, Input, message } from 'antd';
import { FileCheck2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password, values.remember);
      navigate('/');
    } catch (e) {
      message.error(e.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro">
          <div className="login-brand"><span><FileCheck2 size={25} /></span><strong>B8 Document</strong></div>
          <div className="login-intro-copy">
            <span className="login-eyebrow"><ShieldCheck size={15} /> HỆ THỐNG QUẢN LÝ TÀI LIỆU</span>
            <h1>Tài liệu đúng phiên bản,<br />đến đúng bộ phận.</h1>
            <p>Quản lý quy trình, hồ sơ sản phẩm và tiến độ tiếp nhận tập trung trên một nền tảng.</p>
          </div>
          <small>© 2026 B8 Document Management</small>
        </section>
        <section className="login-form-panel">
          <div className="login-form-wrap">
            <div className="login-mobile-brand"><FileCheck2 size={22} /><strong>B8 Document</strong></div>
            <div className="login-heading"><span>Chào mừng trở lại</span><h2>Đăng nhập hệ thống</h2><p>Sử dụng tài khoản nội bộ được cấp để tiếp tục.</p></div>
            <Form layout="vertical" onFinish={onFinish} initialValues={{ remember: true }} requiredMark={false}>
          <Form.Item name="username" label="Tài khoản" rules={[{ required: true, message: 'Vui lòng nhập tài khoản' }]}>
            <Input prefix={<UserRound size={18} />} placeholder="Nhập tên tài khoản" autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}>
            <Input.Password prefix={<LockKeyhole size={18} />} placeholder="Nhập mật khẩu" autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked" className="login-remember"><Checkbox>Ghi nhớ đăng nhập</Checkbox></Form.Item>
          <Button className="login-submit" htmlType="submit" type="primary" block loading={loading}>
            Đăng nhập
          </Button>
        </Form>
            <div className="login-security-note"><ShieldCheck size={15} /><span>Phiên đăng nhập được bảo vệ và chỉ sử dụng trong hệ thống nội bộ.</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
