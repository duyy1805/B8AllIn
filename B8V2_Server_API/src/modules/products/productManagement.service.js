const { getPool, sql } = require('../../config/db');
const { execProc } = require('../../utils/proc');
const { versionCode } = require('../../utils/validation');

function idArray(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
    const error = new Error(`${name} phải có từ 1 đến 500 phần tử.`); error.status = 400; throw error;
  }
  const ids = [...new Set(value.map(Number))];
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) {
    const error = new Error(`${name} chứa ID không hợp lệ.`); error.status = 400; throw error;
  }
  return ids;
}

function optionalIdArray(value, name) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 500) {
    const error = new Error(`${name} phải là danh sách tối đa 500 phần tử.`); error.status = 400; throw error;
  }
  const ids = [...new Set(value.map(Number))];
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) {
    const error = new Error(`${name} chứa ID không hợp lệ.`); error.status = 400; throw error;
  }
  return ids;
}

async function syncProducts(userId) {
  try {
    const result = await execProc('B8V2.sp_Product_SyncManual', { UserId: { type: 'int', value: userId } });
    return result.recordset?.[0];
  } catch (error) {
    const number = Number(error?.number || error?.originalError?.info?.number);
    if (number === 54610) error.status = 409;
    else {
      try {
        const pool = await getPool();
        await pool.request().input('UserId', sql.Int, userId).input('Message', sql.NVarChar(2000), String(error.message || 'Lỗi đồng bộ').slice(0, 2000)).query(`
          INSERT [B8V2].[ProductSyncRun](StartedBy,StartedAt,CompletedAt,Status,ErrorCount,ErrorMessage)
          VALUES(@UserId,SYSDATETIME(),SYSDATETIME(),'FAILED',1,@Message)
        `);
      } catch {}
    }
    throw error;
  }
}

async function setRequiredDocumentTypes({ action, productIds, documentTypeIds, reason, userId }) {
  const normalizedAction = String(action || '').toUpperCase();
  if (!['ADD', 'REMOVE'].includes(normalizedAction)) {
    const error = new Error('action phải là ADD hoặc REMOVE.'); error.status = 400; throw error;
  }
  const products = idArray(productIds, 'productIds');
  const types = idArray(documentTypeIds, 'documentTypeIds');
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    for (const productId of products) {
      for (const documentTypeId of types) {
        await new sql.Request(transaction)
          .input('ProductId', sql.Int, productId)
          .input('DocumentTypeId', sql.Int, documentTypeId)
          .input('Action', sql.VarChar(10), normalizedAction)
          .input('Reason', sql.NVarChar(500), reason || null)
          .input('UserId', sql.Int, userId)
          .execute('B8V2.sp_ProductRequiredDocumentType_Set');
      }
    }
    await transaction.commit();
    return { action: normalizedAction, productCount: products.length, documentTypeCount: types.length };
  } catch (error) {
    try { await transaction.rollback(); } catch {}
    throw error;
  }
}

