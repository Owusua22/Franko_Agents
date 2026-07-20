// MergedProducts.jsx
import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Table, Spin, Input, Button,  Empty } from "antd";
import { getMergedProducts } from "../../../Redux/Slice/ctp001Slice"; // adjust path

/* ────────── field extractors (matched to your exact API shape) ────────── */
const getField = (o, ...keys) => {
  for (const k of keys) if (o?.[k] != null && o[k] !== "") return o[k];
  return null;
};

const pId = (p) => getField(p, "id", "Id") || "";
const pCtp001Id = (p) => String(getField(p, "ctP001ProductId", "CTP001ProductId") || "N/A");
const pCtp001Name = (p) => getField(p, "ctP001ProductName", "CTP001ProductName") || "Unnamed Product";
const pCtp002Id = (p) => String(getField(p, "ctP002VariantId", "CTP002VariantId") || "N/A");
const pCtp002Name = (p) => getField(p, "ctP002ProductName", "CTP002ProductName") || "";

/* ────────── small pieces ────────── */
const StatCard = memo(({ value, label, emoji, color }) => (
  <div
    className="flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl shadow-sm"
    style={{ borderLeft: `3px solid ${color}` }}
  >
    <div>
      <div className="text-2xl font-black leading-none" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1.5">
        {label}
      </div>
    </div>
    <div className="text-2xl opacity-25">{emoji}</div>
  </div>
));

const CopyChip = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy"
      className="group inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors max-w-full"
    >
      <span className="truncate">{copied ? "Copied ✓" : text}</span>
    </button>
  );
};

