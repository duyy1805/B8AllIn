# AGENT.md — B8V2 Document Management System

## 1. Mục đích tài liệu

Tài liệu này là nguồn mô tả nghiệp vụ và kiến trúc chính thức cho project **B8V2 – Hệ thống quản lý quy trình và tài liệu sản phẩm**.

Coding agent phải đọc toàn bộ file này trước khi sửa code, thêm tính năng, thiết kế API, viết SQL, hoặc thay đổi UI.

Không được suy diễn hệ thống theo project B8 cũ. Đây là **project mới hoàn toàn**, không migration dữ liệu cũ, không tái sử dụng code legacy trừ khi được yêu cầu rõ ràng.

Mục tiêu của hệ thống:

- Quản lý Quy trình theo phiên bản.
- Quản lý Tài liệu sản phẩm theo ItemCode.
- Một tài liệu sản phẩm có thể áp dụng cho một hoặc nhiều ItemCode.
- Một ItemCode có thể có nhiều tài liệu.
- Mỗi Quy trình / Tài liệu có nhiều phiên bản.
- Phân phối tài liệu theo bộ phận.
- Theo dõi người dùng đã xem / xác nhận / đào tạo.
- Quản lý file PDF và các file nguồn/đính kèm.
- Phản hồi tài liệu.
- Audit lịch sử thao tác.
- Giao diện theo phong cách enterprise DMS/document control.

---

# 2. Kiến trúc tổng thể

## 2.1 Công nghệ

Frontend:

- React
- Vite
- React Router
- Axios
- TanStack React Query
- Ant Design

Backend:

- Node.js
- Express
- mssql
- JWT
- Multer
- SQL Server

Database:

- SQL Server 2016 SP2
- Compatibility level 130
- Schema nghiệp vụ mới: `B8V2`

Master data:

- Tài khoản lấy trực tiếp từ `TAG_SYSTEM`
- Bộ phận lấy trực tiếp từ `TAG_SYSTEM.dbo.DM_DonVi`

Không tạo bảng UserRef hoặc DepartmentRef trong B8V2.

---

# 3. Nguyên tắc nguồn dữ liệu master

## 3.1 Tài khoản

Nguồn:

```sql
TAG_SYSTEM.dbo.TaiKhoanDangNhap
```

Các cột đã xác nhận:

```text
ID_TaiKhoanDangNhap
TenDangNhap
MatKhau
ID_DonVi
ID_BoPhan
ID_ChucVu
ID_NhanSu
Loai_TaiKhoan
Quyen_TatCaDonVi
TenDayDu
Ten_GiaoDich
NgaySinh
GioiTinh
Email
DienThoai
...
```

Mapping chính:

```text
UserId       = ID_TaiKhoanDangNhap
Username     = TenDangNhap
FullName     = TenDayDu
DepartmentId = ID_DonVi
Email        = Email
```

Mật khẩu hiện tại là hash kiểu MD5 trong hệ thống hiện hữu.

Backend phải hỗ trợ:

```env
AUTH_PASSWORD_MODE=md5
```

Không được lưu tài khoản B8 riêng nếu không có yêu cầu mới.

---

## 3.2 Bộ phận

Nguồn:

```sql
TAG_SYSTEM.dbo.DM_DonVi
```

Các ID bộ phận trong B8V2 chỉ lưu `ID_DonVi`.

Ví dụ:

```text
OwnerDepartmentId
DepartmentId
DepartmentIdSnapshot
```

đều là ID tham chiếu logic tới `TAG_SYSTEM.dbo.DM_DonVi.ID_DonVi`.

SQL Server không tạo FK cross-database.

Do đó validation phải thực hiện ở Stored Procedure hoặc backend:

```sql
IF NOT EXISTS (
    SELECT 1
    FROM TAG_SYSTEM.dbo.DM_DonVi
    WHERE ID_DonVi = @DepartmentId
)
    THROW ...
```

---

# 4. Nguyên tắc kiến trúc quan trọng

1. Không lưu danh sách bộ phận bằng chuỗi comma-separated.
2. Không lưu nhiều ItemCode trong một field text.
3. Không duplicate tài liệu cho từng ItemCode nếu cùng một tài liệu áp dụng nhiều ItemCode.
4. Không lưu PDF binary trong SQL Server.
5. SQL chỉ lưu metadata/path file.
6. Một Process có nhiều ProcessVersion.
7. Một ProductDocument có nhiều ProductDocumentVersion.
8. ItemCode và ProductDocument là quan hệ N:N.
9. Chỉ một version được `EFFECTIVE` tại một thời điểm cho cùng một Process/Document.
10. Publish phải được xử lý trong backend/SP, không để frontend tự update nhiều bảng.
11. Receipt phải giữ snapshot Department tại thời điểm phát hành.
12. User đổi bộ phận sau này không được làm thay đổi lịch sử receipt cũ.
13. Các thay đổi nghiệp vụ quan trọng phải ghi AuditLog.
14. Client không chứa business rule phức tạp.
15. Backend/service/SP là nơi thực thi rule nghiệp vụ.

---

# 5. Schema B8V2

## 5.1 Security

### `B8V2.SecurityRole`

Các role mặc định:

```text
ADMIN
DOCUMENT_CONTROLLER
EDITOR
REVIEWER
APPROVER
DEPARTMENT_MANAGER
USER
AUDITOR
```

### `B8V2.UserRole`

Quan hệ:

```text
UserId -> TAG_SYSTEM.dbo.TaiKhoanDangNhap.ID_TaiKhoanDangNhap
RoleId -> B8V2.SecurityRole.Id
```

Không có FK sang TAG_SYSTEM.

---

# 6. Phân quyền nghiệp vụ

## ADMIN

