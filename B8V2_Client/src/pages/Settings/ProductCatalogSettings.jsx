import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Select, Switch, Table, Tag, message } from 'antd';
import { Factory, Pencil, Plus, Save } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DepartmentSelect from '../../components/DepartmentSelect';
import {
  createProductionProcess, getDocumentTypes, getProductCustomers, getProductCustomerTemplates,
  getProductionProcesses, setProductionProcessActive, updateProductCustomerTemplate, updateProductionProcess
} from '../../api/master.api';

export function CustomerTemplateSettings() {
  const qc = useQueryClient();
  const [customerCode, setCustomerCode] = useState('DEK');
  const [selectedTypeIds, setSelectedTypeIds] = useState([]);
  const customers = useQuery({ queryKey: ['product-customers'], queryFn: getProductCustomers });
  const types = useQuery({ queryKey: ['document-types'], queryFn: getDocumentTypes });
  const template = useQuery({ queryKey: ['product-customer-template', customerCode], queryFn: () => getProductCustomerTemplates(customerCode) });

  useEffect(() => {
    if (template.data) setSelectedTypeIds(template.data.filter(item => item.IsActive).map(item => item.DocumentTypeId));
  }, [template.data]);

  const save = useMutation({
    mutationFn: () => updateProductCustomerTemplate(customerCode, selectedTypeIds),
    onSuccess: () => {
      message.success('Đã cập nhật mẫu tài liệu khách hàng');
      qc.invalidateQueries({ queryKey: ['product-customer-template', customerCode] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
    onError: error => message.error(error.response?.data?.message || error.message)
  });

  return <section className="settings-table-card">
    <div className="settings-card-heading">
      <div><strong>Mẫu tài liệu theo khách hàng</strong><span>Danh sách này được tính động vào chỉ số Đủ/Thiếu của mọi ItemCode đã gán khách hàng.</span></div>
      <Button type="primary" icon={<Save size={15} />} loading={save.isPending} onClick={() => save.mutate()}>Lưu mẫu</Button>
    </div>
    <div className="catalog-settings-form">
      <label>Khách hàng</label>
      <Select value={customerCode} onChange={setCustomerCode} loading={customers.isLoading} options={(customers.data || []).map(item => ({ value: item.Code, label: item.Name }))} />
      <label>Loại tài liệu mặc định</label>
      <Select mode="multiple" showSearch optionFilterProp="label" value={selectedTypeIds} onChange={setSelectedTypeIds} loading={types.isLoading || template.isLoading} options={(types.data || []).map(item => ({ value: item.Id, label: `${item.Code} · ${item.Name}` }))} placeholder="Chọn các loại tài liệu bắt buộc" />
    </div>
    <div className="catalog-template-preview">
      {(template.data || []).filter(item => item.IsActive).map(item => <Tag key={item.DocumentTypeId}>{item.SortOrder}. {item.DocumentTypeName}</Tag>)}
      {!template.isLoading && !template.data?.length && <Empty description="Mẫu chưa có loại tài liệu" />}
    </div>
  </section>;
}

export function ProductionProcessSettings() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const types = useQuery({ queryKey: ['document-types'], queryFn: getDocumentTypes });
  const list = useQuery({ queryKey: ['production-processes', true], queryFn: () => getProductionProcesses(true) });
  const departmentMap = useMemo(() => {
    const map = new Map();
    (list.data?.departments || []).forEach(item => {
      const values = map.get(Number(item.ProductionProcessId)) || [];
      values.push(Number(item.DepartmentId)); map.set(Number(item.ProductionProcessId), values);
    });
    return map;
  }, [list.data]);
  const typeMap = useMemo(() => {
    const map = new Map();
    (list.data?.documentTypes || []).forEach(item => {
      const values = map.get(Number(item.ProductionProcessId)) || [];
      values.push(Number(item.DocumentTypeId)); map.set(Number(item.ProductionProcessId), values);
    });
    return map;
  }, [list.data]);

  const openModal = item => {
    setEditing(item || null);
    form.resetFields();
    form.setFieldsValue(item ? { code: item.Code, name: item.Name, description: item.Description, departmentIds: departmentMap.get(Number(item.Id)) || [], documentTypeIds: typeMap.get(Number(item.Id)) || [] } : { departmentIds: [], documentTypeIds: [] });
    setModalOpen(true);
  };
  const save = useMutation({
    mutationFn: values => editing ? updateProductionProcess(editing.Id, values) : createProductionProcess(values),
    onSuccess: () => { message.success('Đã lưu quy trình sản xuất'); setModalOpen(false); qc.invalidateQueries({ queryKey: ['production-processes'] }); },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => setProductionProcessActive(id, isActive),
    onSuccess: () => { message.success('Đã cập nhật trạng thái quy trình'); qc.invalidateQueries({ queryKey: ['production-processes'] }); },
    onError: error => message.error(error.response?.data?.message || error.message)
  });
  const columns = [
    { title: 'Mã', dataIndex: 'Code', width: 150, render: value => <Tag>{value}</Tag> },
    { title: 'Quy trình sản xuất', render: (_, item) => <div className="settings-user-cell"><span className="settings-role-shield"><Factory size={17} /></span><div><strong>{item.Name}</strong><span>{item.Description || 'Không có mô tả'}</span></div></div> },
    { title: 'Bộ phận', dataIndex: 'DepartmentCount', width: 110, align: 'center' },
    { title: 'Loại tài liệu', dataIndex: 'DocumentTypeCount', width: 120, align: 'center' },
    { title: 'Hoạt động', dataIndex: 'IsActive', width: 110, render: (value, item) => <Switch checked={Boolean(value)} loading={toggle.isPending && toggle.variables?.id === item.Id} onChange={isActive => toggle.mutate({ id: item.Id, isActive })} /> },
    { title: '', width: 100, render: (_, item) => <Button size="small" icon={<Pencil size={14} />} onClick={() => openModal(item)}>Sửa</Button> }
  ];

  return <>
    <section className="settings-table-card">
      <div className="settings-card-heading"><div><strong>Danh mục quy trình sản xuất</strong><span>Bộ phận của các quy trình liên kết sẽ được đề xuất khi tạo phiên bản tài liệu.</span></div><Button type="primary" icon={<Plus size={15} />} onClick={() => openModal(null)}>Thêm quy trình</Button></div>
      <Table rowKey="Id" loading={list.isLoading} dataSource={list.data?.processes || []} columns={columns} pagination={{ pageSize: 12, showSizeChanger: false }} locale={{ emptyText: <Empty description="Chưa có quy trình sản xuất" /> }} />
    </section>
    <Modal width={720} title={editing ? 'Sửa quy trình sản xuất' : 'Thêm quy trình sản xuất'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={save.isPending}>
      <Form form={form} layout="vertical" onFinish={save.mutate} requiredMark={false}>
        <div className="form-grid-2"><Form.Item name="code" label="Mã quy trình" normalize={value => value?.toUpperCase()} rules={[{ required: true, whitespace: true }]}><Input maxLength={50} placeholder="Ví dụ: CUTTING" /></Form.Item><Form.Item name="name" label="Tên quy trình" rules={[{ required: true, whitespace: true }]}><Input maxLength={255} placeholder="Ví dụ: Cắt" /></Form.Item></div>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
        <Form.Item name="departmentIds" label="Bộ phận thực hiện"><DepartmentSelect mode="multiple" placeholder="Chọn các bộ phận thực hiện" /></Form.Item>
        <Form.Item name="documentTypeIds" label="Loại tài liệu áp dụng"><Select mode="multiple" showSearch optionFilterProp="label" options={(types.data || []).map(item => ({ value: item.Id, label: `${item.Code} · ${item.Name}` }))} placeholder="Chọn các loại tài liệu" /></Form.Item>
      </Form>
    </Modal>
  </>;
}
