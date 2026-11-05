const router = require('express').Router();
const { execProc } = require('../../utils/proc');
const asyncHandler = require('../../utils/asyncHandler');
const { authRequired, requirePermissions, requireAnyPermission } = require('../../middleware/auth');
const { positiveId } = require('../../utils/validation');

router.use(authRequired);

const groupReadPermissions = ['PRODUCT_GROUP_MANAGE','DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','DOCUMENT_VERSION_CREATE','DOCUMENT_FILE_UPLOAD','DOCUMENT_AUDIENCE_MANAGE','PRODUCT_SYNC','PRODUCT_REQUIREMENT_MANAGE','PRODUCT_CUSTOMER_ASSIGN','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'];

router.get('/', requireAnyPermission(...groupReadPermissions), asyncHandler(async (req, res) => {
  const result = await execProc('B8V2.sp_ProductGroup_GetList', {
    Keyword: { type: 'nvarchar', value: req.query.keyword || null },
    IncludeInactive: { type: 'bit', value: req.query.includeInactive === 'true' }
  });
  res.json({ success: true, data: result.recordset || [] });
}));

router.get('/:id', requireAnyPermission(...groupReadPermissions), asyncHandler(async (req, res) => {
  const result = await execProc('B8V2.sp_ProductGroup_GetDetail', {
    ProductGroupId: { type: 'int', value: positiveId(req.params.id, 'ProductGroupId') }
  });
  res.json({ success: true, data: { group: result.recordsets[0]?.[0] || null, members: result.recordsets[1] || [], documents: result.recordsets[2] || [] } });
}));

router.post('/', requirePermissions('PRODUCT_GROUP_MANAGE'), asyncHandler(async (req, res) => {
  const result = await execProc('B8V2.sp_ProductGroup_Save', {
    ProductGroupId: { type: 'int', value: null },
    Name: { type: 'nvarchar', value: req.body.name },
    Description: { type: 'nvarchar', value: req.body.description || null },
    UserId: { type: 'int', value: req.user.userId }
  });
  res.status(201).json({ success: true, data: result.recordset?.[0] });
}));

router.put('/:id', requirePermissions('PRODUCT_GROUP_MANAGE'), asyncHandler(async (req, res) => {
  const result = await execProc('B8V2.sp_ProductGroup_Save', {
    ProductGroupId: { type: 'int', value: positiveId(req.params.id, 'ProductGroupId') },
    Name: { type: 'nvarchar', value: req.body.name },
    Description: { type: 'nvarchar', value: req.body.description || null },
    UserId: { type: 'int', value: req.user.userId }
  });
  res.json({ success: true, data: result.recordset?.[0] });
}));

router.patch('/:id/status', requirePermissions('PRODUCT_GROUP_MANAGE'), asyncHandler(async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive phải là boolean.' });
  const result = await execProc('B8V2.sp_ProductGroup_SetActive', {
    ProductGroupId: { type: 'int', value: positiveId(req.params.id, 'ProductGroupId') },
    IsActive: { type: 'bit', value: req.body.isActive },
    UserId: { type: 'int', value: req.user.userId }
  });
  res.json({ success: true, data: result.recordset?.[0] });
}));

router.put('/:id/members', requirePermissions('PRODUCT_GROUP_MANAGE'), asyncHandler(async (req, res) => {
  const productIds = Array.isArray(req.body.productIds) ? [...new Set(req.body.productIds.map(Number))] : null;
  if (!productIds || productIds.length > 500 || productIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
    return res.status(400).json({ success: false, message: 'productIds phải là danh sách tối đa 500 ItemCode hợp lệ.' });
  }
  const result = await execProc('B8V2.sp_ProductGroup_SetMembers', {
    ProductGroupId: { type: 'int', value: positiveId(req.params.id, 'ProductGroupId') },
    ProductIds: { type: 'nvarchar', value: JSON.stringify(productIds) },
    UserId: { type: 'int', value: req.user.userId }
  });
  res.json({ success: true, data: result.recordset?.[0] });
}));

router.use((error, req, res, next) => {
  const number = Number(error?.number || error?.originalError?.info?.number);
  if (number === 58002) error.status = 409;
  else if (number >= 58001 && number <= 58008) error.status = 400;
  next(error);
});

module.exports = router;
