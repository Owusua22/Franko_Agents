import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchOrdersByThirdParty } from "../../../Redux/Slice/orderSlice";
import { Card, Col, Row, Statistic, Typography, DatePicker, Space, Select, Tag } from "antd";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { RiseOutlined, FallOutlined, ShoppingCartOutlined, CalendarOutlined, FileTextOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

// Extend dayjs with plugins
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);

const { RangePicker } = DatePicker;
const { Option } = Select;

// Order cycle colors - defined outside component to avoid recreation
const ORDER_CYCLE_COLORS = {
  'Pending': '#faad14',
  'Order Placement': '#1890ff',
  'Out of Stock': "#86BAA1",
  'Completed': '#A9FFCB',
  'Delivery': '#B6EEA6',
  'Cancelled': '#DD1C1A',
  'Unreachable': "#ff4d4f",
  'Multiple Orders': '#004E64',
  'Confirmed': '#52c41a',
  'Processing': '#722ed1',
};

const AgentDashboard = () => {
  const dispatch = useDispatch();
  const ordersData = useSelector((state) => state.orders);

  const orders = useMemo(() => ordersData?.orders || [], [ordersData]);
  
  const [weeklyOrders, setWeeklyOrders] = useState([]);
  const [dailyOrders, setDailyOrders] = useState(0);
  const [monthlyOrders, setMonthlyOrders] = useState([]);
  const [percentageChange, setPercentageChange] = useState(0);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [orderCycleData, setOrderCycleData] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState('month');
  const [weeklyOrdersCount, setWeeklyOrdersCount] = useState(0);

  // Parse customer object safely
  const customerObject = useMemo(() => {
    try {
      const customer = localStorage.getItem("customer");
      if (!customer) return null;
      return JSON.parse(customer);
    } catch {
      return null;
    }
  }, []);

  const ThirdPartyAccountNumber = customerObject?.customerAccountNumber;

  // Fetch orders on component mount
  useEffect(() => {
    if (ThirdPartyAccountNumber) {
      const startDate = "2020-01-01";
      const endDate = dayjs().add(1, "day").format("YYYY-MM-DD");
      dispatch(fetchOrdersByThirdParty({ from: startDate, to: endDate, ThirdPartyAccountNumber }));
    }
  }, [ThirdPartyAccountNumber, dispatch]);

  // Define calculation functions with useCallback to prevent recreation
  const calculateWeeklyOrdersCount = useCallback((orders) => {
    const today = dayjs();
    const weekStart = today.startOf('week');
    const weekEnd = today.endOf('week');
    
    return orders.filter(order => 
      dayjs(order.orderDate).isBetween(weekStart, weekEnd, null, '[]')
    ).length;
  }, []);

  const calculateDailyOrders = useCallback((orders) => {
    if (!dateRange || dateRange.length < 2) return [];
    
    const endDate = dateRange[1].clone();
    const startDate = dateRange[0].clone();

    const dailyCounts = [];
    let currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate, "day")) {
      const dailyCount = orders.filter((order) =>
        dayjs(order.orderDate).isSame(currentDate, "day")
      ).length;

      dailyCounts.push({
        name: currentDate.format("MM/DD/YYYY"),
        totalOrders: dailyCount,
      });

      currentDate = currentDate.add(1, "day");
    }

    return dailyCounts;
  }, [dateRange]);

  const calculateWeeklyOrders = useCallback((orders) => {
    if (!dateRange || dateRange.length < 2) return [];
    
    const endDate = dateRange[1].clone();
    const startDate = dateRange[0].clone();

    const weeklyCounts = [];
    let currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate, "day")) {
      const dailyCount = orders.filter((order) =>
        dayjs(order.orderDate).isSame(currentDate, "day")
      ).length;

      weeklyCounts.push({
        name: currentDate.format("MM/DD"),
        totalOrders: dailyCount,
      });

      currentDate = currentDate.add(1, "day");
    }

    return weeklyCounts;
  }, [dateRange]);

  const calculateMonthlyOrders = useCallback((orders) => {
    if (!dateRange || dateRange.length < 2) return [];
    
    const endDate = dateRange[1].clone();
    const startDate = dateRange[0].clone();

    const monthlyCounts = [];
    let currentMonth = startDate.clone().startOf("month");

    while (currentMonth.isSameOrBefore(endDate, "month")) {
      const monthlyOrdersCount = orders.filter((order) =>
        dayjs(order.orderDate).isBetween(
          currentMonth,
          currentMonth.endOf("month"),
          null,
          "[]"
        )
      ).length;

      monthlyCounts.push({
        name: currentMonth.format("MM/YYYY"),
        totalOrders: monthlyOrdersCount,
      });

      currentMonth = currentMonth.add(1, "month");
    }

    return monthlyCounts;
  }, [dateRange]);

  const calculateOrderCycleData = useCallback((orders) => {
    const cycleCount = {};
    
    orders.forEach(order => {
      const cycle = order.orderCycle || 'Unknown';
      cycleCount[cycle] = (cycleCount[cycle] || 0) + 1;
    });

    return Object.entries(cycleCount).map(([cycle, count]) => ({
      name: cycle,
      value: count,
      percentage: ((count / orders.length) * 100).toFixed(1)
    }));
  }, []);

  const updateDailyOrders = useCallback((dailyData) => {
    if (dailyData.length < 2) return;
    
    const todayOrders = dailyData[dailyData.length - 1]?.totalOrders || 0;
    const yesterdayOrders = dailyData[dailyData.length - 2]?.totalOrders || 0;
    const change =
      yesterdayOrders > 0
        ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
        : 0;

    setPercentageChange(parseFloat(change.toFixed(2)));
  }, []);

  // Filter and calculate orders when orders or dateRange changes
  useEffect(() => {
    if (orders.length > 0 && dateRange && dateRange.length === 2) {
      const filtered = orders.filter(order => 
        dayjs(order.orderDate).isBetween(dateRange[0], dateRange[1], null, '[]')
      );
      setFilteredOrders(filtered);
      
      const dailyData = calculateDailyOrders(filtered);
      const monthlyData = calculateMonthlyOrders(filtered);
      const cycleData = calculateOrderCycleData(filtered);
      const weeklyCount = calculateWeeklyOrdersCount(filtered);
      
      setDailyOrders(dailyData[dailyData.length - 1]?.totalOrders || 0);
      setWeeklyOrders(calculateWeeklyOrders(filtered));
      setMonthlyOrders(monthlyData);
      setOrderCycleData(cycleData);
      setWeeklyOrdersCount(weeklyCount);
      updateDailyOrders(dailyData);
    }
  }, [orders, dateRange, calculateDailyOrders, calculateWeeklyOrders, calculateMonthlyOrders, calculateOrderCycleData, calculateWeeklyOrdersCount, updateDailyOrders]);

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
    }
  };

  const handleQuickDateSelect = (value) => {
    setSelectedDateRange(value);
    const today = dayjs();
    let startDate, endDate;

    switch (value) {
      case 'today':
        startDate = today.clone();
        endDate = today.clone();
        break;
      case 'week':
        startDate = today.subtract(7, 'day');
        endDate = today.clone();
        break;
      case 'month':
        startDate = today.subtract(30, 'day');
        endDate = today.clone();
        break;
      case '3months':
        startDate = today.subtract(90, 'day');
        endDate = today.clone();
        break;
      case '6months':
        startDate = today.subtract(180, 'day');
        endDate = today.clone();
        break;
      default:
        startDate = today.subtract(30, 'day');
        endDate = today.clone();
    }

    setDateRange([startDate, endDate]);
  };

  const getTotalOrdersInRange = useCallback(() => {
    return filteredOrders.length;
  }, [filteredOrders]);

  const getOrderCycleColor = useCallback((cycleName) => {
    return ORDER_CYCLE_COLORS[cycleName] || '#d9d9d9';
  }, []);

  return (
    <div className=" py-1">
      <Typography.Title level={4} className="text-red-600">
        Agent Dashboard
      </Typography.Title>

      {/* Date Range Selection */}
      <Card className="mb-6 shadow-lg">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text strong>Select Date Range:</Typography.Text>
          <Space wrap>
            <Select
              value={selectedDateRange}
              onChange={handleQuickDateSelect}
              style={{ width: 150 }}
            >
              <Option value="today">Today</Option>
              <Option value="week">Last 7 Days</Option>
              <Option value="month">Last 30 Days</Option>
              <Option value="3months">Last 3 Months</Option>
              <Option value="6months">Last 6 Months</Option>
            </Select>
            <Typography.Text>or</Typography.Text>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </Space>
          <Typography.Text type="secondary">
            Showing data from {dateRange[0]?.format('YYYY-MM-DD')} to {dateRange[1]?.format('YYYY-MM-DD')}
          </Typography.Text>
        </Space>
      </Card>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} justify="center">
        {/* Daily Orders */}
        <Col xs={24} sm={12} md={6}>
          <Card className="shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white rounded-lg p-3">
            <div className="flex items-center justify-start space-x-4 mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <ShoppingCartOutlined className="text-blue-500 text-3xl" />
              </div>
              <div>
                <Statistic
                  title="Daily Orders"
                  value={dailyOrders}
                  valueStyle={{
                    color: percentageChange >= 0 ? "#3f8600" : "#cf1322",
                    fontSize: "24px",
                  }}
                  prefix={percentageChange >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  suffix={
                    <span
                      style={{
                        fontSize: "14px",
                        marginLeft: '20px',
                        color: percentageChange >= 0 ? "#3f8600" : "#cf1322",
                      }}
                    >
                      {`${Math.abs(percentageChange)}%`}
                    </span>
                  }
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Total Orders in Range */}
        <Col xs={24} sm={12} md={6}>
          <Card className="shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white rounded-lg p-3">
            <div className="flex items-center justify-start space-x-4 mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <FileTextOutlined className="text-green-500 text-3xl" />
              </div>
              <div>
                <Statistic
                  title="Total Orders"
                  value={getTotalOrdersInRange()}
                  valueStyle={{ fontSize: "24px" }}
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Weekly Orders */}
        <Col xs={24} sm={12} md={6}>
          <Card className="shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white rounded-lg p-3">
            <div className="flex items-center justify-start space-x-4 mb-4">
              <div className="bg-orange-100 p-3 rounded-full">
                <CalendarOutlined className="text-orange-500 text-3xl" />
              </div>
              <div>
                <Statistic
                  title="Weekly Orders"
                  value={weeklyOrdersCount}
                  valueStyle={{ fontSize: "24px" }}
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Order Cycles */}
        <Col xs={24} sm={12} md={6}>
          <Card className="shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white rounded-lg p-3">
            <div className="flex items-center justify-start space-x-4 mb-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <ClockCircleOutlined className="text-purple-500 text-3xl" />
              </div>
              <div>
                <Typography.Text strong>Order Status</Typography.Text>
                <div className="mt-2">
                  {orderCycleData.slice(0, 3).map((cycle, index) => (
                    <Tag key={index} color={getOrderCycleColor(cycle.name)} className="mb-1">
                      {cycle.name}: {cycle.value}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: "40px" }}>
        <Col span={12}>
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300" title="Daily Orders Trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyOrders}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="totalOrders" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col span={12}>
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300" title="Monthly Orders">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyOrders}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalOrders" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Order Cycle Analysis */}
      <Row gutter={[16, 16]} style={{ marginTop: "40px" }}>
        <Col span={12}>
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300" title="Order Status Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderCycleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderCycleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getOrderCycleColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col span={12}>
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300" title="Order Status Summary">
            <div className="space-y-4">
              {orderCycleData.map((cycle, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getOrderCycleColor(cycle.name) }}
                    />
                    <Typography.Text strong>{cycle.name}</Typography.Text>
                  </div>
                  <div className="text-right">
                    <Typography.Text>{cycle.value} orders</Typography.Text>
                    <br />
                    <Typography.Text type="secondary">{cycle.percentage}%</Typography.Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default AgentDashboard;