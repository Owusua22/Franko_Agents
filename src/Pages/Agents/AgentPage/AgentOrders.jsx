import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchOrdersByCustomer } from "../../../Redux/Slice/orderSlice";
import {
  DatePicker,
  Table,
  Spin,
  Tooltip,
  Button,
  Input,
  Select,
  Drawer,
} from "antd";
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
  "all",
  "Pending",
  "Processing",
  "Order Placement",
  "Wrong Number",
  "Delivery",
  "Completed",
  "Testing",
  "Cancelled",
  "Unreachable",
  "Not Answered",
  "Multiple order",
];

const QUICK_PERIODS = [
  {
    key: "today",
    label: "Today",
    icon: "☀️",
    getRange: () => [dayjs().startOf("day"), dayjs().add(1, "day").endOf("day")],
  },
  {
    key: "yesterday",
    label: "Yesterday",
    icon: "🌙",
    getRange: () => [dayjs().subtract(1, "day").startOf("day"), dayjs().endOf("day")],
  },
  {
    key: "this_week",
    label: "This Week",
    icon: "📆",
    getRange: () => [dayjs().startOf("week"), dayjs().add(1, "day").endOf("day")],
  },
  {
    key: "this_month",
    label: "This Month",
    icon: "🗓️",
    getRange: () => [dayjs().startOf("month"), dayjs().add(1, "day").endOf("day")],
  },
  {
    key: "last_month",
    label: "Last Month",
    icon: "↩️",
    getRange: () => [
      dayjs().subtract(1, "month").startOf("month"),
      dayjs().subtract(1, "month").endOf("month").add(1, "day"),
    ],
  },
  {
    key: "last_3_months",
    label: "Last 3 Months",
    icon: "📊",
    getRange: () => [
      dayjs().subtract(2, "month").startOf("month"),
      dayjs().add(1, "day").endOf("day"),
    ],
  },
  {
    key: "this_year",
    label: "This Year",
    icon: "🎯",
    getRange: () => [dayjs().startOf("year"), dayjs().add(1, "day").endOf("day")],
  },
  {
    key: "all_time",
    label: "All Time",
    icon: "♾️",
    slow: true,
    getRange: () => [ALL_TIME_START.clone(), dayjs().add(1, "day").endOf("day")],
  },
];

const DATE_PICKER_PRESETS = QUICK_PERIODS.filter(
  (p) => p.key !== "all_time"
).map((p) => ({
  label: p.label,
  value: p.getRange(),
}));

const friendlyDate = (d) => {
  if (!d || !d.isValid()) {
    return { primary: "N/A", secondary: "", time: "", isRecent: false };
  }

  const now = dayjs();
  const diffDays = now.startOf("day").diff(d.startOf("day"), "day");

  let primary;
  if (diffDays === 0) primary = "Today";
  else if (diffDays === 1) primary = "Yesterday";
  else if (diffDays > 1 && diffDays < 7) primary = `${diffDays} days ago`;
  else if (diffDays >= 7 && diffDays < 14) primary = "Last week";
  else primary = d.format("MMM D, YYYY");

  return {
    primary,
    secondary: d.format("ddd, MMM D, YYYY"),
    time: d.format("h:mm A"),
    isRecent: diffDays <= 1,
  };
};

const friendlyDayHeader = (d) => {
  if (!d || !d.isValid()) return "Unknown Date";
  const now = dayjs();
  const diffDays = now.startOf("day").diff(d.startOf("day"), "day");

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (d.isSame(now, "year")) return d.format("dddd, MMMM D");
  return d.format("dddd, MMMM D, YYYY");
};

const getPaymentConfig = (mode) => {
  const map = {
    "Cash on Delivery": {
      bg: "#f0fdf4",
      color: "#166534",
      border: "#bbf7d0",
      dot: "#22c55e",
      label: "Cash on Delivery",
    },
    "Paid Already": {
      bg: "#eff6ff",
      color: "#1e40af",
      border: "#bfdbfe",
      dot: "#3b82f6",
      label: "Paid Already",
    },
    "Pick up": {
      bg: "#faf5ff",
      color: "#6b21a8",
      border: "#e9d5ff",
      dot: "#a855f7",
      label: "Pick up",
    },
    "Bank Transfer": {
      bg: "#fff7ed",
      color: "#9a3412",
      border: "#fed7aa",
      dot: "#f97316",
      label: "Bank Transfer",
    },
  };

  return (
    map[mode] || {
      bg: "#f9fafb",
      color: "#374151",
      border: "#e5e7eb",
      dot: "#9ca3af",
      label: mode || "N/A",
    }
  );
};

