import { Flex, Typography } from 'antd';

export default function PageHeader({ title, subtitle, extra }) {
  return (
    <Flex justify="space-between" align="center" gap={16} wrap>
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>{title}</Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {extra}
    </Flex>
  );
}
