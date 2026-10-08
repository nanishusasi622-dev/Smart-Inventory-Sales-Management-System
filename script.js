// ================= Data =================
const KEY = "smart_inventory_sales_v1";
const GST = 5; // percent
document.getElementById("gstRate").textContent = GST;

function seed() {
  return {
    products: [
      { id: 1, sku: "P001", name: "USB Cable", category: "Electronics", cost: 100, price: 150, qty: 40, reorder: 10 },
      { id: 2, sku: "P002", name: "Notebook", category: "Stationery", cost: 30, price: 45, qty: 4, reorder: 10 },
      { id: 3, sku: "P003", name: "Wireless Mouse", category: "Electronics", cost: 350, price: 499, qty: 12, reorder: 5 },
      { id: 4, sku: "P004", name: "Pen Pack", category: "Stationery", cost: 40, price: 60, qty: 30, reorder: 8 }
    ],
    customers: [{ id: 1, name: "Walk-in Customer", phone: "-" }],
    sales: [],
    nextId: 10,
    nextInvoice: 1001
  };
}
let db = JSON.parse(localStorage.getItem(KEY) || "null") || seed();
let cart = [];
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n).toFixed(2);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const empty = (cols, msg) => `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`;
const custName = id => (db.customers.find(c => c.id === id) || {}).name || "Walk-in Customer";

// ================= Tabs =================
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  b.classList.add("active");
  $(b.dataset.tab).classList.add("active");
  render();
}));

// ================= Render =================
function render() {
  renderDashboard(); renderInventory(); renderSaleForm(); renderCart();
  renderHistory(); renderCustomers(); renderReports();
}

function renderDashboard() {
  const revenue = db.sales.reduce((a, s) => a + s.total, 0);
  const profit = db.sales.reduce((a, s) => a + s.profit, 0);
  const low = db.products.filter(p => p.qty <= p.reorder);
  $("stRevenue").textContent = money(revenue);
  $("stProfit").textContent = money(profit);
  $("stSales").textContent = db.sales.length;
  $("stStockValue").textContent = money(db.products.reduce((a, p) => a + p.qty * p.cost, 0));
  $("stLow").textContent = low.length;
  $("lowBody").innerHTML = low.length
    ? low.map(p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td class="low">${p.qty}</td><td>${p.reorder}</td></tr>`).join("")
    : empty(4, "All items sufficiently stocked.");

  const agg = {};
  db.sales.forEach(s => s.items.forEach(i => {
    agg[i.name] = agg[i.name] || { units: 0, rev: 0 };
    agg[i.name].units += i.qty; agg[i.name].rev += i.qty * i.price;
  }));
  const top = Object.entries(agg).sort((a, b) => b[1].units - a[1].units).slice(0, 5);
  $("topBody").innerHTML = top.length
    ? top.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v.units}</td><td>${money(v.rev)}</td></tr>`).join("")
    : empty(3, "No sales yet.");

  // last 7 days chart
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ key: d.toDateString(), label: d.toLocaleDateString("en-IN", { weekday: "short" }), total: 0 });
  }
  db.sales.forEach(s => { const d = days.find(x => x.key === new Date(s.date).toDateString()); if (d) d.total += s.total; });
  const max = Math.max(...days.map(d => d.total), 1);
  $("chart").innerHTML = days.map(d =>
    `<div class="bar-col"><small>${d.total ? "₹" + Math.round(d.total) : ""}</small><div style="height:${(d.total / max) * 100}%"></div><span>${d.label}</span></div>`).join("");
}

function renderInventory() {
  const q = $("search").value.toLowerCase();
  const rows = db.products.filter(p => [p.sku, p.name, p.category].join(" ").toLowerCase().includes(q));
  $("productBody").innerHTML = rows.length ? rows.map(p => `
    <tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td>
    <td class="${p.qty <= p.reorder ? "low" : ""}">${p.qty}</td>
    <td><button class="small" onclick="editProduct(${p.id})">Edit</button>
    <button class="small danger" onclick="deleteProduct(${p.id})">Delete</button></td></tr>`).join("")
    : empty(7, "No products found.");
}

function renderSaleForm() {
  const cur = $("saleProduct").value, curC = $("saleCustomer").value;
  $("saleProduct").innerHTML = db.products.filter(p => p.qty > 0)
    .map(p => `<option value="${p.id}">${esc(p.name)} - ${money(p.price)} (stock ${p.qty})</option>`).join("");
  $("saleCustomer").innerHTML = db.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  if (cur) $("saleProduct").value = cur;
  if (curC) $("saleCustomer").value = curC;
}

