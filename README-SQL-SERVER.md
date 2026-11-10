# Chạy SOWNMANGA với SQL Server

Website dùng backend Express để đọc/ghi dữ liệu vào các bảng SQL Server. Trình duyệt không ghi dữ liệu vào `localStorage`.

## Các bảng

- `Accounts`: tài khoản quản trị viên, nhân viên và khách hàng.
- `Books`: truyện, giá bán và tồn kho.
- `Suppliers`: nhà cung cấp.
- `Orders` và `OrderDetails`: đơn hàng và các dòng truyện trong đơn.
- `Receipts` và `ReceiptDetails`: phiếu nhập và các dòng truyện được nhập.

Các bảng chi tiết có khóa ngoại đến đơn/phiếu, truyện và tài khoản tương ứng. Mỗi thay đổi từ website được ghi vào SQL Server trong một transaction. Khi website tải lại, dữ liệu được đọc lại từ các bảng này.

## 1. Tạo cấu trúc database

Mở `SownManga.sql` trong SQL Server Management Studio (SSMS) và nhấn **Execute (F5)**. Script tạo `SowNManga`, các bảng quan hệ và dữ liệu mẫu để đăng nhập vào website.

Nếu đang có dữ liệu cũ trong `dbo.StoreState`, script không chèn dữ liệu mẫu; backend sẽ tự chuyển dữ liệu đó sang các bảng mới khi khởi động lần đầu. Bảng cũ không bị xóa.

## 2. Cấu hình kết nối

1. Cài Node.js bản LTS.
2. Với SQL Server Authentication, tạo SQL login cho ứng dụng và cấp quyền đọc, ghi trong database `SowNManga`. Với Windows Authentication, cấp quyền đó cho tài khoản Windows sẽ chạy backend.
3. Sao chép `.env.example` thành `.env`. Không chia sẻ hoặc commit `.env`.
4. Chọn kiểu xác thực:
   - Windows Authentication: đặt `SQL_AUTH=integrated`, `SQL_SERVER` thành tên máy kèm instance (ví dụ `DESKTOP-UFMCEOU\SQLEXPRESS`) và bỏ qua `SQL_USER`/`SQL_PASSWORD`. Cài Node.js, Microsoft ODBC Driver for SQL Server và chạy app bằng đúng tài khoản Windows có quyền truy cập database. Kiểu này dùng driver `msnodesqlv8`.
   - SQL Server Authentication: đặt `SQL_AUTH=sql`, rồi điền `SQL_USER` và `SQL_PASSWORD`. Nếu dùng instance `SQLEXPRESS`, đặt `SQL_INSTANCE=SQLEXPRESS`. Cần bật SQL Server Browser hoặc cấu hình cổng TCP tĩnh.
5. Nếu đã cấu hình cổng TCP tĩnh, bỏ `SQL_INSTANCE` và đặt `SQL_PORT` bằng cổng đó, thường là `1433`.

Ví dụ kết nối instance:

```env
SQL_SERVER=localhost
SQL_INSTANCE=SQLEXPRESS
SQL_DATABASE=SowNManga
SQL_USER=sownmanga_app
SQL_PASSWORD=mat_khau_cua_ban
```

Ví dụ dùng Windows Authentication:

```env
SQL_AUTH=integrated
SQL_SERVER=DESKTOP-UFMCEOU\SQLEXPRESS
SQL_DATABASE=SowNManga
```

Xem dữ liệu đã đồng bộ trong SSMS:

```sql
USE SowNManga;
SELECT * FROM dbo.Books;
SELECT * FROM dbo.Accounts;
SELECT * FROM dbo.Orders;
SELECT * FROM dbo.OrderDetails;
SELECT * FROM dbo.Receipts;
SELECT * FROM dbo.ReceiptDetails;
```

## 3. Cài và chạy

Mở PowerShell tại thư mục dự án. Cài Node.js LTS trước nếu chưa có:

```powershell
npm install
npm start
```

Mở `http://localhost:3000`. Không mở `index.html` trực tiếp bằng `file://`; trang cần backend để kết nối SQL Server.

Để mở nhanh những lần sau, nhấp đúp file `Mo_SOWNMANGA.bat` trong thư mục dự án. File này tự khởi động backend nếu cần và mở website trên trình duyệt. Có thể nhấp chuột phải file rồi chọn **Send to → Desktop (create shortcut)** để tạo lối tắt ngoài màn hình. Đóng cửa sổ **SOWNMANGA Server** khi muốn dừng backend.

## Nếu ứng dụng báo không kết nối được

- Khởi động backend bằng `npm start` và giữ cửa sổ terminal đang chạy.
- Mở website tại `http://localhost:3000`, không mở `index.html` trực tiếp hoặc bằng Live Server.
- Với cấu hình Windows Authentication hiện tại, chạy backend trên cùng máy và cùng tài khoản Windows đã được cấp quyền database. Nếu SQL Server tắt TCP/IP, backend dùng kết nối cục bộ `lpc:`; không cần bật SQL Server Browser.
- Mở `http://localhost:3000/api/state`. Nếu thấy dữ liệu JSON của truyện, ứng dụng đã đọc được dữ liệu từ SQL Server.

## Lưu ý

Các tài khoản mẫu dùng chung để minh họa đăng nhập. Mật khẩu hiện được lưu dạng văn bản thuần để phù hợp phiên bản bài tập; không dùng cách này cho hệ thống thật. Khi triển khai thực tế cần băm mật khẩu và bổ sung xác thực/phân quyền ở backend.
