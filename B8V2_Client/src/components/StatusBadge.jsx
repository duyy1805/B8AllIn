import { Tag } from 'antd';

const map = {
  ACTIVE: 'green',
  INACTIVE: 'default',
  ARCHIVED: 'default',
  DRAFT: 'default',
  REVIEWING: 'blue',
  APPROVED: 'cyan',
  EFFECTIVE: 'green',
  EXPIRED: 'orange',
  CANCELLED: 'red',
  PENDING: 'gold',
  COMPLIANT: 'green',
  NON_COMPLIANT: 'red'
};

export default function StatusBadge({ status }) {
  return <Tag color={map[status] || 'default'}>{status || '-'}</Tag>;
}