const getStatusConfig = (status) => {
  const map = {
    Pending: { bg: "#fffbeb", color: "#92400e", border: "#fde68a", dot: "#f59e0b" },
    Processing: { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe", dot: "#3b82f6" },
    "Order Placement": { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe", dot: "#3b82f6" },
    "Wrong Number": { bg: "#faf5ff", color: "#6b21a8", border: "#e9d5ff", dot: "#a855f7" },
    Delivery: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", dot: "#22c55e" },
    Completed: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", dot: "#22c55e" },
    Testing: { bg: "#fefce8", color: "#854d0e", border: "#fef08a", dot: "#eab308" },
    Cancelled: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca", dot: "#ef4444" },
    Unreachable: { bg: "#f9fafb", color: "#374151", border: "#e5e7eb", dot: "#9ca3af" },
    "Not Answered": { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa", dot: "#f97316" },
    "Multiple order": { bg: "#eef2ff", color: "#3730a3", border: "#c7d2fe", dot: "#6366f1" },
  };

  return (
    map[status] || {
      bg: "#f9fafb",
      color: "#374151",
      border: "#e5e7eb",
      dot: "#9ca3af",
    }
  );
};

const detectPeriodKey = (range) => {
  if (!range || !range[0] || !range[1]) return "custom";

  for (const p of QUICK_PERIODS) {
    const [s, e] = p.getRange();
    if (range[0].isSame(s, "minute") && range[1].isSame(e, "minute")) {
      return p.key;
    }
  }

  return "custom";
};

const StatCard = memo(({ value, label, emoji, color }) => (
  <div className="oh-stat-card" style={{ "--stat-color": color }}>
    <div className="oh-stat-content">
      <div className="oh-stat-value">{value}</div>
      <div className="oh-stat-label">{label}</div>
    </div>
    <div className="oh-stat-emoji">{emoji}</div>
  </div>
));

const QuickPeriodBar = memo(({ activePeriod, onPeriodChange }) => (
  <div className="oh-quick-bar">
    <div className="oh-quick-scroll">
      {QUICK_PERIODS.map((p) => (
        <button
          key={p.key}
          className={`oh-quick-chip ${activePeriod === p.key ? "is-active" : ""} ${
            p.slow ? "is-all" : ""
          }`}
          onClick={() => onPeriodChange(p.key)}
          type="button"
          title={p.slow ? "Fetches every order and may take longer" : ""}
        >
          <span className="oh-quick-icon">{p.icon}</span>
          {p.label}
          {p.slow && <span className="oh-quick-hint">slow</span>}
        </button>
      ))}
      {activePeriod === "custom" && (
        <span className="oh-quick-chip is-active is-custom">
          <span className="oh-quick-icon">📅</span>
          Custom Range
        </span>
      )}
    </div>
  </div>
));

const MobileOrderCard = memo(({ order, onViewOrder, isViewed }) => {
  const sCfg = getStatusConfig(order.orderCycle);
  const pCfg = getPaymentConfig(order.paymentMode);

  return (
    <div className="oh-mobile-card" onClick={() => onViewOrder(order.orderId)}>
      <div className="oh-mc-row-top">
        <span className="oh-mc-id">#{order.orderId}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isViewed && (
            <span className="oh-tick oh-tick-sm" title="Viewed">
              ✓
            </span>
          )}
          <span
            className="oh-badge-pill"
            style={{
              background: sCfg.bg,
              color: sCfg.color,
              borderColor: sCfg.border,
              fontSize: 10,
              padding: "2px 8px",
            }}
          >
            <span
              className="oh-badge-dot"
              style={{ background: sCfg.dot, width: 6, height: 6 }}
            />
            {order.orderCycle}
          </span>
        </div>
      </div>

      <div className="oh-mc-row-mid">
        <div className="oh-mc-time-block">
          <span className="oh-mc-clock">🕐</span>
          <span className="oh-mc-time">{order.dateTime}</span>
        </div>

        <div className="oh-mc-field">
          <span className="oh-mc-field-label">Payment</span>
          <span
            className="oh-mc-field-value"
            style={{ color: pCfg.color, fontWeight: 600 }}
          >
            {pCfg.label}
          </span>
        </div>
      </div>

      <div className="oh-mc-row-bottom">
        <span className="oh-mc-view-link">
          {isViewed ? "Viewed ✓ · Open again" : "View Details"} →
        </span>
      </div>
    </div>
  );
});

const NoCustomerState = memo(({ onSignInClick }) => (
  <div className="oh-empty-state">
    <div className="oh-empty-circle">
      <span className="oh-empty-emoji">👤</span>
    </div>
    <div className="oh-empty-title">Sign In Required</div>
    <div className="oh-empty-desc">
      Please log in to view your order history and track your purchases.
    </div>
    <button className="oh-btn-primary" onClick={onSignInClick} type="button">
      Sign In
    </button>
  </div>
));

const LoadingState = memo(({ rangeLabel }) => (
  <div className="oh-empty-state">
    <Spin size="large" />
    <div className="oh-empty-title" style={{ marginTop: 20 }}>
      Loading Orders
    </div>
    <div className="oh-empty-desc">
      Fetching orders for {rangeLabel.toLowerCase()}...
    </div>
  </div>
));

const ErrorState = memo(({ error, onRetry }) => (
  <div className="oh-empty-state">
    <div
      className="oh-empty-circle"
      style={{ background: "#fef2f2", borderColor: "#fecaca" }}
    >
      <span className="oh-empty-emoji">⚠</span>
    </div>
    <div className="oh-empty-title">Unable to Load Orders</div>
    <div className="oh-empty-desc">
      {typeof error === "string" ? error : "An unexpected error occurred."}
    </div>
    <button className="oh-btn-primary" onClick={onRetry} type="button">
      Try Again
    </button>
  </div>
));

const EmptyState = memo(
  ({
    orderIdSearch,
    customerSearch,
    statusFilter,
    rangeLabel,
    activePeriod,
    onClearFilters,
    onShowAll,
  }) => {
    const hasFilters =
      orderIdSearch.trim() || customerSearch.trim() || statusFilter !== "all";

    return (
      <div className="oh-empty-state">
        <div className="oh-empty-circle">
          <span className="oh-empty-emoji">📦</span>
        </div>
        <div className="oh-empty-title">
          {hasFilters ? "No Matching Orders" : "No Orders in This Period"}
        </div>
        <div className="oh-empty-desc">
          {hasFilters
            ? "Try adjusting the Order ID search, customer search, or status filter."
            : `No orders found for ${rangeLabel.toLowerCase()}. Try a wider date range.`}
        </div>

        {hasFilters && (
          <button className="oh-btn-secondary" onClick={onClearFilters} type="button">
            Clear Filters
          </button>
        )}

        {!hasFilters && activePeriod !== "all_time" && (
          <button className="oh-btn-primary" onClick={onShowAll} type="button">
            Show All Time
          </button>
        )}
      </div>
    );
  }
);

const FiltersDrawerContent = memo(
  ({
    open,
    onClose,
    activePeriod,
    onPeriodChange,
    displayDateRange,
    onDateChange,
    orderIdSearch,
    onOrderIdSearchChange,
    customerSearch,
    onCustomerSearchChange,
    statusFilter,
    onStatusChange,
    onExportPDF,
    onRefresh,
    canExport,
  }) => (
    <Drawer
      title={<span style={{ fontWeight: 800 }}>Filters & Actions</span>}
      placement="bottom"
      height="auto"
      open={open}
      onClose={onClose}
      styles={{ body: { padding: "0 16px 24px" } }}
    >
      <div className="oh-drawer-body">
        <div className="oh-drawer-field">
          <label className="oh-drawer-label">⚡ Quick Period</label>
          <div className="oh-quick-scroll" style={{ overflowX: "auto", paddingBottom: 4 }}>
            {QUICK_PERIODS.map((p) => (
              <button
                key={p.key}
                className={`oh-quick-chip ${activePeriod === p.key ? "is-active" : ""} ${
                  p.slow ? "is-all" : ""
                }`}
                onClick={() => onPeriodChange(p.key)}
                type="button"
              >
                <span className="oh-quick-icon">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="oh-drawer-field">
          <label className="oh-drawer-label">📅 Custom Date Range</label>
          <RangePicker
            value={displayDateRange}
            onChange={onDateChange}
            format="MMM D, YYYY"
            size="large"
            presets={DATE_PICKER_PRESETS}
            style={{ width: "100%" }}
          />
        </div>

        <div className="oh-drawer-field">
          <label className="oh-drawer-label">🔎 Search by Order ID</label>
          <Input
            placeholder="Enter order ID..."
            value={orderIdSearch}
            onChange={(e) => onOrderIdSearchChange(e.target.value)}
            size="large"
            allowClear
          />
        </div>

        <div className="oh-drawer-field">
          <label className="oh-drawer-label">👤 Search by Customer</label>
          <Input
            placeholder="Enter customer name..."
            value={customerSearch}
            onChange={(e) => onCustomerSearchChange(e.target.value)}
            size="large"
            allowClear
          />
        </div>

        <div className="oh-drawer-field">
          <label className="oh-drawer-label">🏷️ Status</label>
          <Select
            value={statusFilter}
            onChange={onStatusChange}
            size="large"
            style={{ width: "100%" }}
          >
            {STATUS_OPTIONS.map((s) => (
              <Select.Option key={s} value={s}>
                {s === "all" ? "All Statuses" : s}
              </Select.Option>
            ))}
          </Select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="large"
            disabled={!canExport}
            onClick={() => {
              onExportPDF();
              onClose();
            }}
            style={{ flex: 1 }}
          >
            Export PDF
          </Button>

          <Button
            size="large"
            onClick={() => {
              onRefresh();
              onClose();
            }}
            style={{ flex: 1 }}
          >
            Refresh
          </Button>
        </div>
      </div>
    </Drawer>
  )
);

const AgentOrders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const ordersState = useSelector(
    (state) => state.orders || { orders: [], loading: false, error: null }
  );

  const orders = ordersState.orders || [];
  const loading = ordersState.loading || false;
  const error = ordersState.error || null;

  const [dateRange, setDateRange] = useState(() =>
    QUICK_PERIODS.find((p) => p.key === "today").getRange()
  );
  const [activePeriod, setActivePeriod] = useState("today");

  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const customerObject = useMemo(() => {
    try {
      const stored = localStorage.getItem("customer");
      if (!stored || stored === "null") return null;
      return typeof stored === "string" ? JSON.parse(stored) : stored;
    } catch {
      return null;
    }
  }, []);

  const customerId = customerObject?.customerAccountNumber;
  const hasValidCustomer = !!(customerObject && customerId);

  const [viewedOrders, setViewedOrders] = useState(() => {
    try {
      const storedCustomer = localStorage.getItem("customer");
      const parsedCustomer =
        storedCustomer && storedCustomer !== "null"
          ? JSON.parse(storedCustomer)
          : null;
      const localCustomerId = parsedCustomer?.customerAccountNumber;
      if (!localCustomerId) return new Set();

      const stored = localStorage.getItem(`viewedOrders_${localCustomerId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!customerId) {
      setViewedOrders(new Set());
      return;
    }

    try {
      const stored = localStorage.getItem(`viewedOrders_${customerId}`);
      setViewedOrders(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch {
      setViewedOrders(new Set());
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    try {
      localStorage.setItem(
        `viewedOrders_${customerId}`,
        JSON.stringify([...viewedOrders])
      );
    } catch {
      // ignore
    }
  }, [viewedOrders, customerId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const fetchOrders = useCallback(
    (range) => {
      if (!hasValidCustomer || !range?.[0] || !range?.[1]) return;

      const from = range[0].format("MM/DD/YYYY");
      const to = range[1].format("MM/DD/YYYY");

      dispatch(fetchOrdersByCustomer({ from, to, customerId }));
    },
    [dispatch, customerId, hasValidCustomer]
  );

  useEffect(() => {
    fetchOrders(dateRange);
  }, [dateRange, fetchOrders]);

  const handleDateChange = useCallback(
    (dates) => {
      if (!dates || !dates[0] || !dates[1]) return;

      const adjustedRange = [
        dates[0].startOf("day"),
        dates[1].add(1, "day").endOf("day"),
      ];

      setDateRange(adjustedRange);
      setActivePeriod(detectPeriodKey(adjustedRange));
      resetPagination();
    },
    [resetPagination]
  );

  const handleQuickPeriod = useCallback(
    (periodKey) => {
      const period = QUICK_PERIODS.find((p) => p.key === periodKey);
      if (!period) return;

      setActivePeriod(periodKey);
      setDateRange(period.getRange());
      resetPagination();
    },
    [resetPagination]
  );

  const handleViewOrder = useCallback((orderId) => {
    setSelectedOrderId(orderId);
    setIsOrderModalVisible(true);

    setViewedOrders((prev) => {
      if (prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
  }, []);

  const handleOrderModalClose = useCallback(() => {
    setIsOrderModalVisible(false);
    setSelectedOrderId(null);
  }, []);

  const handleSignInClick = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    fetchOrders(dateRange);
  }, [fetchOrders, dateRange]);

  const transformedOrders = useMemo(() => {
    return (orders || [])
      .map((order, index) => {
        const orderDay = dayjs(order?.orderDate);
        const fd = friendlyDate(orderDay);

        return {
          key: order?.orderCode || `${index}`,
          orderId: String(order?.orderCode || "N/A"),
          datePrimary: fd.primary,
          dateSecondary: fd.secondary,
          dateTime: fd.time,
          isRecent: fd.isRecent,
          dayKey: orderDay.isValid() ? orderDay.format("YYYY-MM-DD") : "unknown",
          dayHeader: friendlyDayHeader(orderDay),
          customerName: order?.fullName || "N/A",
          contactNumber: order?.contactNumber || "N/A",
          orderCycle: order?.orderCycle || "N/A",
          paymentMode: order?.paymentMode || "N/A",
          quantity: order?.quantity ?? 0,
          price: order?.price ?? 0,
          total: order?.total ?? 0,
          _timestamp: orderDay.isValid() ? orderDay.valueOf() : 0,
        };
      })
      .filter((order) => {
        const matchesOrderId = order.orderId
          .toLowerCase()
          .includes(orderIdSearch.trim().toLowerCase());

        const matchesCustomer = order.customerName
          .toLowerCase()
          .includes(customerSearch.trim().toLowerCase());

        const matchesStatus =
          statusFilter === "all" || order.orderCycle === statusFilter;

        return matchesOrderId && matchesCustomer && matchesStatus;
      })
      .sort((a, b) => b._timestamp - a._timestamp);
  }, [orders, orderIdSearch, customerSearch, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(transformedOrders.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [transformedOrders.length, currentPage, pageSize]);

  const groupedOrders = useMemo(() => {
    const groups = [];
    const map = {};

    transformedOrders.forEach((order) => {
      if (!map[order.dayKey]) {
        map[order.dayKey] = {
          header: order.dayHeader,
          items: [],
        };
        groups.push(map[order.dayKey]);
      }

      map[order.dayKey].items.push(order);
    });

    return groups;
  }, [transformedOrders]);

  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((o) =>
      ["Delivery", "Completed"].includes(o.orderCycle)
    ).length;
    const inProgress = orders.filter((o) =>
      ["Processing", "Pending", "Testing", "Wrong Number", "Order Placement"].includes(
        o.orderCycle
      )
    ).length;
    const cancelled = orders.filter((o) => o.orderCycle === "Cancelled").length;

    return { total, completed, inProgress, cancelled };
  }, [orders]);

  const rangeLabel = useMemo(() => {
    const period = QUICK_PERIODS.find((p) => p.key === activePeriod);
    if (period) return period.label;

    const from = dateRange?.[0]?.format("MMM D");
    const to = dateRange?.[1]?.subtract(1, "day").format("MMM D, YYYY");
    return `${from} – ${to}`;
  }, [activePeriod, dateRange]);

  const displayDateRange = useMemo(() => {
    return [dateRange[0], dateRange[1].subtract(1, "day")];
  }, [dateRange]);

  const clearFilters = useCallback(() => {
    setOrderIdSearch("");
    setCustomerSearch("");
    setStatusFilter("all");
    resetPagination();
  }, [resetPagination]);

  const showAllTime = useCallback(() => {
    handleQuickPeriod("all_time");
  }, [handleQuickPeriod]);

  const handleExportPDF = useCallback(() => {
    if (transformedOrders.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order History</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            * { box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; margin: 32px; color: #1a1a1a; background: #fff; }
            .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #14532d; }
            .header h1 { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #14532d; }
            .header p { font-size: 13px; color: #666; margin: 0; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 13px; color: #555; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; gap: 12px; flex-wrap: wrap; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #14532d; color: #fff; text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
            td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
            tr:nth-child(even) { background: #fafafa; }
            .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Order History Report</h1>
            <p>Customer: ${customerObject?.fullName || "N/A"}</p>
          </div>

          <div class="meta">
            <span><strong>Period:</strong> ${dateRange[0].format("MMM D, YYYY")} – ${dateRange[1]
      .subtract(1, "day")
      .format("MMM D, YYYY")}</span>
            <span><strong>Total Orders:</strong> ${transformedOrders.length}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Viewed</th>
              </tr>
            </thead>
            <tbody>
              ${transformedOrders
                .map(
                  (o) => `
                    <tr>
                      <td>#${o.orderId}</td>
                      <td>${o.dateSecondary} ${o.dateTime}</td>
                      <td>${o.customerName}</td>
                      <td>${o.paymentMode}</td>
                      <td>${o.orderCycle}</td>
                      <td>${viewedOrders.has(o.orderId) ? "✓" : "—"}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated on ${dayjs().format("MMMM D, YYYY [at] h:mm A")}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }, [customerObject, dateRange, transformedOrders, viewedOrders]);

  const columns = useMemo(
    () => [
      {
        title: "Date",
        dataIndex: "datePrimary",
        key: "datePrimary",
        width: 220,
        render: (text, record) => (
          <div className="oh-date-cell">
            <div className="oh-date-primary-row">
              <span className={`oh-date-primary ${record.isRecent ? "is-recent" : ""}`}>
                {text}
              </span>
              {record.isRecent && <span className="oh-date-new-dot" />}
            </div>
            <span className="oh-date-secondary">
              {record.dateSecondary} · {record.dateTime}
            </span>
          </div>
        ),
        sorter: (a, b) => a._timestamp - b._timestamp,
        defaultSortOrder: "descend",
      },
      {
        title: "Order",
        dataIndex: "orderId",
        key: "orderId",
        width: 150,
        render: (text) => <span className="oh-mono-id">#{text}</span>,
      },
  
      
      {
        title: "Payment",
        dataIndex: "paymentMode",
        key: "paymentMode",
        width: 180,
        render: (mode) => {
          const cfg = getPaymentConfig(mode);
          return (
            <span
              className="oh-badge-pill"
              style={{
                background: cfg.bg,
                color: cfg.color,
                borderColor: cfg.border,
              }}
            >
              <span className="oh-badge-dot" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "orderCycle",
        key: "orderCycle",
        width: 170,
        render: (status) => {
          const cfg = getStatusConfig(status);
          return (
            <span
              className="oh-badge-pill"
              style={{
                background: cfg.bg,
                color: cfg.color,
                borderColor: cfg.border,
              }}
            >
              <span className="oh-badge-dot" style={{ background: cfg.dot }} />
              {status}
            </span>
          );
        },
      },
      {
        title: "Viewed",
        key: "viewed",
        width: 90,
        align: "center",
        render: (_, record) =>
          viewedOrders.has(record.orderId) ? (
            <Tooltip title="You have viewed this order">
              <span className="oh-tick">✓</span>
            </Tooltip>
          ) : (
            <Tooltip title="Not viewed yet">
              <span className="oh-tick-empty">—</span>
            </Tooltip>
          ),
      },
      {
        title: "",
        key: "action",
        width: 56,
        render: (_, record) => (
          <Tooltip title="View Details">
            <button
              className="oh-view-icon-btn"
              onClick={() => handleViewOrder(record.orderId)}
              type="button"
            >
              <span className="oh-eye-char">◉</span>
            </button>
          </Tooltip>
        ),
      },
    ],
    [viewedOrders, handleViewOrder]
  );

  if (!hasValidCustomer) {
    return (
      <>
        <style>{styles}</style>
        <div className="oh-root">
          <div className="oh-container">
            <div className="oh-page-header">
              <div className="oh-header-bar" />
              <div>
                <h1 className="oh-page-title">Order History</h1>
                <p className="oh-page-subtitle">Track and manage your orders</p>
              </div>
            </div>

            <div className="oh-main-card">
              <NoCustomerState onSignInClick={handleSignInClick} />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className="oh-root">
        <div className="oh-container">
          <div className="oh-page-header">
            <div className="oh-header-bar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="oh-page-title">Order History</h1>
              <p className="oh-page-subtitle">
                {loading
                  ? `Loading ${rangeLabel.toLowerCase()}...`
                  : `${transformedOrders.length} order${
                      transformedOrders.length !== 1 ? "s" : ""
                    } · ${rangeLabel}`}
              </p>
            </div>

            <button
              className="oh-refresh-btn"
              onClick={handleRefresh}
              title="Refresh"
              type="button"
            >
              ↻
            </button>

            <button
              className="oh-mobile-filter-btn"
              onClick={() => setFiltersDrawerOpen(true)}
              type="button"
            >
              ☰ Filters
            </button>
          </div>

          <QuickPeriodBar
            activePeriod={activePeriod}
            onPeriodChange={handleQuickPeriod}
          />

          {!loading && !error && orders.length > 0 && (
            <div className="oh-stats-grid">
              <StatCard value={stats.total} label="Total" emoji="📦" color="#2563eb" />
              <StatCard value={stats.completed} label="Completed" emoji="✓" color="#16a34a" />
              <StatCard value={stats.inProgress} label="In Progress" emoji="⏳" color="#ea580c" />
              <StatCard value={stats.cancelled} label="Cancelled" emoji="✕" color="#dc2626" />
            </div>
          )}

          <div className="oh-filters-bar">
            <div className="oh-filter-group">
              <label className="oh-filter-label">📅 Custom Date Range</label>
              <RangePicker
                value={displayDateRange}
                onChange={handleDateChange}
                format="MMM D, YYYY"
                presets={DATE_PICKER_PRESETS}
                allowClear={false}
                style={{ width: "100%" }}
              />
            </div>

            <div className="oh-filter-group">
              <label className="oh-filter-label">🔎 Search by Order ID</label>
              <Input
                placeholder="Search order ID..."
                value={orderIdSearch}
                onChange={(e) => {
                  setOrderIdSearch(e.target.value);
                  resetPagination();
                }}
                allowClear
              />
            </div>

            <div className="oh-filter-group">
              <label className="oh-filter-label">👤 Search by Customer</label>
              <Input
                placeholder="Search customer..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  resetPagination();
                }}
                allowClear
              />
            </div>

            <div className="oh-filter-group">
              <label className="oh-filter-label">🏷️ Status</label>
              <Select
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  resetPagination();
                }}
                style={{ width: "100%" }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <Select.Option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="oh-filter-group">
              <label className="oh-filter-label">📄 Export</label>
              <Button
                disabled={transformedOrders.length === 0}
                onClick={handleExportPDF}
                block
              >
                Export PDF
              </Button>
            </div>
          </div>

          {(orderIdSearch || customerSearch || statusFilter !== "all") && (
            <div className="oh-active-filters">
              <span className="oh-active-label">Filters:</span>

              {orderIdSearch && (
                <span className="oh-chip">
                  Order ID: “{orderIdSearch}”
                  <button
                    onClick={() => {
                      setOrderIdSearch("");
                      resetPagination();
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              )}

              {customerSearch && (
                <span className="oh-chip">
                  Customer: “{customerSearch}”
                  <button
                    onClick={() => {
                      setCustomerSearch("");
                      resetPagination();
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              )}

              {statusFilter !== "all" && (
                <span className="oh-chip">
                  {statusFilter}
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      resetPagination();
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              )}

              <button className="oh-clear-all" onClick={clearFilters} type="button">
                Clear all
              </button>
            </div>
          )}

          <div className="oh-main-card">
            {loading ? (
              <LoadingState rangeLabel={rangeLabel} />
            ) : error ? (
              <ErrorState error={error} onRetry={handleRefresh} />
            ) : transformedOrders.length > 0 ? (
              <>
                <div className="oh-desktop-table">
                  <Table
                    dataSource={transformedOrders}
                    columns={columns}
                    rowKey="key"
                    rowClassName={(record) =>
                      viewedOrders.has(record.orderId) ? "oh-row-viewed" : ""
                    }
                    pagination={{
                      current: currentPage,
                      pageSize,
                      showSizeChanger: true,
                      showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
                      onChange: (page, size) => {
                        setCurrentPage(page);
                        setPageSize(size);
                      },
                      onShowSizeChange: (page, size) => {
                        setCurrentPage(page);
                        setPageSize(size);
                      },
                    }}
                    size="middle"
                    scroll={{ x: 1000 }}
                  />
                </div>

                <div className="oh-mobile-list">
                  <div className="oh-mobile-count">
                    Showing {transformedOrders.length} order
                    {transformedOrders.length !== 1 ? "s" : ""}
                  </div>

                  {groupedOrders.map((group) => (
                    <div key={group.header} className="oh-day-group">
                      <div className="oh-day-header">
                        <span className="oh-day-header-text">{group.header}</span>
                        <span className="oh-day-header-count">{group.items.length}</span>
                      </div>

                      {group.items.map((order) => (
                        <MobileOrderCard
                          key={order.key}
                          order={order}
                          onViewOrder={handleViewOrder}
                          isViewed={viewedOrders.has(order.orderId)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                orderIdSearch={orderIdSearch}
                customerSearch={customerSearch}
                statusFilter={statusFilter}
                rangeLabel={rangeLabel}
                activePeriod={activePeriod}
                onClearFilters={clearFilters}
                onShowAll={showAllTime}
              />
            )}
          </div>
        </div>

        <AgentOrderModal
          orderId={selectedOrderId}
          isModalVisible={isOrderModalVisible}
          onClose={handleOrderModalClose}
        />

        <FiltersDrawerContent
          open={filtersDrawerOpen}
          onClose={() => setFiltersDrawerOpen(false)}
          activePeriod={activePeriod}
          onPeriodChange={handleQuickPeriod}
          displayDateRange={displayDateRange}
          onDateChange={handleDateChange}
          orderIdSearch={orderIdSearch}
          onOrderIdSearchChange={(value) => {
            setOrderIdSearch(value);
            resetPagination();
          }}
          customerSearch={customerSearch}
          onCustomerSearchChange={(value) => {
            setCustomerSearch(value);
            resetPagination();
          }}
          statusFilter={statusFilter}
          onStatusChange={(value) => {
            setStatusFilter(value);
            resetPagination();
          }}
          onExportPDF={handleExportPDF}
          onRefresh={handleRefresh}
          canExport={transformedOrders.length > 0}
        />
      </div>
    </>
  );
};

export default AgentOrders;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  :root {
    --oh-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --oh-green: #14532d;
    --oh-green-mid: #166534;
    --oh-green-accent: #22c55e;
    --oh-green-lighter: #f0fdf4;
    --oh-dark: #111;
    --oh-mid: #555;
    --oh-light: #999;
    --oh-border: #e5e7eb;
    --oh-bg: #f8f9fa;
    --oh-surface: #fff;
    --oh-radius: 10px;
    --oh-radius-lg: 14px;
    --oh-shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
    --oh-shadow-sm: 0 1px 4px rgba(0,0,0,0.06);
    --oh-shadow-md: 0 4px 20px rgba(0,0,0,0.07);
    --oh-transition: 0.2s ease;
  }

  *, *::before, *::after { box-sizing: border-box; }
  .oh-root, .oh-root * { font-family: var(--oh-font) !important; -webkit-font-smoothing: antialiased; }
  .oh-root { min-height: 100vh; background: var(--oh-bg); }

  .oh-container { max-width: 2280px; margin: 0 auto; padding: 20px 16px 20px; }
  @media (min-width: 768px) { .oh-container { padding: 36px 48px 60px; } }

  .oh-page-header {
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 20px; padding-bottom: 18px;
    border-bottom: 1px solid var(--oh-border); flex-wrap: wrap;
  }

  .oh-header-bar {
    width: 4px; height: 34px; border-radius: 4px;
    background: linear-gradient(180deg, var(--oh-green) 0%, var(--oh-green-accent) 100%);
    flex-shrink: 0;
  }

  .oh-page-title {
    font-size: 24px; font-weight: 800; color: var(--oh-dark);
    letter-spacing: -0.035em; margin: 0; line-height: 1.15;
  }

  @media (min-width: 768px) {
    .oh-page-title { font-size: 30px; }
  }

  .oh-page-subtitle {
    font-size: 13px; font-weight: 500; color: var(--oh-light);
    margin: 4px 0 0;
  }

  .oh-refresh-btn {
    display: none; align-items: center; justify-content: center;
    width: 40px; height: 40px; background: var(--oh-surface);
    border: 1px solid var(--oh-border); border-radius: var(--oh-radius);
    color: var(--oh-mid); cursor: pointer; transition: all var(--oh-transition);
    font-size: 20px; margin-left: auto;
  }

  .oh-refresh-btn:hover {
    background: var(--oh-green-lighter);
    border-color: var(--oh-green-accent);
    color: var(--oh-green);
  }

  @media (min-width: 768px) {
    .oh-refresh-btn { display: flex; }
  }

  .oh-mobile-filter-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 18px; background: var(--oh-green); color: #fff;
    border: none; border-radius: var(--oh-radius);
    font-size: 13px; font-weight: 600; cursor: pointer;
    margin-left: auto; transition: all var(--oh-transition);
    box-shadow: var(--oh-shadow-xs);
  }

  .oh-mobile-filter-btn:hover { background: var(--oh-green-mid); }
  .oh-mobile-filter-btn:active { transform: scale(0.97); }

  @media (min-width: 768px) {
    .oh-mobile-filter-btn { display: none; }
  }

  .oh-quick-bar {
    margin-bottom: 18px;
    padding: 10px 12px;
    background: var(--oh-surface);
    border: 1px solid var(--oh-border);
    border-radius: var(--oh-radius-lg);
    box-shadow: var(--oh-shadow-xs);
  }

  .oh-quick-scroll {
    display: flex; gap: 8px; overflow-x: auto;
    scrollbar-width: none; -ms-overflow-style: none;
  }

  .oh-quick-scroll::-webkit-scrollbar { display: none; }

  .oh-quick-chip {
    position: relative;
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px;
    border-radius: 100px;
    background: #f4f5f7;
    border: 1px solid transparent;
    color: var(--oh-mid);
    font-size: 12.5px; font-weight: 600;
    cursor: pointer;
    transition: all var(--oh-transition);
    font-family: var(--oh-font);
    white-space: nowrap;
  }

  .oh-quick-icon { font-size: 14px; line-height: 1; }

  .oh-quick-chip:hover {
    background: #eef0f3;
    color: var(--oh-dark);
    transform: translateY(-1px);
  }

  .oh-quick-chip.is-active {
    background: var(--oh-green);
    color: #fff;
    border-color: var(--oh-green);
    box-shadow: 0 2px 8px rgba(20,83,45,0.18);
  }

  .oh-quick-chip.is-all.is-active {
    background: linear-gradient(135deg, #b91c1c, #ea580c);
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(234,88,12,0.25);
  }

  .oh-quick-chip.is-custom { cursor: default; }

  .oh-quick-hint {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 100px;
    background: rgba(255,255,255,0.25);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .oh-quick-chip.is-all:not(.is-active) .oh-quick-hint {
    background: #fee2e2;
    color: #b91c1c;
  }

  .oh-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }

  @media (min-width: 768px) {
    .oh-stats-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
  }

  .oh-stat-card {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 20px; background: var(--oh-surface);
    border: 1px solid var(--oh-border); border-radius: var(--oh-radius-lg);
    border-left: 3px solid var(--stat-color); transition: all var(--oh-transition);
    box-shadow: var(--oh-shadow-xs);
  }

  .oh-stat-card:hover { box-shadow: var(--oh-shadow-md); transform: translateY(-2px); }
  .oh-stat-content { display: flex; flex-direction: column; }
  .oh-stat-value { font-size: 28px; font-weight: 900; color: var(--stat-color); letter-spacing: -0.04em; line-height: 1; }

  @media (min-width: 768px) {
    .oh-stat-value { font-size: 36px; }
  }

  .oh-stat-label {
    font-size: 11px; font-weight: 700; color: var(--oh-light);
    margin-top: 6px; text-transform: uppercase; letter-spacing: 0.08em;
  }

  .oh-stat-emoji { font-size: 28px; opacity: 0.25; line-height: 1; }

  .oh-filters-bar {
    display: none;
    grid-template-columns: 1.2fr 1fr 1fr 1fr 0.8fr;
    gap: 14px;
    padding: 20px 22px; background: var(--oh-surface);
    border: 1px solid var(--oh-border); border-radius: var(--oh-radius-lg);
    margin-bottom: 16px; box-shadow: var(--oh-shadow-xs);
  }

  @media (min-width: 768px) {
    .oh-filters-bar { display: grid; }
  }

  .oh-filter-group { display: flex; flex-direction: column; gap: 7px; }

  .oh-filter-label {
    font-size: 10px; font-weight: 700; color: var(--oh-light);
    text-transform: uppercase; letter-spacing: 0.08em;
  }

  .oh-active-filters {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 18px; background: var(--oh-green-lighter);
    border: 1px solid #bbf7d0; border-radius: var(--oh-radius);
    margin-bottom: 16px; flex-wrap: wrap; font-size: 13px;
  }

  .oh-active-label {
    font-weight: 700; color: var(--oh-green); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }

  .oh-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; background: #fff;
    border: 1px solid #bbf7d0; border-radius: 100px;
    font-size: 12px; font-weight: 500; color: var(--oh-mid);
  }

  .oh-chip button {
    background: none; border: none; color: var(--oh-light);
    cursor: pointer; font-size: 18px; line-height: 1; padding: 0; margin-left: 2px;
  }

  .oh-chip button:hover { color: #dc2626; }

  .oh-clear-all {
    background: none; border: none; color: var(--oh-green);
    font-weight: 600; font-size: 12px; cursor: pointer; margin-left: auto;
    font-family: var(--oh-font); text-decoration: underline; text-underline-offset: 2px;
  }

  .oh-main-card {
    background: var(--oh-surface);
    border: 1px solid var(--oh-border);
    border-radius: var(--oh-radius-lg);
    overflow: hidden;
    box-shadow: var(--oh-shadow-sm);
  }

  .oh-desktop-table { display: none; }
  @media (min-width: 768px) { .oh-desktop-table { display: block; } }

  .oh-desktop-table .ant-table { border-radius: 0 !important; }
  .oh-desktop-table .ant-table-thead > tr > th {
    background: #f4f5f7 !important;
    border-bottom: 2px solid var(--oh-border) !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    color: #9ca3af !important;
    padding: 14px 20px !important;
    font-family: var(--oh-font) !important;
  }

  .oh-desktop-table .ant-table-tbody > tr > td {
    padding: 16px 20px !important;
    border-bottom: 1px solid #f3f4f6 !important;
    font-size: 13px !important;
    font-family: var(--oh-font) !important;
    vertical-align: middle !important;
  }

  .oh-desktop-table .ant-table-tbody > tr:last-child > td {
    border-bottom: none !important;
  }

  .oh-desktop-table .ant-table-tbody > tr:hover > td {
    background: #fafbfc !important;
  }

  .oh-desktop-table .ant-table-tbody > tr.oh-row-viewed > td {
    background: #f0fdf4 !important;
  }

  .oh-desktop-table .ant-table-tbody > tr.oh-row-viewed:hover > td {
    background: #e7fbef !important;
  }

  .oh-desktop-table .ant-pagination {
    padding: 18px 22px !important;
    font-family: var(--oh-font) !important;
  }

  .oh-desktop-table .ant-pagination-item-active {
    background: var(--oh-green) !important;
    border-color: var(--oh-green) !important;
  }

  .oh-desktop-table .ant-pagination-item-active a {
    color: #fff !important;
  }

  .oh-mono-id {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 13px; font-weight: 600; color: var(--oh-dark);
    background: #f4f5f7; padding: 4px 10px; border-radius: 6px;
    border: 1px solid #e5e7eb; display: inline-block;
  }

  .oh-date-cell { display: flex; flex-direction: column; gap: 3px; }
  .oh-date-primary-row { display: flex; align-items: center; gap: 6px; }

  .oh-date-primary {
    font-size: 14px; font-weight: 700; color: var(--oh-dark); line-height: 1.2;
  }

  .oh-date-primary.is-recent { color: var(--oh-green); }

  .oh-date-new-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--oh-green-accent);
    box-shadow: 0 0 0 3px rgba(34,197,94,0.18);
    animation: oh-pulse 2s infinite;
  }

  @keyframes oh-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .oh-date-secondary {
    font-size: 11.5px; color: var(--oh-light); font-weight: 500;
  }

  .oh-badge-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 100px; border: 1px solid;
    font-size: 11px; font-weight: 600; white-space: nowrap; letter-spacing: 0.01em;
  }

  .oh-badge-dot {
    width: 7px; height: 7px; border-radius: 50%;
    flex-shrink: 0; display: inline-block;
  }

  .oh-tick {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 50%;
    background: var(--oh-green-lighter); color: var(--oh-green-mid);
    border: 1px solid #bbf7d0; font-size: 13px; font-weight: 800;
    line-height: 1; animation: oh-tick-pop 0.25s ease;
  }

  .oh-tick-sm { width: 20px; height: 20px; font-size: 11px; }
  .oh-tick-empty { color: #d1d5db; font-weight: 700; }

  @keyframes oh-tick-pop {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }

  .oh-view-icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; background: #f9fafb;
    border: 1px solid #e5e7eb; border-radius: 8px;
    color: #888; cursor: pointer; transition: all var(--oh-transition);
    font-size: 18px; line-height: 1;
  }

  .oh-view-icon-btn:hover {
    background: var(--oh-green-lighter);
    border-color: var(--oh-green-accent);
    color: var(--oh-green);
  }

  .oh-eye-char { font-size: 16px; display: block; line-height: 1; }

  .oh-mobile-list { display: block; padding: 14px; }
  @media (min-width: 768px) { .oh-mobile-list { display: none; } }

  .oh-mobile-count {
    font-size: 11px; font-weight: 700; color: var(--oh-light);
    text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 4px 14px;
  }

  .oh-day-group { margin-bottom: 18px; }

  .oh-day-header {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 4px 12px;
    position: sticky; top: 0; z-index: 2;
  }

  .oh-day-header-text {
    font-size: 13px; font-weight: 800; color: var(--oh-dark); letter-spacing: -0.01em;
  }

  .oh-day-header-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 20px; height: 20px; padding: 0 6px;
    background: var(--oh-green-lighter); color: var(--oh-green);
    border: 1px solid #bbf7d0; border-radius: 100px;
    font-size: 11px; font-weight: 700;
  }

  .oh-mobile-card {
    border: 1px solid var(--oh-border); border-radius: var(--oh-radius-lg);
    padding: 16px 18px; margin-bottom: 10px; cursor: pointer;
    transition: all var(--oh-transition); background: var(--oh-surface);
    box-shadow: var(--oh-shadow-xs);
  }

  .oh-mobile-card:hover {
    border-color: #d1d5db;
    box-shadow: var(--oh-shadow-md);
    transform: translateY(-2px);
  }

  .oh-mobile-card:active { transform: translateY(0); }

  .oh-mc-row-top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; margin-bottom: 14px;
  }

  .oh-mc-id {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 15px; font-weight: 700; color: var(--oh-dark); letter-spacing: -0.01em;
  }

  .oh-mc-row-mid {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 12px 0;
    border-top: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6;
  }

  .oh-mc-time-block { display: flex; align-items: center; gap: 6px; }
  .oh-mc-clock { font-size: 13px; opacity: 0.6; }
  .oh-mc-time { font-size: 13px; font-weight: 600; color: var(--oh-mid); }

  .oh-mc-field {
    display: flex; flex-direction: column; gap: 2px; align-items: flex-end;
  }

  .oh-mc-field-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--oh-light);
  }

  .oh-mc-field-value {
    font-size: 13px; font-weight: 500; color: var(--oh-mid); line-height: 1.4;
  }

  .oh-mc-row-bottom {
    margin-top: 12px; display: flex; justify-content: flex-end;
  }

  .oh-mc-view-link {
    font-size: 12px; font-weight: 700; color: var(--oh-green); letter-spacing: 0.01em;
  }

  .oh-empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 64px 24px;
  }

  .oh-empty-circle {
    width: 88px; height: 88px; border-radius: 50%; background: var(--oh-bg);
    display: flex; align-items: center; justify-content: center; margin-bottom: 22px;
    border: 1px solid var(--oh-border);
  }

  .oh-empty-emoji { font-size: 36px; line-height: 1; opacity: 0.5; }

  .oh-empty-title {
    font-size: 20px; font-weight: 800; color: var(--oh-dark);
    margin-bottom: 8px; letter-spacing: -0.02em;
  }

  .oh-empty-desc {
    font-size: 14px; color: var(--oh-light); max-width: 360px;
    line-height: 1.7; margin-bottom: 28px;
  }

  .oh-btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 12px 36px; border-radius: var(--oh-radius);
    font-size: 14px; font-weight: 600; cursor: pointer;
    transition: all var(--oh-transition); font-family: var(--oh-font);
    border: none; background: var(--oh-green); color: #fff; box-shadow: var(--oh-shadow-sm);
  }

  .oh-btn-primary:hover {
    background: var(--oh-green-mid);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(20, 83, 45, 0.2);
  }

  .oh-btn-secondary {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 12px 36px; border-radius: var(--oh-radius);
    font-size: 14px; font-weight: 600; cursor: pointer;
    transition: all var(--oh-transition); font-family: var(--oh-font);
    border: 1px solid var(--oh-border); background: var(--oh-surface); color: var(--oh-mid);
  }

  .oh-btn-secondary:hover {
    background: var(--oh-bg); border-color: #ccc; color: var(--oh-dark);
  }

  .oh-drawer-body { display: flex; flex-direction: column; gap: 18px; }
  .oh-drawer-field { display: flex; flex-direction: column; gap: 7px; }

  .oh-drawer-label {
    font-size: 10px; font-weight: 700; color: var(--oh-light);
    text-transform: uppercase; letter-spacing: 0.08em;
  }

  .ant-picker,
  .ant-input,
  .ant-select-selector,
  .ant-btn {
    border-radius: var(--oh-radius) !important;
    font-family: var(--oh-font) !important;
  }

  .ant-input:focus,
  .ant-input-focused,
  .ant-picker-focused,
  .ant-select-focused .ant-select-selector {
    border-color: var(--oh-green) !important;
    box-shadow: 0 0 0 3px rgba(20, 83, 45, 0.08) !important;
  }

  .ant-btn-primary {
    background: var(--oh-green) !important;
    border-color: var(--oh-green) !important;
  }

  .ant-btn-primary:hover {
    background: var(--oh-green-mid) !important;
    border-color: var(--oh-green-mid) !important;
  }

  .ant-drawer-header { border-bottom: 1px solid var(--oh-border) !important; }
  .ant-drawer-title { font-family: var(--oh-font) !important; font-weight: 800 !important; }
  .ant-table-filter-dropdown { border-radius: var(--oh-radius) !important; font-family: var(--oh-font) !important; }

  .ant-picker-presets ul li {
    color: var(--oh-green) !important;
    font-weight: 600 !important;
  }

  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner,
  .ant-picker-cell-in-view.ant-picker-cell-range-start .ant-picker-cell-inner,
  .ant-picker-cell-in-view.ant-picker-cell-range-end .ant-picker-cell-inner {
    background: var(--oh-green) !important;
  }
`;