Toàn quyền B8V2.

Có thể:

- quản lý quy trình
- quản lý tài liệu sản phẩm
- tạo version
- upload file
- gán audience
- review
- approve
- publish
- quản lý role
- xem audit
- xem dashboard đầy đủ

---

## DOCUMENT_CONTROLLER

Vai trò kiểm soát tài liệu.

Có thể:

- tạo/sửa quy trình
- tạo version
- upload file
- gán bộ phận nhận
- submit/review/publish tùy flow
- kiểm soát phát hành
- xử lý feedback
- theo dõi receipt

---

## EDITOR

Có thể:

- tạo master
- tạo version
- chỉnh sửa draft
- upload file
- submit version

Không publish nếu không có quyền khác.

---

## REVIEWER

Có thể:

```text
REVIEWING -> APPROVED
```

---

## APPROVER

Có thể publish:

```text
APPROVED -> EFFECTIVE
```

---

## USER

Có thể:

- xem tài liệu được phân phối
- mở PDF
- ghi nhận đã xem
- acknowledge
- feedback

---

## DEPARTMENT_MANAGER

Có thể xem tình trạng tiếp nhận của bộ phận mình.

---

## AUDITOR

Read-only:

- lịch sử version
- receipt
- feedback
- audit

---

# 7. PROCESS DOMAIN — QUY TRÌNH

## 7.1 Master Process

Table:

```sql
B8V2.ProcessMaster
```

Ý nghĩa:

Một dòng = một Quy trình nghiệp vụ.

Ví dụ:

```text
QT-001 - Quy trình kiểm soát tài liệu
QT-015 - Quy trình đánh giá nhà cung cấp
```

Các field chính:

```text
Id
ProcessCode
ProcessName
OwnerDepartmentId
Status
IsActive
CreatedBy
CreatedAt
UpdatedBy
UpdatedAt
DeletedBy
DeletedAt
```

Status master:

```text
ACTIVE
INACTIVE
ARCHIVED
```

`ProcessCode` phải unique.

---

# 8. PROCESS VERSION

Table:

```sql
B8V2.ProcessVersion
```

Một Process có nhiều version.

Ví dụ:

```text
QT-001
├── V1 EXPIRED
├── V2 EFFECTIVE
└── V3 DRAFT
```

Các field chính:

```text
Id
ProcessId
VersionNo
VersionCode
Title

IssueDate
EffectiveDate
ExpiryDate
ChangeSummary

Status

CreatedBy
ReviewedBy
ApprovedBy

CreatedAt
ReviewedAt
ApprovedAt
PublishedAt
```

`VersionNo` là số thứ tự nội bộ tự tăng, không hiển thị cho người dùng. `VersionCode` là mã phiên bản do người tạo nhập, cho phép cả chữ và số, ví dụ `A`, `Rev.01`, `2026-Q3`.

Unique nghiệp vụ:

```text
(ProcessId, VersionCode)
```

Khi tạo phiên bản, `EffectiveDate` và `VersionCode` là bắt buộc. Bộ phận nhận cùng các cờ yêu cầu đọc/xác nhận/đào tạo được kế thừa từ phiên bản gần nhất.

`VersionNo` vẫn tự tăng nội bộ:

```text
MAX(VersionNo) + 1
```

---

# 9. Lifecycle của ProcessVersion

Flow chuẩn mới:

```text
DRAFT (đã nhập VersionCode + EffectiveDate)
  ↓ tải PDF hoặc SIGNED thành công
EFFECTIVE (tự động)
  ↓ version mới phát hành
EXPIRED
```

Ngoài ra:

```text
CANCELLED
```

Rule:

- DRAFT là metadata đã tạo nhưng chưa gắn PDF/SIGNED.
- Không yêu cầu SUBMIT, REVIEW hay APPROVE trong luồng giao diện hiện hành.
- EFFECTIVE là bản đang có hiệu lực.
- EXPIRED là version cũ.
- CANCELLED là version bị hủy.

Không được có 2 version `EFFECTIVE` cùng Process.

---

# 10. Kích hoạt ProcessVersion

Kích hoạt là transaction nghiệp vụ chạy tự động khi gắn PDF hoặc SIGNED.

Ví dụ:

```text
QT-001

V2 EFFECTIVE
Rev.B DRAFT
```

Khi tải file cho Rev.B thành công:

```text
BEGIN TRANSACTION

V2 -> EXPIRED
Rev.B -> EFFECTIVE

Set:
PublishedAt

AuditLog

COMMIT
```

Kết quả:

```text
V2 EXPIRED
Rev.B EFFECTIVE
```

Frontend không được thực hiện từng update riêng lẻ.

Frontend chỉ cần gọi API gắn file; backend tự kích hoạt trong cùng luồng:

```http
POST /api/files/process-version/:versionId/:fileId
```

---

# 11. ProcessVersion File

Table:

```sql
B8V2.ProcessVersionFile
```

Link:

```text
ProcessVersion
    N:N
FileStore
```

FileRole:

```text
SOURCE
PDF
SIGNED
ATTACHMENT
```

Kích hoạt ProcessVersion yêu cầu tối thiểu:

```text
PDF hoặc SIGNED
```

---

# 12. FileStore

Table:

```sql
B8V2.FileStore
```

Không lưu binary.

Field:

```text
Id
OriginalName
StoredName
StoragePath
Extension
MimeType
FileSize
Sha256Hash
UploadedBy
UploadedAt
IsActive
```

File vật lý hiện lưu trong server:

```text
uploads/
```

Node API dùng Multer.

---

# 13. Process Audience

Table:

```sql
B8V2.ProcessVersionAudience
```

Một version được phân phối tới nhiều bộ phận.

Ví dụ:

