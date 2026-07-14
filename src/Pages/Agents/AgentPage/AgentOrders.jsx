// src/.../AgentOrders.jsx
import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchOrdersByCustomer } from "../../../Redux/Slice/orderSlice";
import { DatePicker, Table, Spin, Tooltip, Button, Input, Select, Drawer } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";
import isBetween from "dayjs/plugin/isBetween";
import AgentOrderModal from "./AgentOrderModal";

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(isBetween);

const { RangePicker } = DatePicker;
const ALL_TIME_START = dayjs("2000-01-01");
const DEFAULT_PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "all", "Pending", "Processing", "Order Placement", "Wrong Number",
  "Delivery", "Completed", "Testing", "Cancelled", "Unreachable",
  "Not Answered", "Multiple order",
];

const QUICK_PERIODS = [
  { key: "today", label: "Today", icon: "☀️", getRange: () => [dayjs().startOf("day"), dayjs().add(1, "day").endOf("day")] },
  { key: "yesterday", label: "Yesterday", icon: "🌙", getRange: () => [dayjs().subtract(1, "day").startOf("day"), dayjs().endOf("day")] },
  { key: "this_week", label: "This Week", icon: "📆", getRange: () => [dayjs().startOf("week"), dayjs().add(1, "day").endOf("day")] },
  { key: "this_month", label: "This Month", icon: "🗓️", getRange: () => [dayjs().startOf("month"), dayjs().add(1, "day").endOf("day")] },
  { key: "last_month", label: "Last Month", icon: "↩️", getRange: () => [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month").add(1, "day")] },
  { key: "last_3_months", label: "Last 3 Months", icon: "📊", getRange: () => [dayjs().subtract(2, "month").startOf("month"), dayjs().add(1, "day").endOf("day")] },
  { key: "this_year", label: "This Year", icon: "🎯", getRange: () => [dayjs().startOf("year"), dayjs().add(1, "day").endOf("day")] },
  { key: "all_time", label: "All Time", icon: "♾️", slow: true, getRange: () => [ALL_TIME_START.clone(), dayjs().add(1, "day").endOf("day")] },
];

const DATE_PICKER_PRESETS = QUICK_PERIODS.filter((p) => p.key !== "all_time").map((p) => ({ label: p.label, value: p.getRange() }));

// localStorage read (your patch returns parsed objects, no need to parse)
const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const extractCustomer = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    if (raw === "null" || raw === "[object Object]") return null;
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (typeof raw !== "object") return null;
  return raw.customer || raw.data?.customer || raw.data || raw;
};

const getAcctNumber = (c) =>
  c?.customerAccountNumber ??
  c?.CustomerAccountNumber ??
  c?.accountNumber ??
  c?.customerId ??
  c?.id ??
  null;

const friendlyDate = (d) => {
  if (!d || !d.isValid()) return { primary: "N/A", secondary: "", time: "", isRecent: false };
  const now = dayjs();
  const diff = now.startOf("day").diff(d.startOf("day"), "day");
  let primary;
  if (diff === 0) primary = "Today";
  else if (diff === 1) primary = "Yesterday";
  else if (diff > 1 && diff < 7) primary = `${diff} days ago`;
  else if (diff >= 7 && diff < 14) primary = "Last week";
  else primary = d.format("MMM D, YYYY");
  return { primary, secondary: d.format("ddd, MMM D"), time: d.format("h:mm A"), isRecent: diff <= 1 };
};

const friendlyDayHeader = (d) => {
  if (!d || !d.isValid()) return "Unknown Date";
  const now = dayjs();
  const diff = now.startOf("day").diff(d.startOf("day"), "day");
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (d.isSame(now, "year")) return d.format("dddd, MMMM D");
  return d.format("dddd, MMMM D, YYYY");
};

const PAYMENT = {
  "Cash on Delivery": "bg-green-50 text-green-800 border-green-200",
  "Paid Already": "bg-blue-50 text-blue-800 border-blue-200",
  "Pick up": "bg-purple-50 text-purple-800 border-purple-200",
  "Bank Transfer": "bg-orange-50 text-orange-800 border-orange-200",
};
const STATUS = {
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  Processing: "bg-blue-50 text-blue-800 border-blue-200",
  "Order Placement": "bg-blue-50 text-blue-800 border-blue-200",
  "Wrong Number": "bg-purple-50 text-purple-800 border-purple-200",
  Delivery: "bg-green-50 text-green-800 border-green-200",
  Completed: "bg-green-50 text-green-800 border-green-200",
  Testing: "bg-yellow-50 text-yellow-800 border-yellow-200",
  Cancelled: "bg-red-50 text-red-800 border-red-200",
  Unreachable: "bg-gray-50 text-gray-700 border-gray-200",
  "Not Answered": "bg-orange-50 text-orange-800 border-orange-200",
  "Multiple order": "bg-indigo-50 text-indigo-800 border-indigo-200",
};
const FALLBACK = "bg-gray-50 text-gray-700 border-gray-200";

const Badge = ({ cls, children }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-px rounded-full border text-[11px] font-semibold whitespace-nowrap ${cls}`}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls.split(" ")[0]?.replace("-50", "-500") ?? ""}`} />
    {children}
  </span>
);

