import { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Avatar,
  Modal,
  Row,
  Col,
  Statistic,
  Empty,
  Alert,
  Tooltip,
  message,
  Form,
  InputNumber,
  Select,
  Progress,
  Typography,
  List,
  Spin,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  EyeOutlined,
  DatabaseOutlined,
  SwapOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  CheckCircleTwoTone,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  getCTP001Products,
  mergeSingleCTP001WithCTP002,
  placeOrder,
  clearSimilarCandidates,
  removeManualMerge,
  selectCTP001Products,
  selectCTP001Pagination,
  selectCTP001ProductsLoading,
  selectSingleMergeLoading,
  selectPlaceOrderLoading,
  selectMergedProductMap,
  selectCTP001ProductsError,
  selectMergeActionError,
  selectSingleMergeError,
  selectPlaceOrderError,
  clearSpecificError,
  getSimilarity,
  getMergedProducts,
  selectMergedProducts,
  selectMergedProductsLoading,
} from "../../../Redux/Slice/ctp001Slice";
import { fetchAllProducts } from "../../../Redux/Slice/productSlice";

const { Text, Title } = Typography;

const BACKEND_BASE_URL = "https://cms.frankotrading.com";

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  const fileName = String(imagePath).split("\\").pop().split("/").pop();
  if (!fileName) return null;
  return `${BACKEND_BASE_URL}/Media/Products_Images/${fileName}`;
};

const getRowKey = (record, index) =>
  record?.productID || record?.Productid || record?.productId || `row-${index}`;

