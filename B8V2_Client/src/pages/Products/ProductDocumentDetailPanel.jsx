import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Form, Input, List, Modal, Popconfirm, Progress, Select, Skeleton, Space, Tabs, message } from 'antd';
import { ArrowLeft, Boxes, Edit3, FilePlus2, History, Link2, Package, RotateCcw, ShieldCheck, Trash2, Upload, UsersRound, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useAuth } from '../../auth/AuthProvider';
import {
  assignProductDocumentAudience,
  createProductDocumentVersion,
  deleteProductDocument,
  deleteProductDocumentVersion,
  deleteProductTrainingEvidence,
  getProductDepartmentProgress,
  getProductDocumentDetail,
  getProductDocumentVersionDetail,
  getProducts,
  mapProductDocument,
  removeProductDocumentAudience,
  restoreProductDocument,
  restoreProductDocumentVersion,
  unmapProductDocument,
  updateProductDocument,
  updateProductDocumentVersion
} from '../../api/product.api';
import { getDocumentTypeDefaultAudience, getDocumentTypes } from '../../api/master.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import FileUploader from '../../components/FileUploader';
import FileViewerButton from '../../components/FileViewerButton';
import FileDownloadButton from '../../components/FileDownloadButton';
import StatusBadge from '../../components/StatusBadge';

const formatDate = value => value ? dayjs(value).format('DD/MM/YYYY') : '—';
const toDate = value => value ? dayjs(value) : null;
const masterStatuses = [
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' }
];

function InfoRow({ label, children }) {
  return <div className="product-info-row"><span>{label}</span><strong>{children || '—'}</strong></div>;
}

