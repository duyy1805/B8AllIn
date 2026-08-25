import { useState } from 'react';
import { Button, Card, DatePicker, Descriptions, Form, Input, Modal, Space, Table, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { createProcessVersion, getProcessDetail } from '../../api/process.api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';

export default function ProcessDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const query = useQuery({
    queryKey: ['process', id],
    queryFn: () => getProcessDetail(id)
  });

  const createVersionMutation = useMutation({
    mutationFn: (values) => createProcessVersion(id, {
      ...values,
      issueDate: values.issueDate?.format('YYYY-MM-DD') || null,
      effectiveDate: values.effectiveDate?.format('YYYY-MM-DD') || null
    }),
    onSuccess: (data) => {
      message.success('Đã tạo phiên bản');
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['process', id] });
      navigate(`/process-versions/${data.Id}`);
    },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const data = query.data || {};
  const process = data.process;
  const versions = data.versions || [];

  const columns = [
    { title: 'Version', dataIndex: 'VersionNo', width: 100, render: v => `V${v}` },
    { title: 'Tiêu đề', dataIndex: 'Title' },
    { title: 'Ngày hiệu lực', dataIndex: 'EffectiveDate', width: 140 },
    { title: 'Trạng thái', dataIndex: 'Status', width: 120, render: v => <StatusBadge status={v} /> }
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title={process ? `${process.ProcessCode} - ${process.ProcessName}` : 'Chi tiết quy trình'}
        subtitle="Thông tin quy trình và lịch sử phiên bản"
        extra={
          hasRole('DOCUMENT_CONTROLLER','EDITOR') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Tạo version
            </Button>
          )
        }
      />

      <Card loading={query.isLoading}>
        {process && (
          <Descriptions column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Mã">{process.ProcessCode}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><StatusBadge status={process.Status} /></Descriptions.Item>
            <Descriptions.Item label="Tên">{process.ProcessName}</Descriptions.Item>
            <Descriptions.Item label="Bộ phận">{process.OwnerDepartmentName || process.OwnerDepartmentId}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card title="Các phiên bản">
        <Table
          rowKey="Id"
          dataSource={versions}
          columns={columns}
          pagination={false}
          onRow={r => ({
            onClick: () => navigate(`/process-versions/${r.Id}`),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Modal
        title="Tạo phiên bản mới"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createVersionMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={createVersionMutation.mutate}>
          <Form.Item name="title" label="Tiêu đề">
            <Input />
          </Form.Item>
          <Form.Item name="issueDate" label="Ngày ban hành">
            <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
          </Form.Item>
          <Form.Item name="effectiveDate" label="Ngày hiệu lực">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="changeSummary" label="Nội dung thay đổi">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
