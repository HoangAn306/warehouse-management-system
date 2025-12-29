// src/pages/TransferPage/index.jsx

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
  Card,
  Row,
  Col,
  DatePicker,
  Tooltip,
  Grid, // [1] Import Grid
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  EditOutlined,
  SearchOutlined,
  ClearOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import * as transferService from "../../services/transfer.service";
import * as warehouseService from "../../services/warehouse.service";
import * as productService from "../../services/product.service";
import * as userService from "../../services/user.service";
import dayjs from "dayjs";

const { Option } = Select;
const { RangePicker } = DatePicker;

// --- CẤU HÌNH ID QUYỀN ---
const PERM_VIEW = 110;
const PERM_CREATE = 111;
const PERM_EDIT = 114;
const PERM_DELETE = 115;
const PERM_APPROVE = 112;
const PERM_CANCEL = 113;
const PERM_EDIT_APPROVED = 116;

const TransferPage = () => {
  // [2] Hook kiểm tra màn hình
  const screens = Grid.useBreakpoint();

  const [listData, setListData] = useState([]);

  // State bộ lọc
  const [filter, setFilter] = useState({
    chungTu: "",
    trangThai: null,
    maKhoXuat: null,
    maKhoNhap: null,
    dateRange: null,
  });

  // Phân trang
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ["5", "10", "20", "50"],
  });

  const [listKho, setListKho] = useState([]);
  const [listSanPham, setListSanPham] = useState([]);
  const [listUser, setListUser] = useState([]);

  const [sourceInventory, setSourceInventory] = useState([]);
  const [selectedSourceKho, setSelectedSourceKho] = useState(null);

  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- 1. HÀM TẢI DỮ LIỆU ---
  const fetchData = useCallback(
    async (page = 1, pageSize = 5, currentFilter = {}) => {
      setLoading(true);
      try {
        const { chungTu, trangThai, maKhoXuat, maKhoNhap, dateRange } =
          currentFilter;

        const filterPayload = {
          page: page - 1,
          size: pageSize,
          chungTu: chungTu || null,
          trangThai: trangThai || null,
          maKhoXuat: maKhoXuat || null,
          maKhoNhap: maKhoNhap || null,
          fromDate: dateRange ? dateRange[0].format("YYYY-MM-DD") : null,
          toDate: dateRange ? dateRange[1].format("YYYY-MM-DD") : null,
        };

        const hasFilter = Object.values(filterPayload).some(
          (val) =>
            val !== null &&
            val !== "" &&
            val !== undefined &&
            val !== page - 1 &&
            val !== pageSize
        );

        let response;
        if (hasFilter && transferService.filterTransfers) {
          response = await transferService.filterTransfers(filterPayload);
        } else {
          response = await transferService.getAllTransfers();
        }

        const data = response.data;
        if (data && Array.isArray(data.content)) {
          setListData(data.content);
          setPagination((prev) => ({
            ...prev,
            current: page,
            pageSize: pageSize,
            total: data.totalElements,
          }));
        } else if (Array.isArray(data)) {
          // Sort giảm dần theo ngày
          data.sort((a, b) => new Date(b.ngayChuyen) - new Date(a.ngayChuyen));

          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          setListData(data.slice(startIndex, endIndex));
          setPagination((prev) => ({
            ...prev,
            current: page,
            pageSize: pageSize,
            total: data.length,
          }));
        } else {
          setListData([]);
        }
      } catch (error) {
        messageApi.error("Không thể tải danh sách phiếu điều chuyển!");
      }
      setLoading(false);
    },
    [messageApi]
  );

  const fetchCommonData = useCallback(async () => {
    try {
      const [resKho, resSP, resUser] = await Promise.allSettled([
        warehouseService.getAllWarehouses(),
        productService.getAllProducts(),
        userService.getAllUsers(),
      ]);
      if (resKho.status === "fulfilled") setListKho(resKho.value.data || []);
      if (resSP.status === "fulfilled") setListSanPham(resSP.value.data || []);
      if (resUser.status === "fulfilled") setListUser(resUser.value.data || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // --- 2. KHỞI TẠO & PHÂN QUYỀN ---
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

        const role = (user.vaiTro || user.tenVaiTro || "").toUpperCase();
        setIsAdmin(role === "ADMIN");

        let rawPerms = user.dsQuyenSoHuu || user.quyen || [];
        if (!Array.isArray(rawPerms)) rawPerms = [];

        const parsedPerms = rawPerms.map((p) => {
          if (typeof p === "object" && p !== null)
            return parseInt(p.maQuyen || p.id);
          return parseInt(p);
        });

        setPermissions(parsedPerms);

        const hasViewPerm = parsedPerms.includes(PERM_VIEW);

        if (role === "ADMIN" || hasViewPerm) {
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

  // Handlers tìm kiếm
  const handleSearch = () => fetchData(1, pagination.pageSize, filter);
  const handleResetFilter = () => {
    const emptyFilter = {
      chungTu: "",
      trangThai: null,
      maKhoXuat: null,
      maKhoNhap: null,
      dateRange: null,
    };
    setFilter(emptyFilter);
    fetchData(1, 5, emptyFilter);
  };
  const handleTableChange = (newPagination) => {
    fetchData(newPagination.current, newPagination.pageSize, filter);
  };

  const checkPerm = (id) => isAdmin || permissions.includes(id);

  const getUserName = (id) =>
    listUser.find((u) => u.maNguoiDung === id)?.hoTen || `ID: ${id}`;
  const getKhoName = (id) =>
    listKho.find((k) => k.maKho === id)?.tenKho || `Mã: ${id}`;
  const getSPName = (id) =>
    listSanPham.find((sp) => sp.maSP === id)?.tenSP || `SP-${id}`;

  const renderStatus = (status) => {
    if (status === 1) return <Tag color="orange">Chờ duyệt</Tag>;
    if (status === 2) return <Tag color="green">Đã duyệt</Tag>;
    if (status === 3) return <Tag color="red">Đã hủy</Tag>;
    return status;
  };

  const isEditable = (record) => {
    if (isAdmin && record.trangThai !== 3) return true;
    if (record.trangThai === 1) return checkPerm(PERM_EDIT);
    if (record.trangThai === 2) return checkPerm(PERM_EDIT_APPROVED);
    return false;
  };

  // --- HANDLERS MODAL ---
  const handleOpenModal = () => {
    setEditingRecord(null);
    form.resetFields();
    setSourceInventory([]);
    setSelectedSourceKho(null);
    setIsModalVisible(true);
  };

  const handleSourceKhoChange = async (khoId) => {
    setSelectedSourceKho(khoId);
    form.setFieldsValue({ maKhoNhap: null, chiTiet: [] });
    try {
      const res = await warehouseService.getInventoryByWarehouse(khoId);
      setSourceInventory(res.data || []);
    } catch (error) {
      setSourceInventory([]);
    }
  };

  const handleEdit = async (record) => {
    if (record.trangThai === 2) {
      const createdDate = dayjs(record.ngayChuyen);
      const diffDays = dayjs().diff(createdDate, "day");
      if (diffDays > 30) {
        messageApi.error(`Không thể sửa: Phiếu đã quá hạn 30 ngày.`);
        return;
      }
      if (!checkPerm(PERM_EDIT_APPROVED) && !isAdmin) {
        messageApi.warning("Bạn cần quyền 116 để sửa phiếu đã duyệt!");
        return;
      }
    } else if (record.trangThai === 3) {
      messageApi.warning("Không thể sửa phiếu đã hủy!");
      return;
    }

    try {
      const response = await transferService.getTransferById(record.maPhieuDC);
      const data = response.data;

      // [FIX] Xử lý ẩn chữ PENDING: Nếu soLo là "PENDING" thì set về null/rỗng
      if (data.chiTiet && Array.isArray(data.chiTiet)) {
        data.chiTiet = data.chiTiet.map((item) => ({
          ...item,
          soLo: item.soLo === "PENDING" ? null : item.soLo,
        }));
      }

      setEditingRecord(data);

      if (data.maKhoXuat) {
        setSelectedSourceKho(data.maKhoXuat);
        try {
          const resInv = await warehouseService.getInventoryByWarehouse(
            data.maKhoXuat
          );
          setSourceInventory(resInv.data || []);
        } catch (e) {
          setSourceInventory([]);
        }
      }

      form.setFieldsValue(data);
      setIsModalVisible(true);
    } catch (error) {
      messageApi.error("Lỗi tải chi tiết phiếu để sửa!");
    }
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        if (values.maKhoXuat === values.maKhoNhap) {
          messageApi.error("Kho xuất và Kho nhập không được trùng nhau!");
          return;
        }
        try {
          if (editingRecord) {
            await transferService.updateTransfer(
              editingRecord.maPhieuDC,
              values
            );
            messageApi.success("Cập nhật thành công!");
          } else {
            await transferService.createTransfer(values);
            messageApi.success("Tạo phiếu thành công!");
          }
          setIsModalVisible(false);
          fetchData(pagination.current, pagination.pageSize, filter);
        } catch (error) {
          messageApi.error(
            error.response?.data?.message || "Lỗi khi lưu phiếu!"
          );
        }
      })
      .catch(() => {});
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await transferService.getTransferById(record.maPhieuDC);
      setViewingRecord(response.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      messageApi.error("Lỗi tải chi tiết!");
    }
  };

  const handleApprove = async (id) => {
    try {
      await transferService.approveTransfer(id);
      messageApi.success("Đã duyệt!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error(e.response?.data?.message || "Lỗi khi duyệt!");
    }
  };
  const handleReject = async (id) => {
    try {
      await transferService.rejectTransfer(id);
      messageApi.success("Đã hủy!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error(e.response?.data?.message || "Lỗi khi hủy!");
    }
  };
  const handleDelete = (id) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };
  const handleDeleteConfirm = async () => {
    try {
      await transferService.deleteTransfer(deletingId);
      messageApi.success("Đã xóa!");
      fetchData(pagination.current, pagination.pageSize, filter);
    } catch (e) {
      messageApi.error(
        e.response?.data?.message || "Lỗi xóa (Phiếu đã có ràng buộc)!"
      );
    }
    setIsDeleteModalOpen(false);
  };

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  const columns = [
    {
      title: "Ngày Chuyển",
      dataIndex: "ngayChuyen",
      width: 150,
      fixed: screens.lg ? "left" : null, // Ghim trái trên PC
      render: (val) => dayjs(val).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Chứng từ",
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
      title: "Kho Xuất",
      dataIndex: "maKhoXuat",
      width: 150,
      render: getKhoName,
    },
    {
      title: "Kho Nhập",
      dataIndex: "maKhoNhap",
      width: 150,
      render: getKhoName,
    },
    {
      title: "Người Lập",
      dataIndex: "nguoiLap",
      width: 150,
      render: (id) => getUserName(id),
    },
    {
      title: "Hành động",
      key: "action",
      width: 200,
      fixed: screens.lg ? "right" : null, // Ghim phải trên PC
      align: "center",
      render: (_, record) => {
        const isPending = record.trangThai === 1; // Chờ duyệt
        const allowEdit = isEditable(record);
        const allowDelete = checkPerm(PERM_DELETE);
        const allowApprove = checkPerm(PERM_APPROVE);
        const allowCancel = checkPerm(PERM_CANCEL);

        return (
          <Space
            size="small"
            wrap={false}
          >
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
            {isPending && allowApprove && (
              <Tooltip title="Duyệt phiếu">
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record.maPhieuDC)}
                  style={{ color: "green", borderColor: "green" }}
                  size="small"
                />
              </Tooltip>
            )}
            {isPending && allowCancel && (
              <Tooltip title="Hủy phiếu">
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleReject(record.maPhieuDC)}
                  danger
                  size="small"
                />
              </Tooltip>
            )}
            {isPending && allowDelete && (
              <Tooltip title="Xóa phiếu">
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  onClick={() => handleDelete(record.maPhieuDC)}
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
        <p>Bạn không có quyền xem danh sách Điều chuyển.</p>
        <p>
          Vui lòng liên hệ Admin cấp quyền mã: <b>{PERM_VIEW}</b>
        </p>
      </Card>
    );
  }

  return (
    <div style={{ padding: "0 10px" }}>
      {" "}
      {/* Padding cho mobile */}
      {contextHolder}
      {/* BỘ LỌC RESPONSIVE (Chia cột 3-3-4-4-6-4) */}
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
              placeholder="DC-001..."
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
              <Option value={3}>Đã hủy</Option>
            </Select>
          </Col>
          <Col
            xs={24}
            md={4}
          >
            <div style={{ fontWeight: 500 }}>Kho Xuất</div>
            <Select
              style={{ width: "100%" }}
              placeholder="Kho xuất"
              allowClear
              value={filter.maKhoXuat}
              onChange={(v) => setFilter({ ...filter, maKhoXuat: v })}
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
            <div style={{ fontWeight: 500 }}>Kho Nhập</div>
            <Select
              style={{ width: "100%" }}
              placeholder="Kho nhập"
              allowClear
              value={filter.maKhoNhap}
              onChange={(v) => setFilter({ ...filter, maKhoNhap: v })}
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
            md={6}
          >
            <div style={{ fontWeight: 500 }}>Ngày chuyển</div>
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
        {checkPerm(PERM_CREATE) && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            Tạo Phiếu Điều Chuyển
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
        rowKey="maPhieuDC"
        pagination={{ ...pagination, size: "small" }}
        onChange={handleTableChange}
        // [QUAN TRỌNG] Cuộn ngang
        scroll={{ x: 1200 }}
        size="small"
      />
      {/* Modal Tạo/Sửa (Responsive) */}
      <Modal
        title={
          editingRecord ? "Sửa Phiếu Điều Chuyển" : "Tạo Phiếu Điều Chuyển"
        }
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={screens.md ? 900 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col
              xs={24}
              md={8}
            >
              <Form.Item
                name="maKhoXuat"
                label="Kho Xuất Hàng"
                rules={[{ required: true, message: "Chọn Kho Xuất" }]}
              >
                <Select
                  placeholder="Chọn kho xuất"
                  onChange={handleSourceKhoChange}
                  disabled={!!editingRecord}
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
            </Col>
            <Col
              xs={24}
              md={8}
            >
              <Form.Item
                name="maKhoNhap"
                label="Kho Nhập Hàng"
                rules={[{ required: true, message: "Chọn Kho Nhập" }]}
              >
                <Select placeholder="Chọn kho nhập">
                  {listKho
                    .filter((k) => k.maKho !== selectedSourceKho)
                    .map((k) => (
                      <Option
                        key={k.maKho}
                        value={k.maKho}
                      >
                        {k.tenKho}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
            <Col
              xs={24}
              md={8}
            >
              <Form.Item
                name="chungTu"
                label="Chứng từ"
                rules={[{ required: true, message: "Nhập Chứng Từ" }]}
              >
                <Input placeholder="DC-001" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="ghiChu"
            label="Ghi chú"
          >
            <Input.TextArea
              rows={2}
              placeholder="Lý do điều chuyển..."
            />
          </Form.Item>

          <Divider
            orientation="left"
            style={{ borderColor: "#faad14", color: "#faad14" }}
          >
            DANH SÁCH HÀNG HÓA
          </Divider>

          {/* HEADER FORM LIST RESPONSIVE */}
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
              <Col span={10}>Sản phẩm</Col>
              <Col span={6}>Số lô</Col> {/* Thêm cột Số lô */}
              <Col span={6}>Số lượng</Col>
              <Col span={2}>Xóa</Col>
            </Row>
          )}

          <Form.List name="chiTiet">
            {(fields, { add, remove }) => (
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
                    {/* 1. Sản phẩm */}
                    <Col
                      xs={24}
                      md={10}
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
                            selectedSourceKho
                              ? "Chọn sản phẩm"
                              : "Chọn Kho Xuất trước"
                          }
                          showSearch
                          optionFilterProp="children"
                          disabled={!selectedSourceKho}
                        >
                          {sourceInventory.map((sp) => (
                            <Option
                              key={sp.maSP}
                              value={sp.maSP}
                            >
                              {sp.tenSP} (Tồn: {sp.soLuongTon})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    {/* 2. Số lô [MỚI] */}
                    <Col
                      xs={12}
                      md={6}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "soLo"]}
                        label={!screens.md ? "Số lô" : null}
                        rules={[{ message: "Nhập lô" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Số lô" />
                      </Form.Item>
                    </Col>

                    {/* 3. Số lượng */}
                    <Col
                      xs={12}
                      md={6}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "soLuong"]}
                        label={!screens.md ? "Số lượng" : null}
                        rules={[
                          { required: true, message: "Nhập SL" },
                          { type: "integer", min: 1, message: ">0" },
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="SL"
                          min={1}
                          precision={0}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>

                    {/* 4. Xóa */}
                    <Col
                      xs={24}
                      md={2}
                      style={{ textAlign: !screens.md ? "right" : "center" }}
                    >
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{
                          color: "red",
                          fontSize: 18,
                          cursor: "pointer",
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
                  >
                    Thêm sản phẩm
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
      {/* Modal Chi Tiết (Responsive) */}
      <Modal
        title="Chi tiết Điều Chuyển"
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
        {viewingRecord && (
          <div>
            <Descriptions
              bordered
              column={screens.md ? 2 : 1}
              size="small"
            >
              <Descriptions.Item label="Mã Phiếu">
                {viewingRecord.maPhieuDC}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày Chuyển">
                {viewingRecord.ngayChuyen}
              </Descriptions.Item>
              <Descriptions.Item label="Kho Xuất">
                {getKhoName(viewingRecord.maKhoXuat)}
              </Descriptions.Item>
              <Descriptions.Item label="Kho Nhập">
                {getKhoName(viewingRecord.maKhoNhap)}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng Thái">
                {renderStatus(viewingRecord.trangThai)}
              </Descriptions.Item>
              <Descriptions.Item label="Người Lập">
                {getUserName(viewingRecord.nguoiLap)}
              </Descriptions.Item>
              <Descriptions.Item
                label="Ghi Chú"
                span={2}
              >
                {viewingRecord.ghiChu}
              </Descriptions.Item>
              <Descriptions.Item
                label="Chứng Từ"
                span={2}
              >
                {viewingRecord.chungTu}
              </Descriptions.Item>
            </Descriptions>
            <Divider
              orientation="left"
              style={{ borderColor: "#faad14", color: "#faad14" }}
            >
              DANH SÁCH HÀNG HÓA
            </Divider>
            <Table
              dataSource={viewingRecord.chiTiet || []}
              rowKey="maSP"
              pagination={false}
              bordered
              scroll={{ x: 500 }}
              size="small"
              columns={[
                {
                  title: "Sản Phẩm",
                  dataIndex: "maSP",
                  render: (id) => getSPName(id),
                },
                {
                  title: "Số Lô", // [MỚI] Hiển thị cột số lô
                  dataIndex: "soLo",
                  align: "center",
                },
                {
                  title: "Số Lượng",
                  dataIndex: "soLuong",
                  align: "center",
                  render: (val) => <b>{val}</b>,
                },
              ]}
            />
          </div>
        )}
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
        <p>Bạn có chắc muốn xóa phiếu này không?</p>
      </Modal>
    </div>
  );
};

export default TransferPage;
