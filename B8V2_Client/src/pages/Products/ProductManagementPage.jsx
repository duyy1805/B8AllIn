import { useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Form, Input, List, Modal, Popconfirm, Progress, Select, Skeleton, Space, Table, Tabs, Tag, Upload as AntUpload, message } from 'antd';
import { Boxes, Clock3, Edit3, FilePlus2, FileText, History, Link2, Package, Plus, RotateCcw, Search, Settings2, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useAuth } from '../../auth/AuthProvider';
import { getDocumentTypes } from '../../api/master.api';
import {
  createProductDocument, createProductDocumentVersion, deleteProduct, deleteProductDocument, deleteProductDocumentVersion,
  getProductDetail, getProductDocumentDetail, getProductDocuments, getProductDocumentVersionDetail, getProducts,
  mapProductDocument, restoreProduct, restoreProductDocument, restoreProductDocumentVersion, unmapProductDocument,
  updateProduct, updateProductDocument, updateProductDocumentVersion, upsertProduct, syncProducts, getLatestProductSync,
  bulkSetProductRequirements, createProductDocumentWizard, getProductDepartmentProgress, assignProductDocumentAudience,
  removeProductDocumentAudience, deleteProductTrainingEvidence
} from '../../api/product.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import FileUploader from '../../components/FileUploader';
import FileViewerButton from '../../components/FileViewerButton';
import FileDownloadButton from '../../components/FileDownloadButton';
import StatusBadge from '../../components/StatusBadge';
import MyProductDocumentsPage from './MyProductDocumentsPage';
import { attachProductDocumentFile, uploadFile } from '../../api/file.api';
import ProductDocumentDetailPanel from './ProductDocumentDetailPanel';

const formatDate = value => value ? dayjs(value).format('DD/MM/YYYY') : '—';
const toDate = value => value ? dayjs(value) : null;
const masterStatuses = [{value:'ACTIVE',label:'Đang hoạt động'},{value:'INACTIVE',label:'Ngừng hoạt động'},{value:'ARCHIVED',label:'Đã lưu trữ'}];

function InfoRow({ label, children }) {
  return <div className="product-info-row"><span>{label}</span><strong>{children || '—'}</strong></div>;
}

function DeletedModeFilter({ value, onChange }) {
  return <div className="filter-field"><label>Dữ liệu</label><Select value={value} onChange={onChange} options={[{value:'ACTIVE',label:'Đang sử dụng'},{value:'DELETED',label:'Đã xóa'},{value:'ALL',label:'Tất cả'}]} /></div>;
}

