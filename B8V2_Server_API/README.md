# B8V2 Server API

Backend mới hoàn toàn cho hệ thống quản lý Quy trình / Tài liệu sản phẩm B8V2.

## 1. Yêu cầu

- SQL Server 2016 SP2 trở lên.
- Schema `B8V2` đã được tạo.
- Database `TAG_SYSTEM` truy cập được từ cùng SQL Server instance.
- Node.js 18+.

## 2. Cài Stored Procedure

Chạy theo thứ tự:

1. `database/00_check_environment.sql`
2. `database/procedures/01_process.sql`
3. `database/procedures/02_product_document.sql`
4. `database/procedures/03_files.sql`
5. `database/procedures/04_roles.sql`
6. `database/procedures/05_feedback.sql`
7. `database/procedures/06_dashboard.sql`

`99_install_all.sql` dùng SQLCMD mode của SSMS. Nếu không dùng SQLCMD mode thì chạy từng file theo thứ tự trên.

## 3. Test database / stored procedure

Chạy:

- `tests/01_test_tables.sql`
- `tests/02_test_procedures.sql`
- `tests/03_test_process_flow.sql`
- `tests/04_test_product_flow.sql`
- `tests/05_validate_data.sql`

Hai test flow chạy trong `BEGIN TRANSACTION ... ROLLBACK`, vì vậy dữ liệu test sẽ không tồn tại sau khi test thành công.

### Migration tiếp nhận và đào tạo theo bộ phận

Sau các migration ngày `20260825`, chạy thủ công:

- `database/migrations/20260826_01_process_department_training.sql`
- kiểm tra bằng `database/tests/06_test_process_department_training.sql`

Migration tạo receipt theo `Ten_DonVi_ThanhToan`, backfill phiên bản đang hiệu lực và không tự chạy vào database. Phải chạy migration trước khi triển khai phiên bản API/client này.

### Migration quyền sửa/xóa và xóa mềm

Sau migration tiếp nhận, chạy thủ công:

- `database/migrations/20260826_02_entity_crud_soft_delete.sql`
- kiểm tra bằng `database/tests/07_test_entity_crud_soft_delete.sql`

Migration bổ sung permission sửa/xóa, metadata xóa mềm và stored procedure CRUD/khôi phục cho Quy trình và Sản phẩm. Migration có tính idempotent nhưng không được Node API tự chạy.

### Migration quản lý tài liệu sản phẩm

Sau migration xóa mềm, chạy thủ công:

- `database/migrations/20260826_03_product_document_management.sql`
- kiểm tra cú pháp bằng `database/tests/00_parse_product_document_migration.sql`
- kiểm tra nghiệp vụ bằng `database/tests/08_test_product_document_management.sql`

Migration này không tạo lịch đồng bộ tự động. Xem thứ tự đầy đủ tại `database/MIGRATIONS.md`.

## 4. Cấu hình TAG_SYSTEM

Tên bảng/cột tài khoản chưa được khóa cứng trong Node API.

Copy:

`.env.example` -> `.env`

Sau đó sửa nhóm:

`MASTER_USER_*`

cho đúng bảng tài khoản thật trong `TAG_SYSTEM`.

Bộ phận mặc định:

`TAG_SYSTEM.dbo.DM_DonVi`

Stored Procedure hiện sử dụng trực tiếp:

- `ID_DonVi`
- `Ten_DonVi`

Nếu database thực tế dùng tên khác, tìm `TAG_SYSTEM.dbo.DM_DonVi` trong các file SQL và thay đúng tên field trước khi cài SP.

## 5. Chạy Node API

```bash
npm install
npm run dev
```

Health:

`GET /api/health`

Login:

`POST /api/auth/login`

```json
{
  "username": "user",
  "password": "password"
}
```

## 6. Quyền

Role B8 nằm tại:

- `B8V2.SecurityRole`
- `B8V2.UserRole`

Tài khoản và thông tin bộ phận vẫn lấy trực tiếp từ TAG_SYSTEM.

Nếu user chưa được gán role B8, API mặc định áp dụng role `USER` và các quyền hiện hành của role này mà không tạo dữ liệu `UserRole`. Khi có role được gán chính thức, role mặc định tự ngừng áp dụng.

