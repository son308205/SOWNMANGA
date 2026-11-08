(async function () {
  try {
    await StoreData.initialize();
  } catch (error) {
    console.error("Không thể tải dữ liệu cửa hàng từ SQL Server.", error);
    document.getElementById("content").innerHTML =
      `<div class="page-heading"><div><h1>Không thể kết nối cơ sở dữ liệu</h1><p class="subtitle">${String(error.message || "Hãy kiểm tra backend và cấu hình SQL Server.").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])}</p></div></div>`;
    return;
  }

  const content = document.getElementById("content");
  const loginModal = document.getElementById("login-modal");
  const registerModal = document.getElementById("register-modal");
  const bookModal = document.getElementById("book-modal");
  const cart = new Map();
  let session = null;
  let currentView = "catalog";
  let searchTerm = "";
  let toastTimer;

  const pageNames = {
    dashboard: "Tổng quan",
    catalog: "Kho truyện",
    orders: "Đơn hàng",
    cart: "Giỏ hàng",
    inventory: "Nhập kho",
    reports: "Báo cáo",
    employees: "Nhân viên",
    customers: "Khách hàng"
  };

  function money(value) {
    return new Intl.NumberFormat("vi-VN").format(value) + "đ";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function notify(message, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.style.background = isError ? "#9c4038" : "";
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
  }

  window.addEventListener("store:persistence-error", event => {
    notify(event.detail || "Không thể lưu dữ liệu vào SQL Server.", true);
  });

  function run(action) {
    try {
      action();
    } catch (error) {
      console.error("Thao tác cửa hàng thất bại.", error);
      notify(error.message || "Đã xảy ra lỗi. Vui lòng thử lại.", true);
    }
  }

  function state() {
    return StoreBusiness.getState();
  }

  function navigate(view) {
    if (!pageNames[view]) return;
    if (!session && !["catalog", "cart"].includes(view)) {
      view = "catalog";
      notify("Đăng nhập để sử dụng chức năng này.", true);
    }
    if (["inventory", "reports", "customers"].includes(view) && (!session || session.role === "customer")) {
      view = "catalog";
      notify("Tài khoản của bạn không có quyền truy cập mục này.", true);
    }
    if (view === "employees" && (!session || session.role !== "admin")) {
      view = "catalog";
      notify("Chỉ quản trị viên được xem danh sách nhân viên.", true);
    }
    currentView = view;
    document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === view));
    document.getElementById("breadcrumb-title").textContent = pageNames[view];
    document.getElementById("sidebar").classList.remove("open");
    render();
  }

  function pageHeader(eyebrow, title, description, action = "") {
    return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
  }

  function metric(label, value, foot, icon) {
    return `<article class="metric-card"><div class="metric-top">${label}<span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`;
  }

  function render() {
    const data = state();
    document.getElementById("breadcrumb-title").textContent = pageNames[currentView];
    document.querySelectorAll(".auth-only").forEach(link => link.classList.toggle("hidden", !session));
    document.querySelectorAll(".admin-only").forEach(link => link.classList.toggle("hidden", !session || session.role !== "admin"));
    document.querySelectorAll(".staff-only:not(.admin-only)").forEach(link => link.classList.toggle("hidden", !session || session.role === "customer"));
    document.querySelector(".profile").classList.toggle("hidden", !session);
    document.getElementById("auth-toggle").textContent = session ? "Đăng xuất" : "Đăng nhập";
    if (session) {
      document.getElementById("profile-name").textContent = session.name;
      document.getElementById("profile-role").textContent = session.label;
      document.getElementById("profile-avatar").textContent = session.name.charAt(0);
    }
    document.getElementById("nav-book-count").textContent = String(data.books.length).padStart(2, "0");
    document.getElementById("nav-order-count").textContent = String(data.orders.length);
    document.getElementById("nav-cart-count").textContent = String([...cart.values()].reduce((sum, quantity) => sum + quantity, 0));
    const page = {
      dashboard: renderDashboard,
      catalog: renderCatalog,
      orders: renderOrders,
      cart: renderCart,
      inventory: renderInventory,
      reports: renderReports,
      employees: renderEmployees,
      customers: renderCustomers
    }[currentView];
    page();
  }

  function renderDashboard() {
    const data = state();
    const customer = session.role === "customer";
    const totalStock = data.books.reduce((sum, book) => sum + book.stock, 0);
    const pending = data.orders.filter(order => order.status === "Chờ xử lý").length;
    const revenue = data.orders.reduce((sum, order) => sum + order.total, 0);
    const action = customer
      ? '<button class="primary-button" data-navigate="catalog"><span>＋</span> Khám phá truyện</button>'
      : session.role === "admin"
        ? '<button class="primary-button" data-action="add-book"><span>＋</span> Thêm truyện mới</button>'
        : '<button class="primary-button" data-navigate="orders"><span>→</span> Xử lý đơn hàng</button>';
    content.innerHTML = `${pageHeader(customer ? "Chào mừng bạn ghé chơi" : "SOWNMANGA · Quản lý cửa hàng", `Xin chào, ${escapeHtml(session.name.split(" ").pop())} 👋`, customer ? "Chọn một câu chuyện hay và dành chút thời gian cho riêng mình nhé." : "Nắm bắt tình hình cửa hàng và xử lý công việc hôm nay.", action)}
      <section class="welcome-banner"><div class="welcome-copy"><p class="eyebrow">${customer ? "MỘT GÓC NHỎ CỦA BẠN" : "SOWNMANGA · BẢN TIN CỬA HÀNG"}</p><h2>${customer ? "Thế giới truyện hay đang chờ bạn" : "Chuyện hay mỗi ngày, niềm vui ở lại"}</h2><p>${customer ? "Khám phá tuyển tập truyện tranh và manga được chọn lọc dành riêng cho những tâm hồn mê đọc." : `Cửa hàng có ${data.books.length} đầu truyện và ${totalStock} cuốn sẵn sàng phục vụ độc giả.`}</p></div><div class="banner-art" aria-hidden="true"><div class="banner-book">🌿</div><div class="banner-book">🌙</div><div class="banner-book">🐈</div></div></section>
      <section class="metrics">${customer
        ? metric("Đầu truyện", data.books.length, "Đang mở bán", "▤") + metric("Đơn hàng của bạn", data.orders.filter(order => order.customer === session.name).length, "Đơn đã đặt", "▧") + metric("Tổng tồn kho", totalStock, "Cuốn có sẵn", "📚") + metric("Đơn từ 200.000đ", "0đ phí ship", "Ưu đãi giao hàng", "✦")
        : metric("Doanh thu tích lũy", money(revenue), `${data.orders.length} hóa đơn đã ghi nhận`, "↗") + metric("Đầu truyện trong kho", data.books.length, `${totalStock} cuốn sẵn sàng bán`, "▤") + metric("Đơn cần xử lý", pending, "Hóa đơn đang chờ", "▧") + metric("Truyện sắp hết", data.books.filter(book => book.stock <= 5).length, "Tồn kho còn 5 cuốn trở xuống", "⚠")}</section>
      <section class="dashboard-grid"><article class="panel"><div class="panel-heading"><div><h2>${customer ? "Truyện được yêu thích" : "Truyện bán chạy"}</h2><p>${customer ? "Những câu chuyện được độc giả yêu thích" : "Xếp theo số lượng bán ra"}</p></div><button class="text-button" data-navigate="catalog">Xem kho →</button></div>${bookList(data.books)}</article>
      <article class="panel"><div class="panel-heading"><div><h2>${customer ? "Đơn hàng gần đây" : "Hoạt động bán hàng"}</h2><p>Trạng thái hóa đơn mới nhất</p></div><button class="text-button" data-navigate="orders">Tất cả →</button></div>${orderTable(customer ? data.orders.filter(order => order.customer === session.name).slice(0, 4) : data.orders.slice(0, 4), false)}</article></section>
      <div class="layer-note"><strong>Mô hình 3 tầng:</strong> Giao diện trình bày nằm trong <code>app-presentation.js</code>; kiểm tra nghiệp vụ và xử lý giao dịch nằm trong <code>app-business.js</code>; đọc/ghi dữ liệu nằm trong <code>app-data.js</code>.</div>`;
    bindDataControls();
  }

  function bookList(books) {
    const popular = [...books].sort((a, b) => b.sold - a.sold).slice(0, 4);
    if (!popular.length) return '<div class="empty-state">Chưa có truyện trong cửa hàng.</div>';
    return `<div class="book-list">${popular.map(book => `<div class="book-row"><div class="book-cover ${escapeHtml(book.color)}">${escapeHtml(book.icon)}</div><div class="book-info"><div class="book-title">${escapeHtml(book.title)}</div><div class="book-author">${escapeHtml(book.author)}</div></div><div class="book-sales"><strong>${book.sold} cuốn</strong>đã bán</div></div>`).join("")}</div>`;
  }

  function orderTable(orders, withActions) {
    if (!orders.length) return '<div class="empty-state">Chưa có hóa đơn nào.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>NGƯỜI MUA</th><th>SẢN PHẨM</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th>${withActions ? "<th>THAO TÁC</th>" : ""}</tr></thead><tbody>${orders.map(order => `<tr><td>${escapeHtml(order.code)}</td><td>${escapeHtml(order.customer)}</td><td>${order.items} cuốn</td><td>${money(order.total)}</td><td><span class="status ${order.status === "Chờ xử lý" ? "pending" : ""}">${escapeHtml(order.status)}</span></td>${withActions ? `<td>${order.status === "Chờ xử lý" ? `<button class="text-button" data-complete-order="${escapeHtml(order.code)}">Đánh dấu đã giao</button>` : "—"}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
  }

  function renderCatalog() {
    const data = state();
    const admin = session?.role === "admin";
    const filtered = data.books.filter(book => `${book.code} ${book.title} ${book.author} ${book.category}`.toLocaleLowerCase("vi").includes(searchTerm.toLocaleLowerCase("vi")));
    const action = admin ? '<button class="primary-button" data-action="add-book"><span>＋</span> Thêm truyện mới</button>' : "";
    const title = !session || session.role === "customer" ? "Kho truyện dành cho bạn 📚" : "Quản lý kho truyện";
    content.innerHTML = `${pageHeader("Danh mục sản phẩm", title, `${data.books.length} đầu truyện · ${data.books.reduce((sum, book) => sum + book.stock, 0)} cuốn trong kho`, action)}
      ${!session || session.role === "customer" ? '<div class="role-note">✨ Tham quan kho truyện thoải mái. Đăng nhập để đặt mua và theo dõi đơn hàng.</div>' : ""}
      <div class="store-tools"><select class="filter-select" id="category-filter" aria-label="Lọc thể loại"><option value="">Tất cả thể loại</option>${[...new Set(data.books.map(book => book.category))].map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select><select class="filter-select" id="sort-filter" aria-label="Sắp xếp truyện"><option value="popular">Phổ biến nhất</option><option value="price-asc">Giá: thấp đến cao</option><option value="price-desc">Giá: cao đến thấp</option><option value="name">Tên A–Z</option></select><span style="margin-left:auto;align-self:center;color:var(--muted);font-size:10px" id="catalog-count">${filtered.length} truyện</span></div>
      <section class="catalog-grid" id="catalog-grid">${catalogCards(filtered)}</section>`;
    bindDataControls();
  }

  function catalogCards(books) {
    if (!books.length) return '<div class="empty-state" style="grid-column:1/-1">Không tìm thấy truyện phù hợp.</div>';
    return books.map(book => `<article class="catalog-card"><div class="catalog-cover ${escapeHtml(book.color)}"><span class="catalog-label">${escapeHtml(book.category)} · ${escapeHtml(book.code)}</span><div class="cover-book">${escapeHtml(book.icon)}</div></div><div class="catalog-details"><div class="catalog-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div><div class="catalog-author">${escapeHtml(book.author)}</div><div class="catalog-price"><strong>${money(book.price)}</strong><span class="stock-count ${book.stock <= 5 ? "stock-low" : ""}">${book.stock ? `Còn ${book.stock} cuốn` : "Tạm hết hàng"}</span></div>
      ${session?.role === "admin" ? `<div class="store-tools" style="margin:10px 0 0"><button class="catalog-action" data-edit-book="${escapeHtml(book.code)}">Sửa thông tin</button><button class="catalog-action" data-delete-book="${escapeHtml(book.code)}">Xóa truyện</button></div>` : `<button class="catalog-action" data-add-cart="${escapeHtml(book.code)}" ${book.stock < 1 ? "disabled" : ""}>${book.stock < 1 ? "Hết hàng" : "＋ Thêm vào giỏ hàng"}</button>`}</div></article>`).join("");
  }

  function applyCatalogFilters() {
    const data = state();
    const category = document.getElementById("category-filter").value;
    const sort = document.getElementById("sort-filter").value;
    const filtered = data.books.filter(book => (!category || book.category === category) && `${book.code} ${book.title} ${book.author} ${book.category}`.toLocaleLowerCase("vi").includes(searchTerm.toLocaleLowerCase("vi")));
    if (sort === "price-asc") filtered.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") filtered.sort((a, b) => b.price - a.price);
    if (sort === "name") filtered.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    if (sort === "popular") filtered.sort((a, b) => b.sold - a.sold);
    document.getElementById("catalog-grid").innerHTML = catalogCards(filtered);
    document.getElementById("catalog-count").textContent = `${filtered.length} truyện`;
  }

  function renderCart() {
    const data = state();
    const lines = [...cart.entries()].map(([bookCode, quantity]) => ({ book: data.books.find(item => item.code === bookCode), quantity })).filter(line => line.book);
    const total = lines.reduce((sum, line) => sum + line.book.price * line.quantity, 0);
    const rows = lines.length ? `<div class="table-wrap"><table><thead><tr><th>TRUYỆN</th><th>ĐƠN GIÁ</th><th>SỐ LƯỢNG</th><th>TẠM TÍNH</th><th></th></tr></thead><tbody>${lines.map(line => `<tr><td>${escapeHtml(line.book.title)}<br><small>${escapeHtml(line.book.code)} · Còn ${line.book.stock} cuốn</small></td><td>${money(line.book.price)}</td><td><span class="quantity-control"><button data-cart-change="${escapeHtml(line.book.code)}" data-delta="-1" aria-label="Giảm">−</button><strong>${line.quantity}</strong><button data-cart-change="${escapeHtml(line.book.code)}" data-delta="1" aria-label="Tăng">+</button></span></td><td>${money(line.book.price * line.quantity)}</td><td><button class="table-action danger" data-cart-remove="${escapeHtml(line.book.code)}">Bỏ</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state">Giỏ hàng đang trống. Hãy chọn truyện trong kho nhé!</div>';
    content.innerHTML = `${pageHeader("Bán hàng", "Giỏ hàng & thanh toán", "Kiểm tra số lượng, tồn kho và xác nhận hóa đơn trong cùng một giao dịch.", '<button class="secondary-button" data-navigate="catalog">← Chọn truyện</button>')}
      <section class="cart-layout"><article class="panel"><div class="panel-heading"><div><h2>Sản phẩm đã chọn</h2><p>Tồn kho được kiểm tra lại tại thời điểm thanh toán</p></div></div>${rows}</article>
      <article class="panel"><div class="panel-heading"><div><h2>${session ? "Thông tin thanh toán" : "Đăng nhập để mua hàng"}</h2><p>${session ? "Hóa đơn sẽ lưu kèm từng sản phẩm" : "Bạn có thể xem truyện mà không cần tài khoản."}</p></div></div>${session ? `<label class="field-label" for="checkout-customer">Tên khách hàng</label><input class="field" id="checkout-customer" list="checkout-customer-list" value="${escapeHtml(session.role === "customer" ? session.name : "")}" ${session.role === "customer" ? "readonly" : ""} placeholder="Nhập tên khách hàng"><datalist id="checkout-customer-list">${StoreBusiness.getAccounts("customer").map(customer => `<option value="${escapeHtml(customer.name)}">`).join("")}</datalist>` : '<p class="subtitle">Đăng nhập bằng tài khoản khách hàng để xác nhận đơn mua.</p>'}<div class="cart-total"><span>Tạm tính</span><strong>${money(total)}</strong></div><div class="cart-total"><span>Giảm giá</span><strong>0đ</strong></div><div class="cart-total grand"><span>Tổng thanh toán</span><strong>${money(total)}</strong></div><button class="primary-button" data-action="${session ? "checkout" : "login"}" style="width:100%;margin-top:12px" ${!lines.length ? "disabled" : ""}>${session ? "Xác nhận thanh toán" : "Đăng nhập để thanh toán"}</button></article></section>`;
  }

  function renderOrders() {
    const data = state();
    const visible = session.role === "customer" ? data.orders.filter(order => order.customer === session.name) : data.orders;
    content.innerHTML = `${pageHeader(session.role === "customer" ? "Theo dõi hành trình sách" : "Hoạt động bán hàng", session.role === "customer" ? "Đơn hàng của bạn" : "Quản lý hóa đơn", `${visible.length} hóa đơn`, session.role === "customer" ? "" : '<button class="secondary-button" data-action="export-orders">↓ Xuất danh sách</button>')}
      ${session.role === "customer" ? '<div class="role-note">🚚 Trạng thái đơn hàng sẽ được cập nhật tại đây.</div>' : ""}
      <article class="panel"><div class="panel-heading"><div><h2>${session.role === "customer" ? "Lịch sử mua hàng" : "Danh sách hóa đơn"}</h2><p>Hóa đơn và chi tiết giao dịch được lưu sau khi thanh toán thành công</p></div></div>${orderTable(visible, session.role !== "customer")}</article>`;
  }

  function renderInventory() {
    const data = state();
    const options = data.books.map(book => `<option value="${escapeHtml(book.code)}">${escapeHtml(book.code)} · ${escapeHtml(book.title)} (tồn ${book.stock})</option>`).join("");
    const supplierOptions = data.suppliers.map(supplier => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join("");
    content.innerHTML = `${pageHeader("Quản lý kho", "Nhập kho", "Lập phiếu nhập, kiểm tra dữ liệu và cộng tồn kho cùng một giao dịch.")}
      <article class="panel"><div class="panel-heading"><div><h2>Tạo phiếu nhập hàng</h2><p>Số lượng phải là số nguyên dương; đơn giá nhập không âm</p></div></div>
      <form id="receipt-form"><div class="inline-form"><div><label class="field-label" for="receipt-supplier">Nhà cung cấp</label><input class="field" id="receipt-supplier" list="supplier-list" required placeholder="Tên nhà cung cấp"><datalist id="supplier-list">${supplierOptions}</datalist></div><div><label class="field-label" for="receipt-book">Truyện</label><select class="field" id="receipt-book" required>${options}</select></div><div><label class="field-label" for="receipt-quantity">Số lượng nhập</label><input class="field" id="receipt-quantity" type="number" min="1" step="1" required value="10"></div><div><label class="field-label" for="receipt-cost">Đơn giá nhập (đ)</label><input class="field" id="receipt-cost" type="number" min="0" step="1000" required value="30000"></div><button class="primary-button" type="submit">Lưu phiếu nhập</button></div></form></article>
      <article class="panel" style="margin-top:18px"><div class="panel-heading"><div><h2>Tồn kho hiện tại</h2><p>Truyện có tồn kho thấp được đánh dấu cảnh báo</p></div></div><div class="table-wrap"><table><thead><tr><th>MÃ TRUYỆN</th><th>TÊN TRUYỆN</th><th>NHÀ XUẤT BẢN / THỂ LOẠI</th><th>TỒN KHO</th><th>GIÁ BÁN</th></tr></thead><tbody>${data.books.map(book => `<tr><td>${escapeHtml(book.code)}</td><td>${escapeHtml(book.title)}</td><td>${escapeHtml(book.category)}</td><td class="${book.stock <= 5 ? "stock-low" : ""}">${book.stock} cuốn ${book.stock <= 5 ? "· Sắp hết" : ""}</td><td>${money(book.price)}</td></tr>`).join("")}</tbody></table></div></article>
      <article class="panel" style="margin-top:18px"><div class="panel-heading"><div><h2>Lịch sử phiếu nhập</h2><p>${data.receipts.length} phiếu nhập đã lưu</p></div></div>${data.receipts.length ? `<div class="table-wrap"><table><thead><tr><th>MÃ PHIẾU</th><th>NHÀ CUNG CẤP</th><th>NHÂN VIÊN</th><th>NGÀY NHẬP</th><th>TỔNG TIỀN</th></tr></thead><tbody>${data.receipts.map(receipt => `<tr><td>${escapeHtml(receipt.code)}</td><td>${escapeHtml(receipt.supplier)}</td><td>${escapeHtml(receipt.employee)}</td><td>${new Date(receipt.createdAt).toLocaleDateString("vi-VN")}</td><td>${money(receipt.total)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state">Chưa có phiếu nhập nào.</div>'}</article>`;
    bindDataControls();
  }

  function renderReports() {
    const period = document.getElementById("report-period")?.value || "month";
    const report = StoreBusiness.getReport(period);
    const max = Math.max(1, ...report.bestsellers.map(book => book.periodSold));
    content.innerHTML = `${pageHeader("Thống kê cửa hàng", "Báo cáo doanh thu & tồn kho", "Theo dõi doanh thu, truyện bán chạy và các mặt hàng cần nhập thêm.", '<button class="secondary-button" data-action="export-report">↓ Xuất báo cáo</button>')}
      <div class="store-tools"><label class="field-label" for="report-period" style="margin:0;align-self:center">Thời gian</label><select class="filter-select" id="report-period"><option value="day" ${period === "day" ? "selected" : ""}>Hôm nay</option><option value="month" ${period === "month" ? "selected" : ""}>Tháng này</option><option value="year" ${period === "year" ? "selected" : ""}>Năm nay</option><option value="all" ${period === "all" ? "selected" : ""}>Toàn thời gian</option></select></div>
      <section class="metrics">${metric("Doanh thu", money(report.revenue), `${report.orders.length} hóa đơn trong kỳ`, "↗")}${metric("Số truyện đã bán", report.sold, "Theo chi tiết hóa đơn", "▤")}${metric("Tổng tồn kho", report.totalStock, `${state().books.length} đầu truyện`, "📦")}${metric("Sắp hết hàng", report.lowStock.length, "Tồn kho 5 cuốn trở xuống", "⚠")}</section>
      <section class="dashboard-grid"><article class="panel"><div class="panel-heading"><div><h2>Truyện bán chạy trong kỳ</h2><p>Số lượng lấy từ chi tiết hóa đơn</p></div></div><div class="report-bars">${report.bestsellers.map(book => `<div class="report-bar"><span>${escapeHtml(book.title)}</span><div class="report-track"><div class="report-fill" style="width:${book.periodSold / max * 100}%"></div></div><strong>${book.periodSold} cuốn</strong></div>`).join("")}</div></article>
      <article class="panel"><div class="panel-heading"><div><h2>Danh sách cần nhập</h2><p>Ngưỡng cảnh báo: còn tối đa 5 cuốn</p></div></div>${report.lowStock.length ? `<div class="book-list">${report.lowStock.map(book => `<div class="book-row"><div class="book-cover ${escapeHtml(book.color)}">${escapeHtml(book.icon)}</div><div class="book-info"><div class="book-title">${escapeHtml(book.title)}</div><div class="book-author">${escapeHtml(book.code)}</div></div><strong class="stock-low">${book.stock} cuốn</strong></div>`).join("")}</div>` : '<div class="empty-state">Kho hiện không có truyện sắp hết.</div>'}</article></section>
      <div class="layer-note">Lưu ý: báo cáo doanh thu không phải lợi nhuận. Hệ thống cần thêm dữ liệu giá vốn để tính lợi nhuận chính xác.</div>`;
    bindDataControls();
  }

  function renderCustomers() {
    const data = state();
    const customers = StoreBusiness.getAccounts("customer");
    const rows = customers.map(customer => {
      const orders = data.orders.filter(order => order.customer === customer.name);
      return `<tr><td>${escapeHtml(customer.name)}</td><td>${escapeHtml(customer.email)}</td><td>${orders.length} đơn</td><td>${money(orders.reduce((sum, order) => sum + order.total, 0))}</td><td>${orders.reduce((sum, order) => sum + order.items, 0)} cuốn</td></tr>`;
    }).join("");
    content.innerHTML = `${pageHeader("Cộng đồng yêu truyện", "Khách hàng", "Danh sách khách hàng và thống kê theo lịch sử hóa đơn.")}
      <article class="panel"><div class="panel-heading"><div><h2>Danh sách khách hàng</h2><p>${customers.length} khách hàng</p></div></div>${rows ? `<div class="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>EMAIL</th><th>SỐ HÓA ĐƠN</th><th>TỔNG CHI TIÊU</th><th>SỐ TRUYỆN ĐÃ MUA</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">Chưa có dữ liệu khách hàng.</div>'}</article>`;
  }

  function renderEmployees() {
    const employees = StoreBusiness.getAccounts("staff");
    const rows = employees.map(employee => `<tr><td>${escapeHtml(employee.name)}</td><td>${escapeHtml(employee.email)}</td><td><span class="status">Đang hoạt động</span></td></tr>`).join("");
    content.innerHTML = `${pageHeader("Quản lý tài khoản", "Nhân viên", "Danh sách nhân viên được cấp quyền sử dụng hệ thống.")}
      <article class="panel"><div class="panel-heading"><div><h2>Danh sách nhân viên</h2><p>${employees.length} tài khoản nhân viên</p></div></div><div class="table-wrap"><table><thead><tr><th>HỌ VÀ TÊN</th><th>EMAIL ĐĂNG NHẬP</th><th>TRẠNG THÁI</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  }

  function bindDataControls() {
    const category = document.getElementById("category-filter");
    const sort = document.getElementById("sort-filter");
    if (category) category.addEventListener("change", applyCatalogFilters);
    if (sort) sort.addEventListener("change", applyCatalogFilters);
    const receiptForm = document.getElementById("receipt-form");
    if (receiptForm) receiptForm.addEventListener("submit", event => {
      event.preventDefault();
      run(() => {
        const receipt = StoreBusiness.receiveStock(session, document.getElementById("receipt-supplier").value, [{
          bookCode: document.getElementById("receipt-book").value,
          quantity: document.getElementById("receipt-quantity").value,
          unitCost: document.getElementById("receipt-cost").value
        }]);
        notify(`Đã lưu phiếu ${receipt.code} và cập nhật tồn kho.`);
        render();
      });
    });
    const period = document.getElementById("report-period");
    if (period) period.addEventListener("change", renderReports);
  }

  function openBookForm(code = "") {
    const book = code ? state().books.find(item => item.code === code) : null;
    document.getElementById("edit-book-code").value = book ? book.code : "";
    document.getElementById("book-modal-title").textContent = book ? "Cập nhật truyện" : "Thêm truyện mới";
    document.getElementById("save-book-button").textContent = book ? "Lưu thay đổi" : "Thêm vào kho";
    document.getElementById("new-title").value = book ? book.title : "";
    document.getElementById("new-author").value = book ? book.author : "";
    document.getElementById("new-category").value = book ? book.category : "";
    document.getElementById("new-price").value = book ? book.price : "";
    document.getElementById("new-stock").value = book ? book.stock : "";
    bookModal.classList.remove("hidden");
  }

  function exportCsv(filename, rows) {
    const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    notify("Đã xuất tệp CSV.");
  }

  document.getElementById("navigation").addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (button && !button.classList.contains("hidden")) navigate(button.dataset.view);
  });
  document.getElementById("content").addEventListener("click", event => {
    const target = event.target.closest("[data-navigate], [data-action], [data-add-cart], [data-cart-change], [data-cart-remove], [data-edit-book], [data-delete-book], [data-complete-order]");
    if (!target) return;
    if (target.dataset.navigate) navigate(target.dataset.navigate);
    if (target.dataset.action === "add-book") openBookForm();
    if (target.dataset.action === "login") document.getElementById("auth-toggle").click();
    if (target.dataset.action === "checkout") run(() => {
      if (!window.confirm("Xác nhận thanh toán và lưu hóa đơn?")) return;
      const order = StoreBusiness.createOrder(session, document.getElementById("checkout-customer").value, [...cart.entries()].map(([bookCode, quantity]) => ({ bookCode, quantity })));
      cart.clear();
      notify(`Đã lưu hóa đơn ${order.code} và cập nhật tồn kho.`);
      navigate("orders");
    });
    if (target.dataset.action === "export-orders") {
      const rows = [["Mã đơn", "Người mua", "Số sản phẩm", "Tổng tiền", "Trạng thái"], ...state().orders.map(order => [order.code, order.customer, order.items, order.total, order.status])];
      exportCsv("don-hang-mot-truyen.csv", rows);
    }
    if (target.dataset.action === "export-report") {
      const report = StoreBusiness.getReport(document.getElementById("report-period").value);
      const rows = [["Mã đơn", "Ngày", "Khách hàng", "Số truyện", "Doanh thu"], ...report.orders.map(order => [order.code, new Date(order.createdAt).toLocaleDateString("vi-VN"), order.customer, order.items, order.total])];
      exportCsv("bao-cao-mot-truyen.csv", rows);
    }
    if (target.dataset.addCart) {
      const book = state().books.find(item => item.code === target.dataset.addCart);
      const quantity = cart.get(target.dataset.addCart) || 0;
      if (!book || quantity >= book.stock) notify("Số lượng trong giỏ đã vượt tồn kho.", true);
      else {
        cart.set(target.dataset.addCart, quantity + 1);
        notify(`Đã thêm "${book.title}" vào giỏ.`);
        render();
      }
    }
    if (target.dataset.cartChange) {
      const quantity = (cart.get(target.dataset.cartChange) || 0) + Number(target.dataset.delta);
      if (quantity < 1) cart.delete(target.dataset.cartChange);
      else cart.set(target.dataset.cartChange, quantity);
      render();
    }
    if (target.dataset.cartRemove) {
      cart.delete(target.dataset.cartRemove);
      render();
    }
    if (target.dataset.editBook) openBookForm(target.dataset.editBook);
    if (target.dataset.deleteBook) run(() => {
      const book = state().books.find(item => item.code === target.dataset.deleteBook);
      if (book && window.confirm(`Xóa "${book.title}" khỏi danh mục?`)) {
        StoreBusiness.deleteBook(session, book.code);
        notify("Đã xóa truyện khỏi danh mục.");
        render();
      }
    });
    if (target.dataset.completeOrder) run(() => {
      StoreBusiness.completeOrder(session, target.dataset.completeOrder);
      notify("Đã cập nhật trạng thái hóa đơn.");
      render();
    });
  });
  document.getElementById("auth-toggle").addEventListener("click", () => {
    if (session) {
      session = null;
      currentView = "catalog";
      document.getElementById("breadcrumb-title").textContent = pageNames.catalog;
      document.getElementById("login-error").classList.add("hidden");
      render();
      notify("Bạn đã đăng xuất.");
      return;
    }
    document.getElementById("login-error").classList.add("hidden");
    loginModal.classList.remove("hidden");
  });
  document.getElementById("continue-guest").addEventListener("click", () => loginModal.classList.add("hidden"));
  document.getElementById("open-register").addEventListener("click", () => {
    document.getElementById("register-error").classList.add("hidden");
    loginModal.classList.add("hidden");
    registerModal.classList.remove("hidden");
  });
  document.getElementById("back-to-login").addEventListener("click", () => {
    registerModal.classList.add("hidden");
    loginModal.classList.remove("hidden");
  });
  document.getElementById("register-form").addEventListener("submit", event => {
    event.preventDefault();
    const error = document.getElementById("register-error");
    const password = document.getElementById("register-password").value;
    if (password !== document.getElementById("register-password-confirm").value) {
      error.textContent = "Mật khẩu nhập lại không khớp.";
      error.classList.remove("hidden");
      return;
    }
    try {
      session = StoreBusiness.registerCustomer(
        document.getElementById("register-name").value,
        document.getElementById("register-email").value,
        password
      );
      currentView = "catalog";
      registerModal.classList.add("hidden");
      event.target.reset();
      render();
      notify("Đăng ký thành công. Chào mừng bạn đến với SOWNMANGA!");
    } catch (registrationError) {
      error.textContent = registrationError.message || "Không thể tạo tài khoản. Vui lòng thử lại.";
      error.classList.remove("hidden");
    }
  });
  loginModal.addEventListener("click", event => {
    if (event.target === loginModal) loginModal.classList.add("hidden");
  });
  registerModal.addEventListener("click", event => {
    if (event.target === registerModal) registerModal.classList.add("hidden");
  });
  document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("notification-button").addEventListener("click", () => {
    const low = state().books.filter(book => book.stock <= 5).length;
    notify(low ? `Có ${low} đầu truyện sắp hết hàng.` : "Bạn đã cập nhật tin mới nhất rồi đó!");
  });
  document.getElementById("search-input").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    if (currentView !== "catalog" && searchTerm) navigate("catalog");
    else if (currentView === "catalog") applyCatalogFilters();
  });
  const demoAccounts = StoreBusiness.getAccounts().filter(account => account.role !== "admin")
    .reduce((accounts, account) => {
      const existing = accounts.find(group => group.role === account.role);
      if (existing) existing.accounts.push(account);
      else accounts.push({ role: account.role, label: account.label, accounts: [account] });
      return accounts;
    }, [{ role: "admin", label: "Quản trị viên", accounts: StoreBusiness.getAccounts("admin") }]);
  document.getElementById("demo-account-list").innerHTML = demoAccounts.map(group =>
    `<div class="demo-title">${escapeHtml(group.label)}</div>${group.accounts.map(account =>
      `<button class="demo-account" type="button" data-demo-email="${escapeHtml(account.email)}"><strong>${escapeHtml(account.name)}</strong><span>${escapeHtml(account.email)}</span></button>`
    ).join("")}`
  ).join("");
  document.getElementById("demo-account-list").addEventListener("click", event => {
    const button = event.target.closest("[data-demo-email]");
    if (!button) return;
    const email = button.dataset.demoEmail;
    document.getElementById("email").value = email;
    document.getElementById("password").value = StoreBusiness.getDemoPassword(email);
    document.getElementById("login-error").classList.add("hidden");
  });
  document.getElementById("login-form").addEventListener("submit", event => {
    event.preventDefault();
    const error = document.getElementById("login-error");
    try {
      const account = StoreBusiness.login(document.getElementById("email").value, document.getElementById("password").value);
      session = account;
      currentView = "dashboard";
      loginModal.classList.add("hidden");
      render();
    } catch (loginError) {
      error.textContent = loginError.message || "Email hoặc mật khẩu chưa chính xác.";
      error.classList.remove("hidden");
    }
  });
  document.getElementById("book-form").addEventListener("submit", event => {
    event.preventDefault();
    run(() => {
      const input = {
        title: document.getElementById("new-title").value,
        author: document.getElementById("new-author").value,
        category: document.getElementById("new-category").value,
        price: document.getElementById("new-price").value,
        stock: document.getElementById("new-stock").value
      };
      const code = document.getElementById("edit-book-code").value;
      if (code) StoreBusiness.editBook(session, code, input);
      else StoreBusiness.addBook(session, input);
      bookModal.classList.add("hidden");
      event.target.reset();
      notify(code ? "Đã cập nhật thông tin truyện." : "Đã thêm truyện mới vào kho.");
      render();
    });
  });
  document.querySelectorAll("[data-close-book]").forEach(button => button.addEventListener("click", () => bookModal.classList.add("hidden")));
  bookModal.addEventListener("click", event => { if (event.target === bookModal) bookModal.classList.add("hidden"); });
  document.querySelectorAll(".help-card [data-view-link]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.viewLink)));
  render();
})();
