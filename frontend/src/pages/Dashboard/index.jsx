// src/pages/Dashboard/index.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  DatePicker,
  Button,
  Space,
  Table,
  Spin,
  Tabs,
  Grid, // [1] Import Grid để bắt kích thước màn hình
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  WarningOutlined,
  DollarOutlined,
  ShopOutlined,
} from "@ant-design/icons";
// Thư viện biểu đồ
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import dayjs from "dayjs";
import * as dashboardService from "../../services/dashboard.service";

const { RangePicker } = DatePicker;

// [!] 1. ĐỊNH NGHĨA QUYỀN DASHBOARD
const PERM_DASHBOARD_VIEW = 130;

const Dashboard = () => {
  // [2] Hook kiểm tra màn hình (screens.md = true nghĩa là PC/Tablet, false là Mobile)
  const screens = Grid.useBreakpoint();

  const [loading, setLoading] = useState(false);

  // State dữ liệu
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [alerts, setAlerts] = useState({
    sapHetHang: [],
    hetHanSuDung: [],
    tonAm: [],
  });

  // State bộ lọc (Mặc định là tháng hiện tại)
  const [filter, setFilter] = useState({
    from: dayjs().startOf("month"),
    to: dayjs().endOf("month"),
  });

  // [!] 2. STATE PHÂN QUYỀN
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // [!] 3. LẤY QUYỀN TỪ LOCALSTORAGE
  useEffect(() => {
    const storedUser = localStorage.getItem("user_info");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userData =
          user.quyen && !Array.isArray(user.quyen) && user.quyen.maNguoiDung
            ? user.quyen
            : user;

        const role = userData.vaiTro || userData.tenVaiTro || "";
        setIsAdmin(role.toUpperCase() === "ADMIN");

        let perms = userData.dsQuyenSoHuu || userData.quyen || [];
        if (!Array.isArray(perms)) perms = [];
        setPermissions(perms);
      } catch (e) {
        setPermissions([]);
      }
    }
  }, []);

  // Biến kiểm tra quyền
  const canViewDashboard = isAdmin || permissions.includes(PERM_DASHBOARD_VIEW);

  // Hàm format tiền tệ
  const formatCurrency = (value) => `${Number(value || 0).toLocaleString()} đ`;

  // 1. Hàm tải dữ liệu tổng hợp
  const fetchData = useCallback(async () => {
    if (!canViewDashboard) return;

    setLoading(true);
    try {
      const dateParams = {
        from: filter.from.format("YYYY-MM-DD"),
        to: filter.to.format("YYYY-MM-DD"),
      };
      const year = filter.from.year();

      const [resStats, resChart, resTop, resAlerts] = await Promise.allSettled([
        dashboardService.getStats(dateParams),
        dashboardService.getChartData(year),
        dashboardService.getTopProducts({
          ...dateParams,
          type: "export",
          limit: 5,
        }),
        dashboardService.getAlerts(),
      ]);

      if (resStats.status === "fulfilled") setStats(resStats.value.data || {});
      if (resChart.status === "fulfilled")
        setChartData(resChart.value.data || []);
      if (resTop.status === "fulfilled")
        setTopProducts(resTop.value.data || []);
      if (resAlerts.status === "fulfilled")
        setAlerts(
          resAlerts.value.data || {
            sapHetHang: [],
            hetHanSuDung: [],
            tonAm: [],
          }
        );
    } catch (error) {
      console.error("Dashboard Error:", error);
    }
    setLoading(false);
  }, [filter, canViewDashboard]);

  useEffect(() => {
    if (canViewDashboard) {
      fetchData();
    }
  }, [fetchData, canViewDashboard]);

  const handleDateChange = (dates) => {
    if (dates) {
      setFilter({ from: dates[0], to: dates[1] });
    }
  };

  // Cấu hình cột cho bảng Top Sản phẩm
  const topProductColumns = [
    {
      title: "Sản phẩm",
      dataIndex: "tenSP",
      key: "tenSP",
      // Mobile thì cho phép tên dài xuống dòng, không fix width cứng
      width: screens.md ? undefined : 150,
    },
    {
      title: "SL", // Rút gọn tên cột trên mobile
      dataIndex: "tongSoLuong",
      key: "tongSoLuong",
      align: "center",
      width: 60,
    },
    {
      title: "Doanh thu",
      dataIndex: "tongGiaTri",
      key: "tongGiaTri",
      align: "right",
      render: formatCurrency,
      width: 120,
    },
  ];

  // Cấu hình cột cho bảng Cảnh báo
  const alertColumns = [
    { title: "Mã", dataIndex: "maSP", width: 60, responsive: ["sm"] }, // Ẩn mã trên điện thoại quá nhỏ
    { title: "Tên Sản Phẩm", dataIndex: "tenSP" },
    {
      title: "Tồn Kho",
      key: "tonKho",
      width: 120,
      render: (_, record) => {
        let ton = 0;
        if (record.soLuongTon !== undefined) ton = record.soLuongTon;
        else if (record.tonHienTai !== undefined) ton = record.tonHienTai;

        return (
          <span
            style={{ color: ton <= 0 ? "red" : "orange", fontWeight: "bold" }}
          >
            {ton}{" "}
            {record.mucTonToiThieu ? `/ Min: ${record.mucTonToiThieu}` : ""}
          </span>
        );
      },
    },
  ];

  if (!canViewDashboard) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <WarningOutlined
              style={{ fontSize: 40, color: "#faad14", marginBottom: 16 }}
            />
            <h3>Bạn không có quyền xem Dashboard</h3>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 10px" }}>
      {/* --- THANH CÔNG CỤ (RESPONSIVE) --- */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          // [Responsive] Mobile: Xếp dọc (column), Desktop: Xếp ngang (row)
          flexDirection: screens.md ? "row" : "column",
          justifyContent: "space-between",
          // [Responsive] Mobile: Căn trái, Desktop: Căn giữa theo trục dọc
          alignItems: screens.md ? "center" : "flex-start",
          gap: 10, // Tạo khoảng cách giữa Title và Bộ lọc khi xuống dòng
        }}
      >
        <h2 style={{ margin: 0 }}>Tổng Quan Kho</h2>

        {/* Space bọc RangePicker và Button */}
        <Space
          // [Responsive] Mobile: button xuống dòng nếu thiếu chỗ, width 100%
          direction={screens.md ? "horizontal" : "vertical"}
          style={{ width: screens.md ? "auto" : "100%" }}
          size={10}
        >
          <span style={{ display: screens.md ? "inline" : "none" }}>
            Thời gian:
          </span>
          <RangePicker
            value={[filter.from, filter.to]}
            onChange={handleDateChange}
            allowClear={false}
            // [Responsive] Mobile: RangePicker full width để dễ bấm
            style={{ width: screens.md ? "auto" : "100%" }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            // [Responsive] Mobile: Button full width
            block={!screens.md}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* --- 1. THẺ THỐNG KÊ (STATS) --- */}
          {/* Gutter: Khoảng cách giữa các thẻ. xs=24 tự động xếp chồng trên mobile */}
          <Row gutter={[16, 16]}>
            <Col
              xs={24}
              sm={12}
              lg={6}
            >
              <Card
                bordered={false}
                hoverable
              >
                <Statistic
                  title="Vốn Nhập Hàng"
                  value={stats?.tongVonNhap || 0}
                  precision={0}
                  valueStyle={{ color: "#cf1322" }}
                  prefix={<ArrowDownOutlined />}
                  suffix="đ"
                />
              </Card>
            </Col>
            <Col
              xs={24}
              sm={12}
              lg={6}
            >
              <Card
                bordered={false}
                hoverable
              >
                <Statistic
                  title="Doanh Thu Xuất"
                  value={stats?.tongDoanhThuXuat || 0}
                  precision={0}
                  valueStyle={{ color: "#3f8600" }}
                  prefix={<ArrowUpOutlined />}
                  suffix="đ"
                />
              </Card>
            </Col>
            <Col
              xs={24}
              sm={12}
              lg={6}
            >
              <Card
                bordered={false}
                hoverable
              >
                <Statistic
                  title="Lợi Nhuận Ước Tính"
                  value={stats?.loiNhuanUocTinh || 0}
                  precision={0}
                  valueStyle={{
                    color:
                      (stats?.loiNhuanUocTinh || 0) >= 0
                        ? "#3f8600"
                        : "#cf1322",
                  }}
                  prefix={<DollarOutlined />}
                  suffix="đ"
                />
              </Card>
            </Col>
            <Col
              xs={24}
              sm={12}
              lg={6}
            >
              <Card
                bordered={false}
                hoverable
              >
                <Statistic
                  title="Tổng Tồn Kho"
                  value={stats?.tongTonKho || 0}
                  prefix={<ShopOutlined />}
                  suffix="SP"
                />
              </Card>
            </Col>
          </Row>

          <Row
            gutter={[16, 16]}
            style={{ marginTop: 24 }}
          >
            {/* --- 2. BIỂU ĐỒ (CHART) --- */}
            <Col
              xs={24}
              lg={16}
            >
              <Card
                title={`Biểu đồ (${filter.from.year()})`}
                bordered={false}
                bodyStyle={{ padding: screens.md ? 24 : "24px 0" }} // Mobile giảm padding ngang
              >
                <div style={{ height: 350, width: "100%" }}>
                  <ResponsiveContainer>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }} // Giảm margin phải cho mobile
                    >
                      <defs>
                        <linearGradient
                          id="colorNhap"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#ff4d4f"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#ff4d4f"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorXuat"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#52c41a"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#52c41a"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="thang" />
                      <YAxis
                        // Rút gọn số trên trục Y (ví dụ 1.000.000 -> 1M)
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("en", {
                            notation: "compact",
                          }).format(value)
                        }
                        width={40} // Thu nhỏ chiều rộng trục Y để đỡ chiếm chỗ
                      />
                      <CartesianGrid strokeDasharray="3 3" />
                      <Tooltip
                        formatter={(value) =>
                          new Intl.NumberFormat("vi-VN").format(value) + " đ"
                        }
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="nhap"
                        name="Vốn Nhập"
                        stroke="#ff4d4f"
                        fillOpacity={1}
                        fill="url(#colorNhap)"
                      />
                      <Area
                        type="monotone"
                        dataKey="xuat"
                        name="Doanh Thu"
                        stroke="#52c41a"
                        fillOpacity={1}
                        fill="url(#colorXuat)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            {/* --- 3. TOP SẢN PHẨM --- */}
            <Col
              xs={24}
              lg={8}
            >
              <Card
                title="Top 5 Bán chạy"
                bordered={false}
                bodyStyle={{ padding: "0" }}
              >
                <Table
                  dataSource={topProducts}
                  columns={topProductColumns}
                  rowKey="maSP"
                  pagination={false}
                  size="small"
                  // [Responsive] Thêm scroll ngang để không bị vỡ trên mobile
                  scroll={{ x: 400 }}
                />
              </Card>
            </Col>
          </Row>

          {/* --- 4. CẢNH BÁO (ALERTS) --- */}
          <Row
            gutter={[16, 16]}
            style={{ marginTop: 24 }}
          >
            <Col span={24}>
              <Card
                title={
                  <span>
                    <WarningOutlined style={{ color: "orange" }} /> Cảnh Báo
                  </span>
                }
                bordered={false}
              >
                <Tabs
                  defaultActiveKey="1"
                  items={[
                    {
                      key: "1",
                      label: `Sắp hết hàng (${alerts.sapHetHang?.length || 0})`,
                      children: (
                        <Table
                          dataSource={alerts.sapHetHang}
                          columns={alertColumns}
                          rowKey="maSP"
                          pagination={{ pageSize: 5 }}
                          size="small"
                          // [Responsive] Thêm scroll ngang
                          scroll={{ x: 500 }}
                        />
                      ),
                    },
                    {
                      key: "3",
                      label: `Hết hạn (${alerts.hetHanSuDung?.length || 0})`,
                      children: (
                        <Table
                          dataSource={alerts.hetHanSuDung}
                          columns={alertColumns}
                          rowKey="maSP"
                          pagination={{ pageSize: 5 }}
                          size="small"
                          scroll={{ x: 500 }}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default Dashboard;
