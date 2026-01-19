// src/pages/SystemLogPage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  message,
  Tag,
  Card,
  DatePicker,
  Space,
  Button,
  Row,
  Col,
  Grid, // [1] Import Grid
} from "antd";
import {
  HistoryOutlined,
  ReloadOutlined,
  LockOutlined,
} from "@ant-design/icons";

// [!] Import đầy đủ các service để lấy tên
import * as logService from "../../services/log.service";
import * as userService from "../../services/user.service";
import * as productService from "../../services/product.service";
import * as customerService from "../../services/customer.service";
import * as supplierService from "../../services/supplier.service";
import * as warehouseService from "../../services/warehouse.service";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

const PERM_VIEW_LOG = 100;

// Map tên quyền (giữ nguyên)
const PERMISSION_MAP = {
  10: "Tạo User",
  11: "Sửa User",
  12: "Xóa User",
  13: "Cấu hình",
  14: "Xem User",
  20: "Tạo Phiếu Nhập",
  21: "Sửa Phiếu Nhập",
  22: "Xóa Phiếu Nhập",
  40: "Duyệt P.Nhập",
  41: "Hủy P.Nhập",
  23: "Tạo Phiếu Xuất",
  24: "Sửa Phiếu Xuất",
  25: "Xóa Phiếu Xuất",
  42: "Duyệt P.Xuất",
  43: "Hủy P.Xuất",
  30: "Xem Báo Cáo",
  31: "Duyệt PO",
  32: "Duyệt SO",
  50: "Tạo SP",
  51: "Sửa SP",
  52: "Xóa SP",
  60: "Xem NCC",
  61: "Tạo NCC",
  62: "Sửa NCC",
  63: "Xóa NCC",
  70: "Xem Kho",
  71: "Tạo Kho",
  72: "Sửa Kho",
  73: "Xóa Kho",
  90: "Xem KH",
  91: "Tạo KH",
  92: "Sửa KH",
  93: "Xóa KH",
  100: "Xem Nhật Ký Hệ Thống",
  101: "Xem Lịch Sử GD",
  103: "Xem Báo Cáo Tồn",
  110: "Xem Điều Chuyển",
  111: "Tạo Điều Chuyển",
  112: "Duyệt ĐC",
  113: "Hủy ĐC",
  114: "Sửa ĐC đã duyệt",
  120: "Sửa P.Nhập đã duyệt",
  121: "Sửa P.Xuất đã duyệt",
  130: "Xem Dashboard",
  131: "Xem Báo Cáo NXT",
  140: "Xem Loại Hàng",
  141: "Tạo Loại Hàng",
  142: "Sửa Loại Hàng",
  143: "Xóa Loại Hàng",
};