```text
QT-001 V3
├── B6
├── B8
└── QA
```

Một record:

```text
ProcessVersionId
DepartmentId
RequiredRead
RequiredAcknowledge
RequiredTraining
AssignedBy
AssignedAt
IsActive
```

Không lưu:

```text
"B6,B8,QA"
```

---

# 14. Process Receipt

Table:

```sql
B8V2.ProcessVersionReceipt
```

Một dòng = một user nhận một version.

Unique:

```text
(ProcessVersionId, UserId)
```

Field:

```text
Id
ProcessVersionId
UserId
DepartmentIdSnapshot

AssignedAt
FirstViewedAt
LastViewedAt
AcknowledgedAt
TrainingCompletedAt

ComplianceStatus
Comment
```

ComplianceStatus:

```text
PENDING
COMPLIANT
NON_COMPLIANT
NOT_APPLICABLE
```

---

# 15. Luồng phân phối Process

Mục tiêu cuối cùng:

```text
ProcessVersion EFFECTIVE
        ↓
Audience Department
        ↓
TAG_SYSTEM.dbo.TaiKhoanDangNhap
        ↓
lọc user thuộc Department
        ↓
ProcessVersionReceipt
```

Khi publish, hệ thống nên tự động tạo receipt cho toàn bộ user thuộc các Department đã gán.

Cần có SP/logic:

```text
sp_ProcessVersion_GenerateReceiptsForAudience
```

Pseudo flow:

```sql
SELECT user
FROM TAG_SYSTEM.dbo.TaiKhoanDangNhap
WHERE ID_DonVi IN (
    SELECT DepartmentId
    FROM B8V2.ProcessVersionAudience
    WHERE ProcessVersionId=@VersionId
      AND IsActive=1
)

INSERT missing rows
INTO B8V2.ProcessVersionReceipt
```

Không tạo duplicate receipt.

---

# 16. Mark Viewed Process

Khi user mở tài liệu:

```http
POST /api/process-versions/:id/view
```

Logic:

```text
nếu chưa có receipt:
    tạo receipt

FirstViewedAt:
    chỉ set lần đầu

LastViewedAt:
    update mỗi lần xem
```

Không overwrite FirstViewedAt.

---

# 17. Acknowledge Process

Khi user xác nhận:

```http
POST /api/process-versions/:id/acknowledge
```

Set:

```text
AcknowledgedAt = current time
ComplianceStatus = COMPLIANT
```

Không được reset AcknowledgedAt nếu đã xác nhận.

---

# 18. PRODUCT DOMAIN

## 18.1 Product

Table:

```sql
B8V2.Product
```

Đơn vị quản lý sản phẩm chính:

```text
ItemCode
```

ItemCode unique.

Field:

```text
Id
ItemCode
ProductName
ModelCode
CustomerCode
CustomerName
ProductLine
Category
IsActive
CreatedBy
CreatedAt
UpdatedBy
UpdatedAt
```

Không dùng lại mô hình sản phẩm cũ gồm nhiều mã rời rạc nếu không cần.

---

# 19. ProductDocument

Table:

```sql
B8V2.ProductDocument
```

Đây là master tài liệu sản phẩm.

Ví dụ:

```text
TL-001 Packing Instruction
TL-002 Drawing
TL-003 QC Standard
```

Field:

```text
Id
DocumentCode
DocumentName
DocumentTypeId
OwnerDepartmentId
Status
IsActive
CreatedBy
CreatedAt
UpdatedBy
UpdatedAt
DeletedBy
DeletedAt
```

DocumentCode unique.

---

# 20. DocumentType

Table:

```sql
B8V2.DocumentType
```

Seed hiện tại:

```text
DRAWING
SPEC
BOM
PACKING
QC_STANDARD
MANUAL
LABEL
PHOTO
OTHER
```

Có thể mở rộng.

---

# 21. ItemCode ↔ ProductDocument

Table:

```sql
B8V2.ProductDocumentMap
```

Quan hệ:

```text
Product N:N ProductDocument
```

Ví dụ:

```text
TL-001 Packing Instruction
    ├── 3021928
    ├── 3021929
    └── 3021930
```

Không tạo:

```text
TL-001-3021928
TL-001-3021929
TL-001-3021930
```

nếu chúng thực chất là cùng một tài liệu.

Field:

```text
Id
ProductId
DocumentId
ApplicableFrom
ApplicableTo
IsActive
CreatedBy
CreatedAt
EndedBy
EndedAt
```

Cho phép lịch sử:

```text
ItemCode A dùng Document X
2025-01-01 -> 2025-06-30

sau đó ngừng

2026-01-01 -> active lại
```

Unique filtered rule:

```text
chỉ một mapping active / ProductId + DocumentId
```

---

# 22. ProductDocumentVersion

Table:

```sql
B8V2.ProductDocumentVersion
```

Quan hệ:

```text
ProductDocument
    1:N
ProductDocumentVersion
```

Ví dụ:

```text
TL-001
├── V1 EXPIRED
├── V2 EFFECTIVE
└── V3 DRAFT
```

Field:

```text
Id
DocumentId
VersionNo
VersionCode
IssueDate
EffectiveDate
ExpiryDate
ChangeSummary
Status
CreatedBy
ReviewedBy
ApprovedBy
CreatedAt
ReviewedAt
ApprovedAt
PublishedAt
```

`VersionNo` chỉ là số thứ tự nội bộ. `VersionCode` do người tạo nhập và có thể chứa chữ. `VersionCode` cùng `EffectiveDate` là bắt buộc; audience kế thừa từ phiên bản trước.

Lifecycle giống ProcessVersion mới:

```text
DRAFT
EFFECTIVE
EXPIRED
CANCELLED
```

Chỉ một EFFECTIVE version / Document.