export default function ProductDocumentDetailPanel({
  product,
  documentId,
  openCreateVersion = false,
  onCreateVersionOpened,
  onBack,
  onClose,
  onChanged
}) {
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [modal, setModal] = useState(null);
  const [itemCodeSearch, setItemCodeSearch] = useState('');
  const [masterForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [mapForm] = Form.useForm();
  const [audienceForm] = Form.useForm();

  const types = useQuery({ queryKey: ['document-types'], queryFn: getDocumentTypes });
  const productOptions = useQuery({
    queryKey: ['product-map-options', itemCodeSearch],
    queryFn: () => getProducts({
      keyword: itemCodeSearch || undefined,
      sourceStatus: 'ACTIVE',
      hasDocuments: 'ALL',
      deletedMode: 'ACTIVE',
      page: 1,
      pageSize: 100
    }),
    enabled: modal === 'map'
  });
  const detail = useQuery({
    queryKey: ['product-document', documentId],
    queryFn: () => getProductDocumentDetail(documentId),
    enabled: Boolean(documentId)
  });
  const document = detail.data?.document;
  const versions = detail.data?.versions || [];
  const products = detail.data?.products || [];
  const defaultAudience = useQuery({
    queryKey: ['document-type-default-audience', document?.DocumentTypeId],
    queryFn: () => getDocumentTypeDefaultAudience(document.DocumentTypeId),
    enabled: Boolean(document?.DocumentTypeId)
  });
  const currentVersion = useMemo(
    () => versions.find(item => item.Id === selectedVersionId)
      || versions.find(item => !item.IsDeleted && item.Status === 'EFFECTIVE')
      || versions.find(item => !item.IsDeleted)
      || versions[0]
      || null,
    [versions, selectedVersionId]
  );
  const versionDetail = useQuery({
    queryKey: ['product-document-version', currentVersion?.Id],
    queryFn: () => getProductDocumentVersionDetail(currentVersion.Id),
    enabled: Boolean(currentVersion?.Id && !currentVersion?.IsDeleted)
  });
  const activeAudiences = (versionDetail.data?.audiences || []).filter(item => item.IsActive);
  const progress = useQuery({
    queryKey: ['product-document-progress', currentVersion?.Id],
    queryFn: () => getProductDepartmentProgress(currentVersion.Id),
    enabled: Boolean(currentVersion?.Id && !currentVersion?.IsDeleted && hasPermission('DOCUMENT_VIEW_ALL'))
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['product', product?.Id] });
    qc.invalidateQueries({ queryKey: ['product-document', documentId] });
    if (currentVersion?.Id) {
      qc.invalidateQueries({ queryKey: ['product-document-version', currentVersion.Id] });
      qc.invalidateQueries({ queryKey: ['product-document-progress', currentVersion.Id] });
    }
    onChanged?.();
  };

  const useActionMutation = (fn, success) => useMutation({
    mutationFn: fn,
    onSuccess: data => {
      message.success(success);
      setModal(null);
      refresh();
      return data;
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  const editDocument = useActionMutation(values => updateProductDocument(documentId, values), 'Đã cập nhật tài liệu');
  const removeDocument = useActionMutation(() => deleteProductDocument(documentId), 'Đã xóa mềm tài liệu');
  const recoverDocument = useActionMutation(() => restoreProductDocument(documentId), 'Đã khôi phục tài liệu');
  const editVersion = useActionMutation(values => updateProductDocumentVersion(currentVersion.Id, {
    ...values,
    issueDate: values.issueDate?.format('YYYY-MM-DD') || null,
    effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
    expiryDate: values.expiryDate?.format('YYYY-MM-DD') || null
  }), 'Đã cập nhật phiên bản');
  const removeVersion = useActionMutation(id => deleteProductDocumentVersion(id), 'Đã xóa mềm phiên bản');
  const recoverVersion = useActionMutation(id => restoreProductDocumentVersion(id), 'Đã khôi phục phiên bản');
  const mapMutation = useActionMutation(async ({ itemCodes = [], applicableFrom }) => {
    for (const itemCode of itemCodes) {
      await mapProductDocument(documentId, {
        itemCode,
        applicableFrom: applicableFrom?.format('YYYY-MM-DD') || null
      });
    }
  }, 'Đã liên kết các ItemCode');
  const unmapMutation = useActionMutation(itemCode => unmapProductDocument(documentId, itemCode), 'Đã kết thúc liên kết ItemCode');
  const audienceMutation = useActionMutation(async ({ departmentIds = [] }) => {
    const selectedIds = new Set(departmentIds);
    const activeByDepartment = new Map(activeAudiences.map(item => [item.DepartmentId, item]));
    const removedIds = activeAudiences
      .filter(item => !selectedIds.has(item.DepartmentId))
      .map(item => item.DepartmentId);
    const upsertedIds = departmentIds.filter(departmentId => {
      const current = activeByDepartment.get(departmentId);
      return !current || !current.RequiredRead || !current.RequiredAcknowledge || !current.RequiredTraining;
    });

    for (const departmentId of removedIds) {
      await removeProductDocumentAudience(currentVersion.Id, departmentId);
    }
    for (const departmentId of upsertedIds) {
      await assignProductDocumentAudience(currentVersion.Id, {
        departmentId,
        requiredRead: true,
        requiredAcknowledge: true,
        requiredTraining: true
      });
    }
  }, 'Đã cập nhật bộ phận nhận');
  const deleteEvidenceMutation = useActionMutation(id => deleteProductTrainingEvidence(id), 'Đã xóa minh chứng');
  const createVersion = useMutation({
    mutationFn: values => createProductDocumentVersion(documentId, {
      ...values,
      issueDate: values.issueDate?.format('YYYY-MM-DD') || null,
      effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
      changeSummary: values.changeSummary || null,
      departmentIds: values.departmentIds || []
    }),
    onSuccess: data => {
      message.success('Đã tạo phiên bản nháp');
      setSelectedVersionId(data.Id);
      setModal(null);
      refresh();
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  const openVersion = (modeName, item) => {
    if (item) setSelectedVersionId(item.Id);
    versionForm.resetFields();
    versionForm.setFieldsValue(modeName === 'editVersion' ? {
      versionCode: item.VersionCode,
      issueDate: toDate(item.IssueDate),
      effectiveDate: toDate(item.EffectiveDate),
      expiryDate: toDate(item.ExpiryDate),
      changeSummary: item.ChangeSummary
    } : {
      issueDate: dayjs(),
      effectiveDate: dayjs(),
      departmentIds: [...new Set([
        ...activeAudiences.map(audience => Number(audience.DepartmentId)),
        ...(defaultAudience.data || []).map(audience => Number(audience.DepartmentId))
      ])]
    });
    setModal(modeName);
  };
  const openAudienceModal = () => {
    audienceForm.setFieldsValue({ departmentIds: activeAudiences.map(item => item.DepartmentId) });
    setModal('audience');
  };
  const openMapModal = () => {
    setItemCodeSearch('');
    mapForm.resetFields();
    setModal('map');
  };

  useEffect(() => {
    setSelectedVersionId(null);
  }, [documentId]);

  useEffect(() => {
    if (modal !== 'createVersion' || !defaultAudience.data) return;
    const current = versionForm.getFieldValue('departmentIds') || [];
    versionForm.setFieldValue('departmentIds', [...new Set([...current, ...defaultAudience.data.map(item => Number(item.DepartmentId))])]);
  }, [defaultAudience.data, modal, versionForm]);

  useEffect(() => {
    if (openCreateVersion && document && !document.IsDeleted && hasPermission('DOCUMENT_VERSION_CREATE')) {
      openVersion('createVersion');
      onCreateVersionOpened?.();
    }
  }, [openCreateVersion, document?.Id]);

  if (detail.isLoading) {
    return <aside className="process-drawer"><div className="drawer-loading"><Skeleton active /></div></aside>;
  }

  if (!document) {
    return <aside className="process-drawer"><Empty description="Không tìm thấy tài liệu" /></aside>;
  }

  const overview = <>
    <div className="drawer-section product-info-list">
      <InfoRow label="Loại tài liệu">{document.DocumentTypeName}</InfoRow>
      <InfoRow label="Bộ phận">{document.OwnerDepartmentName}</InfoRow>
      <InfoRow label="ItemCode áp dụng">{products.length}</InfoRow>
      <InfoRow label="Trạng thái"><StatusBadge status={document.IsDeleted ? 'DELETED' : document.Status} /></InfoRow>
    </div>
    <div className="drawer-actions">
      {document.IsDeleted ? isAdmin && <Button type="primary" icon={<RotateCcw size={16} />} onClick={() => recoverDocument.mutate()}>Khôi phục tài liệu</Button> : <>
        {hasPermission('PRODUCT_DOCUMENT_EDIT') && <Button icon={<Edit3 size={16} />} onClick={() => {
          masterForm.setFieldsValue({
            documentTypeId: document.DocumentTypeId,
            ownerDepartmentId: document.OwnerDepartmentId,
            status: document.Status
          });
          setModal('edit');
        }}>Sửa tài liệu</Button>}
        {hasPermission('PRODUCT_DOCUMENT_DELETE') && <Popconfirm
          title={`Xóa tài liệu dùng chung cho ${products.length} ItemCode?`}
          description="Tài liệu sẽ bị ẩn nhưng file, tiếp nhận và lịch sử vẫn được giữ."
          onConfirm={() => removeDocument.mutate()}
          okText="Xóa"
          cancelText="Hủy"
        ><Button danger icon={<Trash2 size={16} />}>Xóa tài liệu</Button></Popconfirm>}
      </>}
    </div>
  </>;

  const versionTab = <div className="version-timeline">
    {versions.length ? versions.map(item => <div
      className={`version-card ${item.Id === currentVersion?.Id ? 'is-active' : ''} ${item.IsDeleted ? 'is-deleted' : ''}`}
      key={item.Id}
      onClick={() => setSelectedVersionId(item.Id)}
    >
      <span className="version-dot" />
      <span><strong>Phiên bản {item.VersionCode}</strong><small>{item.IsDeleted ? `Đã xóa ${formatDate(item.DeletedAt)}` : formatDate(item.EffectiveDate)}</small></span>
      <span>
        <StatusBadge status={item.IsDeleted ? 'DELETED' : item.Status} />
        <span className="version-card-actions" onClick={event => event.stopPropagation()}>
          {!document.IsDeleted && !item.IsDeleted && hasPermission('PRODUCT_DOCUMENT_VERSION_EDIT') && <Button type="link" size="small" onClick={() => openVersion('editVersion', item)}>Sửa</Button>}
          {!document.IsDeleted && !item.IsDeleted && hasPermission('PRODUCT_DOCUMENT_VERSION_DELETE') && <Popconfirm title="Xóa mềm phiên bản?" onConfirm={() => removeVersion.mutate(item.Id)}><Button type="link" size="small" danger>Xóa</Button></Popconfirm>}
          {!document.IsDeleted && item.IsDeleted && isAdmin && <Button type="link" size="small" onClick={() => recoverVersion.mutate(item.Id)}>Khôi phục</Button>}
        </span>
      </span>
    </div>) : <Empty description="Chưa có phiên bản" />}
    {!document.IsDeleted && hasPermission('DOCUMENT_VERSION_CREATE') && <Button block icon={<FilePlus2 size={16} />} onClick={() => openVersion('createVersion')}>Thêm phiên bản</Button>}
    {!document.IsDeleted && currentVersion && !currentVersion.IsDeleted && <div className="product-version-files">
      {(versionDetail.data?.files || []).map(file => <div className="drawer-file-row" key={file.FileId}>
        <div><strong>{file.OriginalName}</strong><span>{file.FileRole || 'PDF'}</span></div>
        <Space><FileViewerButton file={file} label="Xem" /><FileDownloadButton file={file} label="Tải" /></Space>
      </div>)}
      {currentVersion.Status === 'DRAFT' && hasPermission('DOCUMENT_FILE_UPLOAD') && <div className="drawer-upload">
        <Upload size={16} />
        <div><strong>Tải PDF/SIGNED để phát hành</strong><FileUploader productDocumentVersionId={currentVersion.Id} onUploaded={refresh} /></div>
      </div>}
    </div>}
  </div>;

  const distributionTab = currentVersion ? <div className="distribution-list">
    {activeAudiences.length ? activeAudiences.map(item => <div className="distribution-card" key={item.Id || item.DepartmentId}>
      <div className="distribution-icon"><UsersRound size={18} /></div>
      <div><strong>{item.DepartmentName || `Bộ phận ${item.DepartmentId}`}</strong><span>Bắt buộc đọc, xác nhận và đào tạo</span></div>
      <StatusBadge status="ACTIVE" />
    </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bộ phận nhận" />}
    {!document.IsDeleted && !currentVersion.IsDeleted && hasPermission('DOCUMENT_AUDIENCE_MANAGE') && <Button block icon={<UsersRound size={16} />} onClick={openAudienceModal}>Cập nhật bộ phận nhận</Button>}
  </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hãy tạo phiên bản trước" />;

  const productTab = <div className="linked-document-list">
    {products.map(item => <div className="linked-document-card" key={item.ProductId}>
      <Package size={17} />
      <div><strong>{item.ItemCode}</strong><span>{item.ProductName || 'Không có tên'}</span></div>
      {hasPermission('PRODUCT_MANAGE') && item.ProductId !== product?.Id && <Popconfirm title="Kết thúc liên kết ItemCode này?" onConfirm={() => unmapMutation.mutate(item.ItemCode)}><Button type="text" danger icon={<X size={15} />} /></Popconfirm>}
    </div>)}
    {!products.length && <Empty description="Chưa có ItemCode" />}
    {!document.IsDeleted && hasPermission('PRODUCT_MANAGE') && <Button block icon={<Link2 size={16} />} onClick={openMapModal}>Liên kết ItemCode</Button>}
  </div>;

  const progressData = progress.data || {};
  const summary = progressData.summary || {};
  const progressTab = <div className="drawer-section">
    <div className="progress-label"><span>Đã xem</span><strong>{summary.ViewedDepartments || 0}/{summary.TotalDepartments || 0}</strong></div>
    <Progress percent={summary.TotalDepartments ? Math.round((summary.ViewedDepartments || 0) * 100 / summary.TotalDepartments) : 0} showInfo={false} />
    <div className="progress-label"><span>Đã đào tạo</span><strong>{summary.TrainedDepartments || 0}/{summary.TotalDepartments || 0}</strong></div>
    <Progress status="success" percent={summary.TotalDepartments ? Math.round((summary.TrainedDepartments || 0) * 100 / summary.TotalDepartments) : 0} showInfo={false} />
    <List
      loading={progress.isLoading}
      dataSource={progressData.departments || []}
      locale={{ emptyText: <Empty description="Chưa có dữ liệu tiếp nhận" /> }}
      renderItem={item => <List.Item><List.Item.Meta
        title={<Space><strong>{item.DepartmentNameSnapshot}</strong><StatusBadge status={item.DeliveryStatus} /></Space>}
        description={<>
          {item.FirstViewedAt && <div>Xem: {item.FirstViewedByName || item.FirstViewedBy} · {dayjs(item.FirstViewedAt).format('DD/MM/YYYY HH:mm')}</div>}
          {item.TrainingConfirmedAt && <div>Đào tạo: {item.TrainingConfirmedByName || item.TrainingConfirmedBy} · {dayjs(item.TrainingConfirmedAt).format('DD/MM/YYYY HH:mm')}</div>}
          {item.evidence?.map(file => <div className="drawer-file-row" key={file.EvidenceId}>
            <div><strong>{file.OriginalName}</strong><span>{Math.ceil((file.FileSize || 0) / 1024)} KB</span></div>
            <Space><FileViewerButton file={file} label="Xem" /><FileDownloadButton file={file} label="Tải" />{isAdmin && <Popconfirm title="Xóa minh chứng?" onConfirm={() => deleteEvidenceMutation.mutate(file.EvidenceId)}><Button danger size="small">Xóa</Button></Popconfirm>}</Space>
          </div>)}
        </>}
      /></List.Item>}
    />
  </div>;

  return <>
    <aside className="process-drawer product-document-panel">
      <div className="drawer-header product-document-panel-header">
        <Button className="product-panel-back-button" type="text" icon={<ArrowLeft size={18} />} onClick={onBack} aria-label="Quay lại danh sách tài liệu" />
        <div className="drawer-header-copy">
          <span className="product-panel-breadcrumb">{product?.ItemCode} / {document.DocumentTypeName}</span>
          <strong>{document.DocumentTypeName}</strong>
        </div>
        <Button type="text" icon={<X size={20} />} onClick={onClose} />
      </div>
      <Tabs className="drawer-tabs" defaultActiveKey="versions" items={[
        { key: 'overview', label: 'Tổng quan', children: overview },
        { key: 'versions', label: <span><History size={15} /> Phiên bản</span>, children: versionTab },
        { key: 'distribution', label: <span><UsersRound size={15} /> Phân phối</span>, children: distributionTab },
        { key: 'progress', label: 'Tiếp nhận', children: progressTab },
        { key: 'products', label: <span><Boxes size={15} /> ItemCode</span>, children: productTab }
      ]} />
    </aside>

    <Modal title="Sửa tài liệu sản phẩm" open={modal === 'edit'} onCancel={() => setModal(null)} onOk={() => masterForm.submit()} confirmLoading={editDocument.isPending}>
      <Form form={masterForm} layout="vertical" onFinish={editDocument.mutate}>
        <Form.Item name="documentTypeId" label="Loại tài liệu" extra="Không thể đổi loại sau khi tài liệu đã liên kết ItemCode."><Select disabled options={(types.data || []).map(item => ({ value: item.Id, label: `${item.Code} · ${item.Name}` }))} /></Form.Item>
        <Form.Item name="ownerDepartmentId" label="Bộ phận ban hành"><DepartmentSelect allowClear /></Form.Item>
        <Form.Item name="status" label="Trạng thái"><Select options={masterStatuses} /></Form.Item>
      </Form>
    </Modal>
    <Modal title={modal === 'editVersion' ? 'Sửa phiên bản' : 'Thêm phiên bản'} open={['createVersion', 'editVersion'].includes(modal)} onCancel={() => setModal(null)} onOk={() => versionForm.submit()} confirmLoading={createVersion.isPending || editVersion.isPending}>
      <Form form={versionForm} layout="vertical" onFinish={modal === 'editVersion' ? editVersion.mutate : createVersion.mutate}>
        <Form.Item name="versionCode" label="Phiên bản" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập phiên bản' }]}><Input maxLength={50} placeholder="Ví dụ: A, Rev.01, 2026-Q3..." /></Form.Item>
        <div className="form-grid-2">
          <Form.Item name="issueDate" label="Ngày ban hành"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effectiveDate" label="Ngày hiệu lực" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        </div>
        {modal === 'editVersion' && <Form.Item name="expiryDate" label="Ngày hết hạn"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>}
        <Form.Item name="changeSummary" label="Nội dung thay đổi"><Input.TextArea rows={4} maxLength={1000} /></Form.Item>
        {modal === 'createVersion' && <Form.Item name="departmentIds" label="Bộ phận nhận" extra="Kế thừa phiên bản trước và đề xuất từ quy trình sản xuất; có thể thêm hoặc bỏ."><DepartmentSelect mode="multiple" /></Form.Item>}
      </Form>
    </Modal>
    <Modal title="Liên kết ItemCode" open={modal === 'map'} onCancel={() => setModal(null)} onOk={() => mapForm.submit()} confirmLoading={mapMutation.isPending} okText="Liên kết" cancelText="Hủy">
      <Form form={mapForm} layout="vertical" onFinish={mapMutation.mutate}>
        <Form.Item name="itemCodes" label="ItemCode" rules={[{ required: true, message: 'Vui lòng chọn ít nhất một ItemCode' }]}>
          <Select
            mode="multiple"
            showSearch
            allowClear
            maxTagCount="responsive"
            filterOption={false}
            loading={productOptions.isFetching}
            onSearch={setItemCodeSearch}
            placeholder="Tìm và chọn một hoặc nhiều ItemCode"
            notFoundContent={productOptions.isFetching ? 'Đang tìm kiếm...' : 'Không tìm thấy ItemCode phù hợp'}
            options={(productOptions.data || [])
              .filter(item => !products.some(linked => linked.ItemCode === item.ItemCode))
              .map(item => ({
                value: item.ItemCode,
                label: `${item.ItemCode}${item.ProductName ? ` — ${item.ProductName}` : ''}`
              }))}
          />
        </Form.Item>
        <Form.Item name="applicableFrom" label="Áp dụng từ"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
    <Modal title="Cập nhật bộ phận nhận" open={modal === 'audience'} onCancel={() => setModal(null)} onOk={() => audienceForm.submit()} confirmLoading={audienceMutation.isPending} okText="Lưu thay đổi" cancelText="Hủy">
      <Form form={audienceForm} layout="vertical" onFinish={audienceMutation.mutate} requiredMark={false}>
        <Form.Item name="departmentIds" label="Bộ phận nhận"><DepartmentSelect mode="multiple" placeholder="Chọn các bộ phận nhận tài liệu" /></Form.Item>
        <div className="audience-requirement-note"><ShieldCheck size={17} /><span>Tất cả bộ phận được chọn đều bắt buộc đọc, xác nhận và hoàn thành đào tạo.</span></div>
      </Form>
    </Modal>
  </>;
}
