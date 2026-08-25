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

Nếu user chưa được gán role B8, API login mặc định cấp role `USER`.

## 7. Luồng Quy trình

Tạo Process -> tạo Version (người dùng nhập mã phiên bản + ngày hiệu lực, tự kế thừa bộ phận nhận) -> upload/attach PDF -> tự động EFFECTIVE -> tạo Receipt -> Mark Viewed -> Acknowledge.

Các endpoint chính:

- `GET/POST /api/processes`
- `POST /api/processes/:id/versions`
- `GET /api/process-versions/:id`
- `POST /api/process-versions/:id/audiences`
- `DELETE /api/process-versions/:id/audiences/:departmentId`
- `POST /api/process-versions/:id/view`
- `POST /api/process-versions/:id/acknowledge`

## 8. Luồng tài liệu sản phẩm

Upsert ItemCode -> tạo ProductDocument -> map một/nhiều ItemCode -> tạo Version (mã phiên bản + ngày hiệu lực, kế thừa audience) -> upload/attach PDF -> tự động EFFECTIVE.

Endpoint chính:

- `POST /api/products/upsert`
- `GET /api/products/:itemCode`
- `GET/POST /api/product-documents`
- `POST /api/product-documents/:id/itemcodes`
- `POST /api/product-documents/:id/versions`
- `GET /api/product-document-versions/:id`

## 9. Receipt và danh sách người nhận

Các SP `GenerateReceipt` hiện nhận `UserId` cụ thể.

Lý do: tên bảng/cột user của TAG_SYSTEM chưa được xác nhận trong project này.

Khi đã chốt chính xác schema user của TAG_SYSTEM, bước tiếp theo nên bổ sung:

- `sp_ProcessVersion_GenerateReceiptsForAudience`
- `sp_ProductDocumentVersion_GenerateReceiptsForAudience`

để tự động lấy toàn bộ user thuộc các Department đã gán và tạo Receipt hàng loạt ngay khi phiên bản vào hiệu lực.

Node API hiện đã có cấu hình `MASTER_USER_*`, nên phần này có thể triển khai mà không thay đổi kiến trúc.

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
