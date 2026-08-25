import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Form, Input, Modal, Pagination, Progress, Select, Skeleton, Switch, Table, Tabs, Tooltip, message } from 'antd';
import { CheckCircle2, ChevronRight, CircleEllipsis, Clock3, Eye, FileClock, FilePlus2, FileText, History, Layers3, MessageSquareText, Search, Send, ShieldCheck, Upload, UsersRound, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { assignProcessAudience, createProcess, createProcessVersion, getProcessDetail, getProcesses, getProcessVersionDetail, publishProcessVersion, reviewProcessVersion, submitProcessVersion } from '../../api/process.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import FileUploader from '../../components/FileUploader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';

const PAGE_SIZE = 10;
const statusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' }
];
const formatDate = value => value ? dayjs(value).format('DD/MM/YYYY') : '—';

function MetricCard({ icon: Icon, tone, label, value, note }) {
  return <div className="process-metric-card"><div className={`metric-icon metric-icon--${tone}`}><Icon size={23} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function DetailItem({ icon: Icon, label, children }) {
  return <div className="drawer-detail-item"><Icon size={16} /><span>{label}</span><div>{children || '—'}</div></div>;
}

export default function ProcessListPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState();
  const [page, setPage] = useState(1);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [audienceForm] = Form.useForm();

  useEffect(() => { const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 350); return () => clearTimeout(timer); }, [keyword]);
  useEffect(() => setPage(1), [debouncedKeyword, status, departmentId]);

  const listQuery = useQuery({
    queryKey: ['processes', debouncedKeyword, status, departmentId],
    queryFn: () => getProcesses({ keyword: debouncedKeyword || undefined, status: status || undefined, departmentId, page: 1, pageSize: 500 })
  });
  const detailQuery = useQuery({ queryKey: ['process', selectedProcessId], queryFn: () => getProcessDetail(selectedProcessId), enabled: Boolean(selectedProcessId) });
  const detail = detailQuery.data || {};
  const process = detail.process;
  const versions = detail.versions || [];
  const currentVersion = useMemo(() => versions.find(v => v.Id === selectedVersionId) || versions.find(v => v.Status === 'EFFECTIVE') || versions[0] || null, [versions, selectedVersionId]);
  useEffect(() => { if (currentVersion?.Id && !selectedVersionId) setSelectedVersionId(currentVersion.Id); }, [currentVersion, selectedVersionId]);
  const versionDetailQuery = useQuery({ queryKey: ['process-version', currentVersion?.Id], queryFn: () => getProcessVersionDetail(currentVersion.Id), enabled: Boolean(currentVersion?.Id) });

  const allRows = listQuery.data || [];
  const pagedRows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = useMemo(() => ({
    total: allRows.length,
    effective: allRows.filter(r => r.EffectiveVersionNo || r.EffectiveVersionId || r.VersionStatus === 'EFFECTIVE').length,
    processing: allRows.filter(r => ['DRAFT', 'REVIEWING', 'APPROVED'].includes(r.LatestVersionStatus || r.VersionStatus)).length,
    inactive: allRows.filter(r => ['INACTIVE', 'ARCHIVED'].includes(r.Status)).length
  }), [allRows]);

  const invalidateSelected = () => {
    qc.invalidateQueries({ queryKey: ['process', selectedProcessId] });
    if (currentVersion?.Id) qc.invalidateQueries({ queryKey: ['process-version', currentVersion.Id] });
    qc.invalidateQueries({ queryKey: ['processes'] });
  };
  const createMutation = useMutation({
    mutationFn: createProcess,
    onSuccess: data => { message.success('Đã tạo quy trình mới'); setCreateOpen(false); createForm.resetFields(); qc.invalidateQueries({ queryKey: ['processes'] }); setSelectedProcessId(data.Id); setSelectedVersionId(null); },
    onError: e => message.error(e.response?.data?.message || e.message)
  });
  const createVersionMutation = useMutation({
    mutationFn: values => createProcessVersion(selectedProcessId, { ...values, issueDate: values.issueDate?.format('YYYY-MM-DD') || null, effectiveDate: values.effectiveDate?.format('YYYY-MM-DD') || null }),
    onSuccess: data => { message.success('Đã tạo phiên bản mới'); setVersionOpen(false); versionForm.resetFields(); setSelectedVersionId(data.Id); invalidateSelected(); },
    onError: e => message.error(e.response?.data?.message || e.message)
  });
  const workflowMutation = useMutation({
    mutationFn: type => type === 'submit' ? submitProcessVersion(currentVersion.Id) : type === 'review' ? reviewProcessVersion(currentVersion.Id) : publishProcessVersion(currentVersion.Id),
    onSuccess: () => { message.success('Đã cập nhật trạng thái phiên bản'); invalidateSelected(); },
    onError: e => message.error(e.response?.data?.message || e.message)
  });
  const audienceMutation = useMutation({
    mutationFn: ({ departmentIds, ...options }) => Promise.all(
      departmentIds.map(departmentId => assignProcessAudience(currentVersion.Id, { ...options, departmentId }))
    ),
    onSuccess: (_data, variables) => { message.success(`Đã gán ${variables.departmentIds.length} bộ phận nhận`); setAudienceOpen(false); audienceForm.resetFields(); invalidateSelected(); },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const columns = [
    { title: 'Mã', dataIndex: 'ProcessCode', width: 112, render: value => <span className="process-code">{value}</span> },
    { title: 'Tên quy trình', dataIndex: 'ProcessName', render: value => <span className="process-name">{value}</span> },
    { title: 'Bộ phận ban hành', dataIndex: 'OwnerDepartmentName', width: 190, render: v => v || '—' },
    { title: 'Phiên bản', dataIndex: 'EffectiveVersionNo', width: 100, align: 'center', render: (v, row) => v ? `V${v}` : row.LatestVersionNo ? `V${row.LatestVersionNo}` : '—' },
    { title: 'Ngày hiệu lực', dataIndex: 'EffectiveDate', width: 130, render: formatDate },
    { title: 'Trạng thái', dataIndex: 'Status', width: 126, render: (value, row) => <StatusBadge status={row.VersionStatus || value} /> },
    { title: '', key: 'action', width: 52, align: 'center', render: () => <Button className="row-action" type="text" icon={<ChevronRight size={17} />} /> }
  ];

  const vDetail = versionDetailQuery.data || {};
  const version = vDetail.version || currentVersion;
  const files = vDetail.files || [];
  const audiences = vDetail.audiences || [];
  const canEdit = hasRole('DOCUMENT_CONTROLLER', 'EDITOR');
  const overviewTab = <>
    <div className="drawer-section">
      <DetailItem icon={FileText} label="Mã quy trình"><strong>{process?.ProcessCode}</strong></DetailItem>
      <DetailItem icon={Layers3} label="Tên quy trình">{process?.ProcessName}</DetailItem>
      <DetailItem icon={UsersRound} label="Bộ phận ban hành">{process?.OwnerDepartmentName || process?.OwnerDepartmentId}</DetailItem>
      <DetailItem icon={FileClock} label="Phiên bản hiện tại">{version?.VersionNo ? `V${version.VersionNo}` : 'Chưa có'}</DetailItem>
      <DetailItem icon={Clock3} label="Ngày hiệu lực">{formatDate(version?.EffectiveDate)}</DetailItem>
      <DetailItem icon={ShieldCheck} label="Trạng thái"><StatusBadge status={version?.Status || process?.Status} /></DetailItem>
    </div>
    {version && <div className="drawer-section drawer-progress-section"><div className="drawer-section-title"><Eye size={16} /> Tiến độ tiếp nhận</div>{version.TotalRecipients ? <><div className="progress-label"><span>Đã xem</span><strong>{version.ViewedCount || 0}/{version.TotalRecipients}</strong></div><Progress percent={Math.round(((version.ViewedCount || 0) / version.TotalRecipients) * 100)} showInfo={false} size="small" /></> : <span className="muted-note">Chưa có dữ liệu người nhận.</span>}</div>}
    <div className="drawer-actions">
      {canEdit && <Button type="primary" icon={<FilePlus2 size={17} />} onClick={() => setVersionOpen(true)}>Tạo phiên bản mới</Button>}
      {version?.Status === 'DRAFT' && canEdit && <Button icon={<Send size={17} />} loading={workflowMutation.isPending} onClick={() => workflowMutation.mutate('submit')}>Gửi kiểm tra</Button>}
      {version?.Status === 'REVIEWING' && hasRole('REVIEWER', 'DOCUMENT_CONTROLLER') && <Button icon={<CheckCircle2 size={17} />} loading={workflowMutation.isPending} onClick={() => workflowMutation.mutate('review')}>Duyệt phiên bản</Button>}
      {version?.Status === 'APPROVED' && hasRole('APPROVER', 'DOCUMENT_CONTROLLER') && <Button type="primary" icon={<ShieldCheck size={17} />} loading={workflowMutation.isPending} onClick={() => workflowMutation.mutate('publish')}>Phát hành</Button>}
      {version && hasRole('DOCUMENT_CONTROLLER') && <Button icon={<UsersRound size={17} />} onClick={() => setAudienceOpen(true)}>Gán bộ phận nhận</Button>}
      {version && canEdit && version.Status !== 'EFFECTIVE' && <div className="drawer-upload"><Upload size={16} /><FileUploader processVersionId={Number(version.Id)} onUploaded={invalidateSelected} /></div>}
    </div>
  </>;

  const historyTab = versions.length ? <div className="version-timeline">{versions.map(item => <button type="button" key={item.Id} className={`version-card ${item.Id === version?.Id ? 'is-active' : ''}`} onClick={() => setSelectedVersionId(item.Id)}><span className="version-dot" /><span><strong>Phiên bản V{item.VersionNo}</strong><small>{item.Title || 'Không có tiêu đề'}</small></span><span><StatusBadge status={item.Status} /><small>{formatDate(item.EffectiveDate)}</small></span></button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiên bản" />;
  const distributionTab = version ? <div className="distribution-list">{audiences.length ? audiences.map(item => <div className="distribution-card" key={item.Id || item.DepartmentId}><div className="distribution-icon"><UsersRound size={18} /></div><div><strong>{item.DepartmentName || `Bộ phận ${item.DepartmentId}`}</strong><span>{item.RequiredAcknowledge ? 'Yêu cầu đọc và xác nhận' : 'Yêu cầu đọc'}</span></div><StatusBadge status={item.IsActive ? 'ACTIVE' : 'INACTIVE'} /></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa gán bộ phận nhận" />}{hasRole('DOCUMENT_CONTROLLER') && <Button block icon={<UsersRound size={16} />} onClick={() => setAudienceOpen(true)}>Gán thêm bộ phận</Button>}{files.length > 0 && <div className="file-summary"><FileText size={16} /> {files.length} file đã đính kèm</div>}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hãy tạo phiên bản trước" />;

  return <div className={`process-workspace ${selectedProcessId ? 'has-drawer' : ''}`}>
    <main className="process-main">
      <div className="process-titlebar"><div><h1>Quản lý quy trình</h1><p>Quản lý, phát hành và theo dõi toàn bộ quy trình nội bộ</p></div>{canEdit && <Button type="primary" size="large" icon={<FilePlus2 size={18} />} onClick={() => setCreateOpen(true)}>Tạo quy trình</Button>}</div>
      <section className="process-metrics">
        <MetricCard icon={Layers3} tone="blue" label="Tổng quy trình" value={counts.total} note="Theo bộ lọc hiện tại" />
        <MetricCard icon={ShieldCheck} tone="green" label="Đang hiệu lực" value={counts.effective} note="Có phiên bản hiệu lực" />
        <MetricCard icon={FileClock} tone="amber" label="Đang xử lý" value={counts.processing} note="Nháp, kiểm tra hoặc chờ duyệt" />
        <MetricCard icon={Clock3} tone="red" label="Ngừng hoạt động" value={counts.inactive} note="Ngừng hoặc đã lưu trữ" />
      </section>
      <section className="process-table-card">
        <div className="process-filters">
          <div className="filter-field filter-search"><label>Tìm kiếm</label><Input allowClear prefix={<Search size={17} />} placeholder="Mã hoặc tên quy trình..." value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
          <div className="filter-field"><label>Bộ phận</label><DepartmentSelect allowClear value={departmentId} onChange={setDepartmentId} placeholder="Tất cả bộ phận" /></div>
          <div className="filter-field"><label>Trạng thái</label><Select value={status} options={statusOptions} onChange={setStatus} /></div>
        </div>
        <Table className="process-table" rowKey="Id" loading={listQuery.isLoading} dataSource={pagedRows} columns={columns} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy quy trình phù hợp" /> }} rowClassName={record => record.Id === selectedProcessId ? 'selected-process-row' : ''} onRow={record => ({ onClick: () => { setSelectedProcessId(record.Id); setSelectedVersionId(null); }, style: { cursor: 'pointer' } })} />
        <div className="process-pagination"><span>Hiển thị {allRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, allRows.length)} trong {allRows.length} kết quả</span><Pagination current={page} pageSize={PAGE_SIZE} total={allRows.length} showSizeChanger={false} onChange={setPage} /></div>
      </section>
    </main>
    {selectedProcessId && <aside className="process-drawer" aria-label="Chi tiết quy trình">
      <div className="drawer-header"><div><span>Chi tiết quy trình</span><strong>{process?.ProcessCode || 'Đang tải...'}</strong></div><Tooltip title="Đóng bảng chi tiết"><Button type="text" icon={<X size={20} />} onClick={() => { setSelectedProcessId(null); setSelectedVersionId(null); }} /></Tooltip></div>
      {detailQuery.isLoading ? <div className="drawer-loading"><Skeleton active paragraph={{ rows: 10 }} /></div> : process ? <Tabs className="drawer-tabs" defaultActiveKey="overview" items={[{ key: 'overview', label: 'Tổng quan', children: overviewTab }, { key: 'history', label: <span><History size={15} /> Phiên bản</span>, children: historyTab }, { key: 'distribution', label: <span><UsersRound size={15} /> Phân phối</span>, children: distributionTab }]} /> : <Empty description="Không tải được chi tiết quy trình" />}
      <div className="drawer-footer"><Button icon={<MessageSquareText size={16} />} disabled>Phản hồi</Button><Button icon={<CircleEllipsis size={16} />} disabled>Thao tác khác</Button></div>
    </aside>}
    <Modal title="Tạo quy trình mới" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={createMutation.isPending} okText="Tạo quy trình" cancelText="Hủy"><Form form={createForm} layout="vertical" onFinish={createMutation.mutate} requiredMark={false}><Form.Item name="processCode" label="Mã quy trình" rules={[{ required: true, message: 'Vui lòng nhập mã quy trình' }]}><Input placeholder="Ví dụ: QT-015" /></Form.Item><Form.Item name="processName" label="Tên quy trình" rules={[{ required: true, message: 'Vui lòng nhập tên quy trình' }]}><Input placeholder="Nhập tên quy trình" /></Form.Item><Form.Item name="ownerDepartmentId" label="Bộ phận ban hành" rules={[{ required: true, message: 'Vui lòng chọn bộ phận' }]}><DepartmentSelect /></Form.Item></Form></Modal>
    <Modal title={`Tạo phiên bản mới · ${process?.ProcessCode || ''}`} open={versionOpen} onCancel={() => setVersionOpen(false)} onOk={() => versionForm.submit()} confirmLoading={createVersionMutation.isPending} okText="Tạo phiên bản" cancelText="Hủy"><Form form={versionForm} layout="vertical" onFinish={createVersionMutation.mutate} requiredMark={false} initialValues={{ issueDate: dayjs() }}><Form.Item name="title" label="Tiêu đề phiên bản"><Input placeholder="Tiêu đề hoặc mục đích thay đổi" /></Form.Item><div className="form-grid-2"><Form.Item name="issueDate" label="Ngày ban hành"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item><Form.Item name="effectiveDate" label="Ngày hiệu lực"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></div><Form.Item name="changeSummary" label="Nội dung thay đổi"><Input.TextArea rows={4} placeholder="Mô tả ngắn gọn nội dung thay đổi..." /></Form.Item></Form></Modal>
    <Modal title="Gán bộ phận nhận" open={audienceOpen} onCancel={() => setAudienceOpen(false)} onOk={() => audienceForm.submit()} confirmLoading={audienceMutation.isPending} okText="Gán bộ phận" cancelText="Hủy"><Form form={audienceForm} layout="vertical" onFinish={audienceMutation.mutate} requiredMark={false} initialValues={{ requiredRead: true, requiredAcknowledge: false, requiredTraining: false }}><Form.Item name="departmentIds" label="Bộ phận" rules={[{ required: true, message: 'Vui lòng chọn ít nhất một bộ phận' }]}><DepartmentSelect mode="multiple" placeholder="Chọn một hoặc nhiều bộ phận" /></Form.Item><div className="switch-row"><div><strong>Bắt buộc đọc</strong><span>Người nhận cần mở tài liệu</span></div><Form.Item name="requiredRead" valuePropName="checked" noStyle><Switch /></Form.Item></div><div className="switch-row"><div><strong>Bắt buộc xác nhận</strong><span>Yêu cầu xác nhận đã hiểu nội dung</span></div><Form.Item name="requiredAcknowledge" valuePropName="checked" noStyle><Switch /></Form.Item></div><div className="switch-row"><div><strong>Bắt buộc đào tạo</strong><span>Đánh dấu yêu cầu hoàn tất đào tạo</span></div><Form.Item name="requiredTraining" valuePropName="checked" noStyle><Switch /></Form.Item></div></Form></Modal>
  </div>;
}