async function createDocumentWizard(payload, user) {
  const userId = user.userId;
  const manualVersionCode = versionCode(payload.versionCode);
  const productIds = idArray(payload.productIds, 'productIds');
  const departmentIds = optionalIdArray(payload.departmentIds, 'departmentIds');
  const documentTypeId = Number(payload.documentTypeId);
  if (!Number.isSafeInteger(documentTypeId) || documentTypeId < 1) {
    const error = new Error('DocumentTypeId không hợp lệ.'); error.status = 400; throw error;
  }
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const typeResult = await new sql.Request(transaction)
      .input('DocumentTypeId', sql.Int, documentTypeId)
      .query(`SELECT TOP(1) typeRow.Code,typeRow.Name
        FROM [B8V2].[DocumentType] typeRow WHERE typeRow.Id=@DocumentTypeId AND typeRow.IsActive=1`);
    const documentType = typeResult.recordset?.[0];
    if (!documentType) {
      const error = new Error('Loại tài liệu không tồn tại hoặc đã ngừng hoạt động.'); error.status = 400; throw error;
    }
    const allowsMultipleDocuments = documentType.Code === 'OTHER';
    const lookup = new sql.Request(transaction).input('DocumentTypeId', sql.Int, documentTypeId);
    productIds.forEach((id, index) => lookup.input(`ProductId${index}`, sql.Int, id));
    const existingResult = await lookup.query(`
      SELECT DISTINCT documentRow.Id DocumentId,documentRow.DocumentName
      FROM [B8V2].[ProductDocumentMap] mapRow WITH(UPDLOCK,HOLDLOCK)
      JOIN [B8V2].[ProductDocument] documentRow ON documentRow.Id=mapRow.DocumentId AND documentRow.DeletedAt IS NULL
      WHERE mapRow.IsActive=1 AND mapRow.DocumentTypeIdSnapshot=@DocumentTypeId
        AND mapRow.ProductId IN (${productIds.map((_, index) => `@ProductId${index}`).join(',')})
    `);
    const existingDocuments = allowsMultipleDocuments ? [] : (existingResult.recordset || []);
    if (existingDocuments.length > 1) {
      const error = new Error('Các ItemCode đã liên kết với những hồ sơ khác nhau của cùng loại tài liệu. Hãy chọn từng nhóm hồ sơ để cập nhật phiên bản.');
      error.status = 409;
      error.details = { currentDocuments: existingDocuments };
      throw error;
    }

    let ids;
    if (existingDocuments.length === 1) {
      const canCreateVersion = (user.roles || []).includes('ADMIN') || (user.permissions || []).includes('DOCUMENT_VERSION_CREATE');
      if (!canCreateVersion) {
        const error = new Error('Loại tài liệu này đã tồn tại; bạn cần quyền tạo phiên bản để cập nhật.'); error.status = 403; throw error;
      }
      const existing = existingDocuments[0];
      const reusableDraft = await new sql.Request(transaction)
        .input('DocumentId', sql.Int, existing.DocumentId)
        .input('VersionCode', sql.NVarChar(50), manualVersionCode)
        .query(`SELECT TOP(1) Id FROM [B8V2].[ProductDocumentVersion] WITH(UPDLOCK,HOLDLOCK)
                WHERE DocumentId=@DocumentId AND VersionCode=@VersionCode AND Status='DRAFT' AND DeletedAt IS NULL`);
      let documentVersionId = reusableDraft.recordset?.[0]?.Id;
      if (!documentVersionId) {
        const createdVersion = await new sql.Request(transaction)
          .input('DocumentId', sql.Int, existing.DocumentId)
          .input('VersionCode', sql.NVarChar(50), manualVersionCode)
          .input('IssueDate', sql.Date, payload.issueDate || null)
          .input('EffectiveDate', sql.Date, payload.effectiveDate || null)
          .input('ChangeSummary', sql.NVarChar(1000), payload.changeSummary || null)
          .input('CreatedBy', sql.Int, userId)
          .input('DepartmentIds', sql.NVarChar(sql.MAX), departmentIds === null ? null : JSON.stringify(departmentIds))
          .execute('B8V2.sp_ProductDocumentVersion_Create');
        documentVersionId = createdVersion.recordset?.[0]?.Id;
      }
      ids = {
        DocumentId: existing.DocumentId,
        DocumentVersionId: documentVersionId,
        DocumentName: existing.DocumentName,
        IsNewDocument: false,
        ReusedDraft: Boolean(reusableDraft.recordset?.[0]?.Id)
      };
    } else {
      const documentName = documentType.Name;
      const created = await new sql.Request(transaction)
        .input('DocumentName', sql.NVarChar(255), documentName)
        .input('DocumentTypeId', sql.Int, documentTypeId)
        .input('OwnerDepartmentId', sql.Int, payload.ownerDepartmentId || null)
        .input('VersionCode', sql.NVarChar(50), manualVersionCode)
        .input('IssueDate', sql.Date, payload.issueDate || null)
        .input('EffectiveDate', sql.Date, payload.effectiveDate || null)
        .input('ChangeSummary', sql.NVarChar(1000), payload.changeSummary || null)
        .input('CreatedBy', sql.Int, userId)
        .execute('B8V2.sp_ProductDocument_CreateWizard');
      ids = { ...created.recordset?.[0], DocumentName: documentName, IsNewDocument: true };
    }
    for (const productId of productIds) {
      await new sql.Request(transaction)
        .input('DocumentId', sql.Int, ids.DocumentId)
        .input('ProductId', sql.Int, productId)
        .input('ApplicableFrom', sql.Date, payload.effectiveDate || null)
        .input('CreatedBy', sql.Int, userId)
        .execute('B8V2.sp_ProductDocument_MapProduct');
    }
    let resolvedDepartmentIds = departmentIds;
    if (resolvedDepartmentIds === null && ids.IsNewDocument) {
      const defaults = await new sql.Request(transaction).input('DocumentTypeId', sql.Int, documentTypeId).query(`
        SELECT DISTINCT departmentLink.DepartmentId
        FROM [B8V2].[DocumentTypeProductionProcess] typeLink
        JOIN [B8V2].[ProductionProcess] processRow ON processRow.Id=typeLink.ProductionProcessId AND processRow.IsActive=1
        JOIN [B8V2].[ProductionProcessDepartment] departmentLink ON departmentLink.ProductionProcessId=processRow.Id AND departmentLink.IsActive=1
        WHERE typeLink.DocumentTypeId=@DocumentTypeId AND typeLink.IsActive=1`);
      resolvedDepartmentIds = defaults.recordset.map(item => Number(item.DepartmentId));
    }
    if (departmentIds !== null) {
      const currentAudience = await new sql.Request(transaction).input('DocumentVersionId', sql.Int, ids.DocumentVersionId).query(`
        SELECT DepartmentId FROM [B8V2].[ProductDocumentVersionAudience]
        WHERE DocumentVersionId=@DocumentVersionId AND IsActive=1`);
      for (const current of currentAudience.recordset) {
        if (!departmentIds.includes(Number(current.DepartmentId))) {
          await new sql.Request(transaction)
            .input('DocumentVersionId', sql.Int, ids.DocumentVersionId)
            .input('DepartmentId', sql.Int, current.DepartmentId)
            .input('UserId', sql.Int, userId)
            .execute('B8V2.sp_ProductDocumentVersion_RemoveDepartment');
        }
      }
    }
    for (const departmentId of (resolvedDepartmentIds || [])) {
      await new sql.Request(transaction)
        .input('DocumentVersionId', sql.Int, ids.DocumentVersionId)
        .input('DepartmentId', sql.Int, departmentId)
        .input('RequiredRead', sql.Bit, true)
        .input('RequiredAcknowledge', sql.Bit, true)
        .input('RequiredTraining', sql.Bit, true)
        .input('AssignedBy', sql.Int, userId)
        .execute('B8V2.sp_ProductDocumentVersion_AssignDepartment');
    }
    await transaction.commit();
    return ids;
  } catch (error) {
    try { await transaction.rollback(); } catch {}
    throw error;
  }
}

async function getDocumentTypeName(documentTypeId) {
  const id = Number(documentTypeId);
  if (!Number.isSafeInteger(id) || id < 1) {
    const error = new Error('DocumentTypeId không hợp lệ.'); error.status = 400; throw error;
  }
  const pool = await getPool();
  const result = await pool.request().input('DocumentTypeId', sql.Int, id)
    .query('SELECT TOP(1) Name FROM [B8V2].[DocumentType] WHERE Id=@DocumentTypeId AND IsActive=1');
  const name = result.recordset?.[0]?.Name;
  if (!name) { const error = new Error('Loại tài liệu không tồn tại hoặc đã ngừng hoạt động.'); error.status = 400; throw error; }
  return name;
}

module.exports = { syncProducts, setRequiredDocumentTypes, createDocumentWizard, getDocumentTypeName };
