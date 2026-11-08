IF DB_ID(N'SowNManga') IS NULL
BEGIN
    CREATE DATABASE SowNManga;
END;
GO

USE SowNManga;
GO

IF OBJECT_ID(N'dbo.StoreState', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StoreState
    (
        StateId TINYINT NOT NULL
            CONSTRAINT PK_StoreState PRIMARY KEY
            CONSTRAINT CK_StoreState_SingleRow CHECK (StateId = 1),
        StateJson NVARCHAR(MAX) NOT NULL
            CONSTRAINT CK_StoreState_Json CHECK (ISJSON(StateJson) = 1),
        UpdatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_StoreState_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;
GO

PRINT N'Đã sẵn sàng cơ sở dữ liệu SowNManga và bảng dbo.StoreState.';
PRINT N'Khi chạy backend lần đầu, ứng dụng sẽ tự lưu dữ liệu cửa hàng mẫu vào SQL Server.';
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
USE SowNManga;
GO

