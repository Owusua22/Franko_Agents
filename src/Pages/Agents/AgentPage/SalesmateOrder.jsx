import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getCTP001Orders,
  selectCTP001Orders,
  selectCTP001OrdersLoading,
  selectCTP001OrdersError,
  clearCTP001Orders,
} from "../../../Redux/Slice/ctp001Slice";

/* ─────────────────────────────────────────────
Small UI helpers
───────────────────────────────────────────── */

const Field = ({ label, children }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>
    {children}
  </label>
);

function LoaderInline({ size = 16 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid #cbd5e1",
        borderTopColor: "#2563eb",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

const isoStartOfDay = (yyyyMmDd) =>
  yyyyMmDd ? `${yyyyMmDd}T00:00:00` : undefined;

const isoEndOfDay = (yyyyMmDd) =>
  yyyyMmDd ? `${yyyyMmDd}T23:59:59` : undefined;

const normalizeId = (v) => String(v ?? "").trim();
const containsCI = (text, q) =>
  String(text ?? "").toLowerCase().includes(String(q ?? "").toLowerCase());

const formatDate = (dateString) => {
  if (!dateString) return "-";

  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);

    return d.toLocaleDateString();
  } catch {
    return String(dateString);
  }
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "-";
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  return num.toLocaleString("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  });
};

const sumOrderTotal = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce(
    (acc, it) => acc + Number(it?.price || 0) * Number(it?.quantity || 0),
    0
  );
};

