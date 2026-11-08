(function () {
  function state() {
    return StoreData.getState();
  }

  const demoPasswords = new Map([
    ["son@mottruyen.vn", "admin123"],
    ["quang@mottruyen.vn", "staff123"],
    ["khanh@mottruyen.vn", "staff123"],
    ["an@mottruyen.vn", "staff123"],
    ["linh@mottruyen.vn", "khach123"],
    ["tuanminh@mottruyen.vn", "khach123"],
    ["ducanh@mottruyen.vn", "khach123"]
  ]);

  function nextCode(prefix, records) {
    let suffix = Date.now();
    let code = `${prefix}${String(suffix).slice(-8)}`;
    while (records.some(record => record.code === code)) {
      suffix += 1;
      code = `${prefix}${String(suffix).slice(-8)}`;
    }
    return code;
  }

  function requireRole(session, roles) {
    if (!session || !roles.includes(session.role)) throw new Error("Bạn không có quyền thực hiện thao tác này.");
  }

  function validPositiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw new Error(`${label} phải là số nguyên dương.`);
    return number;
  }

  function validateBook(input, books, existingCode) {
    const title = String(input.title || "").trim();
    const author = String(input.author || "").trim();
    const category = String(input.category || "").trim();
    const price = Number(input.price);
    const stock = Number(input.stock);
    if (!title || !author || !category) throw new Error("Tên truyện, tác giả và thể loại là bắt buộc.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Giá bán phải là số không âm.");
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Tồn kho phải là số nguyên không âm.");
    if (books.some(book => book.code !== existingCode && book.title.toLocaleLowerCase("vi") === title.toLocaleLowerCase("vi"))) {
      throw new Error("Tên truyện đã tồn tại trong danh mục.");
    }
    return { title, author, category, price, stock };
  }

  function login(email, password) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const account = state().registeredAccounts.find(account =>
      account.email === normalizedEmail && account.password === password
    );
    if (!account) throw new Error("Email hoặc mật khẩu chưa chính xác.");
    return { email: account.email, name: account.name, role: account.role, label: account.label };
  }

  function getAccounts(role) {
    return state().registeredAccounts.filter(account => !role || account.role === role)
      .map(({ email, name, role: accountRole, label }) => ({ email, name, role: accountRole, label }));
  }

  function getDemoPassword(email) {
    return demoPasswords.get(email) || "";
  }

  function registerCustomer(name, email, password) {
    const customerName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const accountPassword = String(password || "");
    if (customerName.length < 2) throw new Error("Họ và tên cần có ít nhất 2 ký tự.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Vui lòng nhập địa chỉ email hợp lệ.");
    if (accountPassword.length < 6) throw new Error("Mật khẩu cần có ít nhất 6 ký tự.");
    if (state().registeredAccounts.some(account => account.email.toLowerCase() === normalizedEmail)) {
      throw new Error("Email này đã được đăng ký.");
    }
    const data = state();
    const account = { email: normalizedEmail, password: accountPassword, name: customerName, role: "customer", label: "Khách hàng" };
    data.registeredAccounts.push(account);
    StoreData.saveState(data);
    return { email: account.email, name: account.name, role: account.role, label: account.label };
  }

  function addBook(session, input) {
    requireRole(session, ["admin"]);
    const data = state();
    const book = {
      ...validateBook(input, data.books),
      code: nextCode("MT", data.books),
      icon: "📚",
      color: ["sage", "gold", "blue", "plum"][data.books.length % 4],
      sold: 0
    };
    data.books.unshift(book);
    StoreData.saveState(data);
    return book;
  }

  function editBook(session, code, input) {
    requireRole(session, ["admin"]);
    const data = state();
    const book = data.books.find(item => item.code === code);
    if (!book) throw new Error("Không tìm thấy truyện cần cập nhật.");
    Object.assign(book, validateBook(input, data.books, code));
    StoreData.saveState(data);
    return book;
  }

  function deleteBook(session, code) {
    requireRole(session, ["admin"]);
    const data = state();
    if (!data.books.some(book => book.code === code)) throw new Error("Không tìm thấy truyện cần xóa.");
    if (data.orders.some(order => order.lines.some(line => line.bookCode === code)) ||
        data.receipts.some(receipt => receipt.lines.some(line => line.bookCode === code))) {
      throw new Error("Không thể xóa truyện đã phát sinh giao dịch.");
    }
    data.books = data.books.filter(book => book.code !== code);
    StoreData.saveState(data);
  }

  function createOrder(session, customerName, cart) {
    requireRole(session, ["admin", "staff", "customer"]);
    const data = state();
    const customers = getAccounts("customer");
    const customerAccount = session.role === "customer"
      ? customers.find(account => account.email === session.email)
      : customers.find(account => account.name.toLocaleLowerCase("vi") === String(customerName || "").trim().toLocaleLowerCase("vi"));
    if (!customerAccount) {
      throw new Error("Vui lòng chọn một khách hàng có tài khoản trong hệ thống.");
    }
    const customer = customerAccount.name;
    if (!Array.isArray(cart) || !cart.length) throw new Error("Giỏ hàng đang trống.");
    const quantities = new Map();
    cart.forEach(item => {
      const quantity = validPositiveInteger(item.quantity, "Số lượng");
      quantities.set(item.bookCode, (quantities.get(item.bookCode) || 0) + quantity);
    });
    const lines = [...quantities.entries()].map(([bookCode, quantity]) => {
      const book = data.books.find(entry => entry.code === bookCode);
      if (!book) throw new Error("Một truyện trong giỏ hàng không còn tồn tại.");
      if (book.stock < quantity) throw new Error(`"${book.title}" chỉ còn ${book.stock} cuốn trong kho.`);
      return { bookCode, title: book.title, quantity, unitPrice: book.price, lineTotal: book.price * quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Tổng thanh toán không hợp lệ.");
    const order = {
      code: nextCode("MT-", data.orders),
      customer,
      items: lines.reduce((sum, line) => sum + line.quantity, 0),
      total,
      status: "Chờ xử lý",
      createdAt: new Date().toISOString(),
      lines
    };
    lines.forEach(line => {
      const book = data.books.find(entry => entry.code === line.bookCode);
      book.stock -= line.quantity;
      book.sold += line.quantity;
    });
    data.orders.unshift(order);
    StoreData.saveState(data);
    return order;
  }

  function completeOrder(session, code) {
    requireRole(session, ["admin", "staff"]);
    const data = state();
    const order = data.orders.find(item => item.code === code);
    if (!order) throw new Error("Không tìm thấy hóa đơn.");
    if (order.status !== "Chờ xử lý") throw new Error("Hóa đơn này đã được xử lý.");
    order.status = "Đã giao";
    StoreData.saveState(data);
  }

  function receiveStock(session, supplier, items) {
    requireRole(session, ["admin", "staff"]);
    const data = state();
    const supplierName = String(supplier || "").trim();
    if (!supplierName) throw new Error("Vui lòng chọn nhà cung cấp.");
    if (!Array.isArray(items) || !items.length) throw new Error("Phiếu nhập cần có ít nhất một đầu truyện.");
    const lines = items.map(item => {
      const book = data.books.find(entry => entry.code === item.bookCode);
      if (!book) throw new Error("Không tìm thấy truyện trong phiếu nhập.");
      const quantity = validPositiveInteger(item.quantity, "Số lượng nhập");
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Đơn giá nhập phải là số không âm.");
      return { bookCode: book.code, title: book.title, quantity, unitCost, lineTotal: quantity * unitCost };
    });
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (!Number.isSafeInteger(total)) throw new Error("Tổng tiền phiếu nhập vượt giới hạn hợp lệ.");
    lines.forEach(line => {
      const book = data.books.find(entry => entry.code === line.bookCode);
      if (!Number.isSafeInteger(book.stock + line.quantity)) throw new Error("Số lượng tồn kho vượt giới hạn hợp lệ.");
    });
    const receipt = {
      code: nextCode("PN-", data.receipts),
      supplier: supplierName,
      employee: session.name,
      createdAt: new Date().toISOString(),
      total,
      lines
    };
    lines.forEach(line => {
      data.books.find(book => book.code === line.bookCode).stock += line.quantity;
    });
    data.receipts.unshift(receipt);
    if (!data.suppliers.includes(supplierName)) data.suppliers.push(supplierName);
    StoreData.saveState(data);
    return receipt;
  }

  function getReport(period) {
    const data = state();
    const now = new Date();
    const orders = data.orders.filter(order => {
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      if (period === "day") return date.toDateString() === now.toDateString();
      if (period === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      if (period === "year") return date.getFullYear() === now.getFullYear();
      return true;
    });
    const soldBooks = {};
    orders.forEach(order => order.lines.forEach(line => {
      soldBooks[line.bookCode] = (soldBooks[line.bookCode] || 0) + line.quantity;
    }));
    return {
      orders,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      sold: orders.reduce((sum, order) => sum + order.items, 0),
      lowStock: data.books.filter(book => book.stock <= 5),
      bestsellers: data.books.map(book => ({
        ...book,
        periodSold: period === "all" ? book.sold : soldBooks[book.code] || 0
      })).sort((a, b) => b.periodSold - a.periodSold).slice(0, 5),
      receipts: data.receipts,
      totalStock: data.books.reduce((sum, book) => sum + book.stock, 0)
    };
  }

  window.StoreBusiness = Object.freeze({
    login,
    registerCustomer,
    getAccounts,
    getDemoPassword,
    getState: state,
    addBook,
    editBook,
    deleteBook,
    createOrder,
    completeOrder,
    receiveStock,
    getReport
  });
})();