// ================= Products =================
let editingId = null;
function openModal(p) {
  editingId = p ? p.id : null;
  $("modalTitle").textContent = p ? "Edit Product" : "Add Product";
  $("fSku").value = p ? p.sku : ""; $("fName").value = p ? p.name : "";
  $("fCategory").value = p ? p.category : ""; $("fCost").value = p ? p.cost : 0;
  $("fPrice").value = p ? p.price : 0; $("fQty").value = p ? p.qty : 0;
  $("fReorder").value = p ? p.reorder : 5;
  $("modal").classList.remove("hidden");
}
const closeModal = () => $("modal").classList.add("hidden");
$("addProductBtn").onclick = () => openModal(null);
$("cancelBtn").onclick = closeModal;
$("search").oninput = renderInventory;
window.editProduct = id => openModal(db.products.find(p => p.id === id));
window.deleteProduct = id => {
  if (!confirm("Delete this product?")) return;
  db.products = db.products.filter(p => p.id !== id);
  save(); render();
};
$("productForm").addEventListener("submit", e => {
  e.preventDefault();
  const sku = $("fSku").value.trim();
  if (db.products.some(p => p.sku === sku && p.id !== editingId)) return alert("SKU already exists.");
  const data = {
    sku, name: $("fName").value.trim(), category: $("fCategory").value.trim() || "General",
    cost: parseFloat($("fCost").value) || 0, price: parseFloat($("fPrice").value) || 0,
    qty: parseInt($("fQty").value) || 0, reorder: parseInt($("fReorder").value) || 0
  };
  if (editingId) Object.assign(db.products.find(p => p.id === editingId), data);
  else db.products.push({ id: db.nextId++, ...data });
  save(); closeModal(); render();
});
$("restockBtn").onclick = () => {
  const sku = prompt("Enter product SKU to restock:");
  if (!sku) return;
  const p = db.products.find(x => x.sku.toLowerCase() === sku.trim().toLowerCase());
  if (!p) return alert("SKU not found.");
  const n = parseInt(prompt(`Add how many units to ${p.name}?`));
  if (!n || n <= 0) return;
  p.qty += n; save(); render();
};

// ================= Sale / Cart =================
$("addItemBtn").onclick = () => {
  const p = db.products.find(x => x.id === parseInt($("saleProduct").value));
  const qty = parseInt($("saleQty").value);
  if (!p) return alert("No product available.");
  if (!qty || qty <= 0) return alert("Enter a valid quantity.");
  const line = cart.find(c => c.id === p.id);
  const already = line ? line.qty : 0;
  if (already + qty > p.qty) return alert("Not enough stock. Available: " + p.qty);
  if (line) line.qty += qty; else cart.push({ id: p.id, name: p.name, price: p.price, cost: p.cost, qty });
  $("saleQty").value = 1;
  renderCart();
};
window.removeItem = id => { cart = cart.filter(c => c.id !== id); renderCart(); };
$("clearCartBtn").onclick = () => { cart = []; renderCart(); };
$("saleDiscount").oninput = renderCart;

function totals() {
  const sub = cart.reduce((a, c) => a + c.qty * c.price, 0);
  const dp = Math.min(Math.max(parseFloat($("saleDiscount").value) || 0, 0), 100);
  const disc = sub * dp / 100;
  const gst = (sub - disc) * GST / 100;
  return { sub, disc, gst, total: sub - disc + gst };
}
function renderCart() {
  $("cartBody").innerHTML = cart.length ? cart.map(c => `
    <tr><td>${esc(c.name)}</td><td>${c.qty}</td><td>${money(c.price)}</td><td>${money(c.qty * c.price)}</td>
    <td><button class="small danger" onclick="removeItem(${c.id})">✕</button></td></tr>`).join("")
    : empty(5, "Bill is empty.");
  const t = totals();
  $("cSub").textContent = money(t.sub); $("cDisc").textContent = "-" + money(t.disc);
  $("cGst").textContent = money(t.gst); $("cTotal").textContent = money(t.total);
}

$("checkoutBtn").onclick = () => {
  if (!cart.length) return alert("Add items first.");
  const t = totals();
  let profit = 0;
  cart.forEach(c => {
    const p = db.products.find(x => x.id === c.id);
    p.qty -= c.qty;
    profit += c.qty * (c.price - c.cost);
  });
  profit -= t.disc;
  const sale = {
    invoice: db.nextInvoice++, date: new Date().toISOString(),
    customerId: parseInt($("saleCustomer").value), payment: $("salePayment").value,
    items: cart.map(c => ({ ...c })), subtotal: t.sub, discount: t.disc, gst: t.gst, total: t.total, profit
  };
  db.sales.push(sale);
  cart = []; $("saleDiscount").value = 0;
  save(); render(); showInvoice(sale.invoice);
};

