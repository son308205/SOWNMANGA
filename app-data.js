(function () {
  const renamedCustomers = {
    "Thanh Trúc": "Lê Bảo Linh",
    "Đức Minh": "Dương Tuấn Minh",
    "Phương Linh": "Đỗ Đức Anh"
  };

  const seedState = {
    books: [
      { code: "MT001", title: "Tiệm sách của nàng", author: "Yukiko Asano", price: 58000, stock: 18, icon: "📖", color: "sage", category: "Đời thường", sold: 126 },
      { code: "MT002", title: "Ngày nắng qua ô cửa", author: "Haru Tanaka", price: 65000, stock: 12, icon: "🌤️", color: "gold", category: "Lãng mạn", sold: 98 },
      { code: "MT003", title: "Lữ khách miền sao", author: "Minh Nhật", price: 72000, stock: 7, icon: "🚀", color: "blue", category: "Phiêu lưu", sold: 86 },
      { code: "MT004", title: "Khu vườn mùa hạ", author: "An Nhiên", price: 49000, stock: 22, icon: "🌿", color: "sage", category: "Đời thường", sold: 74 },
      { code: "MT005", title: "Mèo nhỏ, phố lớn", author: "Aki Mori", price: 54000, stock: 15, icon: "🐈", color: "plum", category: "Đời thường", sold: 68 },
      { code: "MT006", title: "Bí mật tiệm bánh", author: "Hana Sato", price: 62000, stock: 9, icon: "🍰", color: "gold", category: "Lãng mạn", sold: 59 },
      { code: "MT007", title: "Chuyến tàu lúc hoàng hôn", author: "Lê Lam", price: 68000, stock: 11, icon: "🚃", color: "blue", category: "Phiêu lưu", sold: 51 },
      { code: "MT008", title: "Những vì sao nhỏ", author: "Mika Hoshi", price: 45000, stock: 4, icon: "⭐", color: "plum", category: "Thiếu nhi", sold: 44 }
    ],
    orders: [
      { code: "MT-24081", customer: "Lê Bảo Linh", items: 2, total: 123000, status: "Đã giao", createdAt: new Date(Date.now() - 86400000).toISOString(), lines: [{ bookCode: "MT001", title: "Tiệm sách của nàng", quantity: 1, unitPrice: 58000, lineTotal: 58000 }, { bookCode: "MT002", title: "Ngày nắng qua ô cửa", quantity: 1, unitPrice: 65000, lineTotal: 65000 }] },
      { code: "MT-24080", customer: "Dương Tuấn Minh", items: 1, total: 72000, status: "Chờ xử lý", createdAt: new Date(Date.now() - 3600000).toISOString(), lines: [{ bookCode: "MT003", title: "Lữ khách miền sao", quantity: 1, unitPrice: 72000, lineTotal: 72000 }] },
      { code: "MT-24079", customer: "Đỗ Đức Anh", items: 3, total: 171000, status: "Đã giao", createdAt: new Date(Date.now() - 172800000).toISOString(), lines: [{ bookCode: "MT004", title: "Khu vườn mùa hạ", quantity: 1, unitPrice: 49000, lineTotal: 49000 }, { bookCode: "MT005", title: "Mèo nhỏ, phố lớn", quantity: 1, unitPrice: 54000, lineTotal: 54000 }, { bookCode: "MT007", title: "Chuyến tàu lúc hoàng hôn", quantity: 1, unitPrice: 68000, lineTotal: 68000 }] }
    ],
    receipts: [],
    registeredAccounts: [
      { email: "son@mottruyen.vn", password: "admin123", name: "Trần Anh Sơn", role: "admin", label: "Quản trị viên" },
      { email: "quang@mottruyen.vn", password: "staff123", name: "Nguyễn Bá Quang", role: "staff", label: "Nhân viên" },
      { email: "khanh@mottruyen.vn", password: "staff123", name: "Nguyễn Nam Khánh", role: "staff", label: "Nhân viên" },
      { email: "an@mottruyen.vn", password: "staff123", name: "Nguyễn Trường An", role: "staff", label: "Nhân viên" },
      { email: "linh@mottruyen.vn", password: "khach123", name: "Lê Bảo Linh", role: "customer", label: "Khách hàng" },
      { email: "tuanminh@mottruyen.vn", password: "khach123", name: "Dương Tuấn Minh", role: "customer", label: "Khách hàng" },
      { email: "ducanh@mottruyen.vn", password: "khach123", name: "Đỗ Đức Anh", role: "customer", label: "Khách hàng" }
    ],
    suppliers: ["Nhà sách Phương Nam", "NXB Trẻ", "Công ty sách Kim Đồng"]
  };

  function normalizeState(data) {
    if (!data || !Array.isArray(data.books) || !Array.isArray(data.orders)) {
      throw new Error("Dữ liệu cửa hàng không đúng định dạng.");
    }
    data.books.forEach((book, index) => {
      if (!book.code) book.code = `MT${String(index + 1).padStart(3, "0")}`;
      if (!book.category) book.category = "Khác";
      if (!Number.isInteger(book.sold)) book.sold = 0;
    });
    data.orders.forEach(order => {
      if (!order.createdAt) order.createdAt = new Date().toISOString();
      if (!Array.isArray(order.lines)) order.lines = [];
      if (renamedCustomers[order.customer]) order.customer = renamedCustomers[order.customer];
    });
    if (!Array.isArray(data.receipts)) data.receipts = [];
    if (!Array.isArray(data.registeredAccounts)) data.registeredAccounts = [];
    const accountsByEmail = new Map(data.registeredAccounts.map(account => [account.email.toLowerCase(), account]));
    seedState.registeredAccounts.forEach(account => {
      if (!accountsByEmail.has(account.email)) accountsByEmail.set(account.email, account);
    });
    data.registeredAccounts = [...accountsByEmail.values()];
    if (!Array.isArray(data.suppliers)) data.suppliers = seedState.suppliers.slice();
    return data;
  }

  async function requestState(method, data) {
    const response = await fetch("/api/state", {
      method,
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không thể kết nối cơ sở dữ liệu.");
    return result;
  }

  let state = null;
  let saveQueue = Promise.resolve();
  window.StoreData = Object.freeze({
    getState: () => state,
    initialize: async () => {
      const result = await requestState("GET");
      if (result.state) {
        state = normalizeState(result.state);
        return state;
      }

      state = normalizeState(JSON.parse(JSON.stringify(seedState)));
      const initialized = await requestState("PUT", state);
      state = normalizeState(initialized.state);
      return state;
    },
    saveState: nextState => {
      state = normalizeState(nextState);
      const snapshot = JSON.parse(JSON.stringify(state));
      saveQueue = saveQueue.catch(() => {}).then(async () => {
        await requestState("PUT", snapshot);
      }).catch(error => {
        console.error("Không thể lưu dữ liệu cửa hàng vào SQL Server.", error);
        window.dispatchEvent(new CustomEvent("store:persistence-error", {
          detail: error.message || "Không thể lưu dữ liệu vào SQL Server."
        }));
      });
      return state;
    }
  });
})();
