# Thứ tự cài migration thủ công

Không thêm các file migration vào `99_install_all.sql`. Người quản trị cơ sở dữ liệu chạy thủ công theo thứ tự và kiểm tra trên môi trường thử nghiệm trước:

1. `migrations/20260825_03_role_permission_rbac.sql`
2. `migrations/20260825_04_rbac_role_crud_user_permissions.sql`
3. `migrations/20260825_05_department_payment_name_grouping.sql`
4. `migrations/20260826_01_process_department_training.sql`
5. `migrations/20260826_02_entity_crud_soft_delete.sql`
6. `migrations/20260826_03_product_document_management.sql`

Sau migration cuối, chạy `tests/08_test_product_document_management.sql`. Script test tự mở transaction và luôn `ROLLBACK`; không để lại Product, tài liệu, receipt hay file metadata test.

Có thể kiểm tra riêng cú pháp migration trước khi cài bằng SQLCMD mode với `tests/00_parse_product_document_migration.sql`; file này bật `PARSEONLY` nên không thực thi DDL/DML.

Module Sản phẩm không tạo SQL Agent job, cron, scheduler hoặc trigger đồng bộ nguồn. `TAG_QTKD.dbo.DM_SanPham` chỉ được đọc khi người có quyền `PRODUCT_SYNC` chủ động bấm “Đồng bộ ItemCode”.