export default function OrdersPage() {
  const dispatch = useDispatch();

  const ordersFromApi = useSelector(selectCTP001Orders);
  const loading = useSelector(selectCTP001OrdersLoading);
  const error = useSelector(selectCTP001OrdersError);

  const n1UId = useSelector((s) => s?.customer?.currentCustomerDetails?.n1UId);

  // Server filters
  const [CartId, setCartId] = useState("");
  const [StartDate, setStartDate] = useState("");
  const [EndDate, setEndDate] = useState("");

  // Client-side search filters
  const [searchCustomerName, setSearchCustomerName] = useState("");
  const [searchProductName, setSearchProductName] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const query = useMemo(() => ({
    CartId: CartId.trim() || undefined,
    StartDate: StartDate ? isoStartOfDay(StartDate) : undefined,
    EndDate: EndDate ? isoEndOfDay(EndDate) : undefined,
  }), [CartId, StartDate, EndDate]);

  // Fetch orders when n1UId or query changes
  useEffect(() => {
    if (n1UId) {
      dispatch(getCTP001Orders(query));
    }
    return () => dispatch(clearCTP001Orders());
  }, [dispatch, n1UId, query]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    if (n1UId) dispatch(getCTP001Orders(query));
  };

  const onReset = () => {
    setCartId("");
    setStartDate("");
    setEndDate("");
    setSearchCustomerName("");
    setSearchProductName("");
    setPage(1);
    if (n1UId) dispatch(getCTP001Orders({}));
  };

  // Only show orders belonging to current user
  const myOrders = useMemo(() => {
    const me = normalizeId(n1UId);
    if (!me) return [];
    return (ordersFromApi || []).filter(
      (o) => normalizeId(o?.customerId) === me
    );
  }, [ordersFromApi, n1UId]);

  // Client-side filtering by customer name and product name
  const searchedOrders = useMemo(() => {
    const qCustomer = searchCustomerName.trim();
    const qProduct = searchProductName.trim();

    if (!qCustomer && !qProduct) return myOrders;

    return myOrders.filter((order) => {
      const customerOk = !qCustomer || containsCI(order?.customerName, qCustomer);

      const items = Array.isArray(order?.items) ? order.items : [];
      const productOk =
        !qProduct ||
        items.some((it) => containsCI(it?.variantName, qProduct));

      return customerOk && productOk;
    });
  }, [myOrders, searchCustomerName, searchProductName]);

  const totalOrders = searchedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));

  // Prevent invalid page numbers
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return searchedOrders.slice(start, start + pageSize);
  }, [searchedOrders, page, pageSize]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      {/* Keyframes for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0 }}>My Orders</h2>
          {loading && (
            <span
              style={{
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              <LoaderInline size={16} />
              Loading…
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Showing {pagedOrders.length} of {totalOrders} order(s)
        </div>
      </header>

      {/* Filters */}
      <form
        onSubmit={onSearch}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <Field label="Agent/Customer ID (n1UId)">
          <input
            value={n1UId || ""}
            readOnly
            disabled
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              fontSize: 14,
            }}
          />
        </Field>

        <Field label="Cart ID">
          <input
            value={CartId}
            onChange={(e) => setCartId(e.target.value)}
            placeholder="Enter Cart ID"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </Field>

        <Field label="Search Customer Name (local)">
          <input
            value={searchCustomerName}
            onChange={(e) => {
              setSearchCustomerName(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. AMANDA"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </Field>

        <Field label="Search Product Name (local)">
          <input
            value={searchProductName}
            onChange={(e) => {
              setSearchProductName(e.target.value);
              setPage(1);
            }}
            placeholder='e.g. "HP CORE 5"'
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </Field>

        <Field label="Start Date">
          <input
            type="date"
            value={StartDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </Field>

        <Field label="End Date">
          <input
            type="date"
            value={EndDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </Field>

        <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
          <button
            type="submit"
            disabled={loading || !n1UId}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 500,
              cursor: loading || !n1UId ? "not-allowed" : "pointer",
              opacity: loading || !n1UId ? 0.7 : 1,
            }}
          >
            Search
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={loading || !n1UId}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontWeight: 500,
              cursor: loading || !n1UId ? "not-allowed" : "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div
          style={{
            padding: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#7f1d1d",
            borderRadius: 10,
          }}
        >
          {String(error)}
        </div>
      )}

      {loading && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 18,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LoaderInline size={18} />
            <div style={{ fontSize: 13, opacity: 0.8 }}>Fetching orders…</div>
          </div>
        </div>
      )}

      {!loading && pagedOrders.length === 0 && (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            border: "1px dashed #e5e7eb",
            borderRadius: 10,
            color: "#6b7280",
            background: "#fff",
          }}
        >
          No orders found.
        </div>
      )}

      {!loading && pagedOrders.length > 0 && (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "auto",
            background: "#fff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["#", "Order Date", "Customer Name", "Delivery Address", "Products", "Order Total"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h.includes("Total") ? "right" : "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e5e7eb",
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {pagedOrders.map((order, idx) => {
                const items = Array.isArray(order?.items) ? order.items : [];
                const orderTotal = sumOrderTotal(order);
                const rowNumber = (page - 1) * pageSize + idx + 1;

                return (
                  <tr key={`${order?.customerId}-${order?.orderDate}`}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      {rowNumber}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {formatDate(order?.orderDate)}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      {order?.customerName || "-"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", maxWidth: 260 }}>
                      <div style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                        {order?.deliveryAddress || "-"}
                      </div>
                    </td>

                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", minWidth: 320 }}>
                      {items.length === 0 ? (
                        <span style={{ opacity: 0.7 }}>No items</span>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {items.map((it, i) => {
                            const qty = Number(it?.quantity || 0);
                            const price = Number(it?.price || 0);
                            const lineTotal = qty * price;

                            return (
                              <div
                                key={`${it?.variantId || i}-${i}`}
                                style={{
                                  border: "1px solid #eef2f7",
                                  borderRadius: 8,
                                  padding: 8,
                                  background: "#fff",
                                }}
                              >
                                <div style={{ fontWeight: 600, lineHeight: 1.2 }}>
                                  {it?.variantName || "Unknown product"}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                                  Qty: <b>{qty}</b> • Unit: {formatCurrency(price)} • Total:{" "}
                                  <b>{formatCurrency(lineTotal)}</b>
                                </div>
                                {it?.color && (
                                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                                    Color: {it.color}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        verticalAlign: "top",
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {formatCurrency(orderTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {!loading && totalOrders > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}>
              First
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}>
              Prev
            </button>
            <span style={{ fontSize: 13 }}>
              Page <b>{page}</b> / <b>{totalPages}</b>
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}>
              Next
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}>
              Last
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}