---

# 23. Điểm quan trọng về ProductDocument version

Mapping ItemCode nằm ở:

```text
Product ↔ ProductDocument
```

không map trực tiếp Product ↔ Version.

Điều này có nghĩa:

```text
TL-001 áp dụng cho:
3021928
3021929
3021930
```

Khi PDF/SIGNED của phiên bản mới được tải lên và phiên bản tự vào hiệu lực:

```text
cả 3 ItemCode tự dùng V2
```

Không cần remap ItemCode.

Đây là business rule chính thức.

---

# 24. ProductDocumentVersion File

Table:

```sql
B8V2.ProductDocumentVersionFile
```

FileRole:

```text
SOURCE
PDF
SIGNED
ATTACHMENT
```

Phiên bản tự vào hiệu lực sau khi gắn file PDF hoặc SIGNED thành công.

---

# 25. ProductDocumentVersion Audience

Table:

```sql
B8V2.ProductDocumentVersionAudience
```

Ý nghĩa giống ProcessVersionAudience.

Một version tài liệu sản phẩm có thể gửi nhiều bộ phận.

Field:

```text
DocumentVersionId
DepartmentId
RequiredRead
RequiredAcknowledge
RequiredTraining
AssignedBy
AssignedAt
IsActive
```

---

# 26. ProductDocumentVersion Receipt

Table:

```sql
B8V2.ProductDocumentVersionReceipt
```

Một dòng = một user nhận một product document version.

Unique:

```text
(DocumentVersionId, UserId)
```

Field:

```text
DocumentVersionId
UserId
DepartmentIdSnapshot
AssignedAt
FirstViewedAt
LastViewedAt
AcknowledgedAt
TrainingCompletedAt
ComplianceStatus
Comment
```

Logic tương tự ProcessReceipt.

---

# 27. Luồng Product Document đầy đủ

Flow admin:

```text
Tạo / sync ItemCode
        ↓
Tạo ProductDocument
        ↓
Map một hoặc nhiều ItemCode
        ↓
Tạo DocumentVersion
        ↓
Upload PDF
        ↓
Gán bộ phận
        ↓
SUBMIT
        ↓
REVIEW
        ↓
APPROVED
        ↓
PUBLISH
        ↓
EFFECTIVE
        ↓
Generate Receipt
        ↓
User xem / xác nhận
```

---

# 28. Product Required Document Type

Table:

```sql
B8V2.ProductRequiredDocumentType
```

Mục đích:

Xác định loại tài liệu nào bắt buộc cho một ItemCode.

Ví dụ:

```text
3021928
├── DRAWING required
├── PACKING required
└── QC_STANDARD required
```

Không nên thiết kế theo kiểu bảng "bỏ qua loại tài liệu" nếu có thể quản lý theo rule dương.

Field:

```text
ProductId
DocumentTypeId
IsRequired
Reason
CreatedBy
CreatedAt
```

---

# 29. GUIDE DOMAIN

Các bảng:

```text
B8V2.Guide
B8V2.GuideVersion
B8V2.GuideVersionFile
B8V2.ProcessGuide
```

Guide là hướng dẫn / biểu mẫu / tài liệu tham chiếu có thể liên kết với Process.

RelationType:

```text
GUIDE
FORM
REFERENCE
```

Guide cũng có version lifecycle giống Process.

---

# 30. Feedback Process

Table:

```sql
B8V2.ProcessFeedback
```

Field:

```text
Id
ProcessVersionId
UserId
DepartmentId
FeedbackType
Content
Status
CreatedAt
ReceivedBy
ReceivedAt
ResolvedBy
ResolvedAt
Resolution
```

FeedbackType:

```text
COMMENT
CHANGE_REQUEST
ERROR
OTHER
```

Status:

```text
OPEN
RECEIVED
PROCESSING
RESOLVED
REJECTED
CLOSED
```

Attachment:

```sql
B8V2.ProcessFeedbackFile
```

---

# 31. Feedback Product Document

Tables:

```text
B8V2.ProductDocumentFeedback
B8V2.ProductDocumentFeedbackFile
```

Logic giống ProcessFeedback.

---

# 32. Audit

Table:

```sql
B8V2.AuditLog
```

Field:

```text
Id
UserId
EntityType
EntityId
Action
OldData
NewData
IpAddress
UserAgent
CreatedAt
```

Các action quan trọng cần audit:

```text
CREATE
UPDATE
DELETE
SUBMIT
REVIEW
APPROVE
PUBLISH
EXPIRE
ASSIGN_AUDIENCE
REMOVE_AUDIENCE
UPLOAD_FILE
ACKNOWLEDGE
RESOLVE_FEEDBACK
```

---

# 33. Stored Procedure hiện có

## Process

```text
B8V2.sp_Process_GetList
B8V2.sp_Process_GetDetail
B8V2.sp_Process_Create
B8V2.sp_Process_Update

B8V2.sp_ProcessVersion_Create
B8V2.sp_ProcessVersion_GetDetail
B8V2.sp_ProcessVersion_SetWorkflowStatus
B8V2.sp_ProcessVersion_AssignDepartment
B8V2.sp_ProcessVersion_RemoveDepartment
B8V2.sp_ProcessVersion_Publish
B8V2.sp_ProcessVersion_GenerateReceipt
B8V2.sp_ProcessVersion_MarkViewed
B8V2.sp_ProcessVersion_Acknowledge
B8V2.sp_Process_GetMyDocuments
```

---

## Product

```text
B8V2.sp_Product_Upsert
B8V2.sp_Product_GetDetailByItemCode

B8V2.sp_ProductDocument_GetList
B8V2.sp_ProductDocument_Create
B8V2.sp_ProductDocument_MapItemCode
B8V2.sp_ProductDocument_UnmapItemCode

B8V2.sp_ProductDocumentVersion_Create
B8V2.sp_ProductDocumentVersion_GetDetail
B8V2.sp_ProductDocumentVersion_SetWorkflowStatus
B8V2.sp_ProductDocumentVersion_AssignDepartment
B8V2.sp_ProductDocumentVersion_Publish
B8V2.sp_ProductDocumentVersion_GenerateReceipt
B8V2.sp_ProductDocumentVersion_MarkViewed
B8V2.sp_ProductDocument_GetMyDocuments
```

---

## File

```text
B8V2.sp_File_Create
B8V2.sp_ProcessVersion_AttachFile
B8V2.sp_ProductDocumentVersion_AttachFile
```

---

## Role

```text
B8V2.sp_Role_GetList
B8V2.sp_UserRole_Get
B8V2.sp_UserRole_Assign
B8V2.sp_UserRole_Remove
```

---

## Feedback

```text
B8V2.sp_ProcessFeedback_Create
B8V2.sp_ProcessFeedback_Resolve
B8V2.sp_ProductDocumentFeedback_Create
B8V2.sp_ProductDocumentFeedback_Resolve
```

---

## Dashboard

```text
B8V2.sp_Dashboard_GetAdmin
B8V2.sp_Dashboard_GetUser
```

---

# 34. Stored Procedure cần bổ sung ưu tiên cao

Coding agent nên xem các SP sau là backlog bắt buộc:

```text
sp_ProcessVersion_GenerateReceiptsForAudience
sp_ProductDocumentVersion_GenerateReceiptsForAudience
```

Mục tiêu:

Publish xong tự sinh receipt cho tất cả user thuộc audience.

Ngoài ra nên bổ sung:

```text
sp_ProcessVersion_GetAudienceProgress
sp_ProductDocumentVersion_GetAudienceProgress
sp_ProcessVersion_GetReaders
sp_ProductDocumentVersion_GetReaders
sp_Process_GetVersionHistory
sp_ProductDocument_GetVersionHistory
```

---

# 35. Node API hiện tại

Base:

```text
/api
```

## Health

```http
GET /api/health
```

---

# 36. Auth API

```http
POST /api/auth/login
GET  /api/auth/me
```

Login dùng tài khoản TAG_SYSTEM.

JWT chứa:

```json
{
  "userId": 123,
  "username": "duynh",
  "fullName": "...",
  "departmentId": 87,
  "email": "...",
  "roles": ["ADMIN"]
}
```

Role B8 lấy từ:

```text
B8V2.UserRole
```

Nếu user chưa có role:

```text
USER
```

---

# 37. Master API

```http
GET /api/master/departments
GET /api/master/users
```

Nguồn trực tiếp TAG_SYSTEM.

---

# 38. Process API

```http
GET    /api/processes
POST   /api/processes
GET    /api/processes/:id
POST   /api/processes/:id/versions

GET    /api/processes/my-documents
```

Version:

```http
GET  /api/process-versions/:id

POST /api/process-versions/:id/submit
POST /api/process-versions/:id/review
POST /api/process-versions/:id/publish

POST /api/process-versions/:id/audiences

POST /api/process-versions/:id/view
POST /api/process-versions/:id/acknowledge
```

---

# 39. Product API

```http
POST /api/products/upsert
GET  /api/products/:itemCode
```

Product Document:

```http
GET  /api/product-documents
POST /api/product-documents

POST /api/product-documents/:id/itemcodes
POST /api/product-documents/:id/versions

GET /api/product-documents/my/list
```

ProductDocumentVersion:

```http
GET  /api/product-document-versions/:id

POST /api/product-document-versions/:id/submit
POST /api/product-document-versions/:id/review
POST /api/product-document-versions/:id/publish
POST /api/product-document-versions/:id/audiences
POST /api/product-document-versions/:id/view
```

---

# 40. File API

Hiện có:

```http
POST /api/files/upload
POST /api/files/process-version/:versionId/:fileId
POST /api/files/product-document-version/:versionId/:fileId
```

Bắt buộc bổ sung:

```http
GET /api/files/:fileId/view
GET /api/files/:fileId/download
```

`view` phải stream file để browser/PDF viewer hiển thị.

Không expose path vật lý trực tiếp cho frontend.

---

# 41. Feedback API

```http
POST /api/feedback/process/:versionId
POST /api/feedback/process/:feedbackId/resolve

POST /api/feedback/product/:versionId
```

Cần mở rộng list/detail khi làm UI feedback.

---

# 42. UI / UX chính thức

Phong cách mong muốn:

- enterprise
- document management system
- rõ ràng
- nhiều dữ liệu nhưng không rối
- sidebar tối
- vùng nội dung sáng
- card thống kê
- filter rõ
- table chính
- action panel bên phải

Không dùng UI đơn giản kiểu CRUD form thô.

---

# 43. Layout trang Quản lý Quy trình

Mong muốn:

```text
┌─────────────┬──────────────────────────────────────┬─────────────────────────┐
│ Sidebar     │ Main content                         │ Right Action Panel      │
│             │                                      │                         │
│ Tổng quan   │ Quản lý quy trình                    │ Chi tiết quy trình      │
│ Quy trình   │                                      │                         │
│ Sản phẩm    │ Metric cards                         │ Mã                      │
│ Tài liệu    │                                      │ Tên                     │
│ Phản hồi    │ Filters                              │ Bộ phận                 │
│ Người dùng  │                                      │ Version                 │
│ Cấu hình    │ Table                                │ Ngày hiệu lực           │
│             │                                      │ Trạng thái              │
│             │ QT-001                               │                         │
│             │ QT-015 <- selected                   │ Quick actions           │
│             │ QT-028                               │                         │
│             │                                      │ [Tạo version]           │
│             │                                      │ [Upload PDF]            │
│             │                                      │ [Gán bộ phận]           │
│             │                                      │ [Submit]                │
│             │                                      │ [Review]                │
│             │                                      │ [Publish]               │
│             │                                      │ [Xem PDF]               │
│             │                                      │ [Lịch sử version]       │
└─────────────┴──────────────────────────────────────┴─────────────────────────┘
```

