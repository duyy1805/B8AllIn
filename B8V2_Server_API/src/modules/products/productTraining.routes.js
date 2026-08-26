const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authRequired } = require('../../middleware/auth');
const training = require('./productTraining.service');

router.use(authRequired);
router.delete('/:evidenceId', asyncHandler(async (req, res) => {
  if (!(req.user.roles || []).includes('ADMIN')) return res.status(403).json({ success: false, message: 'Chỉ ADMIN được xóa minh chứng đào tạo.' });
  const evidenceId = Number(req.params.evidenceId);
  if (!Number.isSafeInteger(evidenceId) || evidenceId < 1) return res.status(400).json({ success: false, message: 'EvidenceId không hợp lệ.' });
  res.json({ success: true, data: await training.deleteEvidence(evidenceId, req.user.userId) });
}));

module.exports = router;