// ✅ Replaced ◉ icon with a clear "View" text button
const ViewButton = memo(({ orderId, onClick, isViewed }) => (
  <Tooltip title={isViewed ? "Viewed ✓ · Open again" : "View Details"}>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(orderId); }}
      className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors
        ${isViewed
          ? "bg-green-50 border-green-300 text-green-800 hover:bg-green-100"
          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"}
        active:scale-95`}
    >
      {isViewed ? "Viewed" : "View order details"}
    </button>
  </Tooltip>
));

const QuickPeriodBar = memo(({ activePeriod, onPeriodChange }) => (
  <div className="mb-3 p-1.5 px-2 bg-white border border-gray-200 rounded-xl shadow-sm">
    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {QUICK_PERIODS.map((p) => {
        const active = activePeriod === p.key;
        const cls = active && p.slow
          ? "bg-gradient-to-br from-red-700 to-orange-600 text-white border-transparent"
          : active
          ? "bg-green-900 text-white border-green-900"
          : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 hover:text-gray-900";
        return (
          <button key={p.key} type="button" onClick={() => onPeriodChange(p.key)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all ${cls}`}>
            <span className="text-[13px]">{p.icon}</span>{p.label}
            {p.slow && <span className={`text-[8px] font-extrabold px-1.5 py-px rounded-full uppercase ${active ? "bg-white/25" : "bg-red-100 text-red-700"}`}>slow</span>}
          </button>
        );
      })}
      {activePeriod === "custom" && (
        <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-green-900 text-white">📅 Custom</span>
      )}
    </div>
  </div>
));

