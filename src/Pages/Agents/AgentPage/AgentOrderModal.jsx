import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Modal,
  Spin,
  Typography,
  Button,
  Space,
  Tooltip,
  message,
  Form,
  Input,
  Tag,
  Select,
  Divider,
  Alert,
} from "antd";
import {
  UserOutlined,
  PhoneOutlined,
  HomeOutlined,
  DownloadOutlined,
  ShoppingOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { placeOrder } from "../../../Redux/Slice/ctp001Slice";
import {
  fetchSalesOrderById,
  fetchOrderDeliveryAddress,
} from "../../../Redux/Slice/orderSlice";
import {
  fetchCTP002ProductVariants,
  selectCTP002VariantsMap,
  selectCTP002VariantsLoadingMap,
} from "../../../Redux/Slice/productSlice";

const { Text } = Typography;
const { Option } = Select;
const BACKEND_BASE_URL = "https://testing.frankotrading.com";

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */

const normalizeId = (v) => {
  const s = String(v ?? "").trim();
  return ["", "undefined", "null", "nan"].includes(s.toLowerCase()) ? "" : s;
};

const normalizeText = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fmt = (n) => {
  const num = Number(n || 0);
  return Number.isNaN(num)
    ? "0.00"
    : num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

const fmtDate = (d) => {
  if (!d) return "N/A";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
};

const imgUrl = (path) => {
  if (!path) return null;
  const f = String(path)
    .split("\\")
    .pop()
    .split("/")
    .pop();
  return f ? `${BACKEND_BASE_URL}/Media/Products_Images/${f}` : null;
};

const getField = (item, ...keys) => {
  for (const k of keys) if (item?.[k] != null && item[k] !== "") return item[k];
  return null;
};

/* ── Order item extractors ── */
const itemProductId = (i) =>
  normalizeId(
    getField(
      i,
      "productId",
      "ProductId",
      "ProductID",
      "productID",
      "ctP002ProductId",
      "CTP002ProductId"
    )
  );

const itemPrice = (i) =>
  Number(
    getField(i, "price", "Price", "sellingPrice", "SellingPrice", "unitPrice", "amount") ?? 0
  ) || 0;

const itemQty = (i) =>
  Number(getField(i, "quantity", "Quantity") ?? 0);

const itemName = (i) =>
  getField(i, "productName", "ProductName", "name", "Name") || "Unknown Product";

const itemColor = (i) =>
  getField(i, "color", "Color") || "";

const itemKey = (i, idx) =>
  normalizeId(
    getField(
      i,
      "salesOrderDetailsId",
      "SalesOrderDetailsId",
      "orderDetailsId",
      "OrderDetailsId",
      "id",
      "Id"
    )
  ) || `item-${idx}`;

/* ── Variant row extractors ── */

/**
 * The parent product ID used to group/lookup variants.
 * This is what fetchCTP002ProductVariants is called with.
 */
const rowParentId = (r, fallbackItem = null) =>
  normalizeId(
    getField(r, "ctP002ProductId", "CTP002ProductId") ||
      itemProductId(fallbackItem || {})
  );

/**
 * The variant's own unique ID.
 * This is what goes in the placeOrder payload.
 *
 * Priority:
 * 1. row.variantId (the variant's own ID from the backend)
 * 2. row.ctP001ProductId (row identifier)
 * 3. row._rowVariantId (internal metadata)
 * 4. parent product ID as absolute fallback
 */
const rowVariantId = (r, fallbackItem = null) =>
  normalizeId(
    getField(r, "variantId", "VariantId") ||
      getField(r, "ctP001ProductId", "CTP001ProductId") ||
      getField(r, "_rowVariantId") ||
      rowParentId(r, fallbackItem)
  );

const rowSelId = (r, f, i) =>
  rowVariantId(r, f) || `${rowParentId(r, f)}-${i}`;

const rowName = (r) =>
  r?._displayName ||
  r?.name ||
  r?.variantName ||
  [r?.color, r?.size].filter(Boolean).join(" / ") ||
  "Website Product";

const rowColor = (r) => r?.color || r?.Color || "";

const rowPrice = (r) =>
  Number(
    getField(r, "_price", "sellingPrice", "SellingPrice", "price", "Price") ?? 0
  ) || 0;

const rowBCode = (r) => r?.bCode || r?.BCode || "855";

const normalizePayment = (v) => {
  const s = String(v || "").toLowerCase();
  if (s.includes("mobile")) return "Mobile Money";
  if (s.includes("card")) return "Card";
  if (s.includes("bank")) return "Bank Transfer";
  return "Cash";
};

const buildRows = (rows, item) => {
  const map = new Map();
  (rows || []).forEach((r, i) => {
    const k = rowSelId(r, item, i);
    if (k && !map.has(k)) map.set(k, r);
  });
  return [...map.values()];
};

const bestMatch = (item, rows) => {
  if (!rows?.length) return null;
  if (rows.length === 1) return rows[0];
  const n = normalizeText(itemName(item));
  const c = normalizeText(itemColor(item));
  return (
    rows.find((r) => normalizeText(rowName(r)) === n) ||
    (n
      ? rows.find((r) => {
          const rn = normalizeText(rowName(r));
          return rn && (n.includes(rn) || rn.includes(n));
        })
      : null) ||
    (c
      ? rows.find((r) => normalizeText(rowColor(r)) === c)
      : null) ||
    null
  );
};

/* ════════════════════════════════════════════
   STYLES
════════════════════════════════════════════ */

const styles = {
  section: {
    background: "#fafafa",
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 12,
    border: "1px solid #f0f0f0",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
    fontSize: 13,
    color: "#444",
  },
  statsBar: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    textAlign: "center",
    background: "#fff",
    borderRadius: 10,
    padding: "12px 8px",
    border: "1px solid #f0f0f0",
  },
  statValue: { fontSize: 16, fontWeight: 700, color: "#222" },
  statLabel: { fontSize: 11, color: "#999", marginTop: 2 },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
  },
  itemImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    background: "#f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "1px solid #eee",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0 0",
  },
};

