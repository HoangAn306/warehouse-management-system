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
} from "antd";
import {
  BarChartOutlined,
  HistoryOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import * as reportService from "../../services/report.service";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

const PERM_INVENTORY = 103;
const PERM_HISTORY = 101;
const PERM_NXT = 131;

const ReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [nxtData, setNxtData] = useState([]);
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

  const fetchInventory = useCallback(async () => {
    if (!canViewInventory) return;
    setLoading(true);
    try {
      const response = await reportService.getInventoryReport();
      const data = response.data || [];
      setInventoryData(data);
      setPagination((prev) => ({ ...prev, total: data.length, current: 1 }));
    } catch (error) {}
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
      setPagination((prev) => ({ ...prev, total: data.length, current: 1 }));
    } catch (error) {
      message.error("Lỗi tải báo cáo NXT!");
    }
    setLoading(false);
  }, [nxtFilter, canViewNXT]);

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

  const handleTabChange = (key) => setActiveTab(key);
  const handleTableChange = (newPagination) =>
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });

  // --- CẤU HÌNH CỘT RESPONSIVE ---
  const inventoryColumns = [
    {
      title: "Tên Sản Phẩm",
      dataIndex: "tenSP",
      key: "tenSP",
      width: 150,
      fixed: "left",
    },
    {
      title: "ĐVT",
      dataIndex: "donViTinh",
      key: "donViTinh",
      width: 70,
      responsive: ["md"],
    },
    {
      title: "Kho",
      dataIndex: "tenKho",
      key: "tenKho",
      width: 100,
      responsive: ["md"],
    },
    {
      title: "Tồn",
      dataIndex: "soLuongTon",
      key: "soLuongTon",
      align: "center",
      width: 80,
      render: (val, record) => (
        <b
          style={{
            color: val <= (record.mucTonToiThieu || 0) ? "red" : "inherit",
          }}
        >
          {val}
        </b>
      ),
    },
    {
      title: "Trạng Thái",
      key: "status",
      width: 130,
      render: (_, record) => {
        const ton = record.soLuongTon || 0;
        const min = record.mucTonToiThieu || 0;
        const max = record.mucTonToiDa || 0;
        if (ton <= min)
          return (
            <Tag
              icon={<WarningOutlined />}
              color="red"
            >
              Thấp
            </Tag>
          );
        else if (max > 0 && ton >= max)
          return (
            <Tag
              icon={<WarningOutlined />}
              color="orange"
            >
              Cao
            </Tag>
          );
        else
          return (
            <Tag
              icon={<SafetyCertificateOutlined />}
              color="green"
            >
              Ổn
            </Tag>
          );
      },
    },
  ];

  const historyColumns = [
    {
      title: "Ngày",
      dataIndex: "ngay",
      key: "ngay",
      width: 110,
      fixed: "left",
      render: (text) => dayjs(text).format("DD/MM HH:mm"),
    },
    {
      title: "Loại",
      dataIndex: "loaiGiaoDich",
      key: "loaiGiaoDich",
      width: 100,
      render: (type) => {
        if (type === "NHAP") return <Tag color="green">NHẬP</Tag>;
        if (type === "XUAT") return <Tag color="blue">XUẤT</Tag>;
        if (type === "CHUYEN_DI") return <Tag color="orange">CHUYỂN</Tag>;
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
    { title: "Tên SP", dataIndex: "tenSP", width: 150, fixed: "left" },
    { title: "ĐVT", dataIndex: "donViTinh", width: 60, responsive: ["md"] },
    {
      title: "Đầu",
      dataIndex: "tonDau",
      align: "center",
      width: 60,
      responsive: ["sm"],
    },
    {
      title: "Nhập",
      dataIndex: "slNhap",
      align: "center",
      width: 60,
      render: (v) => <span style={{ color: "green" }}>+{v}</span>,
    },
    {
      title: "Xuất",
      dataIndex: "slXuat",
      align: "center",
      width: 60,
      render: (v) => <span style={{ color: "red" }}>-{v}</span>,
    },
    {
      title: "Cuối",
      dataIndex: "tonCuoi",
      align: "center",
      width: 60,
      render: (v) => <b style={{ color: "blue" }}>{v}</b>,
    },
    {
      title: "Giá Trị",
      dataIndex: "giaTriTonCuoi",
      align: "right",
      width: 120,
      responsive: ["lg"],
      render: (v) => `${Number(v).toLocaleString()}`,
    },
  ];

  const getTabItems = () => {
    const items = [];
    if (canViewInventory) {
      items.push({
        key: "inventory",
        label: (
          <span>
            <BarChartOutlined /> Tồn kho
          </span>
        ),
        children: (
          <Table
            className="fixed-height-table"
            columns={inventoryColumns}
            dataSource={inventoryData}
            loading={loading}
            rowKey={(r, i) => i}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 600 }}
            size="small"
          />
        ),
      });
    }
    if (canViewHistory) {
      items.push({
        key: "history",
        label: (
          <span>
            <HistoryOutlined /> Lịch sử
          </span>
        ),
        children: (
          <Table
            className="fixed-height-table"
            columns={historyColumns}
            dataSource={historyData}
            loading={loading}
            rowKey={(r, i) => i}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 700 }}
            size="small"
          />
        ),
      });
    }
    if (canViewNXT) {
      items.push({
        key: "nxt",
        label: (
          <span>
            <TableOutlined /> NXT
          </span>
        ),
        children: (
          <>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Space wrap>
                <span style={{ whiteSpace: "nowrap" }}>Kỳ báo cáo:</span>
                <RangePicker
                  allowClear={false}
                  value={[nxtFilter.from, nxtFilter.to]}
                  onChange={(dates) =>
                    setNxtFilter({ from: dates[0], to: dates[1] })
                  }
                  style={{ maxWidth: "100%" }}
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
              size="small"
              scroll={{ x: 800 }}
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
                    <Table.Summary.Cell
                      index={0}
                      colSpan={1}
                    >
                      Tổng
                    </Table.Summary.Cell>
                    <Table.Summary.Cell
                      index={1}
                      colSpan={2}
                      responsive={["md"]}
                    ></Table.Summary.Cell>
                    <Table.Summary.Cell
                      index={3}
                      align="center"
                    >
                      {totalNhap}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell
                      index={4}
                      align="center"
                    >
                      {totalXuat}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}></Table.Summary.Cell>
                    <Table.Summary.Cell
                      index={6}
                      align="right"
                      responsive={["lg"]}
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
      if (!activeTab || !isCurrentTabValid) setActiveTab(items[0].key);
    }
  }, [items, activeTab]);

  useEffect(() => {
    if (activeTab === "inventory" && canViewInventory) fetchInventory();
    else if (activeTab === "history" && canViewHistory) fetchHistory();
    else if (activeTab === "nxt" && canViewNXT) fetchNXT();
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
