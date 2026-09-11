import { message } from 'antd';

export function showMailNotification(summary) {
  if (!summary) return;
  const summaries = (Array.isArray(summary) ? summary : [summary])
    .map(item => item?.mailSummary || item)
    .filter(Boolean);
  const sent = summaries.reduce((total, item) => total + Number(item.sent || 0), 0);
  const failed = summaries.reduce((total, item) => total + Number(item.failed || 0), 0);
  const skipped = summaries.reduce((total, item) => total + Number(item.skipped || 0), 0);
  if (sent > 0 && failed === 0) message.success(`Đã gửi thông báo email đến ${sent} người nhận.`);
  else if (sent > 0 || failed > 0) message.warning(`Email: ${sent} gửi thành công, ${failed} gửi thất bại. ADMIN có thể xem và gửi lại trong Thông báo email.`);
  else if (skipped > 0) message.warning('Tài liệu đã có hiệu lực nhưng chưa gửi mail: bộ phận chưa có người nhận mail hợp lệ.');
}
