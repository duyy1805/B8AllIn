import { useState } from 'react';
import { Button, Card, Descriptions, Form, Modal, Space, Table, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  assignProcessAudience,
  getProcessVersionDetail,
  publishProcessVersion,
  reviewProcessVersion,
  submitProcessVersion
} from '../../api/process.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import FileUploader from '../../components/FileUploader';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../auth/AuthProvider';

export default function ProcessVersionDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [form] = Form.useForm();

  const query = useQuery({
    queryKey: ['process-version', id],
    queryFn: () => getProcessVersionDetail(id)
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['process-version', id] });

  const actionMutation = useMutation({
    mutationFn: ({ type }) => {
      if (type === 'submit') return submitProcessVersion(id);
      if (type === 'review') return reviewProcessVersion(id);
      return publishProcessVersion(id);
    },
    onSuccess: () => {
      message.success('Thao tác thành công');
      invalidate();
    },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const audienceMutation = useMutation({
    mutationFn: values => assignProcessAudience(id, values),
    onSuccess: () => {
      message.success('Đã gán bộ phận');
      setAudienceOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const data = query.data || {};
  const v = data.version;
  const audiences = data.audiences || [];
  const files = data.files || [];

  const actionButtons = [];
  if (v?.Status === 'DRAFT' && hasRole('DOCUMENT_CONTROLLER','EDITOR')) {
    actionButtons.push(<Button key="submit" onClick={() => actionMutation.mutate({ type: 'submit' })}>Submit</Button>);
  }
  if (v?.Status === 'REVIEWING' && hasRole('REVIEWER','DOCUMENT_CONTROLLER')) {
    actionButtons.push(<Button key="review" onClick={() => actionMutation.mutate({ type: 'review' })}>Review / Approve</Button>);
  }
  if (v?.Status === 'APPROVED' && hasRole('APPROVER','DOCUMENT_CONTROLLER')) {
    actionButtons.push(<Button key="publish" type="primary" onClick={() => actionMutation.mutate({ type: 'publish' })}>Publish</Button>);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={v ? `${v.ProcessCode} - Version ${v.VersionNo}` : 'Chi tiết version'}
        subtitle={v?.Title}
        extra={<Space>{actionButtons}</Space>}
      />

      <Card loading={query.isLoading}>
        {v && (
          <Descriptions column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Quy trình">{v.ProcessName}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><StatusBadge status={v.Status} /></Descriptions.Item>
            <Descriptions.Item label="Ngày ban hành">{v.IssueDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="Ngày hiệu lực">{v.EffectiveDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="Thay đổi" span={2}>{v.ChangeSummary || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        title="File"
        extra={
          hasRole('DOCUMENT_CONTROLLER','EDITOR') && v?.Status !== 'EFFECTIVE'
            ? <FileUploader processVersionId={Number(id)} onUploaded={invalidate} />
            : null
        }
      >
        <Table
          rowKey="FileId"
          dataSource={files}
          pagination={false}
          columns={[
            { title: 'Tên file', dataIndex: 'OriginalName' },
            { title: 'Vai trò', dataIndex: 'FileRole', width: 120 },
            { title: 'Dung lượng', dataIndex: 'FileSize', width: 120 }
          ]}
        />
      </Card>

      <Card
        title="Bộ phận nhận"
        extra={
          hasRole('DOCUMENT_CONTROLLER') && (
            <Button onClick={() => setAudienceOpen(true)}>Gán bộ phận</Button>
          )
        }
      >
        <Table
          rowKey="Id"
          dataSource={audiences}
          pagination={false}
          columns={[
            { title: 'Bộ phận', dataIndex: 'DepartmentName' },
            { title: 'Bắt buộc đọc', dataIndex: 'RequiredRead', render: v => v ? 'Có' : 'Không' },
            { title: 'Xác nhận', dataIndex: 'RequiredAcknowledge', render: v => v ? 'Có' : 'Không' },
            { title: 'Đào tạo', dataIndex: 'RequiredTraining', render: v => v ? 'Có' : 'Không' },
            { title: 'Active', dataIndex: 'IsActive', render: v => v ? 'Có' : 'Không' }
          ]}
        />
      </Card>

      <Modal
        title="Gán bộ phận nhận"
        open={audienceOpen}
        onCancel={() => setAudienceOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={audienceMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ requiredRead: true, requiredAcknowledge: false, requiredTraining: false }}
          onFinish={audienceMutation.mutate}
        >
          <Form.Item name="departmentId" label="Bộ phận" rules={[{ required: true }]}>
            <DepartmentSelect />
          </Form.Item>
          <Form.Item name="requiredRead" valuePropName="checked">
            <input type="checkbox" /> Bắt buộc đọc
          </Form.Item>
          <Form.Item name="requiredAcknowledge" valuePropName="checked">
            <input type="checkbox" /> Bắt buộc xác nhận
          </Form.Item>
          <Form.Item name="requiredTraining" valuePropName="checked">
            <input type="checkbox" /> Bắt buộc đào tạo
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