// ✅ Increased spacing between mobile cards (p-4, mb-3, etc.)
const MobileOrderCard = memo(({ order, onViewOrder, isViewed }) => (
  <div onClick={() => onViewOrder(order.orderId)}
    className="border border-gray-200 rounded-xl p-4 mb-3 cursor-pointer bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-md active:scale-[0.99]">
    <div className="flex items-center justify-between gap-2 mb-3">
      <span className="font-mono text-sm font-bold text-gray-900">#{order.orderId}</span>
      <div className="flex items-center gap-2">
        {isViewed && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50 text-green-700 border border-green-200 text-[10px] font-extrabold">✓</span>}
        <Badge cls={(STATUS[order.orderCycle] || FALLBACK)}>{order.orderCycle}</Badge>
      </div>
    </div>
    <div className="flex items-center justify-between gap-2 py-3 border-y border-gray-100">
      <span className="text-xs font-semibold text-gray-600">🕐 {order.dateTime}</span>
      <span className="text-xs font-semibold text-gray-700">{order.paymentMode}</span>
    </div>
    <div className="mt-3 flex justify-end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onViewOrder(order.orderId); }}
        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-green-900 text-white hover:bg-green-800 active:scale-95"
      >
        {isViewed ? "Open again" : "View Order"}
      </button>
    </div>
  </div>
));

const EmptyWrap = ({ children }) => <div className="flex flex-col items-center justify-center text-center px-6 py-16">{children}</div>;
const Circle = ({ children, danger }) => (
  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 border ${danger ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
    <span className="text-3xl opacity-50">{children}</span>
  </div>
);
const btnP = "inline-flex items-center justify-center px-8 py-2.5 rounded-lg text-sm font-semibold bg-green-900 text-white shadow hover:bg-green-800 transition-all";
const btnS = "inline-flex items-center justify-center px-8 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all";

const NoCustomerState = memo(({ onSignInClick, debug }) => (
  <EmptyWrap>
    <Circle>👤</Circle>
    <div className="text-xl font-extrabold text-gray-900 mb-2">Sign In Required</div>
    <div className="text-sm text-gray-400 max-w-sm leading-relaxed mb-6">Please log in to view your order history.</div>
    <button className={btnP} onClick={onSignInClick} type="button">Sign In</button>
    {debug && <pre className="mt-6 text-[10px] text-gray-400 bg-gray-50 p-3 rounded max-w-md overflow-auto text-left">{debug}</pre>}
  </EmptyWrap>
));
const LoadingState = memo(({ rangeLabel }) => (
  <EmptyWrap><Spin size="large" /><div className="text-lg font-extrabold text-gray-900 mb-1 mt-5">Loading Orders</div><div className="text-sm text-gray-400">Fetching {rangeLabel.toLowerCase()}...</div></EmptyWrap>
));
const ErrorState = memo(({ error, onRetry }) => (
  <EmptyWrap><Circle danger>⚠</Circle><div className="text-xl font-extrabold text-gray-900 mb-2">Unable to Load Orders</div><div className="text-sm text-gray-400 max-w-sm mb-6">{typeof error === "string" ? error : "Unexpected error."}</div><button className={btnP} onClick={onRetry} type="button">Try Again</button></EmptyWrap>
));
const EmptyState = memo(({ hasFilters, rangeLabel, activePeriod, onClearFilters, onShowAll }) => (
  <EmptyWrap>
    <Circle>📦</Circle>
    <div className="text-xl font-extrabold text-gray-900 mb-2">{hasFilters ? "No Matching Orders" : "No Orders in This Period"}</div>
    <div className="text-sm text-gray-400 max-w-sm mb-6">{hasFilters ? "Try adjusting your filters." : `No orders for ${rangeLabel.toLowerCase()}. Try a wider range.`}</div>
    {hasFilters && <button className={btnS} onClick={onClearFilters} type="button">Clear Filters</button>}
    {!hasFilters && activePeriod !== "all_time" && <button className={btnP} onClick={onShowAll} type="button">Show All Time</button>}
  </EmptyWrap>
));

const Chip = ({ children, onClear }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-green-200 rounded-full text-[11px] font-medium text-gray-600">
    {children}<button onClick={onClear} type="button" className="text-gray-400 hover:text-red-500 text-base leading-none ml-0.5">×</button>
  </span>
);

const FiltersDrawer = memo(({ open, onClose, activePeriod, onPeriodChange, displayDateRange, onDateChange, orderIdSearch, onOrderIdSearchChange, customerSearch, onCustomerSearchChange, statusFilter, onStatusChange, onExportPDF, onRefresh, canExport }) => {
  const lbl = "text-[10px] font-bold text-gray-400 uppercase tracking-wide";
  return (
    <Drawer title={<span className="font-extrabold">Filters & Actions</span>} placement="bottom" height="auto" open={open} onClose={onClose} styles={{ body: { padding: "0 16px 24px" } }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className={lbl}>⚡ Quick Period</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {QUICK_PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => onPeriodChange(p.key)}
                className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${activePeriod === p.key ? "bg-green-900 text-white border-green-900" : "bg-gray-100 text-gray-600 border-transparent"}`}>
                <span>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2"><label className={lbl}>📅 Date Range</label><RangePicker value={displayDateRange} onChange={onDateChange} format="MMM D, YYYY" size="large" presets={DATE_PICKER_PRESETS} style={{ width: "100%" }} /></div>
        <div className="flex flex-col gap-2"><label className={lbl}>🔎 Order ID</label><Input placeholder="Order ID..." value={orderIdSearch} onChange={(e) => onOrderIdSearchChange(e.target.value)} size="large" allowClear /></div>
        <div className="flex flex-col gap-2"><label className={lbl}>👤 Customer</label><Input placeholder="Customer..." value={customerSearch} onChange={(e) => onCustomerSearchChange(e.target.value)} size="large" allowClear /></div>
        <div className="flex flex-col gap-2"><label className={lbl}>🏷️ Status</label><Select value={statusFilter} onChange={onStatusChange} size="large" style={{ width: "100%" }}>{STATUS_OPTIONS.map((s) => <Select.Option key={s} value={s}>{s === "all" ? "All Statuses" : s}</Select.Option>)}</Select></div>
        <div className="flex gap-2">
          <Button size="large" disabled={!canExport} onClick={() => { onExportPDF(); onClose(); }} className="flex-1">Export PDF</Button>
          <Button size="large" onClick={() => { onRefresh(); onClose(); }} className="flex-1">Refresh</Button>
        </div>
      </div>
    </Drawer>
  );
});

/* ---------------- Main ---------------- */
const AgentOrders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const ordersState = useSelector((s) => s.orders || { orders: [], loading: false, error: null });
  const reduxCustomer = useSelector((s) => s.customer?.currentCustomer || s.customer?.currentCustomerDetails);

  const orders = ordersState.orders || [];
  const loading = ordersState.loading || false;
  const error = ordersState.error || null;

  const [dateRange, setDateRange] = useState(() => QUICK_PERIODS.find((p) => p.key === "today").getRange());
  const [activePeriod, setActivePeriod] = useState("today");
  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ✅ Customer: Redux first, then localStorage (no parse needed)
  const customerObject = useMemo(() => {
    if (getAcctNumber(reduxCustomer)) return reduxCustomer;
    const fromCustomer = extractCustomer(readStorage("customer"));
    if (getAcctNumber(fromCustomer)) return fromCustomer;
    const fromUser = extractCustomer(readStorage("user"));
    if (getAcctNumber(fromUser)) return fromUser;
    return null;
  }, [reduxCustomer]);

  const customerId = getAcctNumber(customerObject);
  const hasValidCustomer = !!(customerObject && customerId);

  const debugInfo = useMemo(() => {
    if (hasValidCustomer) return null;
    try {
      return JSON.stringify({ redux: !!reduxCustomer, lsCustomer: readStorage("customer"), lsUser: readStorage("user") }, null, 2);
    } catch { return "debug unavailable"; }
  }, [hasValidCustomer, reduxCustomer]);

  const [viewedOrders, setViewedOrders] = useState(() => {
    const id = getAcctNumber(customerObject);
    const stored = id ? readStorage(`viewedOrders_${id}`) : null;
    return Array.isArray(stored) ? new Set(stored) : new Set();
  });

  useEffect(() => {
    if (!customerId) { setViewedOrders(new Set()); return; }
    const stored = readStorage(`viewedOrders_${customerId}`);
    setViewedOrders(Array.isArray(stored) ? new Set(stored) : new Set());
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    try { localStorage.setItem(`viewedOrders_${customerId}`, JSON.stringify([...viewedOrders])); } catch {}
  }, [viewedOrders, customerId]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  const resetPagination = useCallback(() => setCurrentPage(1), []);

  const fetchOrders = useCallback((range) => {
    if (!hasValidCustomer || !range?.[0] || !range?.[1]) return;
    dispatch(fetchOrdersByCustomer({ from: range[0].format("MM/DD/YYYY"), to: range[1].format("MM/DD/YYYY"), customerId }));
  }, [dispatch, customerId, hasValidCustomer]);

  useEffect(() => { fetchOrders(dateRange); }, [dateRange, fetchOrders]);

  const handleDateChange = useCallback((dates) => {
    if (!dates?.[0] || !dates?.[1]) return;
    const adj = [dates[0].startOf("day"), dates[1].add(1, "day").endOf("day")];
    setDateRange(adj); setActivePeriod(detectPeriodKey(adj)); resetPagination();
  }, [resetPagination]);

  const handleQuickPeriod = useCallback((key) => {
    const p = QUICK_PERIODS.find((x) => x.key === key);
    if (!p) return;
    setActivePeriod(key); setDateRange(p.getRange()); resetPagination();
  }, [resetPagination]);

  const handleViewOrder = useCallback((id) => {
    setSelectedOrderId(id); setIsOrderModalVisible(true);
    setViewedOrders((prev) => { if (prev.has(id)) return prev; const n = new Set(prev); n.add(id); return n; });
  }, []);

  const handleRefresh = useCallback(() => fetchOrders(dateRange), [fetchOrders, dateRange]);

  const transformedOrders = useMemo(() => (orders || [])
    .map((o, i) => {
      const d = dayjs(o?.orderDate); const fd = friendlyDate(d);
      return {
        key: o?.orderCode || `${i}`, orderId: String(o?.orderCode || "N/A"),
        datePrimary: fd.primary, dateSecondary: fd.secondary, dateTime: fd.time, isRecent: fd.isRecent,
        dayKey: d.isValid() ? d.format("YYYY-MM-DD") : "unknown", dayHeader: friendlyDayHeader(d),
        customerName: o?.fullName || "N/A", orderCycle: o?.orderCycle || "N/A", paymentMode: o?.paymentMode || "N/A",
        _timestamp: d.isValid() ? d.valueOf() : 0,
      };
    })
    .filter((o) =>
      o.orderId.toLowerCase().includes(orderIdSearch.trim().toLowerCase()) &&
      o.customerName.toLowerCase().includes(customerSearch.trim().toLowerCase()) &&
      (statusFilter === "all" || o.orderCycle === statusFilter))
    .sort((a, b) => b._timestamp - a._timestamp),
  [orders, orderIdSearch, customerSearch, statusFilter]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(transformedOrders.length / pageSize));
    if (currentPage > tp) setCurrentPage(tp);
  }, [transformedOrders.length, currentPage, pageSize]);

  const groupedOrders = useMemo(() => {
    const g = []; const m = {};
    transformedOrders.forEach((o) => {
      if (!m[o.dayKey]) { m[o.dayKey] = { header: o.dayHeader, items: [] }; g.push(m[o.dayKey]); }
      m[o.dayKey].items.push(o);
    });
    return g;
  }, [transformedOrders]);

  const rangeLabel = useMemo(() => {
    const p = QUICK_PERIODS.find((x) => x.key === activePeriod);
    if (p) return p.label;
    return `${dateRange?.[0]?.format("MMM D")} – ${dateRange?.[1]?.subtract(1, "day").format("MMM D, YYYY")}`;
  }, [activePeriod, dateRange]);

  const displayDateRange = useMemo(() => [dateRange[0], dateRange[1].subtract(1, "day")], [dateRange]);
  const clearFilters = useCallback(() => { setOrderIdSearch(""); setCustomerSearch(""); setStatusFilter("all"); resetPagination(); }, [resetPagination]);

  const handleExportPDF = useCallback(() => {
    if (!transformedOrders.length) return;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Orders</title><style>body{font-family:Inter,sans-serif;margin:32px}h1{color:#14532d}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#14532d;color:#fff;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px;border-bottom:1px solid #eee;font-size:13px}tr:nth-child(even){background:#fafafa}</style></head><body><h1>Order History</h1><p>${customerObject?.fullName || "Customer"} — ${transformedOrders.length} orders</p><table><thead><tr><th>Order ID</th><th>Date</th><th>Payment</th><th>Status</th></tr></thead><tbody>${transformedOrders.map((o) => `<tr><td>#${o.orderId}</td><td>${o.dateSecondary} ${o.dateTime}</td><td>${o.paymentMode}</td><td>${o.orderCycle}</td></tr>`).join("")}</tbody></table></body></html>`);
    w.document.close(); w.onload = () => w.print();
  }, [customerObject, transformedOrders]);

  // ✅ Columns with View button (text button) and slightly more row padding
  const columns = useMemo(() => [
    { title: "✔", key: "viewed", width: 50, align: "center",
      render: (_, r) => viewedOrders.has(r.orderId)
        ? <Tooltip title="Viewed"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50 text-green-700 border border-green-200 text-[11px] font-extrabold">✓</span></Tooltip>
        : <span className="text-gray-300 font-bold">—</span> },
    { title: "Date", dataIndex: "datePrimary", key: "date", width: 100,
      sorter: (a, b) => a._timestamp - b._timestamp, defaultSortOrder: "descend",
      render: (t, r) => (
        <div className="flex flex-col leading-tight">
          <span className={`text-[12px] font-bold ${r.isRecent ? "text-green-800" : "text-gray-900"}`}>{t}{r.isRecent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 ml-1 animate-pulse" />}</span>
          <span className="text-[10px] text-gray-400">{r.dateSecondary} · {r.dateTime}</span>
        </div>
      ) },
    { title: "Order", dataIndex: "orderId", key: "orderId", width: 110,
      render: (t) => <span className="font-mono text-[12px] font-semibold text-gray-800 bg-gray-100 px-2 py-px rounded border border-gray-200">#{t}</span> },
    { title: "Payment", dataIndex: "paymentMode", key: "pay", width: 100, render: (m) => <Badge cls={PAYMENT[m] || FALLBACK}>{m}</Badge> },
    { title: "Status", dataIndex: "orderCycle", key: "status", width: 100, render: (s) => <Badge cls={STATUS[s] || FALLBACK}>{s}</Badge> },

            { title: "Order Details", key: "view", width: 80, fixed: "left",
      render: (_, r) => <ViewButton orderId={r.orderId} isViewed={viewedOrders.has(r.orderId)} onClick={handleViewOrder} /> },
  ], [viewedOrders, handleViewOrder]);

  const headerBar = <div className="w-[3px] h-6 rounded-full shrink-0 bg-gradient-to-b from-green-900 to-green-500" />;

  if (!hasValidCustomer) {
    return (
      <>
        <AntdOverrides />
        <div className="min-h-screen bg-gray-50 font-sans">
          <div className="max-w-[1400px] mx-auto px-3 pt-3 pb-6 md:px-6">
            <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-gray-200">
              {headerBar}
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-gray-900 tracking-tight">Order History</h1>
                <p className="text-[11px] text-gray-400 mt-0.5">Track and manage your orders</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <NoCustomerState onSignInClick={() => navigate("/")} debug={import.meta.env.DEV ? debugInfo : null} />
            </div>
          </div>
        </div>
      </>
    );
  }

  const hasFilters = orderIdSearch.trim() || customerSearch.trim() || statusFilter !== "all";

  return (
    <>
      <AntdOverrides />
      <div className="min-h-screen bg-gray-50 font-sans">
        <div className="max-w-[1400px] mx-auto px-3 pt-3 pb-6 md:px-6">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-gray-200 flex-wrap">
            {headerBar}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-extrabold text-gray-900 tracking-tight leading-tight">Order History</h1>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {loading ? `Loading ${rangeLabel.toLowerCase()}...` : `${transformedOrders.length} order${transformedOrders.length !== 1 ? "s" : ""} · ${rangeLabel}`}
              </p>
            </div>
            <button onClick={handleRefresh} title="Refresh" type="button"
              className="hidden md:flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 text-lg hover:bg-green-50 hover:border-green-400 hover:text-green-800 ml-auto transition-all">↻</button>
            <button onClick={() => setFiltersDrawerOpen(true)} type="button"
              className="md:hidden flex items-center gap-1 px-3 py-1.5 bg-green-900 text-white rounded-lg text-[11px] font-semibold ml-auto shadow-sm active:scale-95">☰ Filters</button>
          </div>

          <QuickPeriodBar activePeriod={activePeriod} onPeriodChange={handleQuickPeriod} />

          {/* Compact single-row filters (desktop) */}
          <div className="hidden md:flex items-center gap-2 p-1.5 px-2 bg-white border border-gray-200 rounded-xl mb-2.5 flex-wrap shadow-sm">
            {[
              { icon: "📅", node: <RangePicker value={displayDateRange} onChange={handleDateChange} format="MMM D" presets={DATE_PICKER_PRESETS} allowClear={false} size="small" variant="borderless" className="w-full" /> },
              { icon: "🔎", node: <Input placeholder="Order ID" value={orderIdSearch} onChange={(e) => { setOrderIdSearch(e.target.value); resetPagination(); }} allowClear size="small" variant="borderless" /> },
              { icon: "👤", node: <Input placeholder="Customer" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); resetPagination(); }} allowClear size="small" variant="borderless" /> },
              { icon: "🏷️", node: <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); resetPagination(); }} size="small" variant="borderless" className="w-full" popupMatchSelectWidth={false}>{STATUS_OPTIONS.map((s) => <Select.Option key={s} value={s}>{s === "all" ? "All" : s}</Select.Option>)}</Select> },
            ].map((f, i) => (
              <div key={i} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 gap-1.5 flex-1 min-w-0">
                <span className="text-sm opacity-70">{f.icon}</span>
                <div className="flex-1 min-w-0">{f.node}</div>
              </div>
            ))}
            <Button disabled={!transformedOrders.length} onClick={handleExportPDF} size="small" className="!h-8 !font-semibold shrink-0">Export</Button>
          </div>

          {/* Active chips */}
          {hasFilters && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg mb-2.5 flex-wrap">
              <span className="font-bold text-green-800 text-[10px] uppercase tracking-wide">Filters:</span>
              {orderIdSearch && <Chip onClear={() => { setOrderIdSearch(""); resetPagination(); }}>ID: “{orderIdSearch}”</Chip>}
              {customerSearch && <Chip onClear={() => { setCustomerSearch(""); resetPagination(); }}>“{customerSearch}”</Chip>}
              {statusFilter !== "all" && <Chip onClear={() => { setStatusFilter("all"); resetPagination(); }}>{statusFilter}</Chip>}
              <button className="ml-auto text-green-800 font-semibold text-[11px] underline" onClick={clearFilters} type="button">Clear all</button>
            </div>
          )}

          {/* Card */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {loading ? <LoadingState rangeLabel={rangeLabel} />
              : error ? <ErrorState error={error} onRetry={handleRefresh} />
              : transformedOrders.length > 0 ? (
                <>
                  <div className="hidden md:block oh-table">
                    <Table
                      dataSource={transformedOrders} columns={columns} rowKey="key"
                      rowClassName={(r) => (viewedOrders.has(r.orderId) ? "oh-row-viewed" : "")}
                      pagination={{ current: currentPage, pageSize, showSizeChanger: true, size: "small", pageSizeOptions: [10, 20, 50, 100], showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`, onChange: (p, s) => { setCurrentPage(p); setPageSize(s); }, onShowSizeChange: (p, s) => { setCurrentPage(p); setPageSize(s); } }}
                      size="small" scroll={{ x: "max-content" }} sticky
                    />
                  </div>
                  <div className="md:hidden p-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-3">Showing {transformedOrders.length} order{transformedOrders.length !== 1 ? "s" : ""}</div>
                    {groupedOrders.map((g) => (
                      <div key={g.header} className="mb-4">
                        <div className="flex items-center gap-2 px-1 pb-2 sticky top-0 z-[2] bg-white">
                          <span className="text-sm font-extrabold text-gray-900">{g.header}</span>
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-green-50 text-green-800 border border-green-200 rounded-full text-[10px] font-bold">{g.items.length}</span>
                        </div>
                        {g.items.map((o) => <MobileOrderCard key={o.key} order={o} onViewOrder={handleViewOrder} isViewed={viewedOrders.has(o.orderId)} />)}
                      </div>
                    ))}
                  </div>
                </>
              ) : <EmptyState hasFilters={!!hasFilters} rangeLabel={rangeLabel} activePeriod={activePeriod} onClearFilters={clearFilters} onShowAll={() => handleQuickPeriod("all_time")} />}
          </div>
        </div>

        <AgentOrderModal orderId={selectedOrderId} isModalVisible={isOrderModalVisible} onClose={() => { setIsOrderModalVisible(false); setSelectedOrderId(null); }} />
        <FiltersDrawer open={filtersDrawerOpen} onClose={() => setFiltersDrawerOpen(false)} activePeriod={activePeriod} onPeriodChange={handleQuickPeriod} displayDateRange={displayDateRange} onDateChange={handleDateChange} orderIdSearch={orderIdSearch} onOrderIdSearchChange={(v) => { setOrderIdSearch(v); resetPagination(); }} customerSearch={customerSearch} onCustomerSearchChange={(v) => { setCustomerSearch(v); resetPagination(); }} statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); resetPagination(); }} onExportPDF={handleExportPDF} onRefresh={handleRefresh} canExport={transformedOrders.length > 0} />
      </div>
    </>
  );
};

const AntdOverrides = () => (
  <style>{`
    .oh-table .ant-table{font-size:12px!important}
    .oh-table .ant-table-thead>tr>th{background:#f4f5f7!important;border-bottom:2px solid #e5e7eb!important;font-size:10px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:.08em!important;color:#9ca3af!important;padding:8px 14px!important}
    .oh-table .ant-table-tbody>tr>td{padding:9px 14px!important;border-bottom:1px solid #f3f4f6!important;font-size:12px!important;vertical-align:middle!important}
    .oh-table .ant-table-tbody>tr:last-child>td{border-bottom:none!important}
    .oh-table .ant-table-tbody>tr:hover>td{background:#fafbfc!important}
    .oh-table .ant-table-tbody>tr.oh-row-viewed>td{background:#f0fdf4!important}
    .oh-table .ant-table-tbody>tr.oh-row-viewed:hover>td{background:#e7fbef!important}
    .oh-table .ant-table-cell-fix-left{background:inherit!important}
    .oh-table .ant-pagination{padding:10px 16px!important;font-size:12px!important}
    .oh-table .ant-pagination-item-active{background:#14532d!important;border-color:#14532d!important}
    .oh-table .ant-pagination-item-active a{color:#fff!important}
  `}</style>
);

export default AgentOrders;