function positiveId(value, label = 'ID') {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    const error = new Error(`${label} không hợp lệ.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function deletedMode(value, user) {
  const requested = String(value || 'ACTIVE').toUpperCase();
  if (!['ACTIVE', 'DELETED', 'ALL'].includes(requested)) return 'ACTIVE';
  if (requested !== 'ACTIVE' && !(user?.roles || []).includes('ADMIN')) {
    const error = new Error('Chỉ ADMIN được xem dữ liệu đã xóa.');
    error.status = 403;
    throw error;
  }
  return requested;
}

function assertVersionDates({ issueDate=null, effectiveDate=null, expiryDate=null }) {
  const parse=value=>value ? new Date(`${value}T00:00:00`) : null;
  const issue=parse(issueDate),effective=parse(effectiveDate),expiry=parse(expiryDate);
  if ((issueDate && Number.isNaN(issue?.getTime())) || (effectiveDate && Number.isNaN(effective?.getTime())) || (expiryDate && Number.isNaN(expiry?.getTime()))) {
    const error=new Error('Ngày không hợp lệ.'); error.status=400; throw error;
  }
  if (issue && effective && issue>effective) { const error=new Error('Ngày ban hành không được sau ngày hiệu lực.'); error.status=400; throw error; }
  if (effective && expiry && effective>expiry) { const error=new Error('Ngày hết hạn không được trước ngày hiệu lực.'); error.status=400; throw error; }
}

function versionCode(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error('Vui lòng nhập mã phiên bản.'); error.status = 400; throw error;
  }
  if (normalized.length > 50) {
    const error = new Error('Mã phiên bản không được vượt quá 50 ký tự.'); error.status = 400; throw error;
  }
  return normalized;
}

module.exports = { positiveId, deletedMode, assertVersionDates, versionCode };