Các quyền CRUD mới gồm `PROCESS_EDIT`, `PROCESS_DELETE`, `PROCESS_VERSION_EDIT`, `PROCESS_VERSION_DELETE`, `PRODUCT_EDIT`, `PRODUCT_DELETE`, `PRODUCT_DOCUMENT_EDIT`, `PRODUCT_DOCUMENT_DELETE`, `PRODUCT_DOCUMENT_VERSION_EDIT`, `PRODUCT_DOCUMENT_VERSION_DELETE`. Chỉ role `ADMIN` được gọi endpoint khôi phục.

Module sản phẩm bổ sung `PRODUCT_SYNC` và `PRODUCT_REQUIREMENT_MANAGE`; mặc định chỉ `ADMIN` và `DOCUMENT_CONTROLLER` được cấp hai quyền này.

## 7. Luồng Quy trình

Tạo Process -> tạo Version -> gán bộ phận -> upload/attach PDF -> tự động EFFECTIVE -> tạo receipt cấp bộ phận -> mở tài liệu -> tải minh chứng -> xác nhận đào tạo.

Các endpoint chính:

- `GET/POST /api/processes`
- `POST /api/processes/:id/versions`
- `GET /api/process-versions/:id`
- `POST /api/process-versions/:id/audiences`
- `DELETE /api/process-versions/:id/audiences/:departmentId`
- `POST /api/process-versions/:id/view`
- `GET /api/process-versions/:id/training-confirmation`
- `POST /api/process-versions/:id/training-confirmations` (`multipart`, field `files`, tối đa 10 file)
- `GET /api/process-versions/:id/department-progress`
- `DELETE /api/process-training-evidence/:evidenceId` (chỉ ADMIN)

## 8. Luồng tài liệu sản phẩm

Người có quyền chủ động đồng bộ ItemCode từ `TAG_QTKD` -> cấu hình loại bắt buộc -> wizard tạo hồ sơ dùng chung cho một/nhiều ItemCode -> tạo Version và audience -> upload/attach PDF -> tự động EFFECTIVE -> tiếp nhận và đào tạo theo bộ phận.

Endpoint chính:

- `POST /api/products/sync`
- `GET /api/products/sync-runs`
- `GET /api/products/sync-runs/latest`
- `GET /api/products`
- `GET /api/products/:id/detail`
- `POST /api/products/required-document-types/bulk`
- `GET /api/products/my-documents`
- `POST /api/product-documents/wizard`
- `POST /api/product-documents/:id/itemcodes`
- `POST /api/product-documents/:id/versions`
- `GET /api/product-document-versions/:id`
- `POST /api/product-document-versions/:id/audiences`
- `DELETE /api/product-document-versions/:id/audiences/:departmentId`
- `POST /api/product-document-versions/:id/view`
- `GET /api/product-document-versions/:id/training-confirmation`
- `POST /api/product-document-versions/:id/training-confirmations`
- `GET /api/product-document-versions/:id/department-progress`
- `DELETE /api/product-training-evidence/:evidenceId` (chỉ ADMIN)

## 9. Receipt và danh sách người nhận

Quy trình dùng `ProcessVersionDepartmentReceipt` làm nguồn trạng thái chính. Một receipt đại diện cho một `Ten_DonVi_ThanhToan`; mọi tài khoản cùng nhóm nhìn thấy chung trạng thái `PENDING`, `VIEWED` hoặc `TRAINED`.

`ProcessVersionReceipt` vẫn được giữ để lưu lịch sử thao tác theo từng tài khoản. Tài liệu sản phẩm áp dụng cùng mô hình qua `ProductDocumentVersionDepartmentReceipt`; `ProductDocumentVersionReceipt` chỉ giữ lịch sử xem theo người.

## 10. File

File vật lý lưu ở thư mục `uploads/`.

SQL chỉ lưu metadata trong `B8V2.FileStore`.

Endpoint:

`POST /api/files/upload`

multipart field: `file`.

Sau đó attach:

- `/api/files/process-version/:versionId/:fileId`
- `/api/files/product-document-version/:versionId/:fileId`

Body:

```json
{ "fileRole": "PDF" }
```
