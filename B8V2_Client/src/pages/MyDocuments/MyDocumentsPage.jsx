import { Button, Card, Space, Table, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeProcess,
  getMyProcessDocuments,
  markProcessViewed
} from '../../api/process.api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

export default function MyDocumentsPage() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['my-process-documents'],
    queryFn: () => getMyProcessDocuments({ page: 1, pageSize: 100 })
  });

  const mutation = useMutation({
    mutationFn: async ({ type, id }) => {
      if (type === 'view') return markProcessViewed(id);
      return acknowledgeProcess(id);
    },
    onSuccess: () => {
      message.success('Đã cập nhật');
      qc.invalidateQueries({ queryKey: ['my-process-documents'] });
    },
    onError: e => message.error(e.response?.data?.message || e.message)
  });

  const columns = [
    { title: 'Mã', dataIndex: 'ProcessCode', width: 140 },
    { title: 'Quy trình', dataIndex: 'ProcessName' },
    { title: 'Version', dataIndex: 'VersionNo', width: 90, render: v => `V${v}` },
    { title: 'Ngày hiệu lực', dataIndex: 'EffectiveDate', width: 130 },
    {
      title: 'Trạng thái',
      width: 130,
      render: (_, r) => <StatusBadge status={r.ComplianceStatus || (r.FirstViewedAt ? 'COMPLIANT' : 'PENDING')} />
    },
    {
      title: 'Thao tác',
      width: 220,
      render: (_, r) => (
        <Space>
          <Button
            onClick={() => mutation.mutate({ type: 'view', id: r.ProcessVersionId })}
          >
            Đánh dấu đã xem
          </Button>
          {!r.AcknowledgedAt && (
            <Button
              type="primary"
              onClick={() => mutation.mutate({ type: 'ack', id: r.ProcessVersionId })}
            >
              Xác nhận
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="page-stack">
      <PageHeader title="Tài liệu của tôi" subtitle="Các quy trình được phân phối cho tài khoản hiện tại" />
      <Card>
        <Table
          rowKey="ReceiptId"
          loading={query.isLoading}
          dataSource={query.data || []}
          columns={columns}
          pagination={false}
        />
      </Card>
    </div>
  );
}
