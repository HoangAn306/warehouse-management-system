// src/pages/PhieuXuatPage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  InputNumber,
  Tag,
  Select,
  Descriptions,
  Divider,
  Row,
  Col,
  Card,
  DatePicker,
  Tooltip,
  Grid,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  ClearOutlined,
  PrinterOutlined, // [MỚI] Import icon in
} from "@ant-design/icons";
import * as phieuXuatService from "../../services/phieuxuat.service";
import * as warehouseService from "../../services/warehouse.service";
import * as productService from "../../services/product.service";
import * as customerService from "../../services/customer.service";
import * as userService from "../../services/user.service";
import dayjs from "dayjs";

const { Option } = Select;
const { RangePicker } = DatePicker;

// --- CẤU HÌNH ID QUYỀN ---
const PERM_CREATE = 23;
const PERM_EDIT = 24;
const PERM_DELETE = 25;
const PERM_VIEW = 27;
const PERM_APPROVE = 42;
const PERM_CANCEL = 43;
const PERM_EDIT_APPROVED = 121;

const PhieuXuatPage = () => {
  const screens = Grid.useBreakpoint();

  const [listData, setListData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ["5", "10", "20", "50"],
  });

  const [filter, setFilter] = useState({
    chungTu: "",
    trangThai: null,
    maKho: null,
    maKH: null,
    dateRange: null,
  });

  const [listKho, setListKho] = useState([]);
  const [listSanPham, setListSanPham] = useState([]);
  const [listKhachHang, setListKhachHang] = useState([]);
  const [listUser, setListUser] = useState([]);

  const [currentInventory, setCurrentInventory] = useState([]);
  const [selectedKho, setSelectedKho] = useState(null);

  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingPhieuXuat, setViewingPhieuXuat] = useState(null);

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLecturer, setIsLecturer] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // --- HÀM TẢI DỮ LIỆU ---
  // --- HÀM TẢI DỮ LIỆU (ĐÃ FIX LỖI PHÂN TRANG & LỌC) ---
  const fetchData = useCallback(
    async (page = 1, pageSize = 5, currentFilter = {}) => {
      setLoading(true);
      try {
        const { chungTu, trangThai, maKho, maKH, dateRange } = currentFilter;

        // 1. Xác định chính xác "Đang lọc"
        // Chỉ cần 1 trong các trường có dữ liệu thì coi là đang lọc
        const isFiltering =
          (chungTu && chungTu.trim() !== "") ||
          (trangThai !== null && trangThai !== undefined) ||
          !!maKho ||
          !!maKH ||
          !!dateRange;

        if (isFiltering) {
          // === TRƯỜNG HỢP 1: LỌC (Server-side Pagination) ===
          const filterPayload = {
            page: page - 1,
            size: pageSize,
            chungTu: chungTu || null,
            // Xử lý trangThai để tránh lỗi undefined khi gửi lên server
            trangThai:
              trangThai !== null && trangThai !== undefined ? trangThai : null,
            maKho: maKho || null,
            maKH: maKH || null,
            fromDate: dateRange ? dateRange[0].format("YYYY-MM-DD") : null,
            toDate: dateRange ? dateRange[1].format("YYYY-MM-DD") : null,
          };

          const response =
            await phieuXuatService.filterPhieuXuat(filterPayload);

          if (response.data) {
            // A. Nếu API trả về dạng phân trang chuẩn { content: [], totalElements: ... }
            if (Array.isArray(response.data.content)) {
              setListData(response.data.content);
              setPagination((prev) => ({
                ...prev,
                current: page, // [QUAN TRỌNG] Cập nhật trang hiện tại
                pageSize: pageSize,
                total: response.data.totalElements,
              }));
            }
            // B. Nếu API trả về mảng thường (chưa phân trang ở server) -> Cắt trang ở Client
            else if (Array.isArray(response.data)) {
              const allFiltered = response.data;
              const startIndex = (page - 1) * pageSize;
              const endIndex = startIndex + pageSize;

              setListData(allFiltered.slice(startIndex, endIndex));
              setPagination((prev) => ({
                ...prev,
                current: page, // [QUAN TRỌNG]
                pageSize: pageSize,
                total: allFiltered.length,
              }));
            } else {
              setListData([]);
              setPagination((prev) => ({ ...prev, total: 0 }));
            }
          }
        } else {
          // === TRƯỜNG HỢP 2: LẤY TẤT CẢ (Client-side Pagination) ===
          const response = await phieuXuatService.getAllPhieuXuat();
          const allData = response.data || [];

          if (Array.isArray(allData)) {
            // Sắp xếp mới nhất lên đầu
            allData.sort(
              (a, b) => new Date(b.ngayLapPhieu) - new Date(a.ngayLapPhieu),
            );

            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;

            setListData(allData.slice(startIndex, endIndex));
            setPagination((prev) => ({
              ...prev,
              current: page,
              pageSize: pageSize,
              total: allData.length,
            }));
          } else {
            setListData([]);
          }
        }
      } catch (error) {
        console.error(error);
        messageApi.error("Không thể tải danh sách phiếu xuất!");
        setListData([]);
      }
      setLoading(false);
    },
    [messageApi],
  );

  const fetchCommonData = useCallback(async () => {
    try {
      const [resKho, resSP, resKH, resUser] = await Promise.allSettled([
        warehouseService.getAllWarehouses(),
        productService.getAllProducts(),
        customerService.getAllCustomers(),
        userService.getAllUsers(),
      ]);

      if (resKho.status === "fulfilled") setListKho(resKho.value.data || []);
      if (resSP.status === "fulfilled") setListSanPham(resSP.value.data || []);
      if (resKH.status === "fulfilled")
        setListKhachHang(resKH.value.data || []);
      if (resUser.status === "fulfilled") setListUser(resUser.value.data || []);
    } catch (error) {
      console.error("Lỗi tải danh mục:", error);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user_info");
    if (storedUser) {
      try {
        let user = JSON.parse(storedUser);
        if (
          user.quyen &&
          !Array.isArray(user.quyen) &&
          user.quyen.maNguoiDung
        ) {
          user = user.quyen;
        }
        setCurrentUser(user);

        const roleName = (user.vaiTro || user.tenVaiTro || "").toUpperCase();
        setIsAdmin(roleName === "ADMIN");
        setIsLecturer(roleName === "GIANG_VIEN");

        let rawPerms = user.dsQuyenSoHuu || user.quyen || [];
        if (!Array.isArray(rawPerms)) rawPerms = [];

        const parsedPerms = rawPerms.map((p) => {
          if (typeof p === "object" && p !== null)
            return parseInt(p.maQuyen || p.id);
          return parseInt(p);
        });

        setPermissions(parsedPerms);

        const hasViewPerm = parsedPerms.includes(PERM_VIEW);
        if (roleName === "ADMIN" || hasViewPerm || roleName === "GIANG_VIEN") {
          fetchData(1, 5, filter);
        } else {
          setLoading(false);
        }
      } catch (e) {
        setPermissions([]);
      }
    }
    fetchCommonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS ---
  const handleSearch = () => fetchData(1, pagination.pageSize, filter);
  const handleResetFilter = () => {
    const emptyFilter = {
      chungTu: "",
      trangThai: null,
      maKho: null,
      maKH: null,
      dateRange: null,
    };
    setFilter(emptyFilter);
    fetchData(1, 5, emptyFilter);
  };
  const handleTableChange = (newPagination) =>
    fetchData(newPagination.current, newPagination.pageSize, filter);

  const checkPerm = (id) => isAdmin || permissions.includes(id);

  const isEditable = (record) => {
    if (isAdmin && record.trangThai !== 3) return true;
    if (record.trangThai === 1) return checkPerm(PERM_EDIT);
    if (record.trangThai === 2) return checkPerm(PERM_EDIT_APPROVED);
    return false;
  };

  const getUserName = (userId) => {
    if (!userId) return "---";
    const user = listUser.find((u) => u.maNguoiDung === userId);
    return user ? user.hoTen : `ID: ${userId}`;
  };

  const renderStatus = (status) => {
    if (status === 1) return <Tag color="orange">Chờ duyệt</Tag>;
    if (status === 2) return <Tag color="green">Đã duyệt</Tag>;
    if (status === 3) return <Tag color="red">Không duyệt</Tag>;
    return status;
  };

  // [MỚI] Hàm xử lý in phiếu xuất
  const handlePrint = async (id) => {
    try {
      messageApi.loading({ content: "Đang tải file in...", key: "print" });
      const response = await phieuXuatService.printPhieuXuat(id);

      // Tạo URL từ blob trả về
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      // Đặt tên file khi tải về
      link.setAttribute("download", `PhieuXuat_${id}.pdf`);
      document.body.appendChild(link);
      link.click();

      // Dọn dẹp
      link.remove();
      window.URL.revokeObjectURL(url);
      messageApi.success({ content: "Tải file in thành công!", key: "print" });
    } catch (error) {
      console.error(error);
      messageApi.error({ content: "Lỗi khi in phiếu!", key: "print" });
    }
  };

  const handleOpenModal = () => {
    setEditingRecord(null);
    setSelectedKho(null);
    setCurrentInventory([]);
    form.resetFields();
    setIsModalVisible(true);
    setIsDeleteModalOpen(false);
  };

  const handleKhoChange = async (khoId) => {
    setSelectedKho(khoId);
    form.setFieldsValue({ chiTiet: [] });
    try {
      const res = await warehouseService.getInventoryByWarehouse(khoId);
      setCurrentInventory(res.data || []);
      message.info("Đã cập nhật danh sách sản phẩm");
    } catch (error) {
      setCurrentInventory([]);
    }
  };

  const handleEdit = async (record) => {
    if (record.trangThai === 2) {
      const createdDate = dayjs(record.ngayLapPhieu);
      const diffDays = dayjs().diff(createdDate, "day");
      if (diffDays > 30) {
        messageApi.error(`Quá hạn sửa (${diffDays} ngày).`);
        return;
      }
      if (!checkPerm(PERM_EDIT_APPROVED) && !isAdmin) {
        messageApi.warning(
          "Bạn không có quyền sửa phiếu đã duyệt (Cần quyền 121)!",
        );
        return;
      }
    } else if (record.trangThai === 3) {
      messageApi.warning("Không thể sửa phiếu đã hủy.");
      return;
    }

    try {
      const response = await phieuXuatService.getPhieuXuatById(
        record.maPhieuXuat,
      );
      const fullData = response.data;

      // Xử lý ẩn chữ PENDING
      if (fullData.chiTiet && Array.isArray(fullData.chiTiet)) {
        fullData.chiTiet = fullData.chiTiet.map((item) => ({
          ...item,
          soLo: item.soLo === "PENDING" ? null : item.soLo,
        }));
      }

      setEditingRecord(fullData);
      if (fullData.maKho) handleKhoChange(fullData.maKho);
      form.setFieldsValue(fullData);
      setIsModalVisible(true);
    } catch (error) {
      messageApi.error("Lỗi tải chi tiết phiếu!");
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await phieuXuatService.getPhieuXuatById(
        record.maPhieuXuat,
      );
      setViewingPhieuXuat(response.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      messageApi.error("Lỗi khi tải chi tiết phiếu!");
    }
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          if (editingRecord) {
            await phieuXuatService.updatePhieuXuat(
              editingRecord.maPhieuXuat,
              values,
            );
            messageApi.success("Cập nhật phiếu xuất thành công!");
          } else {
            if (isLecturer) {
              await phieuXuatService.createPhieuXuatGiangVien(values);
            } else {
              await phieuXuatService.createPhieuXuat(values);
            }
            messageApi.success("Tạo thành công!");
          }
          setIsModalVisible(false);
          fetchData(pagination.current, pagination.pageSize, filter);
        } catch (error) {
          const errorMessage =
            error.response?.data?.message ||
            error.response?.data ||
            "Lỗi xử lý!";
          messageApi.error(errorMessage);
        }
      })
      .catch(() => {});
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };
  const handleDeleteConfirm = async () => {
    try {
      await phieuXuatService.deletePhieuXuat(deletingId);
      messageApi.success("Đã xóa!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error("Lỗi xóa!");
    }
    setIsDeleteModalOpen(false);
  };
  const handleApprove = async (id) => {
    try {
      await phieuXuatService.approvePhieuXuat(id);
      messageApi.success("Đã duyệt!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (error) {
          const errorMessage =
            error.response?.data?.message ||
            error.response?.data ||
            "Lỗi xử lý!";
          messageApi.error(errorMessage);
        }
  };
  const handleReject = async (id) => {
    try {
      await phieuXuatService.rejectPhieuXuat(id);
      messageApi.success("Đã hủy!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error("Lỗi hủy!");
    }
  };

  const columns = [
    {
      title: "Ngày Lập",
      dataIndex: "ngayLapPhieu",
      width: 150,
      fixed: screens.lg ? "left" : null,
      render: (val) => dayjs(val).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Chứng Từ",
      dataIndex: "chungTu",
      width: 120,
      fixed: screens.lg ? "left" : null,
    },
    {
      title: "Trạng Thái",
      dataIndex: "trangThai",
      width: 120,
      render: renderStatus,
    },
    {
      title: "Tổng Tiền",
      dataIndex: "tongTien",
      width: 120,
      align: "right",
      render: (value) => `${Number(value || 0).toLocaleString()} đ`,
    },
    {
      title: "Khách Hàng",
      dataIndex: "maKH",
      width: 200,
      render: (id, record) => {
        if (!isLecturer) {
          const kh = listKhachHang.find((item) => item.maKH === id);
          return kh ? kh.tenKH : record.khachHang?.tenKH || `Mã: ${id}`;
        }
        if (isLecturer && currentUser) {
          return currentUser.hoTen;
        }
        return `Mã: ${id}`;
      },
    },
    {
      title: "Kho Xuất",
      dataIndex: "maKho",
      width: 150,
      render: (maKho) =>
        listKho.find((k) => k.maKho === maKho)?.tenKho || `Mã: ${maKho}`,
    },
    {
      title: "Hành động",
      key: "action",
      width: 220, // Tăng width để chứa nút in
      fixed: screens.lg ? "right" : null,
      align: "center",
      render: (_, record) => {
        const isChoDuyet = record.trangThai === 1;
        const allowEdit = isEditable(record);
        const canDel = checkPerm(PERM_DELETE);
        const allowApprove = checkPerm(PERM_APPROVE);
        const allowCancel = checkPerm(PERM_CANCEL);

        return (
          <Space
            size="small"
            wrap={false}
          >
            {/* [MỚI] Nút In phiếu */}
            <Tooltip title="In phiếu">
              <Button
                icon={<PrinterOutlined />}
                size="small"
                onClick={() => handlePrint(record.maPhieuXuat)}
              />
            </Tooltip>

            <Tooltip title="Xem chi tiết">
              <Button
                icon={<EyeOutlined />}
                size="small"
                onClick={() => handleViewDetail(record)}
              />
            </Tooltip>
            {allowEdit && (
              <Tooltip title="Sửa phiếu">
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
            )}
            {isChoDuyet && canDel && (
              <Tooltip title="Xóa phiếu">
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  onClick={() => handleDelete(record.maPhieuXuat)}
                />
              </Tooltip>
            )}
            {isChoDuyet && allowApprove && (
              <Tooltip title="Duyệt phiếu">
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record.maPhieuXuat)}
                  style={{ color: "green", borderColor: "green" }}
                  size="small"
                />
              </Tooltip>
            )}
            {isChoDuyet && allowCancel && (
              <Tooltip title="Hủy phiếu">
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleReject(record.maPhieuXuat)}
                  danger
                  size="small"
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const hasViewRight = isAdmin || permissions.includes(PERM_VIEW) || isLecturer;
  if (!loading && permissions.length > 0 && !hasViewRight) {
    return (
      <Card style={{ margin: 20, textAlign: "center" }}>
        <h2 style={{ color: "red" }}>Truy cập bị từ chối</h2>
        <p>Bạn không có quyền xem danh sách.</p>
      </Card>
    );
  }

  return (
    <div style={{ padding: "0 10px" }}>
      {contextHolder}

      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        <Row gutter={[16, 16]}>
          <Col
            xs={24}
            md={3}
          >
            <div style={{ fontWeight: 500 }}>Mã chứng từ</div>
            <Input
              placeholder="Nhập mã..."
              prefix={<SearchOutlined />}
              value={filter.chungTu}
              onChange={(e) =>
                setFilter({ ...filter, chungTu: e.target.value })
              }
            />
          </Col>
          <Col
            xs={24}
            md={3}
          >
            <div style={{ fontWeight: 500 }}>Trạng thái</div>
            <Select
              style={{ width: "100%" }}
              placeholder="Chọn trạng thái"
              allowClear
              value={filter.trangThai}
              onChange={(v) => setFilter({ ...filter, trangThai: v })}
            >
              <Option value={1}>Chờ duyệt</Option>
              <Option value={2}>Đã duyệt</Option>
              <Option value={3}>Không duyệt</Option>
            </Select>
          </Col>
          <Col
            xs={24}
            md={4}
          >
            <div style={{ fontWeight: 500 }}>Kho xuất</div>
            <Select
              style={{ width: "100%" }}
              placeholder="Chọn kho"
              allowClear
              value={filter.maKho}
              onChange={(v) => setFilter({ ...filter, maKho: v })}
            >
              {listKho.map((k) => (
                <Option
                  key={k.maKho}
                  value={k.maKho}
                >
                  {k.tenKho}
                </Option>
              ))}
            </Select>
          </Col>
          <Col
            xs={24}
            md={4}
          >
            <div style={{ fontWeight: 500 }}>Khách hàng</div>
            <Select
              style={{ width: "100%" }}
              placeholder="Chọn KH"
              allowClear
              value={filter.maKH}
              onChange={(v) => setFilter({ ...filter, maKH: v })}
            >
              {listKhachHang.map((k) => (
                <Option
                  key={k.maKH}
                  value={k.maKH}
                >
                  {k.tenKH}
                </Option>
              ))}
            </Select>
          </Col>
          <Col
            xs={24}
            md={6}
          >
            <div style={{ fontWeight: 500 }}>Ngày lập phiếu</div>
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              value={filter.dateRange}
              onChange={(dates) => setFilter({ ...filter, dateRange: dates })}
            />
          </Col>
          <Col
            xs={24}
            md={4}
            style={{
              textAlign: screens.md ? "right" : "left",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: screens.md ? "flex-end" : "flex-start",
            }}
          >
            <Space style={{ width: screens.md ? "auto" : "100%" }}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                block={!screens.md}
              >
                Tìm
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={handleResetFilter}
                block={!screens.md}
              >
                Xóa
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        {(isAdmin || permissions.includes(PERM_CREATE)) && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            Tạo Phiếu Xuất
          </Button>
        )}
        <Button
          icon={<ReloadOutlined />}
          onClick={() =>
            fetchData(pagination.current, pagination.pageSize, filter)
          }
        >
          Tải lại
        </Button>
      </Space>

      <Table
        className="fixed-height-table"
        columns={columns}
        dataSource={listData}
        loading={loading}
        rowKey="maPhieuXuat"
        pagination={{ ...pagination, size: "small" }}
        onChange={handleTableChange}
        scroll={{ x: 1200 }}
        size="small"
      />

      {/* Modal Form: Thêm/Sửa */}
      <Modal
        title={editingRecord ? "Sửa Phiếu Xuất" : "Tạo Phiếu Xuất"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={screens.md ? 1000 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Space wrap>
            {!isLecturer && (
              <Form.Item
                name="maKH"
                label="Khách Hàng"
                rules={[{ required: true, message: "Chọn khách hàng" }]}
              >
                <Select
                  style={{ width: 200 }}
                  placeholder="Chọn Khách Hàng"
                  showSearch
                  optionFilterProp="children"
                >
                  {listKhachHang.map((kh) => (
                    <Option
                      key={kh.maKH}
                      value={kh.maKH}
                    >
                      {kh.tenKH}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}
            <Form.Item
              name="maKho"
              label="Kho Xuất Hàng"
              rules={[{ required: true, message: "Chọn kho" }]}
            >
              <Select
                style={{ width: 200 }}
                placeholder="Chọn Kho"
                showSearch
                optionFilterProp="children"
                onChange={handleKhoChange}
              >
                {listKho.map((kho) => (
                  <Option
                    key={kho.maKho}
                    value={kho.maKho}
                  >
                    {kho.tenKho}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="chungTu"
              label="Chứng Từ"
              rules={[{ required: true, message: "Nhập Chứng Từ" }]}
            >
              <Input placeholder="VD: PX-001" />
            </Form.Item>
          </Space>
          <Divider
            orientation="left"
            style={{
              borderColor: "#1677ff", // Màu xanh Ant Design chuẩn
              color: "#003eb3", // Màu chữ xanh đậm hơn chút cho rõ nét
              fontSize: "15px", // Tăng nhẹ cỡ chữ cho đẹp
            }}
          >
            DANH SÁCH SẢN PHẨM
          </Divider>
          {/* Header Form List Responsive */}
          {screens.md && (
            <Row
              gutter={8}
              style={{
                marginBottom: 5,
                fontWeight: "bold",
                textAlign: "center",
                background: "#f0f2f5",
                padding: "5px 0",
              }}
            >
              <Col span={7}>Sản phẩm</Col>
              <Col span={4}>Số lô</Col> {/* Thêm cột Số lô */}
              <Col span={4}>Số lượng</Col>
              <Col span={7}>Đơn giá</Col>
              <Col span={2}>Xóa</Col>
            </Row>
          )}

          <Form.List
            name="chiTiet"
            rules={[
              {
                validator: async (_, names) => {
                  if (!names || names.length < 1) {
                    return Promise.reject(
                      new Error("Vui lòng thêm ít nhất một sản phẩm!"),
                    );
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row
                    key={key}
                    gutter={[8, 8]}
                    style={{
                      marginBottom: 10,
                      borderBottom: !screens.md ? "1px solid #eee" : "none",
                      paddingBottom: !screens.md ? 10 : 0,
                    }}
                    align="middle"
                  >
                    {/* 1. SẢN PHẨM (ĐÃ SỬA) */}
                    <Col
                      xs={24}
                      md={7}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "maSP"]}
                        label={!screens.md ? "Sản phẩm" : null}
                        rules={[{ required: true, message: "Chọn SP" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          style={{ width: "100%" }}
                          placeholder={
                            selectedKho
                              ? "Chọn sản phẩm"
                              : "Chọn Kho Xuất trước"
                          }
                          showSearch
                          optionFilterProp="children"
                          disabled={!selectedKho}
                          // [QUAN TRỌNG] Khi đổi sản phẩm -> Reset số lô
                          onChange={() => {
                            form.setFieldValue(["chiTiet", name, "soLo"], null);
                          }}
                        >
                          {/* Lọc danh sách SP duy nhất và tính tổng tồn kho */}
                          {[
                            ...new Map(
                              currentInventory.map((item) => [item.maSP, item]),
                            ).values(),
                          ].map((sp) => (
                            <Option
                              key={sp.maSP}
                              value={sp.maSP}
                            >
                              {sp.tenSP} (Tổng tồn:{" "}
                              {currentInventory
                                .filter((x) => x.maSP === sp.maSP)
                                .reduce(
                                  (sum, item) => sum + item.soLuongTon,
                                  0,
                                )}
                              )
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    {/* 2. SỐ LÔ (ĐÃ SỬA - DYNAMIC DROPDOWN) */}
                    <Col
                      xs={12}
                      md={4}
                    >
                      {/* Sử dụng shouldUpdate để re-render khi maSP thay đổi */}
                      <Form.Item
                        shouldUpdate={(prevValues, curValues) =>
                          prevValues.chiTiet?.[name]?.maSP !==
                          curValues.chiTiet?.[name]?.maSP
                        }
                        noStyle
                      >
                        {({ getFieldValue }) => {
                          // Lấy ID sản phẩm của dòng hiện tại
                          const currentSP = getFieldValue([
                            "chiTiet",
                            name,
                            "maSP",
                          ]);

                          // Lọc ra các lô thuộc sản phẩm đó trong kho
                          const availableBatches = currentInventory.filter(
                            (item) =>
                              item.maSP === currentSP &&
                              item.soLo &&
                              item.soLo !== "PENDING",
                          );

                          return (
                            <Form.Item
                              {...restField}
                              name={[name, "soLo"]}
                              label={!screens.md ? "Số lô" : null}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                placeholder="Chọn lô"
                                allowClear
                                disabled={!currentSP} // Khóa nếu chưa chọn SP
                              >
                                {availableBatches.map((batch, index) => (
                                  <Option
                                    key={`${batch.soLo}_${index}`}
                                    value={batch.soLo}
                                  >
                                    {batch.soLo}
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>

                    {/* 3. Số lượng */}
                    <Col
                      xs={12}
                      md={4}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "soLuong"]}
                        label={!screens.md ? "Số lượng" : null}
                        rules={[
                          { required: true, message: "Nhập số lượng" },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value) return Promise.resolve();
                              const selectedSP = getFieldValue([
                                "chiTiet",
                                name,
                                "maSP",
                              ]);
                              const inStock = currentInventory.find(
                                (i) => i.maSP === selectedSP,
                              );
                              if (inStock && value > inStock.soLuongTon)
                                return Promise.reject(new Error(`Quá tồn kho`));
                              return Promise.resolve();
                            },
                          }),
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          min={1} // Bắt buộc >= 1 (Dương)
                          precision={0} // [QUAN TRỌNG] Bắt buộc là số nguyên, không cho nhập 1.5
                          step={1} // Nút tăng giảm nhảy 1 đơn vị
                          style={{ width: "100%" }}
                          placeholder="Số lượng"
                          parser={(v) => v.replace(/\D/g, "")} // Chỉ cho phép nhập số
                        />
                      </Form.Item>
                    </Col>

                    {/* 4. Đơn giá */}
                    <Col
                      xs={24}
                      md={7}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "donGia"]}
                        label={!screens.md ? "Đơn giá" : null}
                        rules={[{ required: true, message: "Nhập giá" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          min={0}
                          step={1}
                          style={{ width: "100%" }}
                          placeholder="Đơn giá"
                          // [SỬA LỖI] Formatter: Chỉ thêm dấu phẩy cho phần nguyên
                          formatter={(value) => {
                            if (!value) return "";
                            const strValue = `${value}`;
                            // Tách phần nguyên và phần thập phân
                            const [integer, decimal] = strValue.split(".");

                            // Định dạng phần nguyên có dấu phẩy
                            const formattedInteger = integer.replace(
                              /\B(?=(\d{3})+(?!\d))/g,
                              ",",
                            );

                            // Nếu có phần thập phân thì ghép lại, không thì trả về phần nguyên
                            return decimal !== undefined
                              ? `${formattedInteger}.${decimal}`
                              : formattedInteger;
                          }}
                          // [SỬA LỖI] Parser: Xóa dấu phẩy để tính toán
                          parser={(value) => {
                            // Chỉ xóa dấu phẩy, giữ lại dấu chấm
                            return value ? value.replace(/,/g, "") : "";
                          }}
                        />
                      </Form.Item>
                    </Col>

                    {/* 5. Xóa */}
                    <Col
                      xs={24}
                      md={2}
                      style={{
                        textAlign: !screens.md ? "right" : "center",
                      }}
                    >
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{
                          color: "red",
                          fontSize: "18px",
                          cursor: "pointer",
                        }}
                      />
                    </Col>
                  </Row>
                ))}
                <Form.Item style={{ marginTop: 16 }}>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                    // [THÊM DÒNG NÀY] Nếu chưa chọn kho (selectedKho = null) thì Disable nút
                    disabled={!selectedKho}
                  >
                    Thêm sản phẩm
                  </Button>

                  {/* [THÊM DÒNG NÀY] Hiển thị nhắc nhở nhỏ */}
                  {!selectedKho && (
                    <div
                      style={{
                        color: "#999",
                        fontSize: "12px",
                        marginTop: "5px",
                        textAlign: "center",
                      }}
                    ></div>
                  )}
                  {errors && errors.length > 0 && (
                    <div style={{ color: "#ff4d4f", marginTop: "8px" }}>
                      {errors.map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  )}
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="Xác nhận xóa"
        open={isDeleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText="Xóa"
        cancelText="Hủy"
        okType="danger"
      >
        <p>Bạn có chắc muốn xóa phiếu xuất này?</p>
      </Modal>

      <Modal
        title="Chi tiết Phiếu Xuất"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button
            key="close"
            onClick={() => setIsDetailModalOpen(false)}
          >
            Đóng
          </Button>,
        ]}
        width={screens.md ? 900 : "100%"}
      >
        {viewingPhieuXuat && (
          <div>
            <Descriptions
              bordered
              column={screens.md ? 2 : 1}
              size="small"
            >
              <Descriptions.Item label="Mã Phiếu">
                {viewingPhieuXuat.maPhieuXuat}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày Lập">
                {viewingPhieuXuat.ngayLapPhieu}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng Thái">
                {renderStatus(viewingPhieuXuat.trangThai)}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng Tiền">
                {Number(viewingPhieuXuat.tongTien).toLocaleString()} đ
              </Descriptions.Item>
              <Descriptions.Item label="Khách Hàng">
                {listKhachHang.find((kh) => kh.maKH === viewingPhieuXuat.maKH)
                  ?.tenKH ||
                  viewingPhieuXuat.khachHang?.tenKH ||
                  (isLecturer ? currentUser?.hoTen : viewingPhieuXuat.maKH)}
              </Descriptions.Item>
              <Descriptions.Item label="Kho Xuất">
                {listKho.find((k) => k.maKho === viewingPhieuXuat.maKho)
                  ?.tenKho || viewingPhieuXuat.maKho}
              </Descriptions.Item>
              <Descriptions.Item label="Chứng Từ">
                {viewingPhieuXuat.chungTu}
              </Descriptions.Item>
              <Descriptions.Item label="Người Lập">
                {getUserName(viewingPhieuXuat.nguoiLap)}
              </Descriptions.Item>
              <Descriptions.Item label="Người Duyệt">
                {getUserName(viewingPhieuXuat.nguoiDuyet)}
              </Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">CHI TIẾT XUẤT</Divider>
            <Table
              dataSource={viewingPhieuXuat.chiTiet || []}
              rowKey="maSP"
              pagination={false}
              bordered
              scroll={{ x: 600 }}
              size="small"
              columns={[
                {
                  title: "Tên sản phẩm",
                  dataIndex: "maSP",
                  render: (id) =>
                    listSanPham.find((s) => s.maSP === id)?.tenSP || id,
                },
                { title: "Số lượng", dataIndex: "soLuong", align: "center" },
                { title: "Số lô", dataIndex: "soLo" },
                {
                  title: "Đơn Giá",
                  dataIndex: "donGia",
                  align: "right",
                  render: (v) => Number(v).toLocaleString() + " đ",
                },
                {
                  title: "Thành Tiền",
                  align: "right",
                  render: (_, r) =>
                    (r.soLuong * r.donGia).toLocaleString() + " đ",
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PhieuXuatPage;