const formatPrice = (price) =>
  parseFloat(price || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getProductId = (product) =>
  product?.productID || product?.Productid || product?.productId || product?.ProductId || product?.id || "";

const getProductName = (product) =>
  product?.productName || product?.ProductName || "";

const getProductPrice = (product) =>
  Number(product?.sellingPrice1 || product?.price || 0);

const getProductBCode = (product) =>
  product?.bCode || product?.BCode || "855";

const CTP001ProductsPage = () => {
  const dispatch = useDispatch();

  const products = useSelector(selectCTP001Products);
  const pagination = useSelector(selectCTP001Pagination);
  const mergedProductMap = useSelector(selectMergedProductMap);
  const mergedProducts = useSelector(selectMergedProducts);
  const mergedLoading = useSelector(selectMergedProductsLoading);

  const isFetching = useSelector(selectCTP001ProductsLoading);
  const isSingleMerging = useSelector(selectSingleMergeLoading);
  const isOrdering = useSelector(selectPlaceOrderLoading);

  const fetchError = useSelector(selectCTP001ProductsError);
  const mergeError = useSelector(selectMergeActionError);
  const singleMergeError = useSelector(selectSingleMergeError);
  const orderError = useSelector(selectPlaceOrderError);

  const websiteProducts = useSelector((state) => state.products?.products || []);
  const websiteLoading = useSelector((state) => state.products?.loading);

  const [searchText, setSearchText] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergedModalVisible, setMergedModalVisible] = useState(false);
  const [mergeTargetProduct, setMergeTargetProduct] = useState(null);
  const [selectedWebsiteCandidate, setSelectedWebsiteCandidate] = useState(null);
  const [websiteSearchText, setWebsiteSearchText] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [orderForm] = Form.useForm();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    dispatch(getCTP001Products({ pageNumber: 1, recordPerPage: 3000 }));
    dispatch(getMergedProducts());
    if (!websiteProducts.length && !websiteLoading) {
      dispatch(fetchAllProducts());
    }
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(
      getCTP001Products({
        pageNumber: pagination.pageNumber,
        recordPerPage: pagination.recordPerPage,
      })
    )
      .unwrap()
      .then(() => message.success("Refreshed!"))
      .catch((err) => message.error(typeof err === "string" ? err : "Failed to refresh"));
    dispatch(getMergedProducts()).catch(() => {});
  }, [dispatch, pagination.pageNumber, pagination.recordPerPage]);

  const handleViewMergedProducts = useCallback(() => {
    setMergedModalVisible(true);
    dispatch(getMergedProducts());
  }, [dispatch]);

  const handleOpenMergeModal = useCallback(
    (product) => {
      const openModal = () => {
        setMergeTargetProduct(product);
        setSelectedWebsiteCandidate(null);
        setWebsiteSearchText("");
        setMergeModalVisible(true);
      };

      if (!websiteProducts.length && !websiteLoading) {
        dispatch(fetchAllProducts())
          .unwrap()
          .then(openModal)
          .catch(() => {
            openModal();
            message.error("Failed to load Website Products.");
          });
      } else {
        openModal();
      }
    },
    [dispatch, websiteProducts.length, websiteLoading]
  );

  // ═══════════════════════════════════════════════════════
  // ✅ SIMPLIFIED: No similarity dialog, just merge directly
  // ═══════════════════════════════════════════════════════
  const handleConfirmMerge = async () => {
    if (!mergeTargetProduct || !selectedWebsiteCandidate) {
      message.warning("Please select a Website Product to link with.");
      return;
    }

    // Prevent double-clicks
    if (isMerging || isSingleMerging) {
      return;
    }

    const targetName = getProductName(mergeTargetProduct);
    const candidateName = getProductName(selectedWebsiteCandidate);
    const sim = getSimilarity(targetName, candidateName);

    console.log("═══ MERGE START ═══");
    console.log(`Target: "${targetName}" | Candidate: "${candidateName}"`);
    console.log(`Similarity: ${Math.round(sim * 100)}%`);

    setIsMerging(true);
    const hideLoading = message.loading("Linking products...", 0);

    try {
      const resultAction = await dispatch(
        mergeSingleCTP001WithCTP002({
          ctp001Product: mergeTargetProduct,
          ctp002Product: selectedWebsiteCandidate,
        })
      );

      hideLoading();

      console.log("Dispatch result:", resultAction.type, resultAction.payload);

      if (mergeSingleCTP001WithCTP002.fulfilled.match(resultAction)) {
        const similarityNote = sim < 0.5 ? ` (Similarity: ${Math.round(sim * 100)}%)` : "";
        message.success(
          (resultAction.payload?.message || "Products linked successfully!") + similarityNote
        );
        dispatch(getMergedProducts());
        setMergeModalVisible(false);
        setMergeTargetProduct(null);
        setSelectedWebsiteCandidate(null);
        dispatch(clearSimilarCandidates());
      } else if (mergeSingleCTP001WithCTP002.rejected.match(resultAction)) {
        const errorMsg =
          resultAction.payload || resultAction.error?.message || "Failed to link products";
        console.error("Merge rejected:", errorMsg);
        message.error(typeof errorMsg === "string" ? errorMsg : "Failed to link products");
      }
    } catch (err) {
      hideLoading();
      console.error("Merge error:", err);
      message.error(typeof err === "string" ? err : err?.message || "Failed to link products");
    } finally {
      setIsMerging(false);
    }
  };

  const handleUnmerge = useCallback(
    (salesMateId) => {
      dispatch(removeManualMerge(salesMateId));
      message.success("Link removed.");
      dispatch(getMergedProducts());
    },
    [dispatch]
  );

  const handleViewDetails = useCallback((product) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
  }, []);

  const handleOpenOrderModal = useCallback(
    (product, isMergedProduct = false) => {
      const salesMateId = getProductId(product) || product.ctP001ProductId;
      const websiteProductId = mergedProductMap[salesMateId] || product.ctP002ProductId;
      let orderProduct = product;
      if (websiteProductId) {
        const webProd = websiteProducts.find(
          (p) => String(getProductId(p)) === String(websiteProductId)
        );
        if (webProd) orderProduct = webProd;
      }
      setSelectedProduct(orderProduct);
      orderForm.setFieldsValue({
        cartId: "",
        productId: getProductId(orderProduct) || websiteProductId,
        productName: getProductName(orderProduct) || product.ctP002ProductName,
        price: getProductPrice(orderProduct),
        bCode: getProductBCode(orderProduct),
        quantity: 1,
        customerId: "",
        customerName: "",
        contactNumber: "",
        deliveryAddress: "",
        geolocation: "345",
        paymentMode: "Cash on delivery",
        paymentService: "MTN",
        paymentAccountNumber: "",
        customerAccountType: "Agent",
        isMerged: !!websiteProductId || isMergedProduct,
        ctp001ProductId: isMergedProduct ? product.ctP001ProductId : salesMateId,
        ctp002ProductId: isMergedProduct ? product.ctP002ProductId : websiteProductId || "",
      });
      setDetailModalVisible(false);
      setMergedModalVisible(false);
      setOrderModalVisible(true);
    },
    [orderForm, mergedProductMap, websiteProducts]
  );

