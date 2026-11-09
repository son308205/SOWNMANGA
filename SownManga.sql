IF DB_ID(N'SowNManga') IS NULL
BEGIN
    CREATE DATABASE SowNManga;
END;
GO

USE SowNManga;
GO

IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        Email NVARCHAR(254) NOT NULL CONSTRAINT PK_Accounts PRIMARY KEY,
        Password NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(120) NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        CONSTRAINT CK_Accounts_Role CHECK (Role IN (N'admin', N'staff', N'customer'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Books', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Books (
        BookCode NVARCHAR(32) NOT NULL CONSTRAINT PK_Books PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL CONSTRAINT UQ_Books_Title UNIQUE,
        Author NVARCHAR(120) NOT NULL,
        Category NVARCHAR(80) NOT NULL,
        Price DECIMAL(19, 2) NOT NULL,
        Stock INT NOT NULL,
        Icon NVARCHAR(20) NOT NULL,
        Color NVARCHAR(20) NOT NULL,
        Sold INT NOT NULL CONSTRAINT DF_Books_Sold DEFAULT (0),
        CONSTRAINT CK_Books_Price CHECK (Price >= 0),
        CONSTRAINT CK_Books_Stock CHECK (Stock >= 0),
        CONSTRAINT CK_Books_Sold CHECK (Sold >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.Suppliers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Suppliers (
        SupplierName NVARCHAR(160) NOT NULL CONSTRAINT PK_Suppliers PRIMARY KEY
    );
END;
GO

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Orders (
        OrderCode NVARCHAR(32) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
        CustomerEmail NVARCHAR(254) NOT NULL,
        CustomerName NVARCHAR(120) NOT NULL,
        ItemCount INT NOT NULL,
        Total DECIMAL(19, 2) NOT NULL,
        Status NVARCHAR(40) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL,
        CONSTRAINT FK_Orders_Accounts FOREIGN KEY (CustomerEmail) REFERENCES dbo.Accounts(Email),
        CONSTRAINT CK_Orders_ItemCount CHECK (ItemCount > 0),
        CONSTRAINT CK_Orders_Total CHECK (Total >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.OrderDetails', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrderDetails (
        OrderCode NVARCHAR(32) NOT NULL,
        LineNumber INT NOT NULL,
        BookCode NVARCHAR(32) NOT NULL,
        BookTitle NVARCHAR(200) NOT NULL,
        Quantity INT NOT NULL,
        UnitPrice DECIMAL(19, 2) NOT NULL,
        LineTotal DECIMAL(19, 2) NOT NULL,
        CONSTRAINT PK_OrderDetails PRIMARY KEY (OrderCode, LineNumber),
        CONSTRAINT FK_OrderDetails_Orders FOREIGN KEY (OrderCode) REFERENCES dbo.Orders(OrderCode),
        CONSTRAINT FK_OrderDetails_Books FOREIGN KEY (BookCode) REFERENCES dbo.Books(BookCode),
        CONSTRAINT CK_OrderDetails_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_OrderDetails_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT CK_OrderDetails_LineTotal CHECK (LineTotal >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.Receipts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Receipts (
        ReceiptCode NVARCHAR(32) NOT NULL CONSTRAINT PK_Receipts PRIMARY KEY,
        SupplierName NVARCHAR(160) NOT NULL,
        EmployeeEmail NVARCHAR(254) NULL,
        EmployeeName NVARCHAR(120) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL,
        Total DECIMAL(19, 2) NOT NULL,
        CONSTRAINT FK_Receipts_Suppliers FOREIGN KEY (SupplierName) REFERENCES dbo.Suppliers(SupplierName),
        CONSTRAINT FK_Receipts_Employees FOREIGN KEY (EmployeeEmail) REFERENCES dbo.Accounts(Email),
        CONSTRAINT CK_Receipts_Total CHECK (Total >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.ReceiptDetails', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReceiptDetails (
        ReceiptCode NVARCHAR(32) NOT NULL,
        LineNumber INT NOT NULL,
        BookCode NVARCHAR(32) NOT NULL,
        BookTitle NVARCHAR(200) NOT NULL,
        Quantity INT NOT NULL,
        UnitCost DECIMAL(19, 2) NOT NULL,
        LineTotal DECIMAL(19, 2) NOT NULL,
        CONSTRAINT PK_ReceiptDetails PRIMARY KEY (ReceiptCode, LineNumber),
        CONSTRAINT FK_ReceiptDetails_Receipts FOREIGN KEY (ReceiptCode) REFERENCES dbo.Receipts(ReceiptCode),
        CONSTRAINT FK_ReceiptDetails_Books FOREIGN KEY (BookCode) REFERENCES dbo.Books(BookCode),
        CONSTRAINT CK_ReceiptDetails_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_ReceiptDetails_UnitCost CHECK (UnitCost >= 0),
        CONSTRAINT CK_ReceiptDetails_LineTotal CHECK (LineTotal >= 0)
    );
END;
GO

DECLARE @HasLegacyState BIT = 0;
IF OBJECT_ID(N'dbo.StoreState', N'U') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql
        N'SELECT @HasLegacyState = CASE WHEN EXISTS (SELECT 1 FROM dbo.StoreState WHERE StateId = 1) THEN 1 ELSE 0 END;',
        N'@HasLegacyState BIT OUTPUT',
        @HasLegacyState = @HasLegacyState OUTPUT;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Books)
   AND NOT EXISTS (SELECT 1 FROM dbo.Accounts)
   AND @HasLegacyState = 0
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    INSERT INTO dbo.Accounts (Email, Password, FullName, Role)
    VALUES
        (N'son@mottruyen.vn', N'admin123', N'Trần Anh Sơn', N'admin'),
        (N'quang@mottruyen.vn', N'staff123', N'Nguyễn Bá Quang', N'staff'),
        (N'khanh@mottruyen.vn', N'staff123', N'Nguyễn Nam Khánh', N'staff'),
        (N'an@mottruyen.vn', N'staff123', N'Nguyễn Trường An', N'staff'),
        (N'linh@mottruyen.vn', N'khach123', N'Lê Bảo Linh', N'customer'),
        (N'tuanminh@mottruyen.vn', N'khach123', N'Dương Tuấn Minh', N'customer'),
        (N'ducanh@mottruyen.vn', N'khach123', N'Đỗ Đức Anh', N'customer');

    INSERT INTO dbo.Suppliers (SupplierName)
    VALUES (N'Nhà sách Phương Nam'), (N'NXB Trẻ'), (N'Công ty sách Kim Đồng');

    INSERT INTO dbo.Books (BookCode, Title, Author, Category, Price, Stock, Icon, Color, Sold)
    VALUES
        (N'MT001', N'Tiệm sách của nàng', N'Yukiko Asano', N'Đời thường', 58000, 18, N'📖', N'sage', 126),
        (N'MT002', N'Ngày nắng qua ô cửa', N'Haru Tanaka', N'Lãng mạn', 65000, 12, N'🌤️', N'gold', 98),
        (N'MT003', N'Lữ khách miền sao', N'Minh Nhật', N'Phiêu lưu', 72000, 7, N'🚀', N'blue', 86),
        (N'MT004', N'Khu vườn mùa hạ', N'An Nhiên', N'Đời thường', 49000, 22, N'🌿', N'sage', 74),
        (N'MT005', N'Mèo nhỏ, phố lớn', N'Aki Mori', N'Đời thường', 54000, 15, N'🐈', N'plum', 68),
        (N'MT006', N'Bí mật tiệm bánh', N'Hana Sato', N'Lãng mạn', 62000, 9, N'🍰', N'gold', 59),
        (N'MT007', N'Chuyến tàu lúc hoàng hôn', N'Lê Lam', N'Phiêu lưu', 68000, 11, N'🚃', N'blue', 51),
        (N'MT008', N'Những vì sao nhỏ', N'Mika Hoshi', N'Thiếu nhi', 45000, 4, N'⭐', N'plum', 44);

    INSERT INTO dbo.Orders (OrderCode, CustomerEmail, CustomerName, ItemCount, Total, Status, CreatedAt)
    VALUES
        (N'MT-24081', N'linh@mottruyen.vn', N'Lê Bảo Linh', 2, 123000, N'Đã giao', DATEADD(DAY, -1, SYSUTCDATETIME())),
        (N'MT-24080', N'tuanminh@mottruyen.vn', N'Dương Tuấn Minh', 1, 72000, N'Chờ xử lý', DATEADD(HOUR, -1, SYSUTCDATETIME())),
        (N'MT-24079', N'ducanh@mottruyen.vn', N'Đỗ Đức Anh', 3, 171000, N'Đã giao', DATEADD(DAY, -2, SYSUTCDATETIME()));

    INSERT INTO dbo.OrderDetails (OrderCode, LineNumber, BookCode, BookTitle, Quantity, UnitPrice, LineTotal)
    VALUES
        (N'MT-24081', 1, N'MT001', N'Tiệm sách của nàng', 1, 58000, 58000),
        (N'MT-24081', 2, N'MT002', N'Ngày nắng qua ô cửa', 1, 65000, 65000),
        (N'MT-24080', 1, N'MT003', N'Lữ khách miền sao', 1, 72000, 72000),
        (N'MT-24079', 1, N'MT004', N'Khu vườn mùa hạ', 1, 49000, 49000),
        (N'MT-24079', 2, N'MT005', N'Mèo nhỏ, phố lớn', 1, 54000, 54000),
        (N'MT-24079', 3, N'MT007', N'Chuyến tàu lúc hoàng hôn', 1, 68000, 68000);

    COMMIT TRANSACTION;
END;
GO

PRINT N'Đã tạo xong cấu trúc dữ liệu quan hệ cho SOWNMANGA.';
PRINT N'Dữ liệu mẫu đã được thêm nếu database chưa có dữ liệu cũ.';
PRINT N'Khởi động ứng dụng bằng npm start để đồng bộ các thay đổi với website.';
GO

USE SowNManga;
GO

SELECT * FROM dbo.Accounts;
SELECT * FROM dbo.Books;
SELECT * FROM dbo.Suppliers;
SELECT * FROM dbo.Orders;
SELECT * FROM dbo.OrderDetails;
SELECT * FROM dbo.Receipts;
SELECT * FROM dbo.ReceiptDetails;
SELECT * FROM dbo.StoreState;
GO