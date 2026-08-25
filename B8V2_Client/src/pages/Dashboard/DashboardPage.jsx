import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../api/dashboard.api';
import PageHeader from '../../components/PageHeader';

export default function DashboardPage() {
  const { data = {}, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard
  });

  const stats = Object.entries(data);

  return (
    <div className="page-stack">
      <PageHeader title="Dashboard" subtitle="Tổng quan hệ thống quản lý tài liệu" />
      <Row gutter={[16, 16]}>
        {stats.map(([key, value]) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={key}>
            <Card loading={isLoading}>
              <Statistic title={key} value={value ?? 0} />
            </Card>
          </Col>
        ))}
      </Row>
      {!stats.length && !isLoading && (
        <Typography.Text type="secondary">Chưa có dữ liệu dashboard.</Typography.Text>
      )}
    </div>
  );
}