const handlePlaceOrder = useCallback(
  async (values) => {
    try {
      // 1. Dispatch and get the actual payload
      const resultAction = await dispatch(
        placeOrder({
          cartId: values.cartId,
          productId: values.productId,
          price: values.price,
          quantity: values.quantity,
          customerId: values.customerId,
          customerName: values.customerName,
          contactNumber: values.contactNumber,
          deliveryAddress: values.deliveryAddress,
          geolocation: values.geolocation || "345",
          paymentMode: values.paymentMode,
          paymentService: values.paymentService,
          paymentAccountNumber: values.paymentAccountNumber,
          customerAccountType: values.customerAccountType,
          bCode: values.bCode,
        })
      ).unwrap(); // Use unwrap to get the payload directly

      // 2. Check the responseCode inside the successful payload
      // Based on your JSON, '0' means business logic failure (e.g., product not merged)
      if (resultAction?.responseCode === "0") {
        message.error(resultAction.responseMessage || "One or more products have not been merged.");
        return; // Exit early, don't close the modal
      }

      // 3. If responseCode is successful (e.g., '1' or '200')
      message.success("Order placed successfully!");
      setOrderModalVisible(false);
      setSelectedProduct(null);
      orderForm.resetFields();
    } catch (err) {
      // Handles actual network errors or explicit rejections
      message.error(typeof err === "string" ? err : err?.message || "Failed to place order");
    }
  },
  [dispatch, orderForm]
);

  const handleTableChange = useCallback(
    (pag) => {
      dispatch(
        getCTP001Products({
          pageNumber: pag.current,
          recordPerPage: pag.pageSize,
        })
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [dispatch]
  );

  const closeMergeModal = useCallback(() => {
    setMergeModalVisible(false);
    setMergeTargetProduct(null);
    setSelectedWebsiteCandidate(null);
    setWebsiteSearchText("");
    dispatch(clearSimilarCandidates());
  }, [dispatch]);

  const closeOrderModal = useCallback(() => {
    setOrderModalVisible(false);
    setSelectedProduct(null);
    orderForm.resetFields();
  }, [orderForm]);

  const closeDetailModal = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedProduct(null);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter((product) =>
      [
        product?.productName, product?.ProductName, product?.productID,
        product?.Productid, product?.productId, product?.description,
        product?.brandName, product?.categoryName, product?.showRoomName,
        product?.bCode,
      ].some((field) => String(field ?? "").toLowerCase().includes(q))
    );
  }, [products, searchText]);

  const displayedCandidates = useMemo(() => {
    if (!websiteProducts.length || !mergeTargetProduct) return [];
    const targetName = getProductName(mergeTargetProduct);
    const mapped = websiteProducts.map((p) => ({
      product: p,
      productId: getProductId(p),
      productName: getProductName(p),
      similarity: getSimilarity(targetName, getProductName(p)),
    }));
    if (websiteSearchText) {
      const q = websiteSearchText.toLowerCase();
      return mapped
        .filter(
          (item) =>
            item.productName.toLowerCase().includes(q) ||
            String(item.productId).includes(q)
        )
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 200);
    }
    return mapped.sort((a, b) => b.similarity - a.similarity).slice(0, 200);
  }, [websiteProducts, websiteSearchText, mergeTargetProduct]);

  const stats = useMemo(
    () => ({
      total: pagination.total || (products || []).length,
      displayed: filteredProducts.length,
      mergedCount:
        mergedProducts?.length || Object.keys(mergedProductMap || {}).length,
    }),
    [products, filteredProducts, pagination, mergedProducts, mergedProductMap]
  );

  const columns = useMemo(
    () => [
      {
        title: "Product Details",
        key: "details",
        width: 250,
        render: (_, record) => {
          const id = getProductId(record);
          const isMerged = !!mergedProductMap[id];
          return (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {getProductName(record) || "-"}
                {isMerged && (
                  <CheckCircleTwoTone
                    twoToneColor="#52c41a"
                    style={{ marginLeft: 6, fontSize: 14 }}
                  />
                )}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                ID: {id || "-"}
                {isMerged && (
                  <Tag color="success" style={{ marginLeft: 6, fontSize: 10 }}>
                    Linked → {mergedProductMap[id]}
                  </Tag>
                )}
              </div>
              {record?.brandName && (
                <Tag color="blue" style={{ fontSize: 11, marginRight: 4 }}>
                  {record.brandName}
                </Tag>
              )}
              {record?.categoryName && (
                <Tag color="orange" style={{ fontSize: 11 }}>
                  {record.categoryName}
                </Tag>
              )}
            </div>
          );
        },
      },
      {
        title: "Price",
        key: "sellingPrice1",
        width: 130,
        render: (_, record) => {
          const price = record?.sellingPrice1 || record?.price || 0;
          const oldPrice = record?.oldPrice;
          return (
            <div>
              <div style={{ fontWeight: 600, color: "#ff4d4f", fontSize: 15 }}>
                ₵{formatPrice(price)}
              </div>
              {oldPrice > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#999",
                    textDecoration: "line-through",
                  }}
                >
                  ₵{formatPrice(oldPrice)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Link Status",
        key: "mergeStatus",
        width: 130,
        render: (_, record) => {
          const id = getProductId(record);
          const websiteId = mergedProductMap[id];
          return websiteId ? (
            <Tag
              color="success"
              icon={<LinkOutlined />}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                handleUnmerge(id);
              }}
            >
              Linked
            </Tag>
          ) : (
            <Tag color="default">Not Linked</Tag>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 180,
        fixed: "right",
        render: (_, record) => {
          const id = getProductId(record);
          const isMerged = !!mergedProductMap[id];
          return (
            <Space size="small">
              <Tooltip title="View Details">
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(record);
                  }}
                />
              </Tooltip>
              <Tooltip title={isMerged ? "Re-link" : "Link to Website Product"}>
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  style={{ color: "#722ed1" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenMergeModal(record);
                  }}
                />
              </Tooltip>
              <Tooltip
                title={
                  !isMerged ? "Link first to enable ordering" : "Place Order"
                }
              >
                <Button
                  type="text"
                  icon={<ShoppingCartOutlined />}
                  disabled={!isMerged}
                  style={{ color: isMerged ? "#52c41a" : "#d9d9d9" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMerged) handleOpenOrderModal(record);
                  }}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [
      handleViewDetails,
      handleOpenOrderModal,
      handleOpenMergeModal,
      mergedProductMap,
      handleUnmerge,
    ]
  );

  const detailContent = useMemo(() => {
    if (!selectedProduct) return null;
    const imageUrl = getImageUrl(
      selectedProduct?.productImage || selectedProduct?.image
    );
    const price = selectedProduct?.sellingPrice1 || selectedProduct?.price || 0;
    const id = getProductId(selectedProduct);
    const websiteId = mergedProductMap[id];
    return (
      <div>
        {imageUrl && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <img
              src={imageUrl}
              alt={getProductName(selectedProduct)}
              style={{
                width: "100%",
                maxHeight: 250,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          </div>
        )}
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          {getProductName(selectedProduct) || "Product"}
        </h2>
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <strong>Sales Mate ID:</strong>{" "}
            <span style={{ fontFamily: "monospace" }}>{id || "-"}</span>
          </Col>
          <Col span={12}>
            <strong>B-Code:</strong>{" "}
            <Tag color="purple">{selectedProduct?.bCode || "Not Set"}</Tag>
          </Col>
          {websiteId && (
            <Col span={24}>
              <Alert
                type="success"
                showIcon
                icon={<LinkOutlined />}
                message={`Linked to Website ID: ${websiteId}`}
              />
            </Col>
          )}
        </Row>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ff4d4f" }}>
            ₵{formatPrice(price)}
          </div>
        </div>
        {selectedProduct?.description && (
          <div style={{ marginTop: 16 }}>
            <strong>Description:</strong>
            <p style={{ marginTop: 8, lineHeight: 1.6, color: "#666" }}>
              {selectedProduct.description}
            </p>
          </div>
        )}
      </div>
    );
  }, [selectedProduct, mergedProductMap]);

  return (
    <div style={{ minHeight: "100vh", padding: 24, backgroundColor: "#fff" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          Sales Mate Products
        </h1>
        <p style={{ color: "#8c8c8c", margin: 0 }}>
          Manage inventory, link to Website Products, and process orders.
          <Text type="secondary" style={{ marginLeft: 8 }}>
            (Products must be linked before ordering)
          </Text>
        </p>
      </div>

      {fetchError && (
        <Alert
          message={fetchError}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => dispatch(clearSpecificError("ctp001Products"))}
        />
      )}
      {mergeError && (
        <Alert
          message={mergeError}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => dispatch(clearSpecificError("mergeAction"))}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic
              title="Total"
              value={stats.total}
              prefix={<DatabaseOutlined style={{ color: "#1890ff" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic
              title="Displayed"
              value={stats.displayed}
              prefix={<SearchOutlined style={{ color: "#722ed1" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic
              title="Linked"
              value={stats.mergedCount}
              valueStyle={{ color: "#52c41a" }}
              prefix={<LinkOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle" justify="space-between">
          <Col xs={24} md={10}>
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={isFetching}
              >
                Refresh
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={handleViewMergedProducts}
                loading={mergedLoading}
              >
                View Linked
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          dataSource={filteredProducts}
          columns={columns}
          rowKey={getRowKey}
          loading={isFetching}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: isFetching ? (
              <Spin size="large" />
            ) : (
              <Empty description="No products found" />
            ),
          }}
          pagination={{
            current: pagination.pageNumber,
            pageSize: pagination.recordPerPage || 2000,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ["50", "100", "500", "1000", "2000"],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
          }}
          onChange={handleTableChange}
          size="small"
          bordered
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        open={detailModalVisible}
        onCancel={closeDetailModal}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              disabled={!mergedProductMap[getProductId(selectedProduct)]}
              onClick={() => handleOpenOrderModal(selectedProduct)}
              style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
            >
              Place Order
            </Button>
            <Button onClick={closeDetailModal}>Close</Button>
          </Space>
        }
        width={700}
        centered
        title="Product Details"
        destroyOnClose
      >
        {detailContent}
      </Modal>

      {/* Merged Products Modal */}
      <Modal
        open={mergedModalVisible}
        onCancel={() => setMergedModalVisible(false)}
        footer={null}
        width={900}
        centered
        destroyOnClose
        title={
          <Space>
            <LinkOutlined style={{ color: "#52c41a" }} />
            <span>Linked Products</span>
          </Space>
        }
      >
        <Table
          dataSource={mergedProducts}
          loading={mergedLoading}
          rowKey={(r, i) => `${r.ctP001ProductId}-${r.ctP002ProductId}-${i}`}
          locale={{
            emptyText: mergedLoading ? (
              <Spin />
            ) : (
              <Empty description="No linked products" />
            ),
          }}
          columns={[
            {
              title: "Sales Mate Product",
              dataIndex: "ctP001ProductName",
              render: (t) => <Text strong>{t || "-"}</Text>,
            },
            {
              title: "Sales Mate ID",
              dataIndex: "ctP001ProductId",
              render: (t) => <Tag color="blue">{t}</Tag>,
            },
            {
              title: "Website Product",
              dataIndex: "ctP002ProductName",
              render: (t) => <Text strong>{t || "-"}</Text>,
            },
            {
              title: "Website ID",
              dataIndex: "ctP002ProductId",
              render: (t) => <Tag color="purple">{t}</Tag>,
            },
          ]}
          size="small"
          bordered
        />
      </Modal>

      {/* ═══ MERGE MODAL ═══ */}
      <Modal
        open={mergeModalVisible}
        onCancel={closeMergeModal}
        title={
          <Space>
            <SwapOutlined style={{ color: "#722ed1" }} />
            <span>Link Sales Mate to Website Product</span>
          </Space>
        }
        width={800}
        centered
        destroyOnClose={false}
        maskClosable={false}
        footer={null}
      >
        {singleMergeError && (
          <Alert
            message="Link Error"
            description={singleMergeError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {mergeTargetProduct && (
          <Card
            size="small"
            style={{ marginBottom: 16, backgroundColor: "#fafafa" }}
          >
            <Row gutter={16} align="middle">
              <Col>
                <Avatar
                  src={getImageUrl(
                    mergeTargetProduct.productImage || mergeTargetProduct.image
                  )}
                  size={60}
                  shape="square"
                />
              </Col>
              <Col flex="auto">
                <Title level={5} style={{ margin: 0 }}>
                  {getProductName(mergeTargetProduct)}
                </Title>
                <Text type="secondary">
                  Sales Mate ID: {getProductId(mergeTargetProduct)}
                </Text>
                <br />
                <Text type="secondary">
                  Price: ₵{formatPrice(getProductPrice(mergeTargetProduct))}
                </Text>
              </Col>
            </Row>
          </Card>
        )}

        <div
          style={{
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text strong>Available Website Products:</Text>
          <Input
            placeholder="Search name or ID..."
            size="small"
            prefix={<SearchOutlined />}
            value={websiteSearchText}
            onChange={(e) => setWebsiteSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        </div>

        <List
          loading={websiteLoading}
          bordered
          style={{ maxHeight: 350, overflow: "auto" }}
          locale={{
            emptyText: (
              <Empty
                description={
                  websiteProducts.length ? "No matches." : "Loading..."
                }
              />
            ),
          }}
          dataSource={displayedCandidates}
          renderItem={(item) => {
            const isSelected =
              selectedWebsiteCandidate &&
              getProductId(selectedWebsiteCandidate) === item.productId;
            return (
              <List.Item
                onClick={() => setSelectedWebsiteCandidate(item.product)}
                style={{
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#f6ffed" : "transparent",
                  borderLeft: isSelected
                    ? "3px solid #52c41a"
                    : "3px solid transparent",
                  padding: "10px 12px",
                  transition: "all 0.2s",
                }}
              >
                <Row gutter={12} align="middle" style={{ width: "100%" }}>
                  <Col>
                    <Avatar
                      src={getImageUrl(
                        item.product?.productImage || item.product?.image
                      )}
                      size={45}
                      shape="square"
                    />
                  </Col>
                  <Col flex="auto">
                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ID: {item.productId}
                    </Text>
                    <br />
                    <Text type="secondary">
                      ₵{formatPrice(getProductPrice(item.product))}
                    </Text>
                  </Col>
                  <Col style={{ width: 140 }}>
                    <Progress
                      percent={Math.round(item.similarity * 100)}
                      size="small"
                      status={item.similarity === 1 ? "success" : "active"}
                      format={(p) => `${p}%`}
                    />
                  </Col>
                  <Col>
                    {isSelected && (
                      <CheckCircleTwoTone
                        twoToneColor="#52c41a"
                        style={{ fontSize: 18 }}
                      />
                    )}
                  </Col>
                </Row>
              </List.Item>
            );
          }}
        />

        {selectedWebsiteCandidate && mergeTargetProduct && (
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            icon={<LinkOutlined />}
            message="Selected for linking"
            description={
              <span>
                <strong>{getProductName(selectedWebsiteCandidate)}</strong> (ID:{" "}
                {getProductId(selectedWebsiteCandidate)}) — Similarity:{" "}
                {Math.round(
                  getSimilarity(
                    getProductName(mergeTargetProduct),
                    getProductName(selectedWebsiteCandidate)
                  ) * 100
                )}
                %
              </span>
            }
          />
        )}

        {/* ✅ Action buttons inside modal body */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Button onClick={closeMergeModal}>Cancel</Button>
          <Button
            type="primary"
            icon={<LinkOutlined />}
            loading={isMerging || isSingleMerging}
            disabled={!selectedWebsiteCandidate || isMerging || isSingleMerging}
            style={{
              backgroundColor:
                selectedWebsiteCandidate && !isMerging ? "#52c41a" : undefined,
              borderColor:
                selectedWebsiteCandidate && !isMerging ? "#52c41a" : undefined,
            }}
            onClick={handleConfirmMerge}
          >
            Confirm Link
          </Button>
        </div>
      </Modal>

      {/* ═══ ORDER MODAL ═══ */}
      <Modal
        open={orderModalVisible}
        onCancel={closeOrderModal}
        footer={null}
        width={700}
        centered
        destroyOnClose
        title={
          <Space>
            <ShoppingCartOutlined style={{ color: "#52c41a" }} />
            <span>Place Order</span>
          </Space>
        }
      >
        {orderError && (
          <Alert
            message={orderError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={orderForm} layout="vertical" onFinish={handlePlaceOrder}>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) =>
              getFieldValue("isMerged") ? (
                <Alert
                  type="success"
                  showIcon
                  icon={<LinkOutlined />}
                  message="Using linked Website Product"
                  description={`${getFieldValue("ctp001ProductId")} → ${getFieldValue("ctp002ProductId")}`}
                  style={{ marginBottom: 16 }}
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  message="Product not linked"
                  style={{ marginBottom: 16 }}
                />
              )
            }
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cartId" label="Cart ID">
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="productId" label="Product ID">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Product Name">
            <Input
              value={getProductName(selectedProduct)}
              disabled
              style={{ fontWeight: 600 }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Price"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[
                  { required: true },
                  {
                    validator: (_, v) =>
                      v > 0
                        ? Promise.resolve()
                        : Promise.reject("Must be > 0"),
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={99999}
                  style={{ width: "100%" }}
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerId"
                label="Customer ID"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerName"
                label="Customer Name"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="contactNumber"
            label="Contact Number"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="deliveryAddress"
            label="Delivery Address"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="geolocation" label="Geolocation">
            <Input
              disabled
              prefix={<EnvironmentOutlined style={{ color: "#8c8c8c" }} />}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="paymentMode"
                label="Payment Mode"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: "Cash", value: "Cash" },
                    { label: "Mobile Money", value: "Mobile Money" },
                    { label: "Card", value: "Card" },
                    { label: "Bank Transfer", value: "Bank Transfer" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paymentService"
                label="Payment Service"
                rules={[{ required: true }]}
              >
                <Input placeholder="MTN, Vodafone, etc." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="paymentAccountNumber" label="Payment Account #">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerAccountType"
                label="Account Type"
                rules={[{ required: true }]}
              >
                <Select options={[{ label: "Agent", value: "Agent" }]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="bCode" label="B-Code">
            <Input disabled style={{ fontFamily: "monospace" }} />
          </Form.Item>
          <Form.Item name="isMerged" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ctp001ProductId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ctp002ProductId" hidden>
            <Input />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={closeOrderModal}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isOrdering}
                icon={<ShoppingCartOutlined />}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                size="large"
              >
                Place Order
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CTP001ProductsPage;