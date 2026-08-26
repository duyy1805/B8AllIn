import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Form, Input, Modal, Pagination, Progress, Select, Skeleton, Table, Tabs, Tooltip, message } from 'antd';
import { ChevronRight, CircleEllipsis, Clock3, Eye, FileClock, FilePlus2, FileText, History, Layers3, MessageSquareText, Search, ShieldCheck, Upload, UsersRound, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { assignProcessAudience, createProcess, createProcessVersion, getProcessDetail, getProcesses, getProcessVersionDetail, removeProcessAudience } from '../../api/process.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import FileUploader from '../../components/FileUploader';
import FileViewerButton from '../../components/FileViewerButton';
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
const versionLabel = version => version?.VersionCode || version?.VersionNo || '—';

function MetricCard({ icon: Icon, tone, label, value, note }) {
  return <div className="process-metric-card"><div className={`metric-icon metric-icon--${tone}`}><Icon size={23} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function DetailItem({ icon: Icon, label, children }) {
  return <div className="drawer-detail-item"><Icon size={16} /><span>{label}</span><div>{children || '—'}</div></div>;
}

export default function ProcessListPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
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
  const vDetail = versionDetailQuery.data || {};
  const version = vDetail.version || currentVersion;
  const files = vDetail.files || [];
  const audiences = vDetail.audiences || [];
  const activeAudiences = audiences.filter(item => item.IsActive);

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
  const audienceMutation = useMutation({
    mutationFn: ({ departmentIds = [] }) => {
      const selectedIds = new Set(departmentIds);
      const activeByDepartment = new Map(activeAudiences.map(item => [item.DepartmentId, item]));
      const removedIds = activeAudiences.filter(item => !selectedIds.has(item.DepartmentId)).map(item => item.DepartmentId);
      const upsertedIds = departmentIds.filter(departmentId => {
        const current = activeByDepartment.get(departmentId);
        return !current || !current.RequiredRead || !current.RequiredAcknowledge || !current.RequiredTraining;
      });

      return Promise.all([
        ...upsertedIds.map(departmentId => assignProcessAudience(currentVersion.Id, {
          departmentId,
          requiredRead: true,
          requiredAcknowledge: true,
          requiredTraining: true
        })),
        ...removedIds.map(departmentId => removeProcessAudience(currentVersion.Id, departmentId))
      ]);
    },
    onSuccess: () => { message.success('Đã cập nhật danh sách bộ phận nhận'); setAudienceOpen(false); audienceForm.resetFields(); invalidateSelected(); },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const columns = [
    { title: 'Mã', dataIndex: 'ProcessCode', width: 112, render: value => <span className="process-code">{value}</span> },
    { title: 'Tên quy trình', dataIndex: 'ProcessName', render: value => <span className="process-name">{value}</span> },
    { title: 'Bộ phận ban hành', dataIndex: 'OwnerDepartmentName', width: 190, render: v => v || '—' },
    { title: 'Phiên bản', dataIndex: 'EffectiveVersionCode', width: 110, align: 'center', render: (v, row) => v || row.EffectiveVersionNo || row.LatestVersionCode || row.LatestVersionNo || '—' },
    { title: 'Ngày hiệu lực', dataIndex: 'EffectiveDate', width: 130, render: formatDate },
    { title: 'Trạng thái', dataIndex: 'Status', width: 126, render: (value, row) => <StatusBadge status={row.VersionStatus || value} /> },
    { title: '', key: 'action', width: 52, align: 'center', render: () => <Button className="row-action" type="text" icon={<ChevronRight size={17} />} /> }
  ];

  const canCreate = hasPermission('DOCUMENT_CREATE');
  const canCreateVersion = hasPermission('DOCUMENT_VERSION_CREATE');
  const canUpload = hasPermission('DOCUMENT_FILE_UPLOAD');
  const canManageAudience = hasPermission('DOCUMENT_AUDIENCE_MANAGE');
  const openAudienceModal = () => {
    audienceForm.setFieldsValue({ departmentIds: activeAudiences.map(item => item.DepartmentId) });
    setAudienceOpen(true);
  };
  const overviewTab = <>
    <div className="drawer-section">
      <DetailItem icon={FileText} label="Mã quy trình"><strong>{process?.ProcessCode}</strong></DetailItem>
      <DetailItem icon={Layers3} label="Tên quy trình">{process?.ProcessName}</DetailItem>
      <DetailItem icon={UsersRound} label="Bộ phận ban hành">{process?.OwnerDepartmentName || process?.OwnerDepartmentId}</DetailItem>
      <DetailItem icon={FileClock} label="Phiên bản hiện tại">{version ? versionLabel(version) : 'Chưa có'}</DetailItem>
      <DetailItem icon={Clock3} label="Ngày hiệu lực">{formatDate(version?.EffectiveDate)}</DetailItem>
      <DetailItem icon={ShieldCheck} label="Trạng thái"><StatusBadge status={version?.Status || process?.Status} /></DetailItem>
    </div>
    {version && <div className="drawer-section drawer-progress-section"><div className="drawer-section-title"><Eye size={16} /> Tiến độ tiếp nhận</div>{version.TotalRecipients ? <><div className="progress-label"><span>Đã xem</span><strong>{version.ViewedCount || 0}/{version.TotalRecipients}</strong></div><Progress percent={Math.round(((version.ViewedCount || 0) / version.TotalRecipients) * 100)} showInfo={false} size="small" /></> : <span className="muted-note">Chưa có dữ liệu người nhận.</span>}</div>}
    {files.length > 0 && <div className="drawer-section drawer-file-section"><div className="drawer-section-title"><FileText size={16} /> Tài liệu đính kèm</div>{files.map(file => <div className="drawer-file-row" key={file.FileId}><div><strong>{file.OriginalName}</strong><span>{file.FileRole || 'PDF'}</span></div><FileViewerButton file={file} /></div>)}</div>}
    <div className="drawer-actions">
      {version && canManageAudience && <Button icon={<UsersRound size={17} />} onClick={openAudienceModal}>Cập nhật bộ phận nhận</Button>}
      {version?.Status === 'DRAFT' && canUpload && <div className="drawer-upload"><Upload size={16} /><FileUploader processVersionId={Number(version.Id)} onUploaded={invalidateSelected} /></div>}
    </div>
  </>;

  const historyTab = versions.length ? <div className="version-timeline">{versions.map(item => <div role="button" tabIndex={0} key={item.Id} className={`version-card ${item.Id === version?.Id ? 'is-active' : ''}`} onClick={() => setSelectedVersionId(item.Id)} onKeyDown={event => { if (event.key === 'Enter') setSelectedVersionId(item.Id); }}><span className="version-dot" /><span><strong>Phiên bản {versionLabel(item)}</strong><small>{item.Title || 'Không có tiêu đề'}</small></span><span><StatusBadge status={item.Status} /><small>{formatDate(item.EffectiveDate)}</small><FileViewerButton processVersionId={item.Id} label="Xem nhanh" buttonProps={{ type: 'link', size: 'small', className: 'version-quick-view' }} /></span></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiên bản" />;
  const distributionTab = version ? <div className="distribution-list">{activeAudiences.length ? activeAudiences.map(item => <div className="distribution-card" key={item.Id || item.DepartmentId}><div className="distribution-icon"><UsersRound size={18} /></div><div><strong>{item.DepartmentName || `Bộ phận ${item.DepartmentId}`}</strong><span>Bắt buộc đọc, xác nhận và đào tạo</span></div><StatusBadge status="ACTIVE" /></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bộ phận nhận" />}{canManageAudience && <Button block icon={<UsersRound size={16} />} onClick={openAudienceModal}>Cập nhật bộ phận nhận</Button>}{files.length > 0 && <div className="file-summary"><FileText size={16} /> {files.length} file đã đính kèm</div>}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hãy tạo phiên bản trước" />;

  return <div className={`process-workspace ${selectedProcessId ? 'has-drawer' : ''}`}>
    <main className="process-main">
      <div className="process-titlebar"><div><h1>Quản lý quy trình</h1><p>Quản lý, phát hành và theo dõi toàn bộ quy trình nội bộ</p></div>{canCreate && <Button type="primary" size="large" icon={<FilePlus2 size={18} />} onClick={() => setCreateOpen(true)}>Tạo quy trình</Button>}</div>
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
      <div className="drawer-header"><div className="drawer-header-copy"><span>Chi tiết quy trình</span><strong>{process?.ProcessCode || 'Đang tải...'}</strong></div><div className="drawer-header-actions">{canCreateVersion && process && <Button type="primary" size="small" icon={<FilePlus2 size={15} />} onClick={() => setVersionOpen(true)}>Phiên bản mới</Button>}<Tooltip title="Đóng bảng chi tiết"><Button type="text" icon={<X size={20} />} onClick={() => { setSelectedProcessId(null); setSelectedVersionId(null); }} /></Tooltip></div></div>
      {detailQuery.isLoading ? <div className="drawer-loading"><Skeleton active paragraph={{ rows: 10 }} /></div> : process ? <Tabs className="drawer-tabs" defaultActiveKey="overview" items={[{ key: 'overview', label: 'Tổng quan', children: overviewTab }, { key: 'history', label: <span><History size={15} /> Phiên bản</span>, children: historyTab }, { key: 'distribution', label: <span><UsersRound size={15} /> Phân phối</span>, children: distributionTab }]} /> : <Empty description="Không tải được chi tiết quy trình" />}
      <div className="drawer-footer"><Button icon={<MessageSquareText size={16} />} disabled>Phản hồi</Button><Button icon={<CircleEllipsis size={16} />} disabled>Thao tác khác</Button></div>
    </aside>}
    <Modal title="Tạo quy trình mới" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} confirmLoading={createMutation.isPending} okText="Tạo quy trình" cancelText="Hủy"><Form form={createForm} layout="vertical" onFinish={createMutation.mutate} requiredMark={false}><Form.Item name="processCode" label="Mã quy trình" rules={[{ required: true, message: 'Vui lòng nhập mã quy trình' }]}><Input placeholder="Ví dụ: QT-015" /></Form.Item><Form.Item name="processName" label="Tên quy trình" rules={[{ required: true, message: 'Vui lòng nhập tên quy trình' }]}><Input placeholder="Nhập tên quy trình" /></Form.Item><Form.Item name="ownerDepartmentId" label="Bộ phận ban hành" rules={[{ required: true, message: 'Vui lòng chọn bộ phận' }]}><DepartmentSelect /></Form.Item></Form></Modal>
    <Modal title={`Tạo phiên bản mới · ${process?.ProcessCode || ''}`} open={versionOpen} onCancel={() => setVersionOpen(false)} onOk={() => versionForm.submit()} confirmLoading={createVersionMutation.isPending} okText="Tạo phiên bản" cancelText="Hủy"><Form form={versionForm} layout="vertical" onFinish={createVersionMutation.mutate} requiredMark={false} initialValues={{ issueDate: dayjs() }}><Form.Item name="versionCode" label="Phiên bản" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập phiên bản' }]}><Input maxLength={50} placeholder="Ví dụ: A, Rev.01, 2026-Q3..." /></Form.Item><Form.Item name="title" label="Tiêu đề phiên bản"><Input placeholder="Tiêu đề hoặc mục đích thay đổi" /></Form.Item><div className="form-grid-2"><Form.Item name="issueDate" label="Ngày ban hành"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item><Form.Item name="effectiveDate" label="Ngày hiệu lực" rules={[{ required: true, message: 'Vui lòng chọn ngày hiệu lực' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></div><Form.Item name="changeSummary" label="Nội dung thay đổi"><Input.TextArea rows={4} placeholder="Mô tả ngắn gọn nội dung thay đổi..." /></Form.Item><div className="inherited-audience-note"><UsersRound size={16} /><span>Bộ phận nhận và các yêu cầu tiếp nhận sẽ tự động kế thừa từ phiên bản trước.</span></div></Form></Modal>
    <Modal title="Cập nhật bộ phận nhận" open={audienceOpen} onCancel={() => setAudienceOpen(false)} onOk={() => audienceForm.submit()} confirmLoading={audienceMutation.isPending} okText="Lưu thay đổi" cancelText="Hủy"><Form form={audienceForm} layout="vertical" onFinish={audienceMutation.mutate} requiredMark={false}><Form.Item name="departmentIds" label="Bộ phận nhận"><DepartmentSelect mode="multiple" placeholder="Chọn các bộ phận nhận tài liệu" /></Form.Item><div className="audience-requirement-note"><ShieldCheck size={17} /><span>Tất cả bộ phận được chọn đều bắt buộc đọc, xác nhận và hoàn thành đào tạo.</span></div></Form></Modal>
  </div>;
}