const SystemLogPage = () => {
  // [2] Hook kiểm tra màn hình
  const screens = Grid.useBreakpoint();
// --- STATE QUẢN LÝ DỮ LIỆU ---
  const [logs, setLogs] = useState([]);
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [dateRange, setDateRange] = useState(null);

  // [!] State lưu các Map để tra cứu tên
  const [dataMaps, setDataMaps] = useState({
    users: {},
    products: {},
    customers: {},
    suppliers: {},
    warehouses: {},
  });

  const [tableParams, setTableParams] = useState({
    pagination: {
      current: 1,
      pageSize: 10,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => `Tổng cộng ${total} dòng`,
    },
  });

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
// --- 1. KIỂM TRA QUYỀN TRUY CẬP ---
  useEffect(() => {
    const storedUser = localStorage.getItem("user_info");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userData =
          user.quyen && !Array.isArray(user.quyen) ? user.quyen : user;
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

  const canViewLog = isAdmin || permissions.includes(PERM_VIEW_LOG);

  // --- 2. HÀM TẢI DỮ LIỆU TỔNG HỢP (QUAN TRỌNG) ---
  const fetchData = useCallback(async () => {
    if (!canViewLog) return;

    setLoading(true);
    try {
      const [
        resLogs,
        resUsers,
        resProducts,
        resCustomers,
        resSuppliers,
        resWarehouses,
      ] = await Promise.allSettled([
        logService.getAllLogs(),
        userService.getAllUsers(),
        productService.getAllProducts(),
        customerService.getAllCustomers(),
        supplierService.getAllSuppliers(),
        warehouseService.getAllWarehouses(),
      ]);

      // 1. Xử lý Logs
      let dataLogs = [];
      if (resLogs.status === "fulfilled") {
        dataLogs = resLogs.value.data || [];
        dataLogs.sort(
          (a, b) => new Date(b.thoiGianThucHien) - new Date(a.thoiGianThucHien)
        );
      }

      // 2. Tạo Map User
      let uMap = {};
      if (resUsers.status === "fulfilled") {
        (resUsers.value.data || []).forEach(
          (u) => (uMap[u.maNguoiDung] = `${u.hoTen} (${u.tenDangNhap})`)
        );
      }

      // 3. Tạo Map Sản phẩm
      let pMap = {};
      if (resProducts.status === "fulfilled") {
        const pList = Array.isArray(resProducts.value.data)
          ? resProducts.value.data
          : resProducts.value.data?.content || [];
        pList.forEach((p) => (pMap[p.maSP] = p.tenSP));
      }

      // 4. Tạo Map Khách hàng
      let cMap = {};
      if (resCustomers.status === "fulfilled") {
        (resCustomers.value.data || []).forEach(
          (c) => (cMap[c.maKH] = c.tenKH)
        );
      }

      // 5. Tạo Map NCC
      let sMap = {};
      if (resSuppliers.status === "fulfilled") {
        (resSuppliers.value.data || []).forEach(
          (s) => (sMap[s.maNCC] = s.tenNCC)
        );
      }

      // 6. Tạo Map Kho
      let wMap = {};
      if (resWarehouses.status === "fulfilled") {
        (resWarehouses.value.data || []).forEach(
          (w) => (wMap[w.maKho] = w.tenKho)
        );
      }

      setDataMaps({
        users: uMap,
        products: pMap,
        customers: cMap,
        suppliers: sMap,
        warehouses: wMap,
      });

      setLogs(dataLogs);
      setDisplayedLogs(dataLogs);
      setTableParams((prev) => ({
        ...prev,
        pagination: { ...prev.pagination, total: dataLogs.length },
      }));
    } catch (error) {
      messageApi.error("Lỗi tải dữ liệu!");
    }
    setLoading(false);
  }, [messageApi, canViewLog]);

  useEffect(() => {
    if (canViewLog) fetchData();
  }, [fetchData, canViewLog]);
// --- 3. LOGIC LỌC NGÀY (CLIENT-SIDE) ---
  useEffect(() => {
    if (!dateRange) {
      setDisplayedLogs(logs);
      return;
    }
    const [start, end] = dateRange;
    const filtered = logs.filter((log) => {
      const logDate = dayjs(log.thoiGianThucHien);
      return (
        (logDate.isSame(start, "day") || logDate.isAfter(start, "day")) &&
        (logDate.isSame(end, "day") || logDate.isBefore(end, "day"))
      );
    });
    setDisplayedLogs(filtered);
  }, [dateRange, logs]);

  const handleTableChange = (pagination, filters, sorter) => {
    setTableParams({ pagination, filters, ...sorter });
  };

// --- 4. HÀM FORMAT CHUỖI LOG (MAGIC FUNCTION) ---
  const formatActionText = (text) => {
    if (!text) return "";
    let newText = text;

    newText = newText.replace(
      /user \(MaNguoiDung:\s*(\d+)\)|MaNguoiDung:\s*(\d+)/gi,
      (match, id1, id2) => {
        const id = id1 || id2;
        return dataMaps.users[id]
          ? `User: <b>${dataMaps.users[id]}</b>`
          : match;
      }
    );

    newText = newText.replace(/MaChucNang:\s*(\d+)/gi, (match, id) => {
      return PERMISSION_MAP[id] ? `Quyền: <b>${PERMISSION_MAP[id]}</b>` : match;
    });

    newText = newText.replace(/sản phẩm ID:\s*(\d+)/gi, (match, id) => {
      return dataMaps.products[id]
        ? `sản phẩm: <b>${dataMaps.products[id]}</b>`
        : match;
    });

    newText = newText.replace(/khách hàng ID:\s*(\d+)/gi, (match, id) => {
      return dataMaps.customers[id]
        ? `khách hàng: <b>${dataMaps.customers[id]}</b>`
        : match;
    });

    newText = newText.replace(/Nhà cung cấp ID:\s*(\d+)/gi, (match, id) => {
      return dataMaps.suppliers[id]
        ? `NCC: <b>${dataMaps.suppliers[id]}</b>`
        : match;
    });

    newText = newText.replace(/kho hàng ID:\s*(\d+)/gi, (match, id) => {
      return dataMaps.warehouses[id]
        ? `kho: <b>${dataMaps.warehouses[id]}</b>`
        : match;
    });

    return <span dangerouslySetInnerHTML={{ __html: newText }} />;
  };

  // --- 5. CẤU HÌNH CỘT BẢNG ---
  const columns = [
    {
      title: "Mã hoạt động",
      dataIndex: "maHD",
      width: 80,
      fixed: screens.md ? "left" : null, // Ghim trái trên PC
    },
    {
      title: "Người Thực Hiện",
      dataIndex: "tenDangNhap",
      width: 200,
      fixed: screens.md ? "left" : null, // Ghim trái trên PC
      render: (text, record) => (
        <div>
          <strong>{text}</strong>
          <div style={{ fontSize: 12, color: "#888" }}>{record.hoTen}</div>
        </div>
      ),
    },
    {
      title: "Hành Động",
      dataIndex: "hanhDong",
      width: 400, // Đặt độ rộng cố định để bảng có thể cuộn ngang
      render: (text) => {
        let color = "blue";
        if (
          text.includes("Xóa") ||
          text.includes("Hủy") ||
          text.includes("Thu hồi")
        )
          color = "red";
        if (
          text.includes("Thêm") ||
          text.includes("Tạo") ||
          text.includes("Duyệt") ||
          text.includes("Gán")
        )
          color = "green";
        if (text.includes("Cập nhật") || text.includes("Sửa")) color = "orange";

        return (
          <Tag
            color={color}
            style={{ fontSize: "13px", whiteSpace: "normal", padding: "5px" }}
          >
            {formatActionText(text)}
          </Tag>
        );
      },
    },
    {
      title: "Thời Gian",
      dataIndex: "thoiGianThucHien",
      width: 180,
      fixed: screens.md ? "right" : null, // Ghim phải trên PC
      render: (text) => dayjs(text).format("DD/MM/YYYY HH:mm:ss"),
    },
  ];

  if (!canViewLog) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Card>
          <Space direction="vertical">
            <LockOutlined style={{ fontSize: 40, color: "red" }} />
            <h3>Bạn không có quyền truy cập.</h3>
          </Space>
        </Card>
      </div>
    );
  }
// --- 6. RENDER GIAO DIỆN ---
  return (
    <div style={{ padding: "0 10px" }}>
      {" "}
      {/* Padding nhỏ cho mobile */}
      {contextHolder}
      {/* KHU VỰC BỘ LỌC (Sử dụng Grid thay vì Space để Responsive) */}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        <Row
          gutter={[16, 16]}
          align="middle"
        >
          {/* Tiêu đề */}
          <Col
            xs={24}
            md={8}
          >
            <h3 style={{ margin: 0, fontSize: "18px" }}>
              <HistoryOutlined /> Nhật Ký Hoạt Động
            </h3>
          </Col>

          {/* Chọn ngày */}
          <Col
            xs={24}
            md={10}
          >
            <RangePicker
              placeholder={["Từ ngày", "Đến ngày"]}
              format="DD/MM/YYYY"
              onChange={(dates) => setDateRange(dates)}
              style={{ width: "100%" }}
            />
          </Col>

          {/* Nút Tải lại */}
          <Col
            xs={24}
            md={6}
            style={{ textAlign: screens.md ? "right" : "left" }}
          >
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
              block={!screens.md} // Full width trên mobile
            >
              Tải lại
            </Button>
          </Col>
        </Row>
      </Card>
      {/* BẢNG DỮ LIỆU */}
      <Table
        className="fixed-height-table"
        columns={columns}
        dataSource={displayedLogs}
        loading={loading}
        rowKey="maHD"
        pagination={tableParams.pagination}
        onChange={handleTableChange}
        // [QUAN TRỌNG] Cuộn ngang
        scroll={{ x: 900 }}
        size={screens.md ? "middle" : "small"}
      />
    </div>
  );
};

export default SystemLogPage;
