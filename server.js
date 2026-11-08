const express = require("express");
const path = require("path");
require("dotenv").config();

const integratedAuth = process.env.SQL_AUTH === "integrated";
const sql = integratedAuth ? require("mssql/msnodesqlv8") : require("mssql");
const app = express();
const port = Number(process.env.PORT || 3000);
let dbPool;
const configuredServer = process.env.SQL_SERVER || "localhost";
const serverParts = configuredServer.split("\\", 2);
const localInstanceAddress = serverParts.length === 2 ? `.\\${serverParts[1]}` : configuredServer;
const config = {
  server: integratedAuth && serverParts.length === 2 ? serverParts[0] : configuredServer,
  port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
  database: process.env.SQL_DATABASE || "SowNManga",
  user: integratedAuth ? undefined : process.env.SQL_USER,
  password: integratedAuth ? undefined : process.env.SQL_PASSWORD,
  connectionString: integratedAuth
    ? [
        `Driver={${process.env.SQL_ODBC_DRIVER || "ODBC Driver 18 for SQL Server"}}`,
        `Server=${process.env.SQL_PORT ? `${configuredServer},${process.env.SQL_PORT}` : `lpc:${localInstanceAddress}`}`,
        `Database=${process.env.SQL_DATABASE || "SowNManga"}`,
        "Trusted_Connection=Yes",
        `Encrypt=${process.env.SQL_ENCRYPT === "true" ? "Yes" : "No"}`,
        `TrustServerCertificate=${process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false" ? "Yes" : "No"}`
      ].join(";") + ";"
    : undefined,
  options: {
    encrypt: process.env.SQL_ENCRYPT === "true",
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false",
    ...(integratedAuth
      ? {
          trustedConnection: true,
          instanceName: process.env.SQL_INSTANCE || (serverParts.length === 2 ? serverParts[1] : undefined)
        }
      : { instanceName: process.env.SQL_INSTANCE || undefined })
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

const demoAccounts = [
  { email: "son@mottruyen.vn", password: "admin123", name: "Trần Anh Sơn", role: "admin", label: "Quản trị viên" },
  { email: "quang@mottruyen.vn", password: "staff123", name: "Nguyễn Bá Quang", role: "staff", label: "Nhân viên" },
  { email: "khanh@mottruyen.vn", password: "staff123", name: "Nguyễn Nam Khánh", role: "staff", label: "Nhân viên" },
  { email: "an@mottruyen.vn", password: "staff123", name: "Nguyễn Trường An", role: "staff", label: "Nhân viên" },
  { email: "linh@mottruyen.vn", password: "khach123", name: "Lê Bảo Linh", role: "customer", label: "Khách hàng" },
  { email: "tuanminh@mottruyen.vn", password: "khach123", name: "Dương Tuấn Minh", role: "customer", label: "Khách hàng" },
  { email: "ducanh@mottruyen.vn", password: "khach123", name: "Đỗ Đức Anh", role: "customer", label: "Khách hàng" }
];

const schemaSql = `
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

  IF OBJECT_ID(N'dbo.Suppliers', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Suppliers (
      SupplierName NVARCHAR(160) NOT NULL CONSTRAINT PK_Suppliers PRIMARY KEY
    );
  END;

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
`;

function roleLabel(role) {
  return { admin: "Quản trị viên", staff: "Nhân viên", customer: "Khách hàng" }[role] || role;
}

function normalizeState(state) {
  if (!state || !Array.isArray(state.books) || !Array.isArray(state.orders) ||
      !Array.isArray(state.receipts) || !Array.isArray(state.registeredAccounts) ||
      !Array.isArray(state.suppliers)) {
    throw new Error("Dữ liệu cửa hàng không đúng định dạng.");
  }

  const accountsByEmail = new Map(
    [...demoAccounts, ...state.registeredAccounts].map(account => [
      String(account.email).trim().toLowerCase(),
      { ...account, email: String(account.email).trim().toLowerCase(), label: roleLabel(account.role) }
    ])
  );
  state.registeredAccounts = [...accountsByEmail.values()];
  return state;
}

function dateValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày giao dịch không hợp lệ.");
  return date;
}

function sqlRoleLabel(role) {
  return roleLabel(role);
}

async function loadState(pool) {
  const results = await Promise.all([
    pool.request().query("SELECT BookCode, Title, Author, Category, Price, Stock, Icon, Color, Sold FROM dbo.Books ORDER BY BookCode"),
    pool.request().query("SELECT Email, Password, FullName, Role FROM dbo.Accounts ORDER BY Email"),
    pool.request().query("SELECT SupplierName FROM dbo.Suppliers ORDER BY SupplierName"),
    pool.request().query("SELECT OrderCode, CustomerName, ItemCount, Total, Status, CreatedAt FROM dbo.Orders ORDER BY CreatedAt DESC, OrderCode DESC"),
    pool.request().query("SELECT OrderCode, BookCode, BookTitle, Quantity, UnitPrice, LineTotal FROM dbo.OrderDetails ORDER BY OrderCode, LineNumber"),
    pool.request().query("SELECT ReceiptCode, SupplierName, EmployeeName, CreatedAt, Total FROM dbo.Receipts ORDER BY CreatedAt DESC, ReceiptCode DESC"),
    pool.request().query("SELECT ReceiptCode, BookCode, BookTitle, Quantity, UnitCost, LineTotal FROM dbo.ReceiptDetails ORDER BY ReceiptCode, LineNumber")
  ]);
  const accounts = results[1].recordset.map(account => ({
    email: account.Email,
    password: account.Password,
    name: account.FullName,
    role: account.Role,
    label: sqlRoleLabel(account.Role)
  }));
  const orderLines = new Map();
  for (const line of results[4].recordset) {
    const lines = orderLines.get(line.OrderCode) || [];
    lines.push({
      bookCode: line.BookCode,
      title: line.BookTitle,
      quantity: line.Quantity,
      unitPrice: Number(line.UnitPrice),
      lineTotal: Number(line.LineTotal)
    });
    orderLines.set(line.OrderCode, lines);
  }
  const receiptLines = new Map();
  for (const line of results[6].recordset) {
    const lines = receiptLines.get(line.ReceiptCode) || [];
    lines.push({
      bookCode: line.BookCode,
      title: line.BookTitle,
      quantity: line.Quantity,
      unitCost: Number(line.UnitCost),
      lineTotal: Number(line.LineTotal)
    });
    receiptLines.set(line.ReceiptCode, lines);
  }
  const orders = results[3].recordset.map(order => ({
    code: order.OrderCode,
    customer: order.CustomerName,
    items: order.ItemCount,
    total: Number(order.Total),
    status: order.Status,
    createdAt: order.CreatedAt.toISOString(),
    lines: orderLines.get(order.OrderCode) || []
  }));
  const receipts = results[5].recordset.map(receipt => ({
    code: receipt.ReceiptCode,
    supplier: receipt.SupplierName,
    employee: receipt.EmployeeName,
    createdAt: receipt.CreatedAt.toISOString(),
    total: Number(receipt.Total),
    lines: receiptLines.get(receipt.ReceiptCode) || []
  }));

  if (results.every(result => result.recordset.length === 0)) return null;

  return {
    books: results[0].recordset.map(book => ({
      code: book.BookCode,
      title: book.Title,
      author: book.Author,
      category: book.Category,
      price: Number(book.Price),
      stock: book.Stock,
      icon: book.Icon,
      color: book.Color,
      sold: book.Sold
    })),
    orders,
    receipts,
    registeredAccounts: accounts,
    suppliers: results[2].recordset.map(supplier => supplier.SupplierName)
  };
}

async function saveState(pool, inputState) {
  const state = normalizeState(inputState);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const lock = await new sql.Request(transaction).query(`
      DECLARE @result INT;
      EXEC @result = sys.sp_getapplock
        @Resource = N'SownMangaStateWrite',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 10000;
      SELECT @result AS LockResult;
    `);
    if (lock.recordset[0].LockResult < 0) throw new Error("Không lấy được khóa cập nhật dữ liệu cửa hàng.");

    await new sql.Request(transaction).query(`
      DELETE FROM dbo.OrderDetails;
      DELETE FROM dbo.ReceiptDetails;
      DELETE FROM dbo.Orders;
      DELETE FROM dbo.Receipts;
      DELETE FROM dbo.Books;
      DELETE FROM dbo.Suppliers;
      DELETE FROM dbo.Accounts;
    `);

    for (const account of state.registeredAccounts) {
      await new sql.Request(transaction)
        .input("email", sql.NVarChar(254), account.email)
        .input("password", sql.NVarChar(255), account.password)
        .input("name", sql.NVarChar(120), account.name)
        .input("role", sql.NVarChar(20), account.role)
        .query(`
          INSERT INTO dbo.Accounts (Email, Password, FullName, Role)
          VALUES (@email, @password, @name, @role)
        `);
    }

    for (const supplier of state.suppliers) {
      await new sql.Request(transaction)
        .input("name", sql.NVarChar(160), supplier)
        .query("INSERT INTO dbo.Suppliers (SupplierName) VALUES (@name)");
    }

    for (const book of state.books) {
      await new sql.Request(transaction)
        .input("code", sql.NVarChar(32), book.code)
        .input("title", sql.NVarChar(200), book.title)
        .input("author", sql.NVarChar(120), book.author)
        .input("category", sql.NVarChar(80), book.category)
        .input("price", sql.Decimal(19, 2), book.price)
        .input("stock", sql.Int, book.stock)
        .input("icon", sql.NVarChar(20), book.icon || "📚")
        .input("color", sql.NVarChar(20), book.color || "sage")
        .input("sold", sql.Int, book.sold || 0)
        .query(`
          INSERT INTO dbo.Books (BookCode, Title, Author, Category, Price, Stock, Icon, Color, Sold)
          VALUES (@code, @title, @author, @category, @price, @stock, @icon, @color, @sold)
        `);
    }

    for (const order of state.orders) {
      const customer = state.registeredAccounts.find(account =>
        account.role === "customer" && account.name.toLocaleLowerCase("vi") === String(order.customer).toLocaleLowerCase("vi")
      );
      if (!customer) throw new Error(`Không tìm thấy tài khoản khách hàng của đơn ${order.code}.`);
      await new sql.Request(transaction)
        .input("code", sql.NVarChar(32), order.code)
        .input("email", sql.NVarChar(254), customer.email)
        .input("name", sql.NVarChar(120), order.customer)
        .input("items", sql.Int, order.items)
        .input("total", sql.Decimal(19, 2), order.total)
        .input("status", sql.NVarChar(40), order.status)
        .input("createdAt", sql.DateTime2(3), dateValue(order.createdAt))
        .query(`
          INSERT INTO dbo.Orders (OrderCode, CustomerEmail, CustomerName, ItemCount, Total, Status, CreatedAt)
          VALUES (@code, @email, @name, @items, @total, @status, @createdAt)
        `);

      for (let index = 0; index < order.lines.length; index += 1) {
        const line = order.lines[index];
        await new sql.Request(transaction)
          .input("orderCode", sql.NVarChar(32), order.code)
          .input("lineNumber", sql.Int, index + 1)
          .input("bookCode", sql.NVarChar(32), line.bookCode)
          .input("title", sql.NVarChar(200), line.title)
          .input("quantity", sql.Int, line.quantity)
          .input("unitPrice", sql.Decimal(19, 2), line.unitPrice)
          .input("lineTotal", sql.Decimal(19, 2), line.lineTotal)
          .query(`
            INSERT INTO dbo.OrderDetails (OrderCode, LineNumber, BookCode, BookTitle, Quantity, UnitPrice, LineTotal)
            VALUES (@orderCode, @lineNumber, @bookCode, @title, @quantity, @unitPrice, @lineTotal)
          `);
      }
    }

    for (const receipt of state.receipts) {
      if (!state.suppliers.includes(receipt.supplier)) state.suppliers.push(receipt.supplier);
      const employee = state.registeredAccounts.find(account =>
        account.role !== "customer" && account.name === receipt.employee
      );
      await new sql.Request(transaction)
        .input("code", sql.NVarChar(32), receipt.code)
        .input("supplier", sql.NVarChar(160), receipt.supplier)
        .input("employeeEmail", sql.NVarChar(254), employee ? employee.email : null)
        .input("employeeName", sql.NVarChar(120), receipt.employee)
        .input("createdAt", sql.DateTime2(3), dateValue(receipt.createdAt))
        .input("total", sql.Decimal(19, 2), receipt.total)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.Suppliers WHERE SupplierName = @supplier)
            INSERT INTO dbo.Suppliers (SupplierName) VALUES (@supplier);
          INSERT INTO dbo.Receipts (ReceiptCode, SupplierName, EmployeeEmail, EmployeeName, CreatedAt, Total)
          VALUES (@code, @supplier, @employeeEmail, @employeeName, @createdAt, @total)
        `);

      for (let index = 0; index < receipt.lines.length; index += 1) {
        const line = receipt.lines[index];
        await new sql.Request(transaction)
          .input("receiptCode", sql.NVarChar(32), receipt.code)
          .input("lineNumber", sql.Int, index + 1)
          .input("bookCode", sql.NVarChar(32), line.bookCode)
          .input("title", sql.NVarChar(200), line.title)
          .input("quantity", sql.Int, line.quantity)
          .input("unitCost", sql.Decimal(19, 2), line.unitCost)
          .input("lineTotal", sql.Decimal(19, 2), line.lineTotal)
          .query(`
            INSERT INTO dbo.ReceiptDetails (ReceiptCode, LineNumber, BookCode, BookTitle, Quantity, UnitCost, LineTotal)
            VALUES (@receiptCode, @lineNumber, @bookCode, @title, @quantity, @unitCost, @lineTotal)
          `);
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

app.use(express.json({ limit: "10mb" }));

app.get("/api/state", async (req, res, next) => {
  try {
    const state = await loadState(dbPool);
    res.json({ state });
  } catch (error) {
    next(error);
  }
});

app.put("/api/state", async (req, res, next) => {
  try {
    await saveState(dbPool, req.body);
    res.json({ state: await loadState(dbPool) });
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  if (["/server.js", "/package.json", "/.env", "/.env.example"].includes(req.path)) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(path.join(__dirname)));

app.use((error, req, res, next) => {
  console.error("API error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: error.message || "Lỗi máy chủ hoặc không thể lưu dữ liệu vào SQL Server." });
});

async function migrateLegacyState() {
  const legacyTable = await dbPool.request().query("SELECT OBJECT_ID(N'dbo.StoreState', N'U') AS TableId");
  if (!legacyTable.recordset[0].TableId) return;

  const books = await dbPool.request().query("SELECT COUNT_BIG(*) AS Count FROM dbo.Books");
  if (Number(books.recordset[0].Count) > 0) return;

  const legacy = await dbPool.request().query("SELECT StateJson FROM dbo.StoreState WHERE StateId = 1");
  if (!legacy.recordset[0]) return;

  const state = normalizeState(JSON.parse(legacy.recordset[0].StateJson));
  await saveState(dbPool, state);
  console.log("Đã chuyển dữ liệu cũ từ dbo.StoreState sang các bảng quan hệ.");
}

async function start() {
  if (!integratedAuth && (!config.user || !config.password)) {
    throw new Error("Thiếu SQL_USER hoặc SQL_PASSWORD trong file .env.");
  }

  dbPool = await sql.connect(config);
  await dbPool.request().query(schemaSql);
  await migrateLegacyState();
  app.listen(port, "127.0.0.1", () => console.log(`SOWNMANGA đang chạy tại http://localhost:${port}`));
}

start().catch(error => {
  console.error("Không thể khởi động backend:", error.message);
  process.exitCode = 1;
});
