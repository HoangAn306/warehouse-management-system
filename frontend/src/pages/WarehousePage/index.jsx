// src/pages/WarehousePage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Tag,
  Card,
  Row,
  Col,
  Tooltip,
  Grid, // [1] Import Grid để kiểm tra kích thước màn hình
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined,
  RestOutlined,
  UndoOutlined,
  ArrowLeftOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import * as warehouseService from "../../services/warehouse.service";
import dayjs from "dayjs";
// --- CẤU HÌNH ID QUYỀN (KHO HÀNG) ---
const PERM_VIEW = 70;
const PERM_CREATE = 71;
const PERM_EDIT = 72;
const PERM_DELETE = 73;

const WarehousePage = () => {
  // [2] Hook kiểm tra màn hình
  // screens.lg = true (>= 992px) -> Máy tính. False -> Mobile/Tablet dọc.
  const screens = Grid.useBreakpoint();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  // State chế độ Thùng rác
  const [inTrashMode, setInTrashMode] = useState(false);

  // State cho Modal Thêm/Sửa
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // State cho Modal Xóa
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // State cho Modal Chi tiết tồn kho
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [inventoryList, setInventoryList] = useState([]);
  const [currentWarehouseName, setCurrentWarehouseName] = useState("");

  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // State Quyền hạn
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // State bộ lọc tìm kiếm
  const [keyword, setKeyword] = useState("");

  // --- 1. TẢI DỮ LIỆU ---
  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (inTrashMode) {
        res = await warehouseService.getTrashWarehouses();
      } else {
        res = await warehouseService.getAllWarehouses();
      }

      let data = res.data ? res.data : res;
      if (data && data.content) data = data.content;

      if (Array.isArray(data)) {
        let filtered = data;
        if (keyword) {
          filtered = filtered.filter(
            (item) =>
              item.tenKho.toLowerCase().includes(keyword.toLowerCase()) ||
              (item.diaChi &&
                item.diaChi.toLowerCase().includes(keyword.toLowerCase()))
          );
        }
        setWarehouses(filtered);
      } else {
        setWarehouses([]);
      }
    } catch (error) {
      console.error(error);
      setWarehouses([]);
    }
    setLoading(false);
  }, [inTrashMode, keyword]);

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
      } catch (e) {
        setPermissions([]);
      }
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const checkPerm = (id) => isAdmin || permissions.includes(id);

  // --- HANDLERS ---
  const handleOpenModal = () => {
    setEditingWarehouse(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingWarehouse(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          if (editingWarehouse) {
            await warehouseService.updateWarehouse(
              editingWarehouse.maKho,
              values
            );
            messageApi.success("Cập nhật kho thành công!");
          } else {
            await warehouseService.createWarehouse(values);
            messageApi.success("Tạo kho mới thành công!");
          }
          setIsModalVisible(false);
          fetchWarehouses();
        } catch (error) {
                  // 1. Lấy message từ backend (ưu tiên .message, nếu không có thì lấy toàn bộ data)
                  const errorMessage =
                    error.response?.data?.message ||
                    error.response?.data ||
                    "Lỗi lưu dữ liệu!";
        
                  // 2. Chuyển về chữ thường để kiểm tra từ khóa "duplicate"
                  if (errorMessage.toString().toLowerCase().includes("duplicate")) {
                    // Nếu phát hiện trùng -> Thông báo tiếng Việt dễ hiểu
                    messageApi.error(
                      `Tên kho hàng "${values.tenKho}" đã tồn tại! Vui lòng chọn tên khác.`
                    );
                  } else {
                    // [SỬA ĐOẠN NÀY] Nếu lỗi khác -> Hiển thị nguyên văn message từ Backend
                    messageApi.error(errorMessage);
                  }
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
      await warehouseService.deleteWarehouse(deletingId);
      messageApi.success("Đã chuyển vào thùng rác!");
      fetchWarehouses();
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data ||
        "Không thể xóa!";
      messageApi.error(errorMessage);
    }
    setIsDeleteModalOpen(false);
  };

  const handleRestore = async (id) => {
    try {
      await warehouseService.restoreWarehouse(id);
      messageApi.success("Đã khôi phục kho!");
      fetchWarehouses();
    } catch (e) {
      messageApi.error("Lỗi khôi phục");
    }
  };

  const handleViewInventory = async (record) => {
    try {
      const res = await warehouseService.getInventoryByWarehouse(record.maKho);
      setInventoryList(res.data || res || []);
      setCurrentWarehouseName(record.tenKho);
      setIsDetailModalOpen(true);
    } catch (error) {
      messageApi.error("Không thể tải tồn kho!");
    }
  };

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  // Logic: screens.lg (PC) thì ghim cột. Mobile thì thả lỏng.
  const columns = [
    {
      title: "Mã",
      dataIndex: "maKho",
      width: 80,
      align: "center",
      // Ghim trái trên PC
      fixed: screens.lg ? "left" : null,
    },
    {
      title: "Tên Kho",
      dataIndex: "tenKho",
      key: "tenKho",
      width: 180,
      // Ghim trái trên PC
      fixed: screens.lg ? "left" : null,
      render: (t) => <b>{t}</b>,
    },
    {
      title: "Địa Chỉ",
      dataIndex: "diaChi",
      key: "diaChi",
      width: 250, // Đặt width để bảng có thể cuộn ngang
    },
    {
      title: "Ghi Chú",
      dataIndex: "ghiChu",
      key: "ghiChu",
      width: 150,
    },
    // {
    //   title: "Trạng thái",
    //   align: "center",
    //   width: 120,
    //   render: (_, record) =>
    //     inTrashMode ? (
    //       <Tag color="red">Đã xóa</Tag>
    //     ) : (
    //       <Tag color="green">Hoạt động</Tag>
    //     ),
    // },
    // [Đã xóa cột Trạng thái bị lặp]
    {
      title: "Hành động",
      key: "action",
      width: 160,
      align: "center",
      // Ghim phải trên PC
      fixed: screens.lg ? "right" : null,
      render: (_, record) => {
        const allowEdit = checkPerm(PERM_EDIT);
        const allowDelete = checkPerm(PERM_DELETE);

        return (
          <Space size="small">
            {/* [ĐÃ SỬA] Chỉ hiển thị nút Xem Tồn Kho khi KHÔNG ở trong thùng rác */}
            {!inTrashMode && (
              <Tooltip title="Xem tồn kho">
                <Button
                  icon={<EyeOutlined />}
                  size="small"
                  onClick={() => handleViewInventory(record)}
                />
              </Tooltip>
            )}

            {inTrashMode ? (
              allowDelete && (
                <Tooltip title="Khôi phục">
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => handleRestore(record.maKho)}
                  />
                </Tooltip>
              )
            ) : (
              <>
                {allowEdit && (
                  <Tooltip title="Cập nhật">
                    <Button
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => handleEdit(record)}
                    />
                  </Tooltip>
                )}

                {allowDelete && (
                  <Tooltip title="Xóa">
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      size="small"
                      onClick={() => handleDelete(record.maKho)}
                    />
                  </Tooltip>
                )}
              </>
            )}
          </Space>
        );
      },
    },
  ];

  if (!loading && permissions.length > 0 && !checkPerm(PERM_VIEW)) {
    return (
      <Card style={{ margin: 20, textAlign: "center" }}>
        <h2 style={{ color: "red" }}>Truy cập bị từ chối</h2>
        <p>Bạn không có quyền xem danh sách Kho hàng.</p>
        <p>
          Liên hệ Admin cấp quyền mã: <b>{PERM_VIEW}</b>
        </p>
      </Card>
    );
  }

  return (
    <div style={{ padding: "0 10px" }}>
      {" "}
      {/* Padding nhỏ cho mobile */}
      {contextHolder}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        <Row
          justify="space-between"
          align="middle"
          gutter={[16, 16]}
        >
          {/* Ô tìm kiếm: Full width trên mobile, 8 col trên PC */}
          <Col
            xs={24}
            md={8}
          >
            <Input
              placeholder="Tìm tên kho hoặc địa chỉ..."
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </Col>
          {/* Cụm nút bấm: Full width trên mobile, canh phải trên PC */}
          <Col
            xs={24}
            md={16}
            style={{ textAlign: screens.md ? "right" : "left" }}
          >
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchWarehouses}
              >
                Tải lại
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={() => setKeyword("")}
              >
                Xóa tìm
              </Button>

              {inTrashMode ? (
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setInTrashMode(false)}
                >
                  Quay lại
                </Button>
              ) : (
                <>
                  {(isAdmin || checkPerm(PERM_DELETE)) && (
                    <Button
                      icon={<RestOutlined />}
                      danger
                      onClick={() => setInTrashMode(true)}
                    >
                      Thùng rác
                    </Button>
                  )}

                  {checkPerm(PERM_CREATE) && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleOpenModal}
                    >
                      Tạo Kho Mới
                    </Button>
                  )}
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
      {inTrashMode && (
        <h3 style={{ color: "red", marginLeft: 10 }}>Thùng rác kho hàng</h3>
      )}
      <Table
        className="fixed-height-table"
        columns={columns}
        dataSource={warehouses}
        loading={loading}
        rowKey="maKho"
        pagination={{ pageSize: 5, size: "small" }}
        // [QUAN TRỌNG] Cho phép cuộn ngang
        scroll={{ x: 800 }}
        size="small"
      />
      {/* --- MODAL THÊM/SỬA --- */}
      <Modal
        title={editingWarehouse ? "Cập nhật Kho" : "Tạo Kho mới"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        // Responsive Modal
        width={screens.md ? 600 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="tenKho"
            label="Tên Kho"
            rules={[{ required: true, message: "Nhập tên kho" }]}
          >
            <Input placeholder="Ví dụ: Kho Chính" />
          </Form.Item>
          <Form.Item
            name="diaChi"
            label="Địa Chỉ"
            rules={[{ required: true, message: "Nhập địa chỉ"  }]}
          >
            <Input placeholder="Ví dụ: 123 Đường ABC..." />
          </Form.Item>
          <Form.Item
            name="ghiChu"
            label="Ghi Chú"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
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
        <p>Bạn có chắc muốn xóa kho này không?</p>
      </Modal>
      {/* --- MODAL CHI TIẾT TỒN KHO --- */}
      <Modal
        title={`Chi tiết tồn kho: ${currentWarehouseName}`}
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
        width={screens.md ? 700 : "100%"}
        style={{ top: 20 }}
      >
        <Table
          dataSource={inventoryList}
          rowKey="maSP"
          pagination={{ pageSize: 5, size: "small" }}
          size="small"
          scroll={{ x: 500 }}
          columns={[
            { title: "Mã SP", dataIndex: "maSP", width: 80 },
            { title: "Tên Sản Phẩm", dataIndex: "tenSP", width: 150 },
            { title: "Số lô", dataIndex: "soLo", width: 80 },
            {
              title: "Ngày hết hạn",
              dataIndex: "ngayHetHan",
              render: (text) => {
                return text ? dayjs(text).format("DD/MM/YYYY") : "";
              },
            },
            {
              title: "Tồn",
              dataIndex: "soLuongTon",
              align: "center",
              width: 80,
              render: (v) => <Tag color="blue">{v}</Tag>,
            },
            { title: "ĐVT", dataIndex: "donViTinh", width: 80 },
          ]}
        />
      </Modal>
    </div>
  );
};

export default WarehousePage;
