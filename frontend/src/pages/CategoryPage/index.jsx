// src/pages/CategoryPage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
// Import các component giao diện từ Ant Design
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Card,
  Row,
  Col,
  Tooltip,
  Grid,
} from "antd";
// Import các icon
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RestOutlined,
  UndoOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import * as categoryService from "../../services/category.service";

// --- ĐỊNH NGHĨA QUYỀN HẠN (CONSTANTS) ---
const PERM_VIEW = 140;
const PERM_CREATE = 141;
const PERM_EDIT = 142;
const PERM_DELETE = 143;

const CategoryPage = () => {
  // [RESPONSIVE] Hook kiểm tra kích thước màn hình
  // screens.lg = true nếu màn hình lớn (Laptop/PC), false nếu là Mobile/Tablet
  const screens = Grid.useBreakpoint();
  // --- KHAI BÁO STATE (TRẠNG THÁI) ---
  const [categories, setCategories] = useState([]); // Chứa danh sách loại hàng
  const [loading, setLoading] = useState(false); // Trạng thái loading
  const [inTrashMode, setInTrashMode] = useState(false); // True: đang xem thùng rác, False: xem danh sách chính
  // State cho Modal Thêm/Sửa
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // Lưu thông tin dòng đang sửa (null nếu là thêm mới)
  // State cho Modal Xóa
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form] = Form.useForm(); // Hook quản lý form của Ant Design
  const [messageApi, contextHolder] = message.useMessage(); // Hook hiển thị thông báo (Toast message)

  const [permissions, setPermissions] = useState([]); // Danh sách quyền của user đang đăng nhập
  const [isAdmin, setIsAdmin] = useState(false); // Kiểm tra có phải Admin không

  // --- 1. HÀM TẢI DỮ LIỆU TỪ API ---
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      // Nếu đang ở chế độ thùng rác -> Gọi API lấy rác, ngược lại gọi API lấy tất cả
      if (inTrashMode) {
        res = await categoryService.getTrashCategories();
      } else {
        res = await categoryService.getAllCategories();
      }
      // Xử lý dữ liệu trả về (tùy format backend trả về data hay data.content)
      let data = res.data;
      if (data.content) data = data.content;

      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [inTrashMode]);

  // --- 2. HÀM KIỂM TRA QUYỀN (AUTHORIZATION) ---
  useEffect(() => {
    // Lấy thông tin user từ LocalStorage khi mới vào trang
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
        const parsedPerms = rawPerms.map((p) =>
          typeof p === "object" ? parseInt(p.maQuyen || p.id) : parseInt(p)
        );

        setPermissions(parsedPerms);

        const hasViewPerm = parsedPerms.includes(PERM_VIEW);
        if (role === "ADMIN" || hasViewPerm) {
          fetchCategories();
        }
      } catch (e) {
        setPermissions([]);
      }
    }
  }, [fetchCategories]); // Đã thêm fetchCategories vào dependency

  const checkPerm = (id) => isAdmin || permissions.includes(id);

  // --- CÁC HÀM XỬ LÝ SỰ KIỆN (HANDLERS) ---
  // Mở Modal để thêm mới
  const handleOpenModal = () => {
    setEditingCategory(null);
    form.resetFields();
    setIsModalVisible(true);
  };
  // Mở Modal để chỉnh sửa
  const handleEdit = (record) => {
    setEditingCategory(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };
  // Xử lý khi bấm nút OK (Lưu) trên Modal
  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          if (editingCategory) {
            await categoryService.updateCategory(
              editingCategory.maLoai,
              values
            );
            messageApi.success("Cập nhật thành công!");
          } else {
            await categoryService.createCategory(values);
            messageApi.success("Tạo mới thành công!");
          }
          setIsModalVisible(false);
          fetchCategories();
        } catch (error) {
          // 1. Lấy message từ backend
          const errorMessage =
            error.response?.data?.message ||
            error.response?.data ||
            "Lỗi lưu dữ liệu!";
          if (errorMessage.toString().toLowerCase().includes("duplicate")) {
            messageApi.error(
              `Tên loại hàng "${values.tenLoai}" đã tồn tại! Vui lòng chọn tên khác.`
            );
          } else {
            messageApi.error(errorMessage);
          }
        }
      })
      .catch(() => {});
  };
  // Mở modal xác nhận xóa
  const handleDelete = (id) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };
  // Xác nhận xóa
  const handleDeleteConfirm = async () => {
    try {
      await categoryService.deleteCategory(deletingId);
      messageApi.success("Đã chuyển vào thùng rác!");
      fetchCategories();
    } catch (error) {
      messageApi.error("Lỗi khi xóa!");
    }
    setIsDeleteModalOpen(false);
  };
  // Khôi phục từ thùng rác
  const handleRestore = async (id) => {
    try {
      await categoryService.restoreCategory(id);
      messageApi.success("Đã khôi phục loại hàng!");
      fetchCategories();
    } catch (e) {
      messageApi.error("Lỗi khi khôi phục!");
    }
  };

  // --- [3] CẤU HÌNH CỘT CHO BẢNG (TABLE) ---
  const columns = [
    {
      title: "Mã",
      dataIndex: "maLoai",
      width: 80,
      align: "center",
      fixed: screens.lg ? "left" : null,
    },
    {
      title: "Tên Loại Hàng",
      dataIndex: "tenLoai",
      width: 200,
      fixed: screens.lg ? "left" : null,
      render: (t) => <b>{t}</b>,
    },
    {
      title: "Mô Tả",
      dataIndex: "moTa",
      width: 250,
    },
    // {
    //   title: "Trạng thái",
    //   align: "center",
    //   width: 120,
    //   render: () =>
    //     inTrashMode ? (
    //       <Tag color="red">Đã xóa</Tag>
    //     ) : (
    //       <Tag color="green">Hoạt động</Tag>
    //     ),
    // },
    {
      title: "Hành động",
      key: "action",
      width: 110,
      align: "center",
      fixed: screens.lg ? "right" : null,
      render: (_, record) => {
        const allowEdit = checkPerm(PERM_EDIT);
        const allowDelete = checkPerm(PERM_DELETE);

        return (
          <Space size="small">
            {inTrashMode ? (
              allowDelete && (
                <Tooltip title="Khôi phục">
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => handleRestore(record.maLoai)}
                  />
                </Tooltip>
              )
            ) : (
              <>
                {allowEdit && (
                  <Button
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleEdit(record)}
                  />
                )}
                {allowDelete && (
                  <Button
                    icon={<DeleteOutlined />}
                    danger
                    size="small"
                    onClick={() => handleDelete(record.maLoai)}
                  />
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
      <Card style={{ margin: 20, color: "red", textAlign: "center" }}>
        Bạn không có quyền xem trang này (ID: {PERM_VIEW})
      </Card>
    );
  }
  // --- GIAO DIỆN CHÍNH (RENDER) ---
  return (
    <div style={{ padding: "0 10px" }}>
      {contextHolder}
      {/* 1. Header Card (Tiêu đề + Nút bấm) */}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        <Row
          justify="space-between"
          align="middle"
          gutter={[0, 16]}
        >
          <Col
            xs={24}
            md="auto"
          >
            <h3 style={{ margin: 0, color: inTrashMode ? "red" : "inherit" }}>
              {inTrashMode ? (
                <>
                  <RestOutlined /> Thùng rác Loại Hàng
                </>
              ) : (
                "Quản lý Loại Hàng"
              )}
            </h3>
          </Col>

          {/* Nhóm nút bấm chức năng */}
          <Col
            xs={24}
            md="auto"
          >
            <Space
              wrap
              style={{
                width: "100%",
                justifyContent: screens.md ? "flex-end" : "flex-start",
              }}
            >
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchCategories}
              >
                Tải lại
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
                      Thêm Mới
                    </Button>
                  )}
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
      {/* 2. Bảng dữ liệu */}
      <Table
        className="fixed-height-table"
        columns={columns}
        dataSource={categories}
        loading={loading}
        rowKey="maLoai"
        pagination={{ pageSize: 10, size: "small" }}
        scroll={{ x: 700 }}
        size={screens.md ? "middle" : "small"}
      />
      {/* 3. Modal Thêm/Sửa */}
      <Modal
        title={editingCategory ? "Sửa Loại Hàng" : "Thêm Loại Hàng"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={screens.md ? 520 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="tenLoai"
            label="Tên Loại Hàng"
            rules={[{ required: true, message: "Vui lòng nhập tên loại!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="moTa"
            label="Mô Tả"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      {/* 4. Modal Xác nhận xóa */}
      <Modal
        title="Xác nhận xóa"
        open={isDeleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText="Xóa"
        cancelText="Hủy"
        okType="danger"
      >
        <p>Bạn có chắc muốn chuyển loại hàng này vào thùng rác?</p>
      </Modal>
    </div>
  );
};

export default CategoryPage;