function ProductMasterWorkspace() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [maB4, setMaB4] = useState('');
  const [category, setCategory] = useState('');
  const [market, setMarket] = useState('');
  const [sourceStatus, setSourceStatus] = useState('ACTIVE');
  const [completeness, setCompleteness] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [openVersionOnEnter, setOpenVersionOnEnter] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [modal, setModal] = useState(null);
  const [wizardContextProductId, setWizardContextProductId] = useState(null);
  const [itemCodeSearch, setItemCodeSearch] = useState('');
  const [wizardFileList, setWizardFileList] = useState([]);
  const [requirementForm] = Form.useForm();
  const [wizardForm] = Form.useForm();

  const types = useQuery({ queryKey: ['document-types'], queryFn: getDocumentTypes });
  const list = useQuery({
    queryKey: ['products', keyword, maB4, category, market, sourceStatus, completeness, page, pageSize],
    queryFn: () => getProducts({
      keyword: keyword || undefined,
      maB4: maB4 || undefined,
      category: category || undefined,
      market: market || undefined,
      sourceStatus,
      completeness,
      hasDocuments: 'WITH_DOCUMENTS',
      deletedMode: 'ACTIVE',
      page,
      pageSize
    })
  });
  const productOptions = useQuery({
    queryKey: ['product-options', itemCodeSearch],
    queryFn: () => getProducts({ keyword: itemCodeSearch || undefined, sourceStatus: 'ACTIVE', hasDocuments: 'ALL', deletedMode: 'ACTIVE', page: 1, pageSize: 100 }),
    enabled: ['wizard', 'requirements'].includes(modal)
  });
  const latest = useQuery({
    queryKey: ['product-sync-latest'],
    queryFn: getLatestProductSync,
    enabled: hasPermission('PRODUCT_SYNC') || hasPermission('DOCUMENT_VIEW_ALL')
  });
  const detail = useQuery({ queryKey: ['product', selectedId], queryFn: () => getProductDetail(selectedId), enabled: Boolean(selectedId) });
  const product = detail.data?.product;
  const slots = detail.data?.documentSlots || [];
  const documents = detail.data?.documents || slots.filter(item => item.DocumentId);
  const requiredTypes = slots.filter(item => item.IsRequired);
  const usedTypeIds = new Set(documents.filter(item => !item.IsDeleted).map(item => Number(item.DocumentTypeId)));
  const wizardTypes = wizardContextProductId
    ? (types.data || []).filter(item => !usedTypeIds.has(Number(item.Id)))
    : (types.data || []);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    if (selectedId) qc.invalidateQueries({ queryKey: ['product', selectedId] });
  };
  const openWizard = contextProductId => {
    setWizardContextProductId(contextProductId || null);
    setItemCodeSearch('');
    setWizardFileList([]);
    wizardForm.resetFields();
    wizardForm.setFieldsValue({ issueDate: dayjs(), effectiveDate: dayjs(), additionalProductIds: [] });
    setModal('wizard');
  };

  const syncMutation = useMutation({
    mutationFn: syncProducts,
    onSuccess: data => {
      message.success(`Đồng bộ xong: ${data.CreatedCount} mới, ${data.UpdatedCount} cập nhật, ${data.InactivatedCount} ngừng hoạt động`);
      qc.invalidateQueries({ queryKey: ['product-sync-latest'] });
      refresh();
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const requirementMutation = useMutation({
    mutationFn: bulkSetProductRequirements,
    onSuccess: () => {
      message.success('Đã cập nhật loại tài liệu bắt buộc');
      setModal(null);
      requirementForm.resetFields();
      refresh();
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const wizardMutation = useMutation({
    mutationFn: async values => {
      const productIds = wizardContextProductId
        ? [...new Set([wizardContextProductId, ...(values.additionalProductIds || [])])]
        : values.productIds;
      const data = await createProductDocumentWizard({
        ...values,
        productIds,
        effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
        issueDate: values.issueDate?.format('YYYY-MM-DD') || null
      });
      const file = wizardFileList[0]?.originFileObj || wizardFileList[0];
      if (file) {
        const stored = await uploadFile(file);
        await attachProductDocumentFile(data.DocumentVersionId, stored.Id, 'PDF');
      }
      return { ...data, productIds, published: Boolean(file) };
    },
    onSuccess: data => {
      message.success(data.published ? 'Đã tạo và phát hành tài liệu' : 'Đã lưu tài liệu ở trạng thái nháp');
      setModal(null);
      setWizardFileList([]);
      setWizardContextProductId(null);
      wizardForm.resetFields();
      setSelectedId(data.productIds[0]);
      setSelectedDocumentId(data.DocumentId);
      setOpenVersionOnEnter(false);
      refresh();
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  const columns = [
    { title: 'ItemCode', dataIndex: 'ItemCode', width: 150, render: value => <span className="process-code">{value}</span> },
    { title: 'Tên sản phẩm', dataIndex: 'ProductName', render: value => value || '—' },
    { title: 'MaB4', dataIndex: 'ModelCode', width: 130, render: value => value || '—' },
    { title: 'Chủng loại', dataIndex: 'SourceCategoryName', width: 160, render: value => value || '—' },
    { title: 'Thị trường', dataIndex: 'SourceMarket', width: 110, render: value => value || '—' },
    { title: 'Đầy đủ', width: 105, render: (_, row) => <Tag color={row.RequiredTypeCount === row.CompletedRequiredTypeCount ? 'green' : 'orange'}>{row.CompletedRequiredTypeCount || 0}/{row.RequiredTypeCount || 0}</Tag> },
    { title: 'Trạng thái', width: 120, render: (_, row) => <StatusBadge status={row.IsActive ? 'ACTIVE' : 'INACTIVE'} /> }
  ];

  const selectProduct = id => {
    setSelectedId(id);
    setSelectedDocumentId(null);
    setOpenVersionOnEnter(false);
  };

  const documentCards = <div className="linked-document-list product-document-cards">
    {documents.map(item => <div
      className={`linked-document-card product-document-card ${item.IsDeleted ? 'is-deleted' : ''}`}
      key={item.DocumentId}
      onClick={() => { setSelectedDocumentId(item.DocumentId); setOpenVersionOnEnter(false); }}
      role="button"
      tabIndex={0}
      onKeyDown={event => { if (event.key === 'Enter') setSelectedDocumentId(item.DocumentId); }}
    >
      <FileText size={17} />
      <div>
        <strong>{item.DocumentTypeName} · {item.DocumentName}</strong>
        <span>Phiên bản {item.EffectiveVersionCode || 'nháp'} · {formatDate(item.EffectiveDate)}</span>
      </div>
      <div className="product-document-card-actions" onClick={event => event.stopPropagation()}>
        <StatusBadge status={item.IsDeleted ? 'DELETED' : (item.SlotStatus || item.Status)} />
        {!item.IsDeleted && hasPermission('DOCUMENT_VERSION_CREATE') && <Button size="small" type="link" onClick={() => { setSelectedDocumentId(item.DocumentId); setOpenVersionOnEnter(true); }}>Thêm phiên bản</Button>}
      </div>
    </div>)}
    {!documents.length && <Empty description="Sản phẩm chưa có tài liệu" />}
    {hasPermission('DOCUMENT_CREATE') && wizardTypes.length > 0 && <Button block icon={<FilePlus2 size={16} />} onClick={() => openWizard(selectedId)}>Thêm tài liệu cho sản phẩm</Button>}
  </div>;

  return <div className={`process-workspace product-workspace ${selectedId ? 'has-drawer' : ''}`}>
    <main className="process-main">
      <div className="process-titlebar">
        <div>
          <h1>Sản phẩm</h1>
          <p>Chỉ hiển thị ItemCode đã có hồ sơ tài liệu</p>
          {latest.data && <small className="product-sync-caption">Lần cuối {formatDate(latest.data.CompletedAt || latest.data.StartedAt)} · {latest.data.StartedByName || `User #${latest.data.StartedBy}`} · {latest.data.CreatedCount} mới · {latest.data.InactivatedCount} inactive</small>}
        </div>
        <Space>
          {hasPermission('PRODUCT_REQUIREMENT_MANAGE') && <Button icon={<Settings2 size={17} />} onClick={() => {
            requirementForm.setFieldsValue({ productIds: selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []), action: 'ADD' });
            setItemCodeSearch('');
            setModal('requirements');
          }}>Cấu hình bắt buộc</Button>}
          {hasPermission('DOCUMENT_CREATE') && <Button icon={<FilePlus2 size={17} />} onClick={() => openWizard(null)}>Thêm tài liệu đầu tiên</Button>}
          {hasPermission('PRODUCT_SYNC') && <Button className="product-sync-button" type="primary" size="large" icon={<RefreshCw size={18} />} loading={syncMutation.isPending} onClick={() => Modal.confirm({
            title: 'Đồng bộ ItemCode từ TAG_QTKD?',
            content: 'Dữ liệu nguồn sẽ cập nhật metadata và trạng thái active; không ghi ngược về nguồn.',
            okText: 'Đồng bộ',
            cancelText: 'Hủy',
            onOk: () => syncMutation.mutateAsync()
          })}>Đồng bộ ItemCode</Button>}
        </Space>
      </div>
      <section className="process-table-card">
        <div className="process-filters product-filters">
          <div className="filter-field filter-search"><label>Tìm kiếm</label><Input allowClear prefix={<Search size={17} />} value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} placeholder="ItemCode hoặc tên sản phẩm..." /></div>
          <div className="filter-field"><label>MaB4</label><Input allowClear value={maB4} onChange={event => { setMaB4(event.target.value); setPage(1); }} placeholder="Lọc MaB4" /></div>
          <div className="filter-field"><label>Chủng loại</label><Input allowClear value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} placeholder="Tên chủng loại" /></div>
          <div className="filter-field"><label>Thị trường</label><Input allowClear value={market} onChange={event => { setMarket(event.target.value); setPage(1); }} placeholder="Thị trường" /></div>
          <div className="filter-field"><label>Trạng thái nguồn</label><Select value={sourceStatus} onChange={value => { setSourceStatus(value); setPage(1); }} options={[{ value: 'ALL', label: 'Tất cả' }, { value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }]} /></div>
          <div className="filter-field"><label>Độ đầy đủ</label><Select value={completeness} onChange={value => { setCompleteness(value); setPage(1); }} options={[{ value: 'ALL', label: 'Tất cả' }, { value: 'COMPLETE', label: 'Đầy đủ' }, { value: 'MISSING', label: 'Còn thiếu' }]} /></div>
        </div>
        <Table
          className="process-table"
          rowKey="Id"
          rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds, preserveSelectedRowKeys: true }}
          loading={list.isLoading}
          dataSource={list.data || []}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total: Number(list.data?.[0]?.TotalRows || 0),
            showSizeChanger: true,
            pageSizeOptions: ['50', '100'],
            showTotal: total => `Tổng ${total} sản phẩm`,
            onChange: (nextPage, nextSize) => { setPage(nextSize !== pageSize ? 1 : nextPage); setPageSize(nextSize); }
          }}
          rowClassName={row => row.Id === selectedId ? 'selected-process-row' : ''}
          onRow={row => ({ onClick: () => selectProduct(row.Id), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty description="Chưa có ItemCode nào được liên kết tài liệu. Dùng nút Thêm tài liệu đầu tiên để bắt đầu." /> }}
        />
      </section>
    </main>

    {selectedId && (selectedDocumentId ? <ProductDocumentDetailPanel
      product={product}
      documentId={selectedDocumentId}
      openCreateVersion={openVersionOnEnter}
      onCreateVersionOpened={() => setOpenVersionOnEnter(false)}
      onBack={() => { setSelectedDocumentId(null); setOpenVersionOnEnter(false); }}
      onClose={() => { setSelectedId(null); setSelectedDocumentId(null); }}
      onChanged={refresh}
    /> : <aside className="process-drawer">
      <div className="drawer-header">
        <div className="drawer-header-copy"><span>Chi tiết ItemCode</span><strong>{product?.ItemCode || 'Đang tải...'}</strong></div>
        <Button type="text" icon={<X size={20} />} onClick={() => setSelectedId(null)} />
      </div>
      {detail.isLoading ? <div className="drawer-loading"><Skeleton active /></div> : product ? <Tabs className="drawer-tabs" defaultActiveKey="documents" items={[
        { key: 'overview', label: 'Tổng quan', children: <div className="drawer-section product-info-list"><InfoRow label="ItemCode">{product.ItemCode}</InfoRow><InfoRow label="Tên sản phẩm">{product.ProductName}</InfoRow><InfoRow label="MaB4">{product.ModelCode}</InfoRow><InfoRow label="Chủng loại">{product.SourceCategoryName}</InfoRow><InfoRow label="Thị trường">{product.SourceMarket}</InfoRow><InfoRow label="Màu / Cỡ">{[product.SourceColor, product.SourceSize].filter(Boolean).join(' / ')}</InfoRow><InfoRow label="Đồng bộ lúc">{formatDate(product.LastSyncedAt)}</InfoRow><InfoRow label="Trạng thái"><StatusBadge status={product.IsActive ? 'ACTIVE' : 'INACTIVE'} /></InfoRow></div> },
        { key: 'documents', label: <span><FileText size={15} /> Tài liệu ({documents.length})</span>, children: documentCards },
        { key: 'requirements', label: <span><Settings2 size={15} /> Loại bắt buộc</span>, children: <div className="linked-document-list">{requiredTypes.map(item => <div className="linked-document-card" key={item.DocumentTypeId}><FileText size={17} /><div><strong>{item.DocumentTypeName}</strong><span>{item.Reason || 'Bắt buộc'}</span></div><StatusBadge status={item.SlotStatus} /></div>)}{!requiredTypes.length && <Empty description="Chưa cấu hình loại bắt buộc" />}</div> }
      ]} /> : <Empty description="Không tìm thấy sản phẩm" />}
    </aside>)}

    <Modal title="Cấu hình loại tài liệu bắt buộc" open={modal === 'requirements'} onCancel={() => setModal(null)} onOk={() => requirementForm.submit()} confirmLoading={requirementMutation.isPending}>
      <Form form={requirementForm} layout="vertical" onFinish={requirementMutation.mutate}>
        <Form.Item name="productIds" label="ItemCode áp dụng" rules={[{ required: true, message: 'Hãy chọn ít nhất một ItemCode' }]}><Select mode="multiple" showSearch filterOption={false} onSearch={setItemCodeSearch} loading={productOptions.isFetching} options={(productOptions.data || []).map(item => ({ value: item.Id, label: `${item.ItemCode} · ${item.ProductName || ''}` }))} placeholder="Nhập ItemCode hoặc tên sản phẩm" /></Form.Item>
        <Form.Item name="action" label="Thao tác" rules={[{ required: true }]}><Select options={[{ value: 'ADD', label: 'Thêm yêu cầu bắt buộc' }, { value: 'REMOVE', label: 'Gỡ yêu cầu bắt buộc' }]} /></Form.Item>
        <Form.Item name="documentTypeIds" label="Loại tài liệu" rules={[{ required: true }]}><Select mode="multiple" options={(types.data || []).map(item => ({ value: item.Id, label: item.Name }))} /></Form.Item>
        <Form.Item name="reason" label="Lý do"><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      </Form>
    </Modal>

    <Modal width={720} title={wizardContextProductId ? `Thêm tài liệu · ${product?.ItemCode || ''}` : 'Thêm tài liệu đầu tiên'} open={modal === 'wizard'} onCancel={() => { setModal(null); setWizardFileList([]); setWizardContextProductId(null); }} onOk={() => wizardForm.submit()} confirmLoading={wizardMutation.isPending} okText={wizardFileList.length ? 'Lưu và phát hành' : 'Lưu bản nháp'}>
      <Form form={wizardForm} layout="vertical" onFinish={wizardMutation.mutate}>
        {wizardContextProductId ? <>
          <Form.Item label="ItemCode hiện tại"><Input value={`${product?.ItemCode || ''} · ${product?.ProductName || ''}`} disabled /></Form.Item>
          <Form.Item name="additionalProductIds" label="Áp dụng thêm ItemCode"><Select mode="multiple" showSearch filterOption={false} onSearch={setItemCodeSearch} loading={productOptions.isFetching} options={(productOptions.data || []).filter(item => item.Id !== wizardContextProductId).map(item => ({ value: item.Id, label: `${item.ItemCode} · ${item.ProductName || ''}` }))} placeholder="Tùy chọn" /></Form.Item>
        </> : <Form.Item name="productIds" label="ItemCode chưa có tài liệu" rules={[{ required: true, message: 'Hãy chọn ít nhất một ItemCode' }]}><Select mode="multiple" showSearch filterOption={false} onSearch={setItemCodeSearch} loading={productOptions.isFetching} options={(productOptions.data || []).filter(item => Number(item.DocumentCount || 0) === 0).map(item => ({ value: item.Id, label: `${item.ItemCode} · ${item.ProductName || ''}` }))} placeholder="Nhập ItemCode hoặc tên sản phẩm" /></Form.Item>}
        <div className="form-grid-2">
          <Form.Item name="documentTypeId" label="Loại tài liệu" rules={[{ required: true }]}><Select options={wizardTypes.map(item => ({ value: item.Id, label: item.Name }))} /></Form.Item>
          <Form.Item name="documentName" label="Tên tài liệu" rules={[{ required: true, whitespace: true }]}><Input maxLength={255} /></Form.Item>
        </div>
        <Form.Item name="ownerDepartmentId" label="Bộ phận ban hành"><DepartmentSelect /></Form.Item>
        <div className="form-grid-2">
          <Form.Item name="versionCode" label="Phiên bản" rules={[{ required: true, whitespace: true }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="effectiveDate" label="Ngày hiệu lực" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        </div>
        <Form.Item name="issueDate" label="Ngày ban hành"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="departmentIds" label="Bộ phận nhận" rules={[{ required: true }]}><DepartmentSelect mode="multiple" /></Form.Item>
        <Form.Item label="File PDF" extra="Có thể bỏ trống để lưu nháp; chọn PDF để phát hành ngay."><AntUpload.Dragger accept=".pdf,application/pdf" maxCount={1} beforeUpload={() => false} fileList={wizardFileList} onChange={({ fileList: next }) => setWizardFileList(next.slice(-1))}><Upload size={30} /><p>Kéo thả hoặc chọn file PDF</p></AntUpload.Dragger></Form.Item>
        <Form.Item name="changeSummary" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}

function ProductDocumentWorkspace() {
  const qc=useQueryClient();
  const {hasPermission,hasRole}=useAuth();
  const isAdmin=hasRole('ADMIN');
  const [keyword,setKeyword]=useState('');
  const [deletedMode,setDeletedMode]=useState('ACTIVE');
  const [typeId,setTypeId]=useState();
  const [selectedId,setSelectedId]=useState(null);
  const [selectedVersionId,setSelectedVersionId]=useState(null);
  const [modal,setModal]=useState(null);
  const [masterForm]=Form.useForm(); const [versionForm]=Form.useForm(); const [mapForm]=Form.useForm(); const [audienceForm]=Form.useForm();
  const types=useQuery({queryKey:['document-types'],queryFn:getDocumentTypes});
  const list=useQuery({queryKey:['product-documents',keyword,typeId,deletedMode],queryFn:()=>getProductDocuments({keyword:keyword||undefined,documentTypeId:typeId,deletedMode,page:1,pageSize:500})});
  const detail=useQuery({queryKey:['product-document',selectedId],queryFn:()=>getProductDocumentDetail(selectedId),enabled:Boolean(selectedId)});
  const document=detail.data?.document; const versions=detail.data?.versions||[]; const products=detail.data?.products||[];
  const currentVersion=useMemo(()=>versions.find(v=>v.Id===selectedVersionId)||versions.find(v=>!v.IsDeleted&&v.Status==='EFFECTIVE')||versions.find(v=>!v.IsDeleted)||versions[0]||null,[versions,selectedVersionId]);
  const versionDetail=useQuery({queryKey:['product-document-version',currentVersion?.Id],queryFn:()=>getProductDocumentVersionDetail(currentVersion.Id),enabled:Boolean(currentVersion?.Id&&!currentVersion?.IsDeleted)});
  const progress=useQuery({queryKey:['product-document-progress',currentVersion?.Id],queryFn:()=>getProductDepartmentProgress(currentVersion.Id),enabled:Boolean(currentVersion?.Id&&!currentVersion?.IsDeleted&&hasPermission('DOCUMENT_VIEW_ALL'))});
  const refresh=()=>{qc.invalidateQueries({queryKey:['product-documents']});if(selectedId)qc.invalidateQueries({queryKey:['product-document',selectedId]});if(currentVersion?.Id)qc.invalidateQueries({queryKey:['product-document-version',currentVersion.Id]});};
  const useActionMutation=(fn,success)=>useMutation({mutationFn:fn,onSuccess:data=>{message.success(success);setModal(null);refresh();return data;},onError:e=>message.error(e.response?.data?.message||e.message)});
  const createDoc=useActionMutation(createProductDocument,'Đã tạo tài liệu sản phẩm');
  const editDoc=useActionMutation(values=>updateProductDocument(selectedId,values),'Đã cập nhật tài liệu');
  const removeDoc=useActionMutation(()=>deleteProductDocument(selectedId),'Đã xóa mềm tài liệu');
  const recoverDoc=useActionMutation(()=>restoreProductDocument(selectedId),'Đã khôi phục tài liệu');
  const createVersion=useActionMutation(values=>createProductDocumentVersion(selectedId,{...values,issueDate:values.issueDate?.format('YYYY-MM-DD')||null,effectiveDate:values.effectiveDate?.format('YYYY-MM-DD'),changeSummary:values.changeSummary||null}),'Đã tạo phiên bản');
  const editVersion=useActionMutation(values=>updateProductDocumentVersion(currentVersion.Id,{...values,issueDate:values.issueDate?.format('YYYY-MM-DD')||null,effectiveDate:values.effectiveDate?.format('YYYY-MM-DD'),expiryDate:values.expiryDate?.format('YYYY-MM-DD')||null}),'Đã cập nhật phiên bản');
  const removeVersion=useActionMutation(id=>deleteProductDocumentVersion(id),'Đã xóa mềm phiên bản');
  const recoverVersion=useActionMutation(id=>restoreProductDocumentVersion(id),'Đã khôi phục phiên bản');
  const mapMutation=useActionMutation(values=>mapProductDocument(selectedId,{itemCode:values.itemCode,applicableFrom:values.applicableFrom?.format('YYYY-MM-DD')||null}),'Đã liên kết ItemCode');
  const unmapMutation=useActionMutation(itemCode=>unmapProductDocument(selectedId,itemCode),'Đã kết thúc liên kết ItemCode');
  const audienceMutation=useActionMutation(async values=>{for(const departmentId of values.departmentIds)await assignProductDocumentAudience(currentVersion.Id,{departmentId,requiredRead:true,requiredAcknowledge:true,requiredTraining:true});},'Đã cập nhật bộ phận nhận');
  const removeAudienceMutation=useActionMutation(departmentId=>removeProductDocumentAudience(currentVersion.Id,departmentId),'Đã bỏ bộ phận nhận');
  const deleteEvidenceMutation=useActionMutation(id=>deleteProductTrainingEvidence(id),'Đã xóa minh chứng');
  const openMaster=(modeName)=>{masterForm.setFieldsValue(modeName==='edit'?{documentCode:document.DocumentCode,documentName:document.DocumentName,documentTypeId:document.DocumentTypeId,ownerDepartmentId:document.OwnerDepartmentId,status:document.Status}:{status:'ACTIVE'});setModal(modeName);};
  const openVersion=(modeName,item)=>{if(item)setSelectedVersionId(item.Id);versionForm.setFieldsValue(modeName==='editVersion'?{versionCode:item.VersionCode,issueDate:toDate(item.IssueDate),effectiveDate:toDate(item.EffectiveDate),expiryDate:toDate(item.ExpiryDate),changeSummary:item.ChangeSummary}:{issueDate:dayjs(),effectiveDate:dayjs()});setModal(modeName);};
  const masterFields=<><Form.Item name="documentName" label="Tên tài liệu" rules={[{required:true,whitespace:true}]}><Input maxLength={255}/></Form.Item><Form.Item name="documentTypeId" label="Loại tài liệu" rules={[{required:true}]} extra={modal==='edit'&&products.length?'Không thể đổi loại sau khi đã liên kết ItemCode.':null}><Select disabled={modal==='edit'&&products.length>0} showSearch optionFilterProp="label" options={(types.data||[]).map(x=>({value:x.Id,label:`${x.Code} · ${x.Name}`}))}/></Form.Item><Form.Item name="ownerDepartmentId" label="Bộ phận ban hành"><DepartmentSelect allowClear/></Form.Item>{modal==='edit'&&<Form.Item name="status" label="Trạng thái"><Select options={masterStatuses}/></Form.Item>}</>;
  const versionFields=<><Form.Item name="versionCode" label="Mã phiên bản" rules={[{required:true,whitespace:true}]}><Input maxLength={50}/></Form.Item><div className="form-grid-2"><Form.Item name="issueDate" label="Ngày ban hành"><DatePicker format="DD/MM/YYYY" style={{width:'100%'}}/></Form.Item><Form.Item name="effectiveDate" label="Ngày hiệu lực" rules={[{required:true}]}><DatePicker format="DD/MM/YYYY" style={{width:'100%'}}/></Form.Item></div>{modal==='editVersion'&&<Form.Item name="expiryDate" label="Ngày hết hạn"><DatePicker format="DD/MM/YYYY" style={{width:'100%'}}/></Form.Item>}<Form.Item name="changeSummary" label="Nội dung thay đổi"><Input.TextArea rows={4} maxLength={1000}/></Form.Item></>;
  const columns=[{title:'Tên tài liệu',dataIndex:'DocumentName'},{title:'Loại',dataIndex:'DocumentTypeName',width:170},{title:'ItemCode ảnh hưởng',dataIndex:'ItemCodeCount',width:125,align:'center'},{title:'Phiên bản',dataIndex:'EffectiveVersionCode',width:105,render:v=>v||'—'},{title:'Trạng thái',width:120,render:(_,row)=><StatusBadge status={row.IsDeleted?'DELETED':row.Status}/>}];
  const overview=<><div className="drawer-section product-info-list"><InfoRow label="Tên tài liệu">{document?.DocumentName}</InfoRow><InfoRow label="Loại">{document?.DocumentTypeName}</InfoRow><InfoRow label="Bộ phận">{document?.OwnerDepartmentName}</InfoRow><InfoRow label="ItemCode áp dụng">{products.length}</InfoRow><InfoRow label="Trạng thái"><StatusBadge status={document?.IsDeleted?'DELETED':document?.Status}/></InfoRow></div><div className="drawer-actions">{document?.IsDeleted?isAdmin&&<Button type="primary" icon={<RotateCcw size={16}/>} onClick={()=>recoverDoc.mutate()}>Khôi phục tài liệu</Button>:<>{hasPermission('PRODUCT_DOCUMENT_EDIT')&&<Button icon={<Edit3 size={16}/>} onClick={()=>openMaster('edit')}>Sửa tài liệu</Button>}{hasPermission('PRODUCT_DOCUMENT_DELETE')&&<Popconfirm title={`Xóa tài liệu dùng chung cho ${products.length} ItemCode?`} description="Tài liệu sẽ bị ẩn nhưng toàn bộ file, receipt và lịch sử vẫn được giữ." onConfirm={()=>removeDoc.mutate()} okText="Xóa" cancelText="Hủy"><Button danger icon={<Trash2 size={16}/>}>Xóa tài liệu</Button></Popconfirm>}</>}</div></>;
  const versionTab=<div className="version-timeline">{versions.length?versions.map(item=><div className={`version-card ${item.Id===currentVersion?.Id?'is-active':''} ${item.IsDeleted?'is-deleted':''}`} key={item.Id} onClick={()=>setSelectedVersionId(item.Id)}><span className="version-dot"/><span><strong>Phiên bản {item.VersionCode}</strong><small>{item.IsDeleted?`Đã xóa ${formatDate(item.DeletedAt)}${item.DeletedByName?` · ${item.DeletedByName}`:''}`:formatDate(item.EffectiveDate)}</small></span><span><StatusBadge status={item.IsDeleted?'DELETED':item.Status}/><span className="version-card-actions" onClick={e=>e.stopPropagation()}>{!document?.IsDeleted&&!item.IsDeleted&&hasPermission('PRODUCT_DOCUMENT_VERSION_EDIT')&&<Button type="link" size="small" onClick={()=>openVersion('editVersion',item)}>Sửa</Button>}{!document?.IsDeleted&&!item.IsDeleted&&hasPermission('PRODUCT_DOCUMENT_VERSION_DELETE')&&<Popconfirm title="Xóa mềm phiên bản?" onConfirm={()=>removeVersion.mutate(item.Id)}><Button type="link" size="small" danger>Xóa</Button></Popconfirm>}{!document?.IsDeleted&&item.IsDeleted&&isAdmin&&<Button type="link" size="small" onClick={()=>recoverVersion.mutate(item.Id)}>Khôi phục</Button>}</span></span></div>):<Empty description="Chưa có phiên bản"/>}{!document?.IsDeleted&&hasPermission('DOCUMENT_VERSION_CREATE')&&<Button block icon={<FilePlus2 size={16}/>} onClick={()=>Modal.confirm({title:'Tạo phiên bản mới?',content:`Phiên bản sau khi tải PDF/SIGNED sẽ áp dụng cho ${products.length} ItemCode đang liên kết.`,okText:'Tiếp tục',cancelText:'Hủy',onOk:()=>openVersion('createVersion')})}>Tạo phiên bản</Button>}{!document?.IsDeleted&&currentVersion&&!currentVersion.IsDeleted&&<div className="product-version-files">{(versionDetail.data?.files||[]).map(file=><div className="drawer-file-row" key={file.FileId}><div><strong>{file.OriginalName}</strong><span>{file.FileRole||'PDF'}</span></div><Space><FileViewerButton file={file} label="Xem"/><FileDownloadButton file={file} label="Tải"/></Space></div>)}{currentVersion.Status==='DRAFT'&&hasPermission('DOCUMENT_FILE_UPLOAD')&&<div className="drawer-upload"><Upload size={16}/><FileUploader productDocumentVersionId={currentVersion.Id} onUploaded={refresh}/></div>}</div>}</div>;
  const productTab=<div className="linked-document-list">{products.map(product=><div className="linked-document-card" key={product.ProductId}><Package size={17}/><div><strong>{product.ItemCode}</strong><span>{product.ProductName||'Không có tên'}</span></div>{hasPermission('PRODUCT_MANAGE')&&<Popconfirm title="Kết thúc liên kết ItemCode này?" onConfirm={()=>unmapMutation.mutate(product.ItemCode)}><Button type="text" danger icon={<X size={15}/>} /></Popconfirm>}</div>)}{!products.length&&<Empty description="Chưa có ItemCode"/>}{!document?.IsDeleted&&hasPermission('PRODUCT_MANAGE')&&<Button block icon={<Link2 size={16}/>} onClick={()=>setModal('map')}>Liên kết ItemCode</Button>}</div>;
  const distributionTab=<div className="linked-document-list">{(versionDetail.data?.audiences||[]).filter(item=>item.IsActive).map(item=><div className="linked-document-card" key={item.Id}><Boxes size={17}/><div><strong>{item.DepartmentName||item.DepartmentId}</strong><span>Bắt buộc đọc, xác nhận và đào tạo</span></div>{hasPermission('DOCUMENT_AUDIENCE_MANAGE')&&<Popconfirm title="Bỏ bộ phận nhận?" onConfirm={()=>removeAudienceMutation.mutate(item.DepartmentId)}><Button type="text" danger icon={<X size={15}/>} /></Popconfirm>}</div>)}{!(versionDetail.data?.audiences||[]).some(item=>item.IsActive)&&<Empty description="Chưa có bộ phận nhận"/>}{currentVersion&&!currentVersion.IsDeleted&&hasPermission('DOCUMENT_AUDIENCE_MANAGE')&&<Button block onClick={()=>setModal('audience')}>Cập nhật bộ phận nhận</Button>}</div>;
  const progressData=progress.data||{}; const summary=progressData.summary||{};
  const progressTab=<div className="drawer-section">
    <div className="progress-label"><span>Đã xem</span><strong>{summary.ViewedDepartments||0}/{summary.TotalDepartments||0}</strong></div>
    <Progress percent={summary.TotalDepartments?Math.round((summary.ViewedDepartments||0)*100/summary.TotalDepartments):0} showInfo={false}/>
    <div className="progress-label"><span>Đã đào tạo</span><strong>{summary.TrainedDepartments||0}/{summary.TotalDepartments||0}</strong></div>
    <Progress status="success" percent={summary.TotalDepartments?Math.round((summary.TrainedDepartments||0)*100/summary.TotalDepartments):0} showInfo={false}/>
    <List loading={progress.isLoading} dataSource={progressData.departments||[]} locale={{emptyText:<Empty description="Chưa có dữ liệu tiếp nhận"/>}} renderItem={item=><List.Item><List.Item.Meta
      title={<Space><strong>{item.DepartmentNameSnapshot}</strong><StatusBadge status={item.DeliveryStatus}/></Space>}
      description={<>{item.FirstViewedAt&&<div>Xem: {item.FirstViewedByName||item.FirstViewedBy} · {dayjs(item.FirstViewedAt).format('DD/MM/YYYY HH:mm')}</div>}{item.TrainingConfirmedAt&&<div>Đào tạo: {item.TrainingConfirmedByName||item.TrainingConfirmedBy} · {dayjs(item.TrainingConfirmedAt).format('DD/MM/YYYY HH:mm')}</div>}{item.evidence?.map(file=><div className="drawer-file-row" key={file.EvidenceId}><div><strong>{file.OriginalName}</strong><span>{Math.ceil((file.FileSize||0)/1024)} KB</span></div><Space><FileViewerButton file={file} label="Xem"/><FileDownloadButton file={file} label="Tải"/>{isAdmin&&<Popconfirm title="Xóa minh chứng?" onConfirm={()=>deleteEvidenceMutation.mutate(file.EvidenceId)}><Button danger size="small">Xóa</Button></Popconfirm>}</Space></div>)}</>}
    /></List.Item>}/>
  </div>;
  return <div className={`process-workspace product-workspace ${selectedId?'has-drawer':''}`}><main className="process-main"><div className="process-titlebar"><div><h1>Tài liệu sản phẩm</h1><p>Quản lý hồ sơ dùng chung, phiên bản và tiếp nhận</p></div></div><section className="process-table-card"><div className="process-filters product-filters"><div className="filter-field filter-search"><label>Tìm kiếm</label><Input prefix={<Search size={17}/>} allowClear value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Tên tài liệu..."/></div><div className="filter-field"><label>Loại tài liệu</label><Select allowClear value={typeId} onChange={setTypeId} options={(types.data||[]).map(x=>({value:x.Id,label:x.Name}))}/></div>{isAdmin&&<DeletedModeFilter value={deletedMode} onChange={setDeletedMode}/>}</div><Table className="process-table" rowKey="Id" loading={list.isLoading} dataSource={list.data||[]} columns={columns} pagination={{pageSize:10}} rowClassName={row=>row.Id===selectedId?'selected-process-row':''} onRow={row=>({onClick:()=>{setSelectedId(row.Id);setSelectedVersionId(null);},style:{cursor:'pointer'}})} locale={{emptyText:<Empty description="Chưa có tài liệu sản phẩm"/>}}/></section></main>{selectedId&&<aside className="process-drawer"><div className="drawer-header"><div className="drawer-header-copy"><span>Chi tiết tài liệu</span><strong>{document?.DocumentName||'Đang tải...'}</strong></div><Button type="text" icon={<X size={20}/>} onClick={()=>setSelectedId(null)}/></div>{detail.isLoading?<div className="drawer-loading"><Skeleton active/></div>:document?<Tabs className="drawer-tabs" items={[{key:'overview',label:'Tổng quan',children:overview},{key:'versions',label:<span><History size={15}/> Phiên bản</span>,children:versionTab},{key:'products',label:<span><Boxes size={15}/> ItemCode</span>,children:productTab},{key:'distribution',label:'Phân phối',children:distributionTab},{key:'progress',label:'Tiếp nhận',children:progressTab}]}/>:<Empty description="Không tìm thấy tài liệu"/>}</aside>}
    <Modal title={modal==='edit'?'Sửa tài liệu sản phẩm':'Tạo tài liệu sản phẩm'} open={['create','edit'].includes(modal)} onCancel={()=>setModal(null)} onOk={()=>masterForm.submit()} confirmLoading={createDoc.isPending||editDoc.isPending}><Form form={masterForm} layout="vertical" onFinish={modal==='edit'?editDoc.mutate:createDoc.mutate}>{masterFields}</Form></Modal>
    <Modal title={modal==='editVersion'?'Sửa phiên bản':'Tạo phiên bản'} open={['createVersion','editVersion'].includes(modal)} onCancel={()=>setModal(null)} onOk={()=>versionForm.submit()} confirmLoading={createVersion.isPending||editVersion.isPending}><Form form={versionForm} layout="vertical" onFinish={modal==='editVersion'?editVersion.mutate:createVersion.mutate}>{versionFields}</Form></Modal>
    <Modal title="Liên kết ItemCode" open={modal==='map'} onCancel={()=>setModal(null)} onOk={()=>mapForm.submit()} confirmLoading={mapMutation.isPending}><Form form={mapForm} layout="vertical" onFinish={mapMutation.mutate}><Form.Item name="itemCode" label="ItemCode" rules={[{required:true,whitespace:true}]}><Input maxLength={100}/></Form.Item><Form.Item name="applicableFrom" label="Áp dụng từ"><DatePicker format="DD/MM/YYYY" style={{width:'100%'}}/></Form.Item></Form></Modal>
    <Modal title="Cập nhật bộ phận nhận" open={modal==='audience'} onCancel={()=>setModal(null)} onOk={()=>audienceForm.submit()} confirmLoading={audienceMutation.isPending}><Form form={audienceForm} layout="vertical" onFinish={audienceMutation.mutate}><Form.Item name="departmentIds" label="Bộ phận nhận" rules={[{required:true}]}><DepartmentSelect mode="multiple"/></Form.Item></Form></Modal>
  </div>;
}

export default function ProductManagementPage() {
  const {hasPermission}=useAuth();
  const canManage=['DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','DOCUMENT_VERSION_CREATE','DOCUMENT_FILE_UPLOAD','DOCUMENT_AUDIENCE_MANAGE','PRODUCT_SYNC','PRODUCT_REQUIREMENT_MANAGE','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'].some(permission=>hasPermission(permission));
  if(!canManage) return <MyProductDocumentsPage/>;
  return <div className="product-domain-page"><ProductMasterWorkspace/></div>;
}
