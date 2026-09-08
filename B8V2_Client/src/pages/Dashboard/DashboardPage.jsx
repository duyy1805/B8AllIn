import { Empty, Progress, Skeleton, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Boxes, CheckCircle2, ClipboardCheck, FileClock, FileText, FolderKanban, LayoutDashboard, MessageSquareWarning, PackageCheck, ShieldCheck } from 'lucide-react';
import { getDashboard } from '../../api/dashboard.api';
import { useAuth } from '../../auth/AuthProvider';

const number = value => Number(value || 0);
const percent = (value, total) => total ? Math.min(100, Math.round(number(value) * 100 / number(total))) : 0;

function MetricCard({ icon: Icon, tone, label, value, note }) {
  return <article className={`dashboard-metric dashboard-metric--${tone}`}><span className="dashboard-metric-icon"><Icon size={21} /></span><div><span>{label}</span><strong>{number(value).toLocaleString('vi-VN')}</strong><small>{note}</small></div></article>;
}

function ProgressRow({ label, value, total, color }) {
  const ratio = percent(value, total);
  return <div className="dashboard-progress-row"><div><span>{label}</span><strong>{number(value)}/{number(total)}</strong></div><Progress percent={ratio} showInfo={false} strokeColor={color} trailColor="#edf1f6" /><small>{ratio}% đang hiệu lực</small></div>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();
  const { data = {}, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const isAdminDashboard = hasRole('ADMIN') || hasPermission('DASHBOARD_VIEW_ALL');
  const displayName = user?.fullName || user?.username || 'bạn';
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  const processCount = number(data.ProcessCount);
  const productDocumentCount = number(data.ProductDocumentCount);
  const openFeedback = number(data.OpenProcessFeedbackCount) + number(data.OpenProductFeedbackCount);
  const pendingRead = number(data.UnreadProcesses) + number(data.UnreadProductDocuments);
  const pendingConfirm = number(data.UnacknowledgedProcesses) + number(data.UnacknowledgedProductDocuments);

  const metrics = isAdminDashboard ? [
    { icon: FolderKanban, tone: 'blue', label: 'Tổng quy trình', value: processCount, note: 'Hồ sơ đang quản lý' },
    { icon: Boxes, tone: 'violet', label: 'Sản phẩm hoạt động', value: data.ProductCount, note: 'ItemCode đã đồng bộ' },
    { icon: FileText, tone: 'cyan', label: 'Tài liệu sản phẩm', value: productDocumentCount, note: 'Không gồm dữ liệu đã xóa' },
    { icon: MessageSquareWarning, tone: 'amber', label: 'Phản hồi đang mở', value: openFeedback, note: 'Cần được xem xét, xử lý' }
  ] : [
    { icon: FileClock, tone: 'blue', label: 'Quy trình chưa đọc', value: data.UnreadProcesses, note: 'Được phân phối cho bạn' },
    { icon: PackageCheck, tone: 'violet', label: 'Tài liệu SP chưa đọc', value: data.UnreadProductDocuments, note: 'Được phân phối cho bạn' },
    { icon: ClipboardCheck, tone: 'cyan', label: 'Quy trình chờ xác nhận', value: data.UnacknowledgedProcesses, note: 'Cần hoàn thành tiếp nhận' },
    { icon: AlertCircle, tone: 'amber', label: 'Tài liệu SP chờ xác nhận', value: data.UnacknowledgedProductDocuments, note: 'Cần hoàn thành tiếp nhận' }
  ];
  const shortcuts = [
    ...(['DOCUMENT_VIEW_ALL', 'DOCUMENT_ASSIGNED_VIEW', 'PROCESS_EDIT'].some(permission => hasPermission(permission)) ? [{ icon: FolderKanban, label: 'Quản lý quy trình', note: 'Xem phiên bản và tiến độ tiếp nhận', path: '/processes' }] : []),
    ...(['DOCUMENT_VIEW_ALL', 'DOCUMENT_ASSIGNED_VIEW', 'PRODUCT_MANAGE'].some(permission => hasPermission(permission)) ? [{ icon: Boxes, label: 'Tài liệu sản phẩm', note: 'Quản lý hồ sơ theo ItemCode', path: '/products' }] : []),
    ...(hasPermission('RBAC_VIEW') ? [{ icon: ShieldCheck, label: 'Cấu hình hệ thống', note: 'Tài khoản, vai trò và loại tài liệu', path: '/settings/users' }] : [])
  ];

  return <div className="dashboard-page">
    <section className="dashboard-hero"><div className="dashboard-hero-copy"><span className="dashboard-eyebrow"><LayoutDashboard size={15} /> TỔNG QUAN HỆ THỐNG</span><h1>Xin chào, {displayName}</h1><p>{isAdminDashboard ? 'Theo dõi nhanh tình trạng quy trình, tài liệu sản phẩm và phản hồi trên toàn hệ thống.' : 'Những tài liệu cần bạn đọc và xác nhận được tổng hợp tại đây.'}</p></div><div className="dashboard-date"><span>Hôm nay</span><strong>{today}</strong><Tag color="blue">{isAdminDashboard ? 'Toàn hệ thống' : 'Cá nhân'}</Tag></div></section>
    {isLoading ? <div className="dashboard-loading"><Skeleton active paragraph={{ rows: 12 }} /></div> : isError ? <Empty description="Không thể tải dữ liệu dashboard" /> : <>
      <section className="dashboard-metrics">{metrics.map(item => <MetricCard key={item.label} {...item} />)}</section>
      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-overview-panel"><div className="dashboard-panel-heading"><div><span>{isAdminDashboard ? 'TÌNH TRẠNG HỒ SƠ' : 'VIỆC CẦN HOÀN THÀNH'}</span><h2>{isAdminDashboard ? 'Mức độ hiệu lực' : 'Tiến độ tiếp nhận của bạn'}</h2></div><CheckCircle2 size={21} /></div>{isAdminDashboard ? <div className="dashboard-progress-list"><ProgressRow label="Quy trình" value={data.EffectiveProcessVersionCount} total={processCount} color="#2b72df" /><ProgressRow label="Tài liệu sản phẩm" value={data.EffectiveProductDocumentVersionCount} total={productDocumentCount} color="#7254d6" /></div> : <div className="dashboard-task-list"><button type="button" onClick={() => navigate('/processes')}><span className="dashboard-task-icon dashboard-task-icon--blue"><FileClock size={19} /></span><span><strong>{pendingRead.toLocaleString('vi-VN')} tài liệu chưa đọc</strong><small>Mở danh sách tài liệu được phân phối</small></span><ArrowRight size={17} /></button><button type="button" onClick={() => navigate('/processes')}><span className="dashboard-task-icon dashboard-task-icon--amber"><ClipboardCheck size={19} /></span><span><strong>{pendingConfirm.toLocaleString('vi-VN')} tài liệu chờ xác nhận</strong><small>Hoàn thành yêu cầu tiếp nhận tài liệu</small></span><ArrowRight size={17} /></button></div>}</article>
        <article className="dashboard-panel dashboard-shortcut-panel"><div className="dashboard-panel-heading"><div><span>TRUY CẬP NHANH</span><h2>Khu vực làm việc</h2></div></div><div className="dashboard-shortcuts">{shortcuts.map(({ icon: Icon, label, note, path }) => <button type="button" key={path} onClick={() => navigate(path)}><span><Icon size={18} /></span><div><strong>{label}</strong><small>{note}</small></div><ArrowRight size={16} /></button>)}</div></article>
      </section>
      {isAdminDashboard && <section className="dashboard-feedback-strip"><span className="dashboard-feedback-icon"><MessageSquareWarning size={21} /></span><div><strong>Phản hồi cần quan tâm</strong><span>Hiện có {openFeedback.toLocaleString('vi-VN')} phản hồi quy trình và tài liệu sản phẩm chưa đóng.</span></div><Tag>{openFeedback ? 'Cần xử lý' : 'Đã hoàn tất'}</Tag></section>}
    </>}
  </div>;
}
