// src/pages/CategoryPage/index.jsx

import React, { useState, useEffect, useCallback } from "react";
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
  //Tag,
  Tooltip,
  Grid, // [1] Import Grid
} from "antd";
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

// --- QUYỀN HẠN ---
const PERM_VIEW = 140;
const PERM_CREATE = 141;
const PERM_EDIT = 142;
const PERM_DELETE = 143;

const CategoryPage = () => {
  // [2] Hook kiểm tra màn hình (screens.lg = PC/Laptop)
  const screens = Grid.useBreakpoint();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inTrashMode, setInTrashMode] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- 1. HÀM TẢI DỮ LIỆU ---
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (inTrashMode) {
        res = await categoryService.getTrashCategories();
      } else {
        res = await categoryService.getAllCategories();
      }

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

  // --- 2. CHECK QUYỀN ---
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

  // --- HANDLERS ---
  const handleOpenModal = () => {
    setEditingCategory(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingCategory(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

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
          messageApi.error("Lỗi lưu dữ liệu!");
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
      await categoryService.deleteCategory(deletingId);
      messageApi.success("Đã chuyển vào thùng rác!");
      fetchCategories();
    } catch (error) {
      messageApi.error("Lỗi khi xóa!");
    }
    setIsDeleteModalOpen(false);
  };

  const handleRestore = async (id) => {
    try {
      await categoryService.restoreCategory(id);
      messageApi.success("Đã khôi phục loại hàng!");
      fetchCategories();
    } catch (e) {
      messageApi.error("Lỗi khi khôi phục!");
    }
  };

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  // Logic: Hiển thị tất cả cột, cuộn ngang trên mobile.
  // Ghim cột khi ở màn hình lớn (screens.lg).
  const columns = [
    {
      title: "Mã",
      dataIndex: "maLoai",
      width: 80,
      align: "center",
      fixed: screens.lg ? "left" : null, // Ghim trái trên PC
    },
    {
      title: "Tên Loại Hàng",
      dataIndex: "tenLoai",
      width: 200,
      fixed: screens.lg ? "left" : null, // Ghim trái trên PC
      render: (t) => <b>{t}</b>,
    },
    {
      title: "Mô Tả",
      dataIndex: "moTa",
      width: 250, // Đặt width để có thể cuộn ngang
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
      fixed: screens.lg ? "right" : null, // Ghim phải trên PC
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

  return (
    <div style={{ padding: "0 10px" }}>
      {/* Thêm padding nhỏ cho mobile */}
      {contextHolder}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        <Row
          justify="space-between"
          align="middle"
          gutter={[0, 16]} // Khoảng cách dọc khi xuống dòng
        >
          {/* Tiêu đề: Mobile full dòng, Desktop tự động */}
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

          {/* Nút bấm: Mobile full dòng, Desktop tự động */}
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
      <Table
        className="fixed-height-table"
        columns={columns}
        dataSource={categories}
        loading={loading}
        rowKey="maLoai"
        pagination={{ pageSize: 10, size: "small" }}
        // Scroll ngang 700px để đảm bảo đủ chỗ cho tất cả các cột
        scroll={{ x: 700 }}
        size={screens.md ? "middle" : "small"} // Mobile dùng bảng nhỏ
      />
      <Modal
        title={editingCategory ? "Sửa Loại Hàng" : "Thêm Loại Hàng"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        // Responsive width cho Modal
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
