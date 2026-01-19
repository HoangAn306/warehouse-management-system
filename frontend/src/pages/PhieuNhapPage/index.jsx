// src/pages/PhieuNhapPage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Select,
  InputNumber,
  Tag,
  Descriptions,
  Divider,
  Row,
  Col,
  Card,
  DatePicker,
  Tooltip,
  Grid, // [1] Import Grid
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
import * as phieuNhapService from "../../services/phieunhap.service";
import * as warehouseService from "../../services/warehouse.service";
import * as supplierService from "../../services/supplier.service";
import * as productService from "../../services/product.service";
import * as userService from "../../services/user.service";
import dayjs from "dayjs";

const { Option } = Select;
const { RangePicker } = DatePicker;

// --- CẤU HÌNH ID QUYỀN ---
const PERM_VIEW = 26;
const PERM_CREATE = 20;
const PERM_EDIT = 21;
const PERM_DELETE = 22;
const PERM_APPROVE = 40;
const PERM_CANCEL = 41;
const PERM_EDIT_APPROVED = 120;

const PhieuNhapPage = () => {
  // [2] Hook kiểm tra màn hình
  const screens = Grid.useBreakpoint();

  const [listData, setListData] = useState([]);

  // State phân trang
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ["5", "10", "20", "50"],
  });

  // State bộ lọc
  const [filter, setFilter] = useState({
    chungTu: "",
    trangThai: null,
    maKho: null,
    maNCC: null,
    dateRange: null,
  });

  // State danh mục
  const [listKho, setListKho] = useState([]);
  const [listSanPham, setListSanPham] = useState([]);
  const [listNhaCungCap, setListNhaCungCap] = useState([]);
  const [listUser, setListUser] = useState([]);

  const [selectedNCC, setSelectedNCC] = useState(null);

  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingPhieuNhap, setViewingPhieuNhap] = useState(null);

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- 1. HÀM TẢI DỮ LIỆU ---
  // --- HÀM TẢI DỮ LIỆU (FIX LỖI KHÔNG CHUYỂN TRANG KHI LỌC) ---
  const fetchData = useCallback(
    async (page = 1, pageSize = 5, currentFilter = {}) => {
      setLoading(true);
      try {
        const { chungTu, trangThai, maKho, maNCC, dateRange } = currentFilter;

        // 1. Xác định "Đang lọc"
        const isFiltering =
          (chungTu && chungTu.trim() !== "") ||
          (trangThai !== null && trangThai !== undefined) ||
          !!maKho ||
          !!maNCC ||
          !!dateRange;

        if (isFiltering) {
          // === TRƯỜNG HỢP 1: LỌC ===
          const filterPayload = {
            page: page - 1,
            size: pageSize,
            chungTu: chungTu || null,
            trangThai:
              trangThai !== null && trangThai !== undefined ? trangThai : null,
            maKho: maKho || null,
            maNCC: maNCC || null,
            fromDate: dateRange ? dateRange[0].format("YYYY-MM-DD") : null,
            toDate: dateRange ? dateRange[1].format("YYYY-MM-DD") : null,
          };

          const response =
            await phieuNhapService.filterPhieuNhap(filterPayload);

          if (response.data) {
            // A. Nếu API hỗ trợ phân trang (trả về { content: [], totalElements: ... })
            if (Array.isArray(response.data.content)) {
              setListData(response.data.content);
              setPagination((prev) => ({
                ...prev,
                current: page, // [QUAN TRỌNG] Cập nhật trang hiện tại
                pageSize: pageSize,
                total: response.data.totalElements,
              }));
            }
            // B. Nếu API trả về mảng tất cả kết quả (chưa phân trang ở server)
            else if (Array.isArray(response.data)) {
              const allFiltered = response.data;
              // Tự cắt trang ở Client để hiển thị đúng trang 2, 3...
              const startIndex = (page - 1) * pageSize;
              const endIndex = startIndex + pageSize;

              setListData(allFiltered.slice(startIndex, endIndex));
              setPagination((prev) => ({
                ...prev,
                current: page, // [QUAN TRỌNG] Cập nhật trang hiện tại
                pageSize: pageSize,
                total: allFiltered.length,
              }));
            } else {
              setListData([]);
              setPagination((prev) => ({ ...prev, total: 0 }));
            }
          }
        } else {
          // === TRƯỜNG HỢP 2: KHÔNG LỌC (Lấy tất cả) ===
          const response = await phieuNhapService.getAllPhieuNhap();
          const allData = response.data || [];

          if (Array.isArray(allData)) {
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
        messageApi.error("Không thể tải danh sách!");
        setListData([]);
      }
      setLoading(false);
    },
    [messageApi],
  );

  const fetchCommonData = useCallback(async () => {
    try {
      const [resKho, resSP, resNCC, resUser] = await Promise.allSettled([
        warehouseService.getAllWarehouses(),
        productService.getAllProducts(),
        supplierService.getAllSuppliers(),
        userService.getAllUsers(),
      ]);

      if (resKho.status === "fulfilled") setListKho(resKho.value.data || []);
      if (resSP.status === "fulfilled") setListSanPham(resSP.value.data || []);
      if (resNCC.status === "fulfilled")
        setListNhaCungCap(resNCC.value.data || []);
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

        const roleName = (user.vaiTro || user.tenVaiTro || "").toUpperCase();
        setIsAdmin(roleName === "ADMIN");

        let rawPerms = user.dsQuyenSoHuu || user.quyen || [];
        if (!Array.isArray(rawPerms)) rawPerms = [];

        const parsedPerms = rawPerms.map((p) => {
          if (typeof p === "object" && p !== null)
            return parseInt(p.maQuyen || p.id);
          return parseInt(p);
        });

        setPermissions(parsedPerms);

        const hasViewPerm = parsedPerms.includes(PERM_VIEW);
        if (roleName === "ADMIN" || hasViewPerm) {
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

  const handleSearch = () => fetchData(1, pagination.pageSize, filter);
  const handleResetFilter = () => {
    const empty = {
      chungTu: "",
      trangThai: null,
      maKho: null,
      maNCC: null,
      dateRange: null,
    };
    setFilter(empty);
    fetchData(1, 5, empty);
  };
  const handleTableChange = (newPag) =>
    fetchData(newPag.current, newPag.pageSize, filter);

  const checkPerm = (id) => isAdmin || permissions.includes(id);

  const isEditable = (record) => {
    if (isAdmin && record.trangThai !== 3) return true;
    if (record.trangThai === 1) return checkPerm(PERM_EDIT);
    if (record.trangThai === 2) return checkPerm(PERM_EDIT_APPROVED);
    return false;
  };

  const getUserName = (id) => {
    const u = listUser.find((x) => x.maNguoiDung === id);
    return u ? u.hoTen : id;
  };

  const renderStatus = (s) => {
    if (s === 1) return <Tag color="orange">Chờ duyệt</Tag>;
    if (s === 2) return <Tag color="green">Đã duyệt</Tag>;
    if (s === 3) return <Tag color="red">Không duyệt</Tag>;
    return s;
  };

  const handleNCCChange = (value) => {
    setSelectedNCC(value);
    form.setFieldsValue({ chiTiet: [] });
  };

  const handleOpenModal = () => {
    setEditingRecord(null);
    setSelectedNCC(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = async (record) => {
    if (record.trangThai === 2) {
      if (!checkPerm(PERM_EDIT_APPROVED) && !isAdmin) {
        messageApi.warning("Bạn cần quyền 120 để sửa phiếu đã duyệt!");
        return;
      }
    }
    try {
      const res = await phieuNhapService.getPhieuNhapById(record.maPhieuNhap);
      const data = res.data;

      if (data.chiTiet && Array.isArray(data.chiTiet)) {
        data.chiTiet = data.chiTiet.map((item) => ({
          ...item,
          ngayHetHan: item.ngayHetHan ? dayjs(item.ngayHetHan) : null,
        }));
      }

      setEditingRecord(data);
      setSelectedNCC(data.maNCC);
      form.setFieldsValue(data);
      setIsModalVisible(true);
    } catch (e) {
      messageApi.error("Lỗi tải chi tiết");
      console.error(e);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const res = await phieuNhapService.getPhieuNhapById(record.maPhieuNhap);
      setViewingPhieuNhap(res.data);
      setIsDetailModalOpen(true);
    } catch (e) {
      messageApi.error("Lỗi xem chi tiết");
    }
  };

  // [MỚI] Hàm xử lý in phiếu
  const handlePrint = async (id) => {
    try {
      messageApi.loading({ content: "Đang tải file in...", key: "print" });
      const response = await phieuNhapService.printPhieuNhap(id);

      // Tạo URL từ blob trả về
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      // Đặt tên file khi tải về
      link.setAttribute("download", `PhieuNhap_${id}.pdf`);
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

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          const submitData = {
            ...values,
            chiTiet: values.chiTiet.map((item) => ({
              ...item,
              ngayHetHan: item.ngayHetHan
                ? item.ngayHetHan.format("YYYY-MM-DD")
                : null,
            })),
          };

          if (editingRecord) {
            await phieuNhapService.updatePhieuNhap(
              editingRecord.maPhieuNhap,
              submitData,
            );
            messageApi.success("Cập nhật thành công!");
          } else {
            await phieuNhapService.createPhieuNhap(submitData);
            messageApi.success("Tạo mới thành công!");
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
      await phieuNhapService.deletePhieuNhap(deletingId);
      messageApi.success("Đã xóa!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error("Lỗi xóa!");
    }
    setIsDeleteModalOpen(false);
  };

  const handleApprove = async (id) => {
    try {
      await phieuNhapService.approvePhieuNhap(id);
      messageApi.success("Đã duyệt!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.response?.data || "Lỗi duyệt";
      messageApi.error(errorMessage);
    }
  };
  const handleReject = async (id) => {
    try {
      await phieuNhapService.rejectPhieuNhap(id);
      messageApi.success("Đã hủy!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error("Lỗi hủy!");
    }
  };
  const disabledDate = (current) => {
    return current && current < dayjs().startOf("day");
  };

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  // Logic: screens.lg (PC) thì ghim cột. Mobile thì thả lỏng.
  const columns = [
    {
      title: "Ngày Lập",
      dataIndex: "ngayLapPhieu",
      width: 150,
      fixed: screens.lg ? "left" : null, // Ghim trái trên PC
      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Chứng Từ",
      dataIndex: "chungTu",
      width: 120,
      fixed: screens.lg ? "left" : null, // Ghim trái trên PC
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
      width: 150,
      align: "right",
      render: (v) => Number(v || 0).toLocaleString() + " đ",
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "maNCC",
      width: 200,
      render: (id) => listNhaCungCap.find((n) => n.maNCC === id)?.tenNCC || id,
    },
    {
      title: "Kho Nhập",
      dataIndex: "maKho",
      width: 150,
      render: (maKho) =>
        listKho.find((k) => k.maKho === maKho)?.tenKho || `Mã: ${maKho}`,
    },
    {
      title: "Hành động",
      key: "action",
      width: 220, // Tăng width để chứa đủ các nút
      fixed: screens.lg ? "right" : null, // Ghim phải trên PC
      align: "center",
      render: (_, record) => {
        const isChoDuyet = record.trangThai === 1;
        const allowEdit = isEditable(record);
        const allowDelete = checkPerm(PERM_DELETE);
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
                onClick={() => handlePrint(record.maPhieuNhap)}
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
            {isChoDuyet && allowDelete && (
              <Tooltip title="Xóa phiếu">
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  onClick={() => handleDelete(record.maPhieuNhap)}
                />
              </Tooltip>
            )}
            {isChoDuyet && allowApprove && (
              <Tooltip title="Duyệt phiếu">
                <Button
                  icon={<CheckCircleOutlined />}
                  style={{ color: "green", borderColor: "green" }}
                  size="small"
                  onClick={() => handleApprove(record.maPhieuNhap)}
                />
              </Tooltip>
            )}
            {isChoDuyet && allowCancel && (
              <Tooltip title="Hủy phiếu">
                <Button
                  icon={<CloseCircleOutlined />}
                  danger
                  size="small"
                  onClick={() => handleReject(record.maPhieuNhap)}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const hasViewRight = isAdmin || permissions.includes(PERM_VIEW);
  if (!loading && permissions.length > 0 && !hasViewRight) {
    return (
      <Card style={{ margin: 20, textAlign: "center" }}>
        <h2 style={{ color: "red" }}>Truy cập bị từ chối</h2>
        <p>Bạn không có quyền xem danh sách Phiếu Nhập.</p>
        <p>
          Vui lòng liên hệ Admin cấp quyền mã: <b>{PERM_VIEW}</b>
        </p>
      </Card>
    );
  }

  // Lọc listSanPham dựa trên selectedNCC
  const filteredProducts = listSanPham.filter((sp) => {
    if (!selectedNCC) return false;
    const hasInListObject =
      sp.danhSachNCC && sp.danhSachNCC.some((n) => n.maNCC === selectedNCC);
    const hasInListId =
      sp.danhSachMaNCC && sp.danhSachMaNCC.includes(selectedNCC);

    return hasInListObject || hasInListId;
  });

  return (
    <div style={{ padding: "0 10px" }}>
      {" "}
      {/* Padding nhỏ cho mobile */}
      {contextHolder}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        {/* BỘ LỌC RESPONSIVE - CHỈNH SỬA: Mỗi ô 1 dòng trên Mobile */}
        <Row gutter={[16, 16]}>
          {/* 1. Mã chứng từ: Giảm xuống 3 */}
          <Col
            xs={24}
            md={3}
          >
            <div style={{ fontWeight: 500 }}>Mã chứng từ</div>
            <Input
              prefix={<SearchOutlined />}
              value={filter.chungTu}
              onChange={(e) =>
                setFilter({ ...filter, chungTu: e.target.value })
              }
              placeholder="Tìm mã..."
            />
          </Col>

          {/* 2. Trạng thái: Giảm xuống 3 */}
          <Col
            xs={24}
            md={3}
          >
            <div style={{ fontWeight: 500 }}>Trạng thái</div>
            <Select
              style={{ width: "100%" }}
              allowClear
              placeholder="Chọn trạng thái"
              value={filter.trangThai}
              onChange={(v) => setFilter({ ...filter, trangThai: v })}
            >
              <Option value={1}>Chờ duyệt</Option>
              <Option value={2}>Đã duyệt</Option>
              <Option value={3}>Không duyệt</Option>
            </Select>
          </Col>

          {/* 3. Kho nhập: Giữ 4 */}
          <Col
            xs={24}
            md={4}
          >
            <div style={{ fontWeight: 500 }}>Kho nhập</div>
            <Select
              style={{ width: "100%" }}
              allowClear
              showSearch
              placeholder="Chọn kho"
              optionFilterProp="children"
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

          {/* 4. Nhà cung cấp: Giữ 4 */}
          <Col
            xs={24}
            md={4}
          >
            <div style={{ fontWeight: 500 }}>Nhà cung cấp</div>
            <Select
              style={{ width: "100%" }}
              allowClear
              showSearch
              placeholder="Chọn nhà cung cấp"
              optionFilterProp="children"
              value={filter.maNCC}
              onChange={(v) => setFilter({ ...filter, maNCC: v })}
            >
              {listNhaCungCap.map((n) => (
                <Option
                  key={n.maNCC}
                  value={n.maNCC}
                >
                  {n.tenNCC}
                </Option>
              ))}
            </Select>
          </Col>

          {/* 5. Ngày lập: Tăng lên 6 để đủ chỗ hiển thị ngày */}
          <Col
            xs={24}
            md={6}
          >
            <div style={{ fontWeight: 500 }}>Ngày lập Phiếu</div>
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              value={filter.dateRange}
              placeholder={["Từ ngày", "Đến ngày"]}
              onChange={(d) => setFilter({ ...filter, dateRange: d })}
            />
          </Col>

          {/* 6. Nút bấm: Tăng lên 4 để nút không bị dính vào DatePicker */}
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
        {(isAdmin || checkPerm(PERM_CREATE)) && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            Tạo Phiếu Nhập
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
        rowKey="maPhieuNhap"
        pagination={{ ...pagination, size: "small" }}
        onChange={handleTableChange}
        // [QUAN TRỌNG] Cuộn ngang
        scroll={{ x: 1200 }}
        size="small"
      />
      {/* MODAL THÊM / SỬA */}
      <Modal
        title={editingRecord ? "Sửa Phiếu Nhập" : "Tạo Phiếu Nhập"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        // Responsive Modal Width
        width={screens.md ? 1100 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Space wrap>
            <Form.Item
              name="maNCC"
              label="Nhà Cung Cấp"
              rules={[{ required: true, message: "Chọn nhà cung cấp" }]}
            >
              <Select
                style={{ width: 250 }}
                showSearch
                optionFilterProp="children"
                onChange={handleNCCChange}
                disabled={!!editingRecord}
                placeholder="Chọn nhà cung cấp"
              >
                {listNhaCungCap.map((n) => (
                  <Option
                    key={n.maNCC}
                    value={n.maNCC}
                  >
                    {n.tenNCC}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="maKho"
              label="Kho Nhập"
              rules={[{ required: true, message: "Chọn kho nhập" }]}
            >
              <Select
                style={{ width: 200 }}
                showSearch
                optionFilterProp="children"
                placeholder="Chọn kho nhập"
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
            </Form.Item>
            <Form.Item
              name="chungTu"
              label="Chứng từ"
              rules={[{ required: true, message: "Nhập chứng từ" }]}
            >
              <Input placeholder="Nhập chứng từ" />
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
          {/* --- HEADER CỦA FORM LIST (RESPONSIVE) --- */}
          {/* Trên Mobile: Ẩn header, hiển thị label trong từng item */}
          {screens.md && (
            <Row
              gutter={8}
              style={{
                background: "#f5f5f5",
                padding: "5px 0",
                textAlign: "center",
                fontWeight: "bold",
                marginTop: 10,
              }}
            >
              <Col span={6}>Sản phẩm</Col>
              <Col span={4}>Số lô</Col>
              <Col span={4}>Ngày hết hạn</Col>
              <Col span={3}>Số lượng</Col>
              <Col span={5}>Đơn giá</Col>
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
                    gutter={[8, 8]} // Thêm gutter dọc cho mobile
                    style={{
                      marginTop: 10,
                      borderBottom: !screens.md ? "1px solid #eee" : "none", // Gạch ngang phân cách trên mobile
                      paddingBottom: !screens.md ? 10 : 0,
                    }}
                    align="middle"
                  >
                    {/* 1. CỘT SẢN PHẨM */}
                    <Col
                      xs={24}
                      md={6}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "maSP"]}
                        label={!screens.md ? "Sản phẩm" : null} // Hiện label trên mobile
                        rules={[{ required: true, message: "Chọn sản phẩm" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          optionFilterProp="children"
                          style={{ width: "100%" }}
                          placeholder={
                            selectedNCC ? "Chọn sản phẩm" : "Chọn NCC trước"
                          }
                          disabled={!selectedNCC}
                        >
                          {filteredProducts.map((s) => (
                            <Option
                              key={s.maSP}
                              value={s.maSP}
                            >
                              {s.tenSP}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    {/* 2. CỘT SỐ LÔ */}
                    <Col
                      xs={12}
                      md={4}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "soLo"]}
                        label={!screens.md ? "Số lô" : null}
                        rules={[{ required: true, message: "Nhập lô" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Số lô" />
                      </Form.Item>
                    </Col>

                    {/* 3. CỘT HẠN SỬ DỤNG */}
                    <Col
                      xs={12}
                      md={4}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "ngayHetHan"]}
                        label={!screens.md ? "Hạn SD" : null}
                        style={{ marginBottom: 0 }}
                        rules={[
                          { required: true, message: "Nhập ngày hết hạn" },
                        ]}
                      >
                        <DatePicker
                          format="DD/MM/YYYY"
                          placeholder="Ngày hết hạn"
                          style={{ width: "100%" }}
                          disabledDate={disabledDate}
                        />
                      </Form.Item>
                    </Col>

                    {/* 4. CỘT SỐ LƯỢNG */}
                    <Col
                      xs={12}
                      md={3}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "soLuong"]}
                        label={!screens.md ? "Số lượng" : null}
                        rules={[{ required: true, message: "Nhập số lượng" }]}
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

                    {/* 5. CỘT ĐƠN GIÁ */}
                    <Col
                      xs={12}
                      md={5}
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

                    {/* 6. CỘT XÓA */}
                    <Col
                      xs={24}
                      md={2}
                      style={{
                        textAlign: !screens.md ? "right" : "center",
                        marginTop: !screens.md ? 5 : 0,
                      }}
                    >
                      {!screens.md && (
                        <span style={{ marginRight: 5, color: "#999" }}>
                          Xóa dòng này:{" "}
                        </span>
                      )}
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{
                          color: "red",
                          cursor: "pointer",
                          fontSize: 18,
                        }}
                      />
                    </Col>
                  </Row>
                ))}

                <Form.Item style={{ marginTop: 10 }}>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                    disabled={!selectedNCC}
                  >
                    Thêm sản phẩm
                  </Button>
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
      {/* MODAL XÓA */}
      <Modal
        title="Xác nhận xóa"
        open={isDeleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        okType="danger"
        okText="Xóa"
        cancelText="Hủy"
      >
        <p>Bạn có chắc muốn xóa phiếu nhập này?</p>
      </Modal>
      {/* MODAL CHI TIẾT */}
      <Modal
        title="Chi tiết Phiếu Nhập"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={screens.md ? 800 : "100%"} // Responsive detail modal
        style={{ top: 20 }}
      >
        {viewingPhieuNhap && (
          <div>
            <Descriptions
              bordered
              column={screens.md ? 2 : 1} // Mobile 1 cột, PC 2 cột
              size="small"
            >
              <Descriptions.Item label="Mã Phiếu">
                {viewingPhieuNhap.maPhieuNhap}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày Lập">
                {dayjs(viewingPhieuNhap.ngayLapPhieu).format("DD/MM/YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng Thái">
                {renderStatus(viewingPhieuNhap.trangThai)}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng Tiền">
                {Number(viewingPhieuNhap.tongTien).toLocaleString()} đ
              </Descriptions.Item>
              <Descriptions.Item label="Nhà Cung Cấp">
                {
                  listNhaCungCap.find((n) => n.maNCC === viewingPhieuNhap.maNCC)
                    ?.tenNCC
                }
              </Descriptions.Item>
              <Descriptions.Item label="Kho Nhập">
                {
                  listKho.find((k) => k.maKho === viewingPhieuNhap.maKho)
                    ?.tenKho
                }
              </Descriptions.Item>
              <Descriptions.Item label="Người Lập">
                {getUserName(viewingPhieuNhap.nguoiLap)}
              </Descriptions.Item>
              <Descriptions.Item label="Người Duyệt">
                {viewingPhieuNhap.nguoiDuyet
                  ? getUserName(viewingPhieuNhap.nguoiDuyet)
                  : "---"}
              </Descriptions.Item>
              <Descriptions.Item label="Chứng từ">
                {renderStatus(viewingPhieuNhap.chungTu)}
              </Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">Chi tiết sản phẩm</Divider>
            <Table
              dataSource={viewingPhieuNhap.chiTiet || []}
              pagination={false}
              rowKey="maSP"
              scroll={{ x: 600 }} // Cuộn ngang cho bảng chi tiết nhỏ
              size="small"
              columns={[
                {
                  title: "Tên sản phẩm",
                  dataIndex: "maSP",
                  width: 150,
                  render: (id) =>
                    listSanPham.find((s) => s.maSP === id)?.tenSP || id,
                },
                { title: "Số Lượng", dataIndex: "soLuong", width: 80 },
                { title: "Số lô", dataIndex: "soLo", width: 100 },
                {
                  title: "Ngày hết hạn",
                  dataIndex: "ngayHetHan",
                  width: 120,
                  render: (text) => {
                    return text ? dayjs(text).format("DD/MM/YYYY") : "";
                  },
                },
                {
                  title: "Đơn giá",
                  dataIndex: "donGia",
                  width: 100,
                  render: (v) => Number(v).toLocaleString(),
                },
                {
                  title: "Thành tiền",
                  width: 120,
                  render: (_, r) =>
                    Number(r.soLuong * r.donGia).toLocaleString(),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PhieuNhapPage;
