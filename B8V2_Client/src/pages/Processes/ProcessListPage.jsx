import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Space, Table, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createProcess, getProcesses } from '../../api/process.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';

export default function ProcessListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const query = useQuery({
    queryKey: ['processes', keyword],
    queryFn: () => getProcesses({ keyword, page: 1, pageSize: 100 })
  });

  const createMutation = useMutation({
    mutationFn: createProcess,
    onSuccess: (data) => {
      message.success('Đã tạo quy trình');
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['processes'] });
      navigate(`/processes/${data.Id}`);
    },
    onError: (e) => message.error(e.response?.data?.message || e.message)
  });

  const columns = [
    { title: 'Mã', dataIndex: 'ProcessCode', width: 150 },
    { title: 'Tên quy trình', dataIndex: 'ProcessName' },
    { title: 'Bộ phận', dataIndex: 'OwnerDepartmentName', width: 220 },
    {
      title: 'Trạng thái',
      dataIndex: 'Status',
      width: 120,
      render: (v) => <StatusBadge status={v} />
    },
    {
      title: 'Version hiệu lực',
      dataIndex: 'EffectiveVersionNo',
      width: 130,
      render: v => v ? `V${v}` : '-'
    }
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Quy trình"
        subtitle="Quản lý quy trình và phiên bản"
        extra={
          hasRole('DOCUMENT_CONTROLLER', 'EDITOR') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Tạo quy trình
            </Button>
          )
        }
      />

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="Mã hoặc tên quy trình"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 320 }}
          />
        </Space>

        <Table
          rowKey="Id"
          loading={query.isLoading}
          dataSource={query.data || []}
          columns={columns}
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/processes/${record.Id}`),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Modal
        title="Tạo quy trình"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="processCode" label="Mã quy trình" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="processName" label="Tên quy trình" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ownerDepartmentId" label="Bộ phận ban hành" rules={[{ required: true }]}>
            <DepartmentSelect />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