// ================= Invoice =================
window.showInvoice = no => {
  const s = db.sales.find(x => x.invoice === no);
  if (!s) return;
  $("invBox").className = "modal-box invoice";
  $("invBox").innerHTML = `
    <h3>Invoice #${s.invoice}</h3>
    <div>Date: ${new Date(s.date).toLocaleString()}<br>Customer: ${esc(custName(s.customerId))}<br>Payment: ${esc(s.payment)}</div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
    ${s.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.qty * i.price)}</td></tr>`).join("")}
    </tbody></table>
    <div style="text-align:right">Subtotal: ${money(s.subtotal)}<br>Discount: -${money(s.discount)}<br>GST: ${money(s.gst)}<br>
    <b style="font-size:17px">Total: ${money(s.total)}</b></div>
    <div class="modal-actions"><button onclick="window.print()">Print</button>
    <button class="secondary" onclick="document.getElementById('invModal').classList.add('hidden')">Close</button></div>`;
  $("invModal").classList.remove("hidden");
};

// ================= History =================
function renderHistory() {
  const rows = db.sales.slice().reverse();
  $("historyBody").innerHTML = rows.length ? rows.map(s => `
    <tr><td>#${s.invoice}</td><td>${new Date(s.date).toLocaleString()}</td><td>${esc(custName(s.customerId))}</td>
    <td>${s.items.reduce((a, i) => a + i.qty, 0)}</td><td>${esc(s.payment)}</td><td>${money(s.total)}</td>
    <td><button class="small" onclick="showInvoice(${s.invoice})">View</button></td></tr>`).join("")
    : empty(7, "No sales yet.");
}

// ================= Customers =================
$("cuBtn").onclick = () => {
  const name = $("cuName").value.trim();
  if (!name) return alert("Enter customer name.");
  db.customers.push({ id: db.nextId++, name, phone: $("cuPhone").value || "-" });
  $("cuName").value = $("cuPhone").value = "";
  save(); render();
};
window.deleteCustomer = id => {
  if (id === 1) return alert("Default customer cannot be deleted.");
  if (!confirm("Delete this customer?")) return;
  db.customers = db.customers.filter(c => c.id !== id);
  save(); render();
};
function renderCustomers() {
  $("cuBody").innerHTML = db.customers.map(c => {
    const mine = db.sales.filter(s => s.customerId === c.id);
    return `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${mine.length}</td>
      <td>${money(mine.reduce((a, s) => a + s.total, 0))}</td>
      <td>${c.id === 1 ? "" : `<button class="small danger" onclick="deleteCustomer(${c.id})">Delete</button>`}</td></tr>`;
  }).join("");
}

// ================= Reports =================
function renderReports() {
  const cats = {};
  db.sales.forEach(s => s.items.forEach(i => {
    const p = db.products.find(x => x.id === i.id);
    const c = p ? p.category : "Other";
    cats[c] = cats[c] || { units: 0, rev: 0, profit: 0 };
    cats[c].units += i.qty; cats[c].rev += i.qty * i.price; cats[c].profit += i.qty * (i.price - i.cost);
  }));
  const ce = Object.entries(cats);
  $("catBody").innerHTML = ce.length
    ? ce.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.units}</td><td>${money(v.rev)}</td><td>${money(v.profit)}</td></tr>`).join("")
    : empty(4, "No data yet.");
  const pays = {};
  db.sales.forEach(s => { pays[s.payment] = pays[s.payment] || { n: 0, amt: 0 }; pays[s.payment].n++; pays[s.payment].amt += s.total; });
  const pe = Object.entries(pays);
  $("payBody").innerHTML = pe.length
    ? pe.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${money(v.amt)}</td></tr>`).join("")
    : empty(3, "No data yet.");
}
$("resetBtn").onclick = () => {
  if (!confirm("This deletes ALL data and restores the sample data. Continue?")) return;
  db = seed(); cart = []; save(); render();
};

// ================= CSV =================
function download(name, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name; a.click();
}
$("exportInv").onclick = () => download("inventory.csv",
  [["SKU", "Name", "Category", "Cost", "Price", "Qty", "Reorder"]]
    .concat(db.products.map(p => [p.sku, p.name, p.category, p.cost, p.price, p.qty, p.reorder])));
$("exportSales").onclick = () => download("sales.csv",
  [["Invoice", "Date", "Customer", "Payment", "Subtotal", "Discount", "GST", "Total", "Profit"]]
    .concat(db.sales.map(s => [s.invoice, new Date(s.date).toLocaleString(), custName(s.customerId), s.payment,
      s.subtotal.toFixed(2), s.discount.toFixed(2), s.gst.toFixed(2), s.total.toFixed(2), s.profit.toFixed(2)])));

render();
