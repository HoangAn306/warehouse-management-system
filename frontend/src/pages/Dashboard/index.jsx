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
  Grid,
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  WarningOutlined,
  DollarOutlined,
  ShopOutlined,
} from "@ant-design/icons";
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

const PERM_DASHBOARD_VIEW = 130;

const Dashboard = () => {
  const screens = Grid.useBreakpoint();

  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [alerts, setAlerts] = useState({
    sapHetHang: [],
    hetHanSuDung: [],
    tonAm: [],
  });

  const [filter, setFilter] = useState({
    from: dayjs().startOf("month"),
    to: dayjs().endOf("month"),
  });

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const canViewDashboard = isAdmin || permissions.includes(PERM_DASHBOARD_VIEW);

  const formatCurrency = (value) => `${Number(value || 0).toLocaleString()} đ`;

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

  const topProductColumns = [
    {
      title: "Sản phẩm",
      dataIndex: "tenSP",
      key: "tenSP",
      width: screens.md ? undefined : 150,
    },
    {
      title: "SL",
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

  // [SỬA] 1. Cấu hình cột riêng cho Sắp hết hàng (Không có Số lô/Ngày HH)
  const lowStockColumns = [
    { title: "Mã", dataIndex: "maSP", width: 60, responsive: ["sm"] },
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

  // [SỬA] 2. Cấu hình cột riêng cho Hết hạn sử dụng (Có Số lô, Ngày HH)
  const expiredColumns = [
    { title: "Mã", dataIndex: "maSP", width: 60, responsive: ["sm"] },
    { title: "Tên Sản Phẩm", dataIndex: "tenSP" },
    { title: "Số lô", dataIndex: "soLo", width: 100 },
    {
      title: "Ngày hết hạn",
      dataIndex: "ngayHetHan",
      width: 120,
      render: (val) => (val ? dayjs(val).format("DD/MM/YYYY") : ""),
    },
    {
      title: "Tồn Kho",
      key: "tonKho",
      width: 100,
      render: (_, record) => {
        return (
          <span style={{ color: "red", fontWeight: "bold" }}>
            {record.soLuongTon}
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
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          flexDirection: screens.md ? "row" : "column",
          justifyContent: "space-between",
          alignItems: screens.md ? "center" : "flex-start",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0 }}>Tổng Quan Kho</h2>

        <Space
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
            style={{ width: screens.md ? "auto" : "100%" }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
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
          {/* STATS */}
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
            {/* CHART */}
            <Col
              xs={24}
              lg={16}
            >
              <Card
                title={`Biểu đồ (${filter.from.year()})`}
                bordered={false}
                bodyStyle={{ padding: screens.md ? 24 : "24px 0" }}
              >
                <div style={{ height: 350, width: "100%" }}>
                  <ResponsiveContainer>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("en", {
                            notation: "compact",
                          }).format(value)
                        }
                        width={40}
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

            {/* TOP PRODUCTS */}
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
                  scroll={{ x: 400 }}
                />
              </Card>
            </Col>
          </Row>

          {/* ALERTS */}
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
                          // [SỬA] Sử dụng lowStockColumns cho tab này
                          columns={lowStockColumns}
                          rowKey="maSP"
                          pagination={{ pageSize: 5 }}
                          size="small"
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
                          // [SỬA] Sử dụng expiredColumns cho tab này
                          columns={expiredColumns}
                          rowKey={(record, index) => index}
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
