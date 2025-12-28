// src/pages/ReportPage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Tabs,
  Card,
  Tag,
  Button,
  Space,
  message,
  DatePicker,
  Grid, // [1] Import Grid để kiểm tra kích thước màn hình
} from "antd";
import {
  BarChartOutlined,
  HistoryOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
  SwapRightOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import * as reportService from "../../services/report.service";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

// --- KHAI BÁO MÃ QUYỀN ---
const PERM_INVENTORY = 103;
const PERM_HISTORY = 101;
const PERM_NXT = 131;

const ReportPage = () => {
  // [2] Hook kiểm tra màn hình (screens.md = true nghĩa là màn hình PC/Tablet ngang)
  const screens = Grid.useBreakpoint();

  const [loading, setLoading] = useState(false);

  // State dữ liệu
  const [inventoryData, setInventoryData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [nxtData, setNxtData] = useState([]);

  // State quản lý Tab
  const [activeTab, setActiveTab] = useState("");

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ["5", "10", "20", "50"],
  });

  const [nxtFilter, setNxtFilter] = useState({
    from: dayjs().startOf("month"),
    to: dayjs().endOf("month"),
  });

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // 1. LẤY QUYỀN USER
  useEffect(() => {
    const storedUser = localStorage.getItem("user_info");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userData =
          user.quyen && !Array.isArray(user.quyen) ? user.quyen : user;

        const role = (
          userData.vaiTro ||
          userData.tenVaiTro ||
          ""
        ).toUpperCase();
        setIsAdmin(role === "ADMIN");

        let rawPerms = userData.dsQuyenSoHuu || userData.quyen || [];
        if (!Array.isArray(rawPerms)) rawPerms = [];

        const parsedPerms = rawPerms.map((p) => {
          if (typeof p === "object" && p !== null)
            return parseInt(p.maQuyen || p.id);
          return parseInt(p);
        });

        setPermissions(parsedPerms);
      } catch (e) {
        setPermissions([]);
      }
    }
  }, []);

  const canViewInventory = isAdmin || permissions.includes(PERM_INVENTORY);
  const canViewHistory = isAdmin || permissions.includes(PERM_HISTORY);
  const canViewNXT = isAdmin || permissions.includes(PERM_NXT);
  const canViewAnyReport = canViewInventory || canViewHistory || canViewNXT;

  // --- CÁC HÀM FETCH DỮ LIỆU ---

  const fetchInventory = useCallback(async () => {
    if (!canViewInventory) return;
    setLoading(true);
    try {
      const response = await reportService.getInventoryReport();
      const data = response.data || [];
      setInventoryData(data);
      setPagination((prev) => ({ ...prev, total: data.length, current: 1 }));
    } catch (error) {
      // message.error("Lỗi tải tồn kho");
    }
    setLoading(false);
  }, [canViewInventory]);

  const fetchHistory = useCallback(async () => {
    if (!canViewHistory) return;
    setLoading(true);
    try {
      const response = await reportService.getHistoryReport();
      const data = response.data || [];
      setHistoryData(data);
      setPagination((prev) => ({ ...prev, total: data.length, current: 1 }));
    } catch (error) {
      message.error("Lỗi tải lịch sử!");
    }
    setLoading(false);
  }, [canViewHistory]);

  const fetchNXT = useCallback(async () => {
    if (!canViewNXT) return;
    setLoading(true);
    try {
      const params = {
        from: nxtFilter.from.format("YYYY-MM-DD"),
        to: nxtFilter.to.format("YYYY-MM-DD"),
      };
      const response = await reportService.getNXTReport(params);
      const data = response.data || [];
      setNxtData(data);
      setPagination((prev) => ({
        ...prev,
        total: data.length,
        current: 1,
      }));
    } catch (error) {
      message.error("Lỗi tải báo cáo NXT!");
    }
    setLoading(false);
  }, [nxtFilter, canViewNXT]);

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  const handleExportNXT = async () => {
    if (!canViewNXT) return;
    setLoading(true);
    try {
      const params = {
        from: nxtFilter.from.format("YYYY-MM-DD"),
        to: nxtFilter.to.format("YYYY-MM-DD"),
      };
      const response = await reportService.exportNXTReport(params);
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `BaoCao_NXT_${params.from}_${params.to}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("Xuất file thành công!");
    } catch (error) {
      console.error(error);
      message.error("Lỗi xuất file excel!");
    }
    setLoading(false);
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  // --- [3] CẤU HÌNH CỘT ĐỘNG (RESPONSIVE) ---
  // Logic: Nếu screens.md (PC/Tablet) = true thì giữ nguyên fixed.
  // Nếu false (Mobile) thì bỏ fixed để vuốt ngang dễ dàng.

  const inventoryColumns = [
    {
      title: "Tên Sản Phẩm",
      dataIndex: "tenSP",
      key: "tenSP",
      width: 180,
      // Desktop: Ghim trái. Mobile: Không ghim.
      fixed: screens.md ? "left" : null,
    },
    {
      title: "ĐVT",
      dataIndex: "donViTinh",
      key: "donViTinh",
      width: 70,
      responsive: ["sm"], // Ẩn trên mobile nhỏ
    },
    {
      title: "Kho",
      dataIndex: "tenKho",
      key: "tenKho",
      width: 120,
      responsive: ["md"],
    },
    {
      title: "Tồn",
      dataIndex: "soLuongTon",
      key: "soLuongTon",
      align: "center",
      width: 80,
      render: (val, record) => {
        const min = record.mucTonToiThieu || 0;
        return <b style={{ color: val <= min ? "red" : "inherit" }}>{val}</b>;
      },
    },
    {
      title: "Trạng Thái",
      key: "status",
      width: 140,
      render: (_, record) => {
        const ton = record.soLuongTon || 0;
        const min = record.mucTonToiThieu || 0;
        const max = record.mucTonToiDa || 0;

        // Rút gọn chữ trên Mobile để đỡ tốn chỗ
        if (ton <= min) {
          return (
            <Tag
              icon={<WarningOutlined />}
              color="red"
            >
              {screens.md ? "Cảnh báo hết hàng" : "Hết hàng"}
            </Tag>
          );
        } else if (max > 0 && ton >= max) {
          return (
            <Tag
              icon={<WarningOutlined />}
              color="orange"
            >
              {screens.md ? "Cảnh báo nhiều hàng" : "Đầy kho"}
            </Tag>
          );
        } else {
          return (
            <Tag
              icon={<SafetyCertificateOutlined />}
              color="green"
            >
              {screens.md ? "Bình thường" : "Ổn"}
            </Tag>
          );
        }
      },
    },
  ];

  const historyColumns = [
    {
      title: "Ngày",
      dataIndex: "ngay",
      key: "ngay",
      width: 130,
      // Desktop: Ghim. Mobile: Bỏ ghim.
      fixed: screens.md ? "left" : null,
      render: (text) =>
        screens.md
          ? new Date(text).toLocaleString("vi-VN")
          : dayjs(text).format("DD/MM HH:mm"),
    },
    {
      title: "Loại",
      dataIndex: "loaiGiaoDich",
      key: "loaiGiaoDich",
      width: 110,
      render: (type) => {
        if (type === "NHAP") return <Tag color="green">NHẬP</Tag>;
        if (type === "XUAT") return <Tag color="blue">XUẤT</Tag>;
        if (type === "CHUYEN_DI")
          return (
            <Tag color="orange">
              {screens.md ? (
                <>
                  <SwapRightOutlined /> CHUYỂN ĐI
                </>
              ) : (
                "ĐI"
              )}
            </Tag>
          );
        if (type === "CHUYEN_DEN")
          return (
            <Tag color="cyan">
              {screens.md ? (
                <>
                  <SwapRightOutlined /> CHUYỂN ĐẾN
                </>
              ) : (
                "ĐẾN"
              )}
            </Tag>
          );
        return <Tag>{type}</Tag>;
      },
    },
    {
      title: "Chứng Từ",
      dataIndex: "chungTu",
      key: "chungTu",
      width: 100,
      responsive: ["lg"],
    },
    { title: "Sản Phẩm", dataIndex: "tenSP", key: "tenSP", width: 150 },
    {
      title: "SL",
      dataIndex: "soLuong",
      key: "soLuong",
      width: 70,
      align: "right",
      render: (val, record) => {
        const isImport = ["NHAP", "CHUYEN_DEN"].includes(record.loaiGiaoDich);
        return (
          <b style={{ color: isImport ? "green" : "red" }}>
            {isImport ? "+" : "-"}
            {val}
          </b>
        );
      },
    },
  ];

  const nxtColumns = [
    { title: "Mã", dataIndex: "maSP", width: 70, responsive: ["md"] },
    {
      title: "Tên Sản Phẩm",
      dataIndex: "tenSP",
      width: 180,
      // Desktop: Ghim. Mobile: Bỏ ghim.
      fixed: screens.md ? "left" : null,
    },
    { title: "ĐVT", dataIndex: "donViTinh", width: 60, responsive: ["sm"] },
    {
      title: "Đầu",
      dataIndex: "tonDau",
      align: "center",
      width: 70,
      responsive: ["sm"],
      render: (v) => <b>{v}</b>,
    },
    {
      title: "Nhập",
      dataIndex: "slNhap",
      align: "center",
      width: 70,
      render: (v) => <span style={{ color: "green" }}>+{v}</span>,
    },
    {
      title: "Xuất",
      dataIndex: "slXuat",
      align: "center",
      width: 70,
      render: (v) => <span style={{ color: "red" }}>-{v}</span>,
    },
    {
      title: "Cuối",
      dataIndex: "tonCuoi",
      align: "center",
      width: 70,
      render: (v) => <b style={{ color: "blue" }}>{v}</b>,
    },
    {
      title: "Giá Trị",
      dataIndex: "giaTriTonCuoi",
      align: "right",
      width: 120,
      // Luôn hiện để user vuốt sang xem được tiền
      render: (v) => `${Number(v).toLocaleString()}`,
    },
  ];

  // 3. XÂY DỰNG DANH SÁCH TAB DỰA TRÊN QUYỀN
  const getTabItems = () => {
    const items = [];

    // Tab Tồn kho
    if (canViewInventory) {
      items.push({
        key: "inventory",
        label: (
          <span>
            <BarChartOutlined /> {screens.md ? "Tồn kho hiện tại" : "Tồn kho"}
          </span>
        ),
        children: (
          <Table
            className="fixed-height-table"
            columns={inventoryColumns}
            dataSource={inventoryData}
            loading={loading}
            rowKey={(record, index) => index}
            pagination={pagination}
            onChange={handleTableChange}
            // Desktop: 1000px để fixed column hoạt động tốt
            // Mobile: 600px để đủ hiện các cột và cho phép vuốt ngang
            scroll={{ x: screens.md ? 1000 : 600 }}
            size="small"
          />
        ),
      });
    }

    // Tab Lịch sử
    if (canViewHistory) {
      items.push({
        key: "history",
        label: (
          <span>
            <HistoryOutlined /> {screens.md ? "Lịch sử giao dịch" : "Lịch sử"}
          </span>
        ),
        children: (
          <Table
            className="fixed-height-table"
            columns={historyColumns}
            dataSource={historyData}
            loading={loading}
            rowKey={(record, index) => index}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: screens.md ? 1000 : 700 }}
            size="small"
          />
        ),
      });
    }

    // Tab Nhập Xuất Tồn
    if (canViewNXT) {
      items.push({
        key: "nxt",
        label: (
          <span>
            <TableOutlined /> {screens.md ? "Nhập - Xuất - Tồn" : "NXT"}
          </span>
        ),
        children: (
          <>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                flexWrap: "wrap", // Cho phép xuống dòng trên mobile
                gap: "10px",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Space
                wrap
                style={{ flex: 1 }}
              >
                {" "}
                {/* Space wrap giúp nội dung bên trong xuống dòng */}
                <span style={{ whiteSpace: "nowrap" }}>Kỳ báo cáo:</span>
                <RangePicker
                  style={{ width: "100%", minWidth: "220px" }} // Linh hoạt width
                  allowClear={false}
                  value={[nxtFilter.from, nxtFilter.to]}
                  onChange={(dates) =>
                    setNxtFilter({ from: dates[0], to: dates[1] })
                  }
                />
                <Button
                  type="primary"
                  onClick={fetchNXT}
                  loading={loading}
                >
                  Xem
                </Button>
              </Space>

              <Button
                icon={<FileExcelOutlined />}
                onClick={handleExportNXT}
                loading={loading}
                style={{
                  background: "#217346",
                  color: "#fff",
                  borderColor: "#217346",
                }}
              >
                Xuất Excel
              </Button>
            </div>
            <Table
              className="fixed-height-table"
              columns={nxtColumns}
              dataSource={nxtData}
              loading={loading}
              rowKey="maSP"
              pagination={pagination}
              onChange={handleTableChange}
              bordered
              // Scroll rộng hơn để chứa đủ cột Giá trị
              scroll={{ x: screens.md ? 1200 : 900 }}
              size="small"
              summary={(pageData) => {
                let totalNhap = 0;
                let totalXuat = 0;
                let totalGiaTri = 0;
                pageData.forEach(({ slNhap, slXuat, giaTriTonCuoi }) => {
                  totalNhap += slNhap || 0;
                  totalXuat += slXuat || 0;
                  totalGiaTri += giaTriTonCuoi || 0;
                });

                return (
                  <Table.Summary.Row
                    style={{ fontWeight: "bold", background: "#fafafa" }}
                  >
                    {/* 1. Ô "Tổng":
                      - Desktop (md): Gộp 3 cột (Mã, Tên, ĐVT).
                      - Tablet (sm): Gộp 2 cột (Tên, ĐVT) vì cột Mã bị ẩn.
                      - Mobile: Gộp 1 cột (Tên) vì Mã, ĐVT bị ẩn.
                    */}
                    <Table.Summary.Cell
                      index={0}
                      colSpan={screens.md ? 3 : screens.sm ? 2 : 1}
                    >
                      Tổng
                    </Table.Summary.Cell>
                    {/* 2. Ô trống cho cột "Đầu":
                      - Cột này chỉ hiện khi screens.sm = true.
                      - Nên ta cũng cần render 1 ô trống tương ứng để đẩy các số liệu sau về đúng chỗ.
                    */}
                    {screens.sm && (
                      <Table.Summary.Cell index={1}></Table.Summary.Cell>
                    )}
                    {/* 3. Các ô số liệu (Nhập, Xuất, Cuối, Giá trị) */}
                    <Table.Summary.Cell
                      index={2}
                      align="center"
                    >
                      {totalNhap}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell
                      index={3}
                      align="center"
                    >
                      {totalXuat}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}></Table.Summary.Cell>{" "}
                    {/* Ô trống cho Tồn Cuối */}
                    <Table.Summary.Cell
                      index={5}
                      align="right"
                    >
                      {totalGiaTri.toLocaleString()}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </>
        ),
      });
    }

    return items;
  };

  const items = getTabItems();

  useEffect(() => {
    if (items.length > 0) {
      const isCurrentTabValid = items.some((i) => i.key === activeTab);
      if (!activeTab || !isCurrentTabValid) {
        setActiveTab(items[0].key);
      }
    }
  }, [items, activeTab]);

  useEffect(() => {
    if (activeTab === "inventory" && canViewInventory) {
      fetchInventory();
    } else if (activeTab === "history" && canViewHistory) {
      fetchHistory();
    } else if (activeTab === "nxt" && canViewNXT) {
      fetchNXT();
    }
  }, [
    activeTab,
    canViewInventory,
    canViewHistory,
    canViewNXT,
    fetchInventory,
    fetchHistory,
    fetchNXT,
  ]);

  return (
    <div style={{ padding: "0 10px" }}>
      <h2>Báo cáo & Thống kê</h2>
      {canViewAnyReport && items.length > 0 ? (
        <Tabs
          activeKey={activeTab}
          items={items}
          onChange={handleTabChange}
        />
      ) : (
        <Card style={{ textAlign: "center", marginTop: 20 }}>
          <WarningOutlined
            style={{ fontSize: 40, color: "orange", marginBottom: 10 }}
          />
          <p>Bạn không có quyền xem bất kỳ báo cáo nào.</p>
        </Card>
      )}
    </div>
  );
};

export default ReportPage;
