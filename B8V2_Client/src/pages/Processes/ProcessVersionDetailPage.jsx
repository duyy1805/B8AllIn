import { useState } from 'react';
import { Button, Card, Descriptions, Form, Modal, Table, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import {
  assignProcessAudience,
  getProcessVersionDetail,
  removeProcessAudience
} from '../../api/process.api';
import DepartmentSelect from '../../components/DepartmentSelect';
import FileUploader from '../../components/FileUploader';
import FileViewerButton from '../../components/FileViewerButton';
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

  const data = query.data || {};
  const v = data.version;
  const audiences = data.audiences || [];
  const activeAudiences = audiences.filter(item => item.IsActive);
  const files = data.files || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['process-version', id] });

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
        ...upsertedIds.map(departmentId => assignProcessAudience(id, {
          departmentId,
          requiredRead: true,
          requiredAcknowledge: true,
          requiredTraining: true
        })),
        ...removedIds.map(departmentId => removeProcessAudience(id, departmentId))
      ]);
    },
    onSuccess: () => {
      message.success('Đã cập nhật danh sách bộ phận nhận');
      setAudienceOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const openAudienceModal = () => {
    form.setFieldsValue({ departmentIds: activeAudiences.map(item => item.DepartmentId) });
    setAudienceOpen(true);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={v ? `${v.ProcessCode} - Phiên bản ${v.VersionCode || v.VersionNo}` : 'Chi tiết phiên bản'}
        subtitle={v?.Title}
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
          hasRole('DOCUMENT_CONTROLLER','EDITOR') && v?.Status === 'DRAFT'
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
            { title: 'Dung lượng', dataIndex: 'FileSize', width: 120 },
            { title: 'Thao tác', width: 130, render: (_, file) => <FileViewerButton file={file} /> }
          ]}
        />
      </Card>

      <Card
        title="Bộ phận nhận"
        extra={
          hasRole('DOCUMENT_CONTROLLER') && (
            <Button onClick={openAudienceModal}>Cập nhật bộ phận nhận</Button>
          )
        }
      >
        <Table
          rowKey="Id"
          dataSource={activeAudiences}
          pagination={false}
          columns={[
            { title: 'Bộ phận', dataIndex: 'DepartmentName' },
            { title: 'Yêu cầu', render: () => 'Bắt buộc đọc, xác nhận và đào tạo' }
          ]}
        />
      </Card>

      <Modal
        title="Cập nhật bộ phận nhận"
        open={audienceOpen}
        onCancel={() => setAudienceOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={audienceMutation.isPending}
        okText="Lưu thay đổi"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={audienceMutation.mutate}
        >
          <Form.Item name="departmentIds" label="Bộ phận nhận">
            <DepartmentSelect mode="multiple" placeholder="Chọn các bộ phận nhận tài liệu" />
          </Form.Item>
          <div className="audience-requirement-note"><ShieldCheck size={17} /><span>Tất cả bộ phận được chọn đều bắt buộc đọc, xác nhận và hoàn thành đào tạo.</span></div>
        </Form>
      </Modal>
    </div>
  );
}