/* ════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════ */

const AgentOrderModal = ({ orderId, orderCode, isModalVisible, onClose }) => {
  const dispatch = useDispatch();
  const mounted = useRef(true);

  const { salesOrder, loading, error, deliveryAddress } = useSelector(
    (s) => s.orders
  );
  const customer = useSelector(
    (s) =>
      s.customer?.currentCustomerDetails ||
      s.customers?.currentCustomerDetails ||
      s.auth?.currentCustomerDetails ||
      {}
  );
  const variantsMap = useSelector(selectCTP002VariantsMap);
  const variantLoadingMap = useSelector(selectCTP002VariantsLoadingMap);

  const [fulfilOpen, setFulfilOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selections, setSelections] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const orders = useMemo(
    () => (Array.isArray(salesOrder) ? salesOrder : []),
    [salesOrder]
  );

  const productIds = useMemo(
    () => [...new Set(orders.map(itemProductId).filter(Boolean))],
    [orders]
  );

  useEffect(() => {
    if (orderId && isModalVisible) {
      dispatch(fetchSalesOrderById(orderId));
      dispatch(fetchOrderDeliveryAddress(orderId));
    }
  }, [dispatch, orderId, isModalVisible]);

  useEffect(() => {
    if (isModalVisible && productIds.length)
      productIds.forEach((id) => dispatch(fetchCTP002ProductVariants(id)));
  }, [dispatch, isModalVisible, productIds]);

  useEffect(() => {
    setSent(false);
    setSelections({});
    setFulfilOpen(false);
  }, [orderId, isModalVisible]);

  useEffect(() => {
    if (!fulfilOpen && mounted.current) form.resetFields();
  }, [fulfilOpen, form]);

  /* ── Row retrieval ── */

  const getRows = useCallback(
    (item) => {
      const pid = itemProductId(item);
      const r = variantsMap?.[pid];
      return Array.isArray(r) && r.length ? buildRows(r, item) : [];
    },
    [variantsMap]
  );

  /**
   * Whether this item has any variant rows at all.
   * If false, the product has no colour/size — we use the product ID directly.
   */
  const hasVariants = useCallback(
    (item) => getRows(item).length > 0,
    [getRows]
  );

  const getSelectedRow = useCallback(
    (item, idx) => {
      const rows = getRows(item);
      if (!rows.length) return null; // No variants exist for this product

      const explicit = normalizeId(selections[itemKey(item, idx)]);
      if (explicit) {
        const m = rows.find(
          (r, ri) => rowSelId(r, item, ri) === explicit
        );
        if (m) return m;
      }

      return bestMatch(item, rows) || null;
    },
    [getRows, selections]
  );

  const getSelectedKey = useCallback(
    (item, idx) => {
      const k = normalizeId(selections[itemKey(item, idx)]);
      if (k) return k;
      const row = getSelectedRow(item, idx);
      if (!row) return undefined;
      const rows = getRows(item);
      const ri = rows.indexOf(row);
      return rowSelId(row, item, ri === -1 ? idx : ri);
    },
    [getRows, getSelectedRow, selections]
  );

  const displayPrice = useCallback(
    (item, idx) => {
      const p = rowPrice(getSelectedRow(item, idx));
      return p > 0 ? p : itemPrice(item);
    },
    [getSelectedRow]
  );

  /* ── Computed values ── */

  const total = useMemo(
    () => orders.reduce((a, i, x) => a + displayPrice(i, x) * itemQty(i), 0),
    [orders, displayPrice]
  );

  const totalQty = useMemo(
    () => orders.reduce((a, i) => a + itemQty(i), 0),
    [orders]
  );

  /**
   * Items where variants EXIST but the user hasn't selected one.
   *
   * Items with NO variants at all are NOT missing — they use the product ID directly.
   */
  const missingVariantItems = useMemo(() => {
    return orders.filter((item, idx) => {
      const rows = getRows(item);
      // If no variants exist, this item is fine — no selection needed
      if (rows.length === 0) return false;
      // If variants exist, one must be selected
      const selected = getSelectedRow(item, idx);
      return !selected;
    });
  }, [orders, getRows, getSelectedRow]);

  const canSubmit = useMemo(
    () => missingVariantItems.length === 0 && orders.length > 0,
    [missingVariantItems, orders]
  );

  const variantOptions = useCallback(
    (item) =>
      getRows(item).map((r, i) => ({
        value: rowSelId(r, item, i),
        label:
          rowPrice(r) > 0
            ? `${rowName(r)} — ₵${fmt(rowPrice(r))}`
            : rowName(r),
      })),
    [getRows]
  );

  const onVariantChange = useCallback(
    (key, val) =>
      setSelections((p) => ({ ...p, [key]: normalizeId(val) })),
    []
  );

  const addr = deliveryAddress?.[0] || {};
  const first = orders[0] || {};

  /* ── Open fulfilment modal ── */

  const openFulfil = useCallback(() => {
    if (!orders.length) return message.warning("No items to fulfil.");
    form.setFieldsValue({
      customerId: customer?.n1UId || "",
      customerName: addr.recipientName || first.fullName || "",
      contactNumber: addr.recipientContactNumber || first.contactNumber || "",
      deliveryAddress: addr.address || first.address || "",
      paymentMode: normalizePayment(first.paymentMode),
      paymentService: first.paymentService || "MTN",
      paymentAccountNumber: first.paymentAccountNumber || "",
      customerAccountType: "Agent",
      geolocation: addr.geoLocation || "N/A",
      bCode: "855",
    });
    setFulfilOpen(true);
  }, [addr, customer, first, form, orders]);

  /* ════════════════════════════════════════════
     SUBMIT HANDLER
     
     KEY LOGIC:
     - If item has variants → use selected row's variantId
     - If item has NO variants → use the product's own ctP002ProductId
       as the variantId (the backend treats it as "the product itself")
  ════════════════════════════════════════════ */

  const handleSubmit = async (values) => {
    if (sending) return;

    try {
      if (missingVariantItems.length) {
        return message.error(
          `Please select a colour for ${missingVariantItems.length} item(s).`
        );
      }

      const payload = orders.map((item, idx) => {
        const rows = getRows(item);
        const row = getSelectedRow(item, idx);

        let vid;

        if (row) {
          // ✅ Item has a selected variant — use its variantId
          vid = rowVariantId(row, item);
        } else if (rows.length === 0) {
          // ✅ Item has NO variants at all — use the product ID directly
          vid = itemProductId(item);
        } else {
          // Variants exist but none selected (shouldn't happen due to validation)
          throw new Error(
            `Please select a colour for "${itemName(item)}".`
          );
        }

        if (!vid) {
          throw new Error(
            `Cannot determine product ID for "${itemName(item)}". ` +
              `No variantId or productId found.`
          );
        }

        const price = displayPrice(item, idx);

        return {
          cartId: "",
          variantId: vid,
          price: Number(price),
          quantity: itemQty(item),
          customerId: values.customerId || "",
          customerName: values.customerName || "",
          contactNumber: values.contactNumber || "",
          deliveryAddress: values.deliveryAddress || "",
          geolocation: values.geolocation || "N/A",
          paymentMode: values.paymentMode || "Cash",
          paymentService: values.paymentService || "",
          paymentAccountNumber: values.paymentAccountNumber || "",
          customerAccountType: values.customerAccountType || "Agent",
          bCode: row ? rowBCode(row) : values.bCode || "855",
        };
      });

      setSending(true);
      await dispatch(placeOrder(payload)).unwrap();
      message.success(`${payload.length} item(s) sent to fulfillment.`);
      setSent(true);
      setFulfilOpen(false);
    } catch (e) {
      message.error(e?.message || "Fulfillment failed.");
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  /* ── Invoice ── */

  const downloadInvoice = useCallback(async () => {
    if (downloading || !orders.length) return;
    setDownloading(true);
    try {
      const rows = orders
        .map((i, x) => {
          const p = displayPrice(i, x);
          const q = itemQty(i);
          const r = getSelectedRow(i, x);
          const pid = itemProductId(i);
          const hasRowVariants = hasVariants(i);
          const variantLabel = r
            ? rowName(r)
            : hasRowVariants
            ? "Not selected"
            : "N/A (no colour)";
          return `<tr><td>${x + 1}</td><td>${itemName(i)}</td><td>${variantLabel}</td><td>${q}</td><td>₵${fmt(p)}</td><td>₵${fmt(p * q)}</td></tr>`;
        })
        .join("");

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice ${orderCode || ""}</title><style>body{font-family:system-ui;padding:40px;color:#333}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #eee;padding-bottom:20px}.co{font-size:24px;color:#10b981;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#f4f4f4;text-align:left;padding:12px;border-bottom:2px solid #ddd}td{padding:12px;border-bottom:1px solid #eee}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:30px;color:#10b981}</style></head><body><div class="header"><div class="co">Franko Trading Ltd.</div><h3>INVOICE #${orderCode || ""}</h3><p>${new Date().toLocaleDateString()}</p></div><div style="margin:20px 0"><strong>Bill To:</strong><br/>${addr.recipientName || first.fullName || "N/A"}<br/>${addr.address || first.address || "N/A"}<br/>Tel: ${addr.recipientContactNumber || first.contactNumber || "N/A"}</div><table><thead><tr><th>#</th><th>Item</th><th>Variant</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">TOTAL: ₵${fmt(total)}</div></body></html>`;

      const w = window.open("", "_blank", "width=800,height=600");
      if (!w) return message.error("Allow pop-ups to download invoice.");
      w.document.write(html);
      w.document.close();
      w.onload = () =>
        setTimeout(() => {
          w.focus();
          w.print();
        }, 500);
      message.success("Invoice opened for printing.");
    } catch (e) {
      message.error("Failed to generate invoice.");
    } finally {
      if (mounted.current) setDownloading(false);
    }
  }, [
    downloading,
    orders,
    displayPrice,
    getSelectedRow,
    hasVariants,
    orderCode,
    addr,
    first,
    total,
  ]);

  /* ── Image thumbnail ── */
  const ImgThumb = ({ item }) => {
    const url = imgUrl(item?.imagePath);
    return (
      <div style={styles.itemImg}>
        {url ? (
          <img
            src={url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <ShoppingCartOutlined style={{ color: "#bbb", fontSize: 18 }} />
        )}
      </div>
    );
  };

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */

  return (
    <>
      {/* ══════════ MAIN ORDER MODAL ══════════ */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingOutlined style={{ color: "#3b82f6", fontSize: 18 }} />
            <span style={{ fontWeight: 600, flex: 1 }}>
              Order #{orderCode || ""}
            </span>
            <Tag color={sent ? "purple" : "green"} style={{ margin: 0 }}>
              {sent ? "Fulfilled" : "Active"}
            </Tag>
          </div>
        }
        open={isModalVisible}
        onCancel={onClose}
        width={600}
        centered
        destroyOnClose
        footer={
          <div style={styles.footer}>
            <Text strong style={{ fontSize: 16, color: "#10b981" }}>
              Total: ₵{fmt(total)}
            </Text>
            <Space>
              <Tooltip title="Download Invoice">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={downloadInvoice}
                  loading={downloading}
                >
                  Invoice
                </Button>
              </Tooltip>
              <Button
                type="primary"
                icon={sent ? <CheckCircleOutlined /> : <SendOutlined />}
                onClick={openFulfil}
                disabled={sent || loading}
              >
                {sent ? "Fulfilled" : "Send to fulfilment"}
              </Button>
            </Space>
          </div>
        }
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert
            type="error"
            message={error?.message || "Failed to load order"}
          />
        ) : (
          <div
            style={{ maxHeight: "62vh", overflowY: "auto", paddingRight: 4 }}
            className="clean-scroll"
          >
            {/* Stats */}
            <div style={styles.statsBar}>
              {[
                {
                  icon: <CalendarOutlined />,
                  label: "Date",
                  value: fmtDate(first?.orderDate),
                },
                {
                  icon: <ShoppingCartOutlined />,
                  label: "Items",
                  value: totalQty,
                },
                {
                  label: "Amount",
                  value: `₵${fmt(total)}`,
                  highlight: true,
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.statCard,
                    ...(s.highlight
                      ? { background: "#f0fdf4", borderColor: "#bbf7d0" }
                      : {}),
                  }}
                >
                  {s.icon && (
                    <div style={{ color: "#888", marginBottom: 4 }}>
                      {s.icon}
                    </div>
                  )}
                  <div
                    style={{
                      ...styles.statValue,
                      ...(s.highlight ? { color: "#10b981" } : {}),
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Delivery */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <EnvironmentOutlined /> Delivery Info
              </div>
              {[
                {
                  icon: <UserOutlined />,
                  text:
                    addr.recipientName || first.fullName || "N/A",
                },
                {
                  icon: <PhoneOutlined />,
                  text:
                    addr.recipientContactNumber ||
                    first.contactNumber ||
                    "N/A",
                },
                {
                  icon: <HomeOutlined />,
                  text: addr.address || first.address || "N/A",
                },
              ].map((r, i) => (
                <div key={i} style={styles.infoRow}>
                  <span style={{ color: "#999" }}>{r.icon}</span>{" "}
                  {r.text}
                </div>
              ))}
            </div>

            {/* Items */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <ShoppingCartOutlined /> Items
                <Tag
                  color="blue"
                  style={{ marginLeft: "auto", fontSize: 11 }}
                >
                  {orders.length}
                </Tag>
              </div>

              {orders.map((item, idx) => {
                const row = getSelectedRow(item, idx);
                const p = displayPrice(item, idx);
                const q = itemQty(item);
                const hasRowVariants = hasVariants(item);

                return (
                  <div
                    key={itemKey(item, idx)}
                    style={{
                      ...styles.itemRow,
                      borderBottom:
                        idx < orders.length - 1
                          ? "1px solid #f0f0f0"
                          : "none",
                    }}
                  >
                    <ImgThumb item={item} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {itemName(item)}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        {row ? (
                          <Tag
                            color="blue"
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            {rowName(row)}
                          </Tag>
                        ) : hasRowVariants ? (
                          <Tag
                            color="warning"
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            Select Colour
                          </Tag>
                        ) : (
                          <Tag
                            color="default"
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            No Colour Needed
                          </Tag>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "#999" }}>
                        {q} × ₵{fmt(p)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        ₵{fmt(p * q)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <style>{`
          .clean-scroll::-webkit-scrollbar { width: 3px; }
          .clean-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 3px; }
          @media (max-width: 640px) {
            .ant-modal { max-width: 95vw !important; }
          }
        `}</style>
      </Modal>

      {/* ══════════ FULFILMENT MODAL ══════════ */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SendOutlined style={{ color: "#3b82f6" }} />
            <span>Send to Fulfilment</span>
          </div>
        }
        open={fulfilOpen}
        onCancel={() => setFulfilOpen(false)}
        footer={null}
        width={560}
        centered
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="middle"
          initialValues={{ paymentMode: "Cash", customerAccountType: "Agent" }}
        >
          <Alert
            message={`Order: ${orderCode || ""}`}
            type="info"
            style={{ marginBottom: 16 }}
            showIcon
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Form.Item
              name="customerId"
              label="Agent ID"
              rules={[{ required: true }]}
            >
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="customerName"
              label="Recipient"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="Full name" />
            </Form.Item>
          </div>

          <Form.Item
            name="contactNumber"
            label="Phone"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="+233 XX XXX XXXX" />
          </Form.Item>

          <Form.Item
            name="deliveryAddress"
            label="Address"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input.TextArea rows={2} placeholder="Delivery location" />
          </Form.Item>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Form.Item name="paymentMode" label="Payment">
              <Select>
                <Option value="Cash">Cash</Option>
                <Option value="Mobile Money">Mobile Money</Option>
                <Option value="Bank Transfer">Bank Transfer</Option>
                <Option value="Card">Card</Option>
              </Select>
            </Form.Item>
            <Form.Item name="paymentService" label="Network/Bank">
              <Input placeholder="MTN, Vodafone..." />
            </Form.Item>
          </div>

          <Divider style={{ margin: "12px 0", fontSize: 13 }}>
            Confirm Colours
          </Divider>

          {/* Only show warning if items with variants are missing selections */}
          {missingVariantItems.length > 0 && (
            <Alert
              type="warning"
              message={`Select a colour for ${missingVariantItems.length} item(s) before submitting.`}
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              marginBottom: 16,
            }}
            className="clean-scroll"
          >
            {orders.map((item, idx) => {
              const key = itemKey(item, idx);
              const opts = variantOptions(item);
              const sel = getSelectedKey(item, idx);
              const pid = itemProductId(item);
              const isLoading = Boolean(variantLoadingMap?.[pid]);
              const hasRowVariants = hasVariants(item);

              return (
                <div
                  key={key}
                  style={{
                    marginBottom: 10,
                    paddingBottom: 10,
                    borderBottom: "1px solid #f5f5f5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      {itemName(item)}{" "}
                      <Text type="secondary">×{itemQty(item)}</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: "#10b981" }}>
                      ₵{fmt(displayPrice(item, idx))}
                    </Text>
                  </div>

                  {hasRowVariants ? (
                    /* ── Has variants: show colour dropdown ── */
                    <Select
                      showSearch
                      allowClear
                      placeholder="Choose colour..."
                      optionFilterProp="label"
                      value={sel}
                      onChange={(v) => onVariantChange(key, v)}
                      options={opts}
                      loading={isLoading}
                      disabled={!opts.length && !isLoading}
                      notFoundContent={
                        isLoading ? "Loading..." : "No colour found"
                      }
                      style={{ width: "100%" }}
                      size="small"
                    />
                  ) : (
                    /* ── No variants: show info tag ── */
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        background: "#f6ffed",
                        border: "1px solid #b7eb8f",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#52c41a",
                      }}
                    >
                      <CheckCircleOutlined />
                      <span>
                   No colour selction needed
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 8,
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <Text strong style={{ fontSize: 16, color: "#10b981" }}>
              ₵{fmt(total)}
            </Text>
            <Space>
              <Button onClick={() => setFulfilOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={sending}
                disabled={!canSubmit || sent}
                icon={<SendOutlined />}
              >
                Confirm
              </Button>
            </Space>
          </div>

          <Form.Item name="geolocation" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="bCode" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="customerAccountType" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="paymentAccountNumber" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AgentOrderModal;