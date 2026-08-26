const { getPool, sql } = require('../../config/db');
const { execProc } = require('../../utils/proc');

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
  const productIds = idArray(payload.productIds, 'productIds');
  const departmentIds = idArray(payload.departmentIds, 'departmentIds');
  const documentTypeId = Number(payload.documentTypeId);
  if (!Number.isSafeInteger(documentTypeId) || documentTypeId < 1) {
    const error = new Error('DocumentTypeId không hợp lệ.'); error.status = 400; throw error;
  }
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const lookup = new sql.Request(transaction).input('DocumentTypeId', sql.Int, documentTypeId);
    productIds.forEach((id, index) => lookup.input(`ProductId${index}`, sql.Int, id));
    const existingResult = await lookup.query(`
      SELECT DISTINCT documentRow.Id DocumentId,documentRow.DocumentName
      FROM [B8V2].[ProductDocumentMap] mapRow WITH(UPDLOCK,HOLDLOCK)
      JOIN [B8V2].[ProductDocument] documentRow ON documentRow.Id=mapRow.DocumentId AND documentRow.DeletedAt IS NULL
      WHERE mapRow.IsActive=1 AND mapRow.DocumentTypeIdSnapshot=@DocumentTypeId
        AND mapRow.ProductId IN (${productIds.map((_, index) => `@ProductId${index}`).join(',')})
    `);
    const existingDocuments = existingResult.recordset || [];
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
        .input('VersionCode', sql.NVarChar(50), String(payload.versionCode || '').trim())
        .query(`SELECT TOP(1) Id FROM [B8V2].[ProductDocumentVersion] WITH(UPDLOCK,HOLDLOCK)
                WHERE DocumentId=@DocumentId AND VersionCode=@VersionCode AND Status='DRAFT' AND DeletedAt IS NULL`);
      let documentVersionId = reusableDraft.recordset?.[0]?.Id;
      if (!documentVersionId) {
        const createdVersion = await new sql.Request(transaction)
          .input('DocumentId', sql.Int, existing.DocumentId)
          .input('VersionCode', sql.NVarChar(50), payload.versionCode)
          .input('IssueDate', sql.Date, payload.issueDate || null)
          .input('EffectiveDate', sql.Date, payload.effectiveDate || null)
          .input('ChangeSummary', sql.NVarChar(1000), payload.changeSummary || null)
          .input('CreatedBy', sql.Int, userId)
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
      const created = await new sql.Request(transaction)
        .input('DocumentName', sql.NVarChar(255), payload.documentName)
        .input('DocumentTypeId', sql.Int, documentTypeId)
        .input('OwnerDepartmentId', sql.Int, payload.ownerDepartmentId || null)
        .input('VersionCode', sql.NVarChar(50), payload.versionCode)
        .input('IssueDate', sql.Date, payload.issueDate || null)
        .input('EffectiveDate', sql.Date, payload.effectiveDate || null)
        .input('ChangeSummary', sql.NVarChar(1000), payload.changeSummary || null)
        .input('CreatedBy', sql.Int, userId)
        .execute('B8V2.sp_ProductDocument_CreateWizard');
      ids = { ...created.recordset?.[0], DocumentName: payload.documentName, IsNewDocument: true };
    }
    for (const productId of productIds) {
      await new sql.Request(transaction)
        .input('DocumentId', sql.Int, ids.DocumentId)
        .input('ProductId', sql.Int, productId)
        .input('ApplicableFrom', sql.Date, payload.effectiveDate || null)
        .input('CreatedBy', sql.Int, userId)
        .execute('B8V2.sp_ProductDocument_MapProduct');
    }
    for (const departmentId of departmentIds) {
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

module.exports = { syncProducts, setRequiredDocumentTypes, createDocumentWizard };