---

# 44. Behavior khi click một dòng Process

Không chuyển trang ngay.

Phải:

```text
click row
    ↓
selectedProcessId
    ↓
highlight row
    ↓
load process detail
    ↓
show persistent right panel
```

Panel không chỉ để xem.

Panel là nơi thao tác nhanh.

---

# 45. Right Action Panel — Process

Panel phải hiển thị:

```text
ProcessCode
ProcessName
OwnerDepartment
Current Effective Version
EffectiveDate
Status
CreatedAt
UpdatedAt
```

Version gần nhất.

Quick action theo role/status:

```text
Tạo version
Upload PDF
Gán bộ phận
Submit
Review
Publish
```

Action khác:

```text
Xem PDF
Quản trị phiên bản
Lịch sử phiên bản
Feedback
Receipt / người đã xem
```

---

# 46. UI Product

Sidebar phải có:

```text
Sản phẩm
```

Trang Product phải có:

```text
Search ItemCode
Customer
Model
ProductLine
Category
Document completeness
```

Click ItemCode:

Panel phải hiển thị:

```text
ItemCode
ProductName
Model
Customer
ProductLine

Danh sách DocumentType bắt buộc

Các ProductDocument đang áp dụng
Current version
Status
EffectiveDate
```

Quick action:

```text
Tạo tài liệu
Gán tài liệu có sẵn
Map ItemCode
Unmap
Tạo version
Upload PDF
Publish
```

---

# 47. UI ProductDocument

Danh sách:

```text
DocumentCode
DocumentName
DocumentType
OwnerDepartment
Số ItemCode áp dụng
Current Version
EffectiveDate
Status
```

Click row:

Right panel hiển thị:

```text
Document metadata
Danh sách ItemCode
Version history
Audience
Receipt progress
Feedback
```

Quick action:

```text
Map thêm ItemCode
Tạo version
Upload PDF
Assign audience
Submit
Review
Publish
Xem PDF
```

---

# 48. PDF Viewer

Mục tiêu UI:

Không chuyển sang page mới nếu không cần.

Khi user click:

```text
Xem PDF
```

nên mở:

- modal lớn
hoặc
- center viewer
hoặc
- drawer full-size

Layout ưu tiên:

```text
┌─────────────────────────────────────────────┬─────────────────────┐
│ PDF Viewer                                  │ Metadata panel      │
│                                             │                     │
│                                             │ Version             │
│                                             │ Status              │
│                                             │ EffectiveDate       │
│                                             │ Audience            │
│                                             │ Feedback            │
│                                             │ Acknowledge         │
└─────────────────────────────────────────────┴─────────────────────┘
```

Khi PDF mở thành công:

```text
MarkViewed
```

phải được gọi.

Không gọi MarkViewed chỉ khi user click nút nếu file chưa thực sự mở.

---

# 49. Receipt progress trên UI

Admin/controller cần thấy:

```text
98 / 132 đã xem
87 / 132 đã xác nhận
```

UI progress bar.

Ví dụ:

```text
Đã xem       98/132  ███████████░░
Đã xác nhận  87/132  ██████████░░░
```

Phải lấy từ receipt thực tế.

Không hardcode.

---

# 50. Dashboard

Admin dashboard nên có:

```text
Tổng quy trình
Đang hiệu lực
Chưa xem
Phản hồi mới

Tổng ItemCode
Tổng tài liệu sản phẩm
Tài liệu thiếu
Tài liệu sắp hết hiệu lực
```

Có thể bổ sung:

```text
recent feedback
recent publish
pending approvals
unread trend
```

---

# 51. Search / filter

Process:

```text
Keyword
Department
Status
Effective status
```

Product:

```text
ItemCode
ProductName
Customer
ProductLine
```

ProductDocument:

```text
DocumentCode
DocumentName
DocumentType
Department
Status
ItemCode
```

Không tải toàn bộ dữ liệu rồi filter client nếu dữ liệu lớn.

Filter server-side.

---

# 52. Quy tắc backend

Controller:

- nhận request
- validate basic
- gọi service
- response

Service:

- business orchestration
- permission logic nếu cần
- transaction nếu không xử lý trong SP

Repository/SP:

- data access

Không viết query SQL dài trực tiếp ở route.

---

# 53. Quy tắc API response

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "..."
}
```

Error handler phải giữ message từ SQL Stored Procedure khi có.

---

# 54. Quy tắc trạng thái

Không dùng status tùy ý ngoài enum đã chốt.

Process master:

```text
ACTIVE
INACTIVE
ARCHIVED
```

Version:

```text
DRAFT
REVIEWING
APPROVED
EFFECTIVE
EXPIRED
CANCELLED
```

Feedback:

```text
OPEN
RECEIVED
PROCESSING
RESOLVED
REJECTED
CLOSED
```

Compliance:

```text
PENDING
COMPLIANT
NON_COMPLIANT
NOT_APPLICABLE
```

---

# 55. Test SQL bắt buộc

Mỗi flow quan trọng phải có script test transaction:

```text
BEGIN TRANSACTION

test

SELECT validation