/* ────────── main ────────── */
const MergedProducts = () => {
  const dispatch = useDispatch();

  // Safe inline selectors (work whether reducer is `ctp` or `ctp001`)
  const products = useSelector((state) => (state.ctp || state.ctp001 || {}).mergedProducts ?? []);
  const loading = useSelector((state) => (state.ctp || state.ctp001 || {}).loading?.mergedProducts ?? false);
  const error = useSelector((state) => (state.ctp || state.ctp001 || {}).error?.mergedProducts ?? null);

  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [matchFilter, setMatchFilter] = useState("all"); // all | match | differ

  useEffect(() => {
    dispatch(getMergedProducts());
  }, [dispatch]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const rows = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list.map((p, i) => {
      const productName = pCtp001Name(p);
      const mergedName = pCtp002Name(p);
      return {
        key: pId(p) || `row-${i}`,
        id: pId(p),
        ctp001Id: pCtp001Id(p),
        ctp001Name: productName,
        ctp002Id: pCtp002Id(p),
        ctp002Name: mergedName,
        nameMatch:
          String(productName).trim().toLowerCase() ===
          String(mergedName).trim().toLowerCase(),
      };
    });
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        [r.ctp001Name, r.ctp002Name, r.ctp001Id, r.ctp002Id, r.id].some((v) =>
          String(v || "").toLowerCase().includes(q)
        );
      const matchesFilter =
        matchFilter === "all" ||
        (matchFilter === "match" && r.nameMatch) ||
        (matchFilter === "differ" && !r.nameMatch);
      return matchesSearch && matchesFilter;
    });
  }, [rows, search, matchFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const nameMatches = rows.filter((r) => r.nameMatch).length;
    const nameDiffers = total - nameMatches;
    const uniqueVariants = new Set(rows.map((r) => r.ctp002Id)).size;
    return { total, nameMatches, nameDiffers, uniqueVariants };
  }, [rows]);

  const handleRefresh = useCallback(() => dispatch(getMergedProducts()), [dispatch]);

  const columns = useMemo(
    () => [
      {
        title: "#",
        key: "index",
        width: 56,
        render: (_, __, i) => (
          <span className="text-gray-400 text-xs font-semibold">
            {(currentPage - 1) * pageSize + i + 1}
          </span>
        ),
      },
      {
        title: "Salemate products",
        key: "ctp001",
        width: 320,
        render: (_, r) => (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate mb-1">
              {r.ctp001Name}
            </div>
            <CopyChip text={r.ctp001Id} />
          </div>
        ),
      },
      {
        title: "Website Products",
        key: "ctp002",
        width: 360,
        render: (_, r) => (
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-gray-300 shrink-0 mt-0.5">↔</span>
            <div className="min-w-0 flex-1">
              <div
                className={`text-[13px] font-semibold truncate mb-1 ${
                  r.nameMatch ? "text-gray-900" : "text-orange-600"
                }`}
              >
                {r.ctp002Name || "—"}
              </div>
              <CopyChip text={r.ctp002Id} />
            </div>
          </div>
        ),
      },
      
     
    ],
    [currentPage, pageSize]
  );

  const filterBtn = (key, label) => (
    <button
      type="button"
      onClick={() => { setMatchFilter(key); setCurrentPage(1); }}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
        matchFilter === key
          ? "bg-green-900 text-white border-green-900"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <AntdOverrides />
      <div className="min-h-screen bg-gray-50 font-sans">
        <div className="max-w-[1400px] mx-auto px-3 pt-4 pb-8 md:px-6">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-200 flex-wrap">
            <div className="w-[3px] h-7 rounded-full bg-gradient-to-b from-green-900 to-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Merged Products
              </h1>
              <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">
                {loading
                  ? "Loading merged products..."
                  : `${filtered.length} of ${rows.length} product${rows.length !== 1 ? "s" : ""} merged with the website`}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              title="Refresh"
              type="button"
              className="flex items-center justify-center w-9 h-9 bg-white border border-gray-200 rounded-lg text-gray-600 text-lg hover:bg-green-50 hover:border-green-400 hover:text-green-800 transition-all"
            >
              ↻
            </button>
          </div>

          {/* Stats */}
          {!loading && !error && rows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-4">
              <StatCard value={stats.total} label="Total Merged" emoji="🔗" color="#2563eb" />
              <StatCard value={stats.uniqueVariants} label="Unique Variants" emoji="🧩" color="#16a34a" />
              <StatCard value={stats.nameMatches} label="Name Matches" emoji="✅" color="#a855f7" />
              <StatCard value={stats.nameDiffers} label="Name Differs" emoji="⚠️" color="#ea580c" />
            </div>
          )}

          {/* Search + filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-3">
            <Input.Search
              allowClear
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              size="large"
              className="md:max-w-md"
            />
            <div className="flex gap-2">
              {filterBtn("all", `All (${stats.total})`)}
              {filterBtn("match", `Match (${stats.nameMatches})`)}
              {filterBtn("differ", `Differs (${stats.nameDiffers})`)}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm oh-table">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Spin size="large" />
                <div className="text-sm text-gray-400 mt-4">Fetching merged products...</div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-4">
                  <span className="text-2xl opacity-60">⚠</span>
                </div>
                <div className="text-lg font-extrabold text-gray-900 mb-1">Unable to Load</div>
                <div className="text-sm text-gray-400 max-w-sm mb-5">
                  {typeof error === "string" ? error : error?.message || "Failed to fetch merged products."}
                </div>
                <Button type="primary" onClick={handleRefresh}>Try Again</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16">
                <Empty description={search || matchFilter !== "all" ? "No products match your filter" : "No merged products found"} />
              </div>
            ) : (
              <Table
                dataSource={filtered}
                columns={columns}
                rowKey="key"
                size="small"
                scroll={{ x: "max-content" }}
                sticky
                pagination={{
                  current: currentPage,
                  pageSize,
                  showSizeChanger: true,
                  size: "small",
                  pageSizeOptions: [10, 20, 50, 100],
                  showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
                  onChange: (p, s) => { setCurrentPage(p); setPageSize(s); },
                  onShowSizeChange: (p, s) => { setCurrentPage(p); setPageSize(s); },
                }}
              />
            )}
          </div>
        </div>

     
      </div>
    </>
  );
};


const AntdOverrides = () => (
  <style>{`
    .oh-table .ant-table{font-size:12px!important}
    .oh-table .ant-table-thead>tr>th{background:#f4f5f7!important;border-bottom:2px solid #e5e7eb!important;font-size:10px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:.08em!important;color:#9ca3af!important;padding:10px 14px!important}
    .oh-table .ant-table-tbody>tr>td{padding:12px 14px!important;border-bottom:1px solid #f3f4f6!important;font-size:12px!important;vertical-align:middle!important}
    .oh-table .ant-table-tbody>tr:last-child>td{border-bottom:none!important}
    .oh-table .ant-table-tbody>tr:hover>td{background:#fafbfc!important}
    .oh-table .ant-table-cell-fix-right{background:inherit!important}
    .oh-table .ant-pagination{padding:12px 16px!important;font-size:12px!important}
    .oh-table .ant-pagination-item-active{background:#14532d!important;border-color:#14532d!important}
    .oh-table .ant-pagination-item-active a{color:#fff!important}
    .oh-table .ant-btn-primary{background:#14532d;border-color:#14532d}
    .oh-table .ant-btn-primary:hover{background:#166534!important;border-color:#166534!important}
  `}</style>
);

export default MergedProducts;