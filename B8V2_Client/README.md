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

### Tài liệu của tôi

- Xem danh sách receipt
- Mark Viewed
- Acknowledge

## Lưu ý quan trọng

Client hiện tập trung vào module Quy trình để tạo một vertical slice hoàn chỉnh.

Module tài liệu sản phẩm chưa đưa vào menu dù server đã có API. Sau khi luồng Quy trình chạy ổn end-to-end, nên bổ sung:

- Product list/search
- Product detail theo ItemCode
- ProductDocument list
- Create ProductDocument
- Map nhiều ItemCode
- ProductDocumentVersion
- Upload / Publish
- My Product Documents

## API server cần chạy trước

```text
http://localhost:3100/api/health
```

Nếu server chạy địa chỉ khác, sửa `VITE_API_URL`.