ROLLBACK
```

Test không để lại dữ liệu rác.

Các test tối thiểu:

```text
Create Process
Create Version
Attach PDF
Assign Department
Submit
Review
Publish
Generate Receipt
Mark Viewed
Acknowledge
```

Product:

```text
Create Product
Create ProductDocument
Map ItemCode
Create Version
Attach PDF
Assign Department
Submit
Review
Publish
Generate Receipt
Mark Viewed
```

---

# 56. Data validation bắt buộc

Các query kiểm tra phải trả 0 rows:

```text
>1 EFFECTIVE ProcessVersion / Process
>1 EFFECTIVE ProductDocumentVersion / Document

duplicate active ProductDocumentMap

duplicate active audience

orphan receipt

DepartmentId không tồn tại TAG_SYSTEM
```

---

# 57. Những việc không được làm

Không:

```text
- tạo database user riêng nếu không được yêu cầu
- copy TAG_SYSTEM user sang B8V2
- copy DM_DonVi sang B8V2
- lưu bộ phận bằng chuỗi
- lưu ItemCode bằng chuỗi comma-separated
- lưu binary PDF trong DB
- để frontend update trực tiếp version status
- cho phép 2 EFFECTIVE version
- hardcode user/department names
- hardcode progress data
- duplicate document theo ItemCode
```

---

# 58. Những việc cần hoàn thiện tiếp theo

Priority 1:

```text
Auto-generate Receipt from Audience on Publish
```

Priority 2:

```text
PDF stream/view/download API
```

Priority 3:

```text
PDF Viewer trên client
```

Priority 4:

```text
Product + ProductDocument UI đầy đủ
```

Priority 5:

```text
Feedback UI
```

Priority 6:

```text
Role/User management UI
```

Priority 7:

```text
Receipt progress/report
```

Priority 8:

```text
Audit screen
```

---

# 59. Flow tổng thể Process

```text
TAG_SYSTEM User
       ↓ login
JWT + B8V2 role
       ↓
Create Process
       ↓
Create Version
       ↓
Upload PDF
       ↓
Attach file
       ↓
Assign Department
       ↓
SUBMIT
       ↓
REVIEW
       ↓
APPROVED
       ↓
PUBLISH
       ↓
Previous EFFECTIVE -> EXPIRED
Current -> EFFECTIVE
       ↓
Generate Receipts from Audience
       ↓
User login
       ↓
My Documents
       ↓
Open PDF
       ↓
FirstViewedAt / LastViewedAt
       ↓
Acknowledge
       ↓
ComplianceStatus = COMPLIANT
       ↓
Feedback if needed
       ↓
Admin follows progress
```

---

# 60. Flow tổng thể Product

```text
ItemCode
   ↓
B8V2.Product
   ↓
Map
   ↓
ProductDocument
   ↓
ProductDocumentVersion
   ↓
Upload PDF
   ↓
Assign Department
   ↓
SUBMIT
   ↓
REVIEW
   ↓
APPROVED
   ↓
PUBLISH
   ↓
DocumentVersion EFFECTIVE
   ↓
Tất cả ItemCode mapped vào Document dùng version mới
   ↓
Generate Receipts
   ↓
User view
   ↓
Acknowledge
   ↓
Feedback
```

---

# 61. Data relationship summary

```text
TAG_SYSTEM.dbo.TaiKhoanDangNhap
                │
                ├── UserRole
                ├── CreatedBy
                ├── ReviewedBy
                ├── ApprovedBy
                ├── AssignedBy
                ├── Receipt.UserId
                └── Feedback.UserId

TAG_SYSTEM.dbo.DM_DonVi
                │
                ├── ProcessMaster.OwnerDepartmentId
                ├── ProcessVersionAudience.DepartmentId
                ├── ProductDocument.OwnerDepartmentId
                ├── ProductDocumentVersionAudience.DepartmentId
                └── Receipt.DepartmentIdSnapshot


ProcessMaster
    1
    │
    N
ProcessVersion
    │
    ├── File
    ├── Audience
    ├── Receipt
    └── Feedback


Product
    N
    │
    N
ProductDocument
    1
    │
    N
ProductDocumentVersion
    │
    ├── File
    ├── Audience
    ├── Receipt
    └── Feedback
```

---

# 62. Coding agent expectations

Quy tắc thực thi SQL bắt buộc:

- Mọi thay đổi SQL mới phải đặt trong `B8V2_Server_API/database/migrations/`.
- Coding agent không tự chạy migration hoặc câu lệnh làm thay đổi database.
- Coding agent chỉ được chạy truy vấn đọc dữ liệu.
- Kiểm thử có ghi dữ liệu chỉ được phép nằm trong transaction và phải `ROLLBACK`.
- Người dùng là người trực tiếp chạy migration sau khi kiểm tra.

Trước mỗi thay đổi:

1. Xác định change thuộc domain nào.
2. Không phá rule version lifecycle.
3. Không phá mapping ItemCode N:N Document.
4. Không duplicate master TAG_SYSTEM.
5. Kiểm tra permission.
6. Kiểm tra transaction.
7. Kiểm tra audit.
8. Kiểm tra backward compatibility với API đang dùng.
9. Nếu thay SQL, tạo script test.
10. Nếu thay UI, giữ mô hình right action panel.

---

# 63. Mục tiêu UX cuối cùng

Hệ thống phải cho cảm giác như một Document Control Center chuyên nghiệp, không phải CRUD database viewer.

Người dùng phải có thể:

```text
tìm tài liệu nhanh
xem version hiện hành
xem PDF ngay
biết tài liệu có hiệu lực hay không
biết ai đã xem
biết ai chưa xem
xác nhận tài liệu
phản hồi
```

Admin/controller phải có thể:

```text
tạo
versioning
review
approve
publish
gán bộ phận
theo dõi receipt
xem feedback
xem audit
```

với ít thao tác chuyển trang nhất có thể.

Right Action Panel là pattern UI chính cần duy trì.

---

# 64. Project direction

Đây là hệ thống mới.

Không migration dữ liệu B8 cũ.

Không phụ thuộc route `/B8` legacy.

Client và server mới phải phát triển độc lập.

Target cuối:

```text
B8V2 Client
      ↓
