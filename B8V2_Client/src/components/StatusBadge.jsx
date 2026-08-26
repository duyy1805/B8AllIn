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
  VIEWED: 'blue',
  TRAINED: 'green',
  COMPLIANT: 'green',
  NON_COMPLIANT: 'red',
  DELETED: 'red'
};

const labels = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  ARCHIVED: 'Đã lưu trữ',
  DRAFT: 'Bản nháp',
  REVIEWING: 'Đang kiểm tra',
  APPROVED: 'Đã phê duyệt',
  EFFECTIVE: 'Đang hiệu lực',
  EXPIRED: 'Hết hiệu lực',
  CANCELLED: 'Đã hủy',
  PENDING: 'Đang chờ',
  VIEWED: 'Đã xem – chưa đào tạo',
  TRAINED: 'Đã đào tạo',
  COMPLIANT: 'Đã tuân thủ',
  NON_COMPLIANT: 'Chưa tuân thủ',
  NOT_APPLICABLE: 'Không áp dụng',
  OPEN: 'Mới',
  RECEIVED: 'Đã tiếp nhận',
  PROCESSING: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Đã từ chối',
  CLOSED: 'Đã đóng',
  DELETED: 'Đã xóa'
};

export default function StatusBadge({ status }) {
  return <Tag color={map[status] || 'default'}>{labels[status] || status || '-'}</Tag>;
}
