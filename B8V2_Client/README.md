# B8V2 Client

Client React + Vite cho server `B8V2_Server_API`.

## Công nghệ

- React 18
- Vite
- React Router
- Axios
- TanStack React Query
- Ant Design

## Cài đặt

```bash
npm install
```

Copy:

```text
.env.example
```

thành:

```text
.env
```

Ví dụ:

```env
VITE_API_URL=http://localhost:3100/api
```

Chạy:

```bash
npm run dev
```

Client mặc định:

```text
http://localhost:5173
```

## Luồng đã triển khai

### Authentication

- Login
- JWT lưu localStorage
- ProtectedRoute
- Role từ B8V2.UserRole

### Dashboard

`GET /api/dashboard`

### Quy trình

- Danh sách quy trình
- Tạo quy trình
- Chi tiết quy trình
- Danh sách version
- Tạo version
- Upload PDF
- Gắn file vào version
- Gán bộ phận nhận
- Submit
- Review/Approve
- Publish
- Sửa/xóa mềm quy trình và phiên bản theo permission
- ADMIN lọc dữ liệu đã xóa và khôi phục

### Quy trình được phân phối

- Xem danh sách receipt
- Ghi nhận đã xem sau khi mở file thành công
- Xác nhận đào tạo kèm một hoặc nhiều file minh chứng

### Sản phẩm

- Danh sách và bảng chi tiết Sản phẩm
- Tạo, sửa, xóa mềm và khôi phục theo permission
- Danh sách và bảng chi tiết Tài liệu sản phẩm
- Quản lý ItemCode, phiên bản, file và loại tài liệu

## Lưu ý quan trọng

Nút sửa/xóa/khôi phục chỉ được render khi người dùng có permission tương ứng; backend vẫn kiểm tra lại quyền tại từng endpoint. Mã master chỉ đọc khi sửa, còn mã phiên bản có thể sửa nếu không trùng trong cùng master.

## API server cần chạy trước

```text
http://localhost:3100/api/health
```

Nếu server chạy địa chỉ khác, sửa `VITE_API_URL`.
