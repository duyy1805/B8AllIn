import { useMemo, useState } from 'react';
import { Button, Empty, Form, Input, List, Modal, Progress, Skeleton, Space, Table, Tabs, Upload, message } from 'antd';
import { Clock3, Eye, FileCheck2, FileText, GraduationCap, History, Layers3, Paperclip, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  confirmProcessTraining,
  getMyAssignedProcessVersions,
  getMyProcessDocuments,
  getProcessTrainingConfirmation,
  markProcessViewed
} from '../../api/process.api';
import FileDownloadButton from '../../components/FileDownloadButton';
import FileViewerButton from '../../components/FileViewerButton';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';

const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
const maxFileSize = 50 * 1024 * 1024;
const formatDate = value => value ? dayjs(value).format('DD/MM/YYYY') : '—';
const formatDateTime = value => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';

function DetailItem({ icon: Icon, label, children }) {
  return <div className="drawer-detail-item"><Icon size={16} /><span>{label}</span><div>{children || '—'}</div></div>;
}

export default function MyDocumentsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [form] = Form.useForm();

  const query = useQuery({
    queryKey: ['my-process-documents'],
    queryFn: () => getMyProcessDocuments({ page: 1, pageSize: 100 })
  });
  const rows = query.data || [];
  const selected = rows.find(item => item.ProcessId === selectedProcessId) || null;

  const versionsQuery = useQuery({
    queryKey: ['my-assigned-process-versions', selectedProcessId],
    queryFn: () => getMyAssignedProcessVersions(selectedProcessId),
    enabled: Boolean(selectedProcessId)
  });
  const trainingQuery = useQuery({
    queryKey: ['process-training', selected?.ProcessVersionId],
    queryFn: () => getProcessTrainingConfirmation(selected.ProcessVersionId),
    enabled: Boolean(selected?.ProcessVersionId && evidenceOpen)
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-process-documents'] });
    if (selected?.ProcessVersionId) qc.invalidateQueries({ queryKey: ['process-training', selected.ProcessVersionId] });
  };
  const viewMutation = useMutation({
    mutationFn: markProcessViewed,
    onSuccess: refresh,
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const confirmMutation = useMutation({
    mutationFn: values => confirmProcessTraining(selected.ProcessVersionId, {
      comment: values.comment,
      files: fileList.map(item => item.originFileObj || item)
    }),
    onSuccess: () => {
      message.success('Đã xác nhận hoàn thành đào tạo cho bộ phận');
      setTrainingOpen(false);
      setFileList([]);
      form.resetFields();
      refresh();
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  const beforeUpload = file => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!allowedExtensions.includes(extension)) {
      message.error(`${file.name}: định dạng không được hỗ trợ.`);
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxFileSize) {
      message.error(`${file.name}: dung lượng vượt quá 50 MB.`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const counts = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(item => item.DeliveryStatus === 'PENDING').length,
    viewed: rows.filter(item => item.DeliveryStatus === 'VIEWED').length,
    trained: rows.filter(item => item.DeliveryStatus === 'TRAINED').length
  }), [rows]);
  const assignedData = versionsQuery.data || {};
  const currentVersion = assignedData.versions?.find(version => version.Id === selected?.ProcessVersionId) || null;
  const currentFiles = currentVersion?.files || [];

  const columns = [
    { title: 'Mã', dataIndex: 'ProcessCode', width: 120, render: value => <span className="process-code">{value}</span> },
    { title: 'Tên quy trình', dataIndex: 'ProcessName', render: value => <span className="process-name">{value}</span> },
    { title: 'Phiên bản', dataIndex: 'VersionCode', width: 105, align: 'center', render: (value, row) => value || row.VersionNo || '—' },
    { title: 'Ngày hiệu lực', dataIndex: 'EffectiveDate', width: 130, render: formatDate },
    { title: 'Tiếp nhận', dataIndex: 'DeliveryStatus', width: 190, render: value => <StatusBadge status={value} /> }
  ];

  const overviewTab = selected ? <>
    <div className="drawer-section">
      <DetailItem icon={FileText} label="Mã quy trình"><strong>{selected.ProcessCode}</strong></DetailItem>
      <DetailItem icon={Layers3} label="Tên quy trình">{selected.ProcessName}</DetailItem>
      <DetailItem icon={Layers3} label="Bộ phận ban hành">{assignedData.process?.OwnerDepartmentName || assignedData.process?.OwnerDepartmentId}</DetailItem>
      <DetailItem icon={History} label="Phiên bản hiện tại">{selected.VersionCode || selected.VersionNo}</DetailItem>
      <DetailItem icon={Clock3} label="Ngày hiệu lực">{formatDate(selected.EffectiveDate)}</DetailItem>
      <DetailItem icon={ShieldCheck} label="Trạng thái"><StatusBadge status={currentVersion?.Status || 'EFFECTIVE'} /></DetailItem>
    </div>
    <div className="drawer-section drawer-progress-section">
      <div className="drawer-section-title"><Eye size={16} /> Tiến độ của bộ phận</div>
      <div className="progress-label"><span>Đã xem</span><strong>{selected.FirstViewedAt ? '1/1' : '0/1'}</strong></div>
      <Progress percent={selected.FirstViewedAt ? 100 : 0} showInfo={false} size="small" />
      <div className="progress-label"><span>Đã đào tạo</span><strong>{selected.DeliveryStatus === 'TRAINED' ? '1/1' : '0/1'}</strong></div>
      <Progress status="success" percent={selected.DeliveryStatus === 'TRAINED' ? 100 : 0} showInfo={false} size="small" />
    </div>
    {currentFiles.length > 0 && <div className="drawer-section drawer-file-section">
      <div className="drawer-section-title"><FileText size={16} /> Tài liệu đính kèm</div>
      {currentFiles.map(file => <div className="drawer-file-row" key={file.FileId}><div><strong>{file.OriginalName}</strong><span>{file.FileRole || 'PDF'}</span></div><Space><FileViewerButton file={file} label="Xem" onOpened={() => viewMutation.mutateAsync(selected.ProcessVersionId)} /><FileDownloadButton file={file} label="Tải" /></Space></div>)}
    </div>}
    <div className="drawer-actions user-receipt-actions">
      {selected.DeliveryStatus === 'PENDING' && <span className="muted-note">Mở tài liệu để ghi nhận bộ phận đã xem.</span>}
      {selected.DeliveryStatus === 'VIEWED' && hasPermission('DOCUMENT_TRAINING_CONFIRM') && <Button type="primary" icon={<GraduationCap size={17} />} onClick={() => setTrainingOpen(true)}>Xác nhận đã đào tạo</Button>}
      {selected.DeliveryStatus === 'TRAINED' && <Button icon={<FileCheck2 size={17} />} onClick={() => setEvidenceOpen(true)}>Xem minh chứng ({selected.EvidenceCount || 0})</Button>}
    </div>
  </> : null;

  const versionsTab = versionsQuery.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : assignedData.versions?.length ? <div className="version-timeline">
    {assignedData.versions.map(version => <div className={`version-card ${version.Id === selected?.ProcessVersionId ? 'is-active' : ''}`} key={version.Id}>
      <span className="version-dot" /><span><strong>Phiên bản {version.VersionCode || version.VersionNo}</strong><small>{version.Title || 'Không có tiêu đề'}</small></span>
      <span><StatusBadge status={version.Status} /><small>{formatDate(version.EffectiveDate)}</small>{version.files?.map(file => <Space key={file.FileId} wrap><FileViewerButton file={file} label="Xem" buttonProps={{ type: 'link', size: 'small' }} onOpened={version.Id === selected?.ProcessVersionId ? () => viewMutation.mutateAsync(version.Id) : undefined} /><FileDownloadButton file={file} label="Tải" buttonProps={{ type: 'link', size: 'small' }} /></Space>)}</span>
    </div>)}
  </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiên bản đã nhận" />;

  const receiptTab = selected ? <div className="drawer-section">
    <DetailItem icon={ShieldCheck} label="Trạng thái tiếp nhận"><StatusBadge status={selected.DeliveryStatus} /></DetailItem>
    <DetailItem icon={Eye} label="Xem lần đầu">{formatDateTime(selected.FirstViewedAt)}</DetailItem>
    <DetailItem icon={Clock3} label="Xem gần nhất">{formatDateTime(selected.LastViewedAt)}</DetailItem>
    <DetailItem icon={GraduationCap} label="Xác nhận đào tạo">{formatDateTime(selected.TrainingConfirmedAt)}</DetailItem>
    {selected.Comment && <DetailItem icon={FileText} label="Ghi chú">{selected.Comment}</DetailItem>}
  </div> : null;

  return <div className={`process-workspace ${selectedProcessId ? 'has-drawer' : ''}`}>
    <main className="process-main">
      <div className="process-titlebar"><div><h1>Quy trình</h1><p>Các quy trình được phân phối cho bộ phận của bạn</p></div></div>
      <section className="process-metrics user-process-metrics">
        <div className="process-metric-card"><div className="metric-copy"><span>Tổng quy trình</span><strong>{counts.total}</strong><small>Được phân phối</small></div></div>
        <div className="process-metric-card"><div className="metric-copy"><span>Chưa xem</span><strong>{counts.pending}</strong><small>Cần tiếp nhận</small></div></div>
        <div className="process-metric-card"><div className="metric-copy"><span>Đã xem</span><strong>{counts.viewed}</strong><small>Chờ xác nhận</small></div></div>
        <div className="process-metric-card"><div className="metric-copy"><span>Đã đào tạo</span><strong>{counts.trained}</strong><small>Đã hoàn thành</small></div></div>
      </section>
      <section className="process-table-card">
        <Table className="process-table" rowKey="DepartmentReceiptId" loading={query.isLoading} dataSource={rows} columns={columns} pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bộ phận chưa nhận quy trình nào" /> }}
          rowClassName={row => row.ProcessId === selectedProcessId ? 'selected-process-row' : ''}
          onRow={row => ({ onClick: () => setSelectedProcessId(row.ProcessId), style: { cursor: 'pointer' } })} />
      </section>
    </main>

    {selectedProcessId && <aside className="process-drawer" aria-label="Chi tiết quy trình người dùng">
      <div className="drawer-header"><div className="drawer-header-copy"><span>Chi tiết quy trình</span><strong>{selected?.ProcessCode || 'Đang tải...'}</strong></div><Button type="text" icon={<X size={20} />} onClick={() => setSelectedProcessId(null)} /></div>
      {versionsQuery.isLoading ? <div className="drawer-loading"><Skeleton active paragraph={{ rows: 10 }} /></div> : selected ? <Tabs key={selectedProcessId} className="drawer-tabs" defaultActiveKey="overview" items={[
        { key: 'overview', label: 'Tổng quan', children: overviewTab },
        { key: 'versions', label: <span><History size={15} /> Phiên bản</span>, children: versionsTab },
        { key: 'receipt', label: <span><Eye size={15} /> Tiếp nhận</span>, children: receiptTab }
      ]} /> : <Empty description="Không tải được chi tiết quy trình" />}
    </aside>}

    <Modal title={`Xác nhận đào tạo · ${selected?.ProcessCode || ''}`} open={trainingOpen}
      onCancel={() => { setTrainingOpen(false); setFileList([]); form.resetFields(); }} onOk={() => form.submit()}
      confirmLoading={confirmMutation.isPending} okText="Xác nhận đã đào tạo" cancelText="Hủy" okButtonProps={{ disabled: !fileList.length }}>
      <Form form={form} layout="vertical" onFinish={confirmMutation.mutate}>
        <Form.Item label="Biên bản / minh chứng" required><Upload.Dragger multiple maxCount={10} fileList={fileList} beforeUpload={beforeUpload} onChange={({ fileList: next }) => setFileList(next)} accept={allowedExtensions.join(',')}><UploadCloud size={34} /><p>Kéo thả hoặc chọn tối đa 10 file</p><small>PDF, ảnh, Word hoặc Excel · tối đa 50 MB/file</small></Upload.Dragger></Form.Item>
        <Form.Item name="comment" label="Ghi chú"><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>
      </Form>
    </Modal>

    <Modal title={`Minh chứng đào tạo · ${selected?.ProcessCode || ''}`} open={evidenceOpen} onCancel={() => setEvidenceOpen(false)} footer={null}>
      <List loading={trainingQuery.isLoading} dataSource={trainingQuery.data?.evidence || []} locale={{ emptyText: <Empty description="Không có minh chứng" /> }} renderItem={file => <List.Item actions={[<FileViewerButton key="view" file={file} label="Xem" />, <FileDownloadButton key="download" file={file} />]}><List.Item.Meta avatar={<Paperclip size={18} />} title={file.OriginalName} description={`${Math.ceil((file.FileSize || 0) / 1024)} KB`} /></List.Item>} />
    </Modal>
  </div>;
}
