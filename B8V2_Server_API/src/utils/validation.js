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

module.exports = { positiveId, deletedMode };