B8V2 Node API
      ↓
SQL Server
├── B8V2 schema
└── TAG_SYSTEM master
```

Đây là kiến trúc chính thức cho các thay đổi tiếp theo.

---

# 65. Quy tắc CSS khi dùng Ant Design

CSS tùy chỉnh không được dùng selector phần tử quá rộng bên trong container có component Ant Design.

Không viết:

```css
.drawer-file-row span { ... }
.role-option span { ... }
.process-titlebar .ant-btn span { ... }
```

Ant Design dùng các phần tử `span`, `div` và `button` nội bộ cho label, icon, loading, `Tag`, `Switch`, `Avatar` và nhiều component khác. Selector rộng có thể vô tình ghi đè màu chữ, kích thước, trạng thái hover/disabled hoặc làm ẩn icon của thư viện.

Bắt buộc:

- Dùng selector theo đúng cấu trúc hoặc class riêng của phần tử nghiệp vụ, ví dụ `.drawer-file-row > div:first-child > span`.
- Với button tùy biến, gắn class riêng như `.file-viewer-button`; không style toàn bộ `span` nằm trong vùng chứa button.
- Text và icon bên trong button phải kế thừa `color` và `font-size` từ button, trừ khi thiết kế yêu cầu khác.
- Phân biệt rõ trạng thái mặc định, `hover`, `focus-visible`, `active`, `loading` và `disabled`; trạng thái disabled không được bị selector hover ghi đè.
- Không dùng `!important` để thắng CSS Ant Design nếu có thể giải quyết bằng selector đúng phạm vi.
- Khi cần ẩn nhãn button ở responsive, chỉ chọn phần nhãn, ví dụ `.ant-btn > span:not(.ant-btn-icon)`; không ẩn toàn bộ `span` trong button.
- Khi sửa CSS cho một container, phải kiểm tra các component Ant Design lồng bên trong như `Button`, `Tag`, `Switch`, `Avatar`, `Tabs`, `Upload` và `Spin`.
- Sau thay đổi UI phải chạy `npm run build` và kiểm tra trực quan ít nhất trạng thái mặc định, hover và disabled của các nút bị ảnh hưởng.

Ví dụ đúng:

```css
.drawer-file-row > div:first-child > span {
  color: #8a94a5;
  font-size: 10px;
}

.file-viewer-button > .ant-btn-icon,
.file-viewer-button > span:not(.ant-btn-icon) {
  color: inherit;
  font-size: inherit;
}
```

---

# 66. Quy tắc quản lý tài liệu sản phẩm hiện hành

Các quy tắc dưới đây thay thế những mô tả Product cũ có nội dung khác trong tài liệu này:

- `Product.ItemCode` chỉ đồng bộ thủ công, một chiều từ `TAG_QTKD.dbo.DM_SanPham` khi người có quyền `PRODUCT_SYNC` bấm “Đồng bộ ItemCode”. Không tạo cron, scheduler, SQL Agent job hoặc tiến trình đồng bộ tự động.
- Metadata lấy từ nguồn là chỉ đọc tại B8V2; client và API không cho tạo, sửa hoặc xóa metadata Product thủ công.
- Khi nguồn trùng ItemCode, chọn dòng theo thứ tự: `TonTai=1`, thời điểm sửa/tạo mới nhất, rồi `ID_SanPham` lớn nhất. ItemCode rỗng bị bỏ qua.
- Product không còn hoặc `TonTai=0` được chuyển inactive; không xóa mapping, tài liệu, receipt, minh chứng hoặc audit.
- Mỗi ItemCode chỉ có một `ProductDocument` active cho một `DocumentType`. Khi bổ sung nội dung cùng loại, phải tạo phiên bản mới trên hồ sơ hiện có giống Quy trình; khi phiên bản mới có hiệu lực thì phiên bản cũ chuyển `EXPIRED`. Một hồ sơ tài liệu có thể dùng chung cho nhiều ItemCode.
- `ProductDocument.DocumentCode` là mã kỹ thuật backend tự sinh và không hiển thị/không yêu cầu người dùng nhập.
- Không được đổi `DocumentType` sau khi hồ sơ đã từng map ItemCode.
- Wizard tạo tài liệu gồm ItemCode, DocumentType, metadata, phiên bản đầu, audience và cho lưu `DRAFT` chưa có file.
- PDF hoặc SIGNED chỉ kích hoạt phiên bản khi có ít nhất một ItemCode active, một audience và ngày hiệu lực. Khi kích hoạt, phiên bản cũ thành `EXPIRED`; phiên bản mới áp dụng cho mọi mapping active của hồ sơ.
- Loại tài liệu bắt buộc cấu hình dương theo từng ItemCode qua `ProductRequiredDocumentType`. Một loại chỉ được tính đủ nếu mapping và tài liệu active có phiên bản `EFFECTIVE`.
- Tiếp nhận và đào tạo tài liệu sản phẩm theo bộ phận chuẩn hóa bằng `Ten_DonVi_ThanhToan`, dùng trạng thái `PENDING -> VIEWED -> TRAINED`; một thành viên hoàn thành thay cho cả bộ phận và xác nhận đào tạo bắt buộc có minh chứng.
- USER dùng chung sidebar “Sản phẩm”; không tạo menu “Tài liệu của tôi” riêng cho sản phẩm.
- Migration chính thức của module là `database/migrations/20260826_03_product_document_management.sql` và không được tự động chạy bởi coding agent.
