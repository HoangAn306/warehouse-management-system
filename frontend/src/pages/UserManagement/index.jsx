// src/pages/UserManagement/index.jsx

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
  Dropdown,
  Tag,
  Tooltip,
  Row,
  Col,
  Card,
  Grid, // [1] Import Grid
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  RestOutlined,
  UndoOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import * as userService from "../../services/user.service";

const { Option } = Select;

// [GIỮ NGUYÊN DANH SÁCH QUYỀN CỦA BẠN]
const permissionGroups = [
  // --- NHÓM 1: QUẢN LÝ DANH MỤC (Có menu con) ---
  {
    key: "cat_group",
    label: " Quản lý Danh mục",
    children: [
      {
        label: " Loại hàng",
        perms: [
          { id: 140, name: "Xem danh sách" },
          { id: 141, name: "Tạo mới" },
          { id: 142, name: "Cập nhật" },
          { id: 143, name: "Xóa" },
        ],
      },
      {
        label: "Sản phẩm",
        perms: [
          { id: 50, name: "Tạo mới" },
          { id: 51, name: "Cập nhật" },
          { id: 52, name: "Xóa" },
        ],
      },
      {
        label: " Kho hàng",
        perms: [
          { id: 70, name: "Xem danh sách" },
          { id: 71, name: "Tạo mới" },
          { id: 72, name: "Cập nhật" },
          { id: 73, name: "Xóa" },
        ],
      },
      {
        label: "Nhà cung cấp",
        perms: [
          { id: 60, name: "Xem danh sách" },
          { id: 61, name: "Tạo mới" },
          { id: 62, name: "Cập nhật" },
          { id: 63, name: "Xóa" },
        ],
      },
      {
        label: " Khách hàng",
        perms: [
          { id: 90, name: "Xem danh sách" },
          { id: 91, name: "Tạo mới" },
          { id: 92, name: "Cập nhật" },
          { id: 93, name: "Xóa" },
        ],
      },
    ],
  },

  // --- NHÓM 2: NGHIỆP VỤ ---
  {
    key: "biz_group",
    label: " Nghiệp vụ Kho",
    children: [
      {
        label: "Phiếu nhập",
        perms: [
          { id: 26, name: "Xem danh sách" },
          { id: 20, name: "Tạo mới" },
          { id: 21, name: "Cập nhật" },
          { id: 22, name: "Xóa" },
          { id: 40, name: "Duyệt phiếu" },
          { id: 41, name: "Hủy phiếu" },
          { id: 120, name: "Sửa phiếu (đã duyệt)" },
        ],
      },
      {
        label: "Phiếu xuất",
        perms: [
          { id: 27, name: "Xem danh sách" },
          { id: 23, name: "Tạo mới" },
          { id: 24, name: "Cập nhật" },
          { id: 25, name: "Xóa" },
          { id: 42, name: "Duyệt phiếu" },
          { id: 43, name: "Hủy phiếu" },
          { id: 121, name: "Sửa phiếu (đã duyệt)" },
        ],
      },
      {
        label: "Điều chuyển",
        perms: [
          { id: 110, name: "Xem danh sách" },
          { id: 111, name: "Tạo mới" },
          { id: 114, name: "Cập nhật" },
          { id: 115, name: "Xóa" },
          { id: 112, name: "Duyệt phiếu" },
          { id: 113, name: "Hủy phiếu" },
          { id: 116, name: "Sửa phiếu (đã duyệt)" },
        ],
      },
    ],
  },

  // --- NHÓM 3: BÁO CÁO ---
  {
    key: "rpt_group",
    label: " Báo cáo & Thống kê",
    perms: [
      { id: 130, name: "Xem Dashboard" },
      { id: 30, name: "Báo cáo Tổng hợp" },
      { id: 103, name: "Báo cáo Tồn kho" },
      { id: 101, name: "Lịch sử Giao dịch" },
      { id: 131, name: "Báo cáo Nhập-Xuất-Tồn" },
    ],
  },
];

const UserManagementPage = () => {
  // [2] Hook kiểm tra màn hình
  const screens = Grid.useBreakpoint();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // State chế độ thùng rác
  const [inTrashMode, setInTrashMode] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const [messageApi, contextHolder] = message.useMessage();

  const [currentUserPermissions, setCurrentUserPermissions] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  const danhSachVaiTro = [
    { MaVaiTro: 1, TenVaiTro: "ADMIN" },
    { MaVaiTro: 2, TenVaiTro: "NHAN_VIEN" },
    { MaVaiTro: 3, TenVaiTro: "THUKHO" },
    { MaVaiTro: 4, TenVaiTro: "QUAN_LY" },
    { MaVaiTro: 5, TenVaiTro: "GIANG_VIEN" },
  ];

  // 1. FETCH DATA
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (inTrashMode) {
        response = await userService.getTrashUsers();
      } else {
        response = await userService.getAllUsers();
      }
      setUsers(response.data);
    } catch (error) {
      console.error(error);
      messageApi.error("Không thể tải danh sách người dùng!");
    }
    setLoading(false);
  }, [messageApi, inTrashMode]);

  useEffect(() => {
    fetchUsers();
    try {
      const storedUser = localStorage.getItem("user_info");
      if (storedUser) {
        let user = JSON.parse(storedUser);
        if (
          user.quyen &&
          !Array.isArray(user.quyen) &&
          user.quyen.maNguoiDung
        ) {
          user = user.quyen;
        }
        const roleName = user.vaiTro || user.tenVaiTro || "";
        setCurrentUserRole(roleName);
        let perms = user.dsQuyenSoHuu || user.quyen;
        if (!Array.isArray(perms)) perms = [];
        setCurrentUserPermissions(perms);
      }
    } catch (e) {
      setCurrentUserPermissions([]);
    }
  }, [fetchUsers]);

  const isMyRoleAdmin = currentUserRole === "ADMIN";
  const canEdit = isMyRoleAdmin || currentUserPermissions.includes(11);
  const canDelete = isMyRoleAdmin || currentUserPermissions.includes(12);
  const canCreate = isMyRoleAdmin || currentUserPermissions.includes(10);
  const canManagePerms = isMyRoleAdmin;

  // --- HANDLERS ---
  const handleOpenModal = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
    setIsDeleteModalOpen(false);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    const vaiTroId = danhSachVaiTro.find(
      (vt) => vt.TenVaiTro === record.tenVaiTro
    )?.MaVaiTro;
    form.setFieldsValue({
      tenDangNhap: record.tenDangNhap,
      hoTen: record.hoTen,
      email: record.email,
      sdt: record.sdt,
      maVaiTro: vaiTroId,
    });
    setIsModalVisible(true);
  };

  const handleDelete = (userId) => {
    setDeletingUserId(userId);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await userService.deleteUser(deletingUserId);
      messageApi.success("Đã chuyển người dùng vào thùng rác!");
      fetchUsers();
    } catch (error) {
      let errMsg =
        error.response?.data?.message || error.response?.data || "Lỗi khi xóa!";
      messageApi.error(errMsg);
    }
    setIsDeleteModalOpen(false);
    setDeletingUserId(null);
  };

  const handleRestore = async (userId) => {
    try {
      await userService.restoreUser(userId);
      messageApi.success("Khôi phục tài khoản thành công!");
      fetchUsers();
    } catch (error) {
      messageApi.error(error.response?.data?.message || "Lỗi khi khôi phục!");
    }
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          if (editingUser) {
            await userService.updateUser(editingUser.maNguoiDung, values);
            messageApi.success("Cập nhật thành công!");
          } else {
            await userService.createUser(values);
            messageApi.success("Tạo người dùng mới thành công!");
          }
          setIsModalVisible(false);
          fetchUsers();
        } catch (error) {
          const errorMessage =
            error.response?.data?.message ||
            error.response?.data ||
            "Có lỗi xảy ra!";
          if (
            errorMessage.toLowerCase().includes("duplicate") ||
            errorMessage.toLowerCase().includes("tồn tại")
          ) {
            messageApi.error("Tên đăng nhập đã tồn tại!");
          } else {
            messageApi.error(errorMessage);
          }
        }
      })
      .catch(() => {});
  };

  const handleGrantPermission = async (userId, permId, permName) => {
    try {
      await userService.grantPermission(userId, permId);
      messageApi.success(`Đã cấp quyền '${permName}'`);
      fetchUsers();
    } catch (error) {
      messageApi.error("Không thể cấp quyền");
    }
  };

  const handleRevokePermission = async (userId, permId, permName) => {
    try {
      await userService.revokePermission(userId, permId);
      messageApi.success(`Đã thu hồi quyền '${permName}'`);
      fetchUsers();
    } catch (error) {
      messageApi.error("Không thể thu hồi quyền");
    }
  };

  const createPermissionMenu = (userRecord) => {
    const userPerms = userRecord.dsQuyenSoHuu || [];
    const renderPermItem = (perm) => {
      const hasPermission = userPerms.includes(perm.id);
      if (hasPermission) {
        return {
          key: `revoke-${perm.id}`,
          label: <span style={{ color: "red" }}>Thu hồi: {perm.name}</span>,
          onClick: () =>
            handleRevokePermission(userRecord.maNguoiDung, perm.id, perm.name),
        };
      } else {
        return {
          key: `grant-${perm.id}`,
          label: <span style={{ color: "green" }}>Cấp: {perm.name}</span>,
          onClick: () =>
            handleGrantPermission(userRecord.maNguoiDung, perm.id, perm.name),
        };
      }
    };

    const items = permissionGroups.map((group) => {
      if (group.children) {
        return {
          key: group.key,
          label: <b>{group.label}</b>,
          children: group.children.map((subGroup, idx) => ({
            key: `${group.key}_sub_${idx}`,
            label: subGroup.label,
            children: subGroup.perms.map(renderPermItem),
          })),
        };
      }
      if (group.perms) {
        return {
          key: group.key,
          label: <b>{group.label}</b>,
          children: group.perms.map(renderPermItem),
        };
      }
      return null;
    });

    return { items };
  };

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  const columns = [
    {
      title: "Họ Tên",
      dataIndex: "hoTen",
      key: "hoTen",
      width: 180,
      fixed: screens.md ? "left" : null, // Ghim trái trên PC
    },
    {
      title: "Tên Đăng Nhập",
      dataIndex: "tenDangNhap",
      key: "tenDangNhap",
      width: 150,
    },
    { title: "Email", dataIndex: "email", key: "email", width: 200 },
    { title: "SĐT", dataIndex: "sdt", key: "sdt", width: 120 },
    {
      title: "Vai Trò",
      dataIndex: "tenVaiTro",
      key: "tenVaiTro",
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Trạng thái",
      key: "status",
      align: "center",
      width: 130,
      render: (_, record) => {
        const val = record.trangThai ?? record.TrangThai;
        const isActive = val === true || val === 1 || val === "1";
        return isActive ? (
          <Tag color="green"> Hoạt động</Tag>
        ) : (
          <Tag color="red"> Đã khóa/Xóa</Tag>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 150,
      align: "center",
      fixed: screens.md ? "right" : null, // Ghim phải trên PC
      render: (_, record) => (
        <Space
          size="small"
          wrap
        >
          {inTrashMode ? (
            <Tooltip title="Khôi phục tài khoản">
              <Button
                type="primary"
                ghost
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleRestore(record.maNguoiDung)}
              />
            </Tooltip>
          ) : (
            <>
              {canEdit && (
                <Tooltip title="Sửa thông tin">
                  <Button
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleEdit(record)}
                  />
                </Tooltip>
              )}

              {canDelete && (
                <Tooltip title="Xóa tài khoản">
                  <Button
                    icon={<DeleteOutlined />}
                    danger
                    size="small"
                    onClick={() => handleDelete(record.maNguoiDung)}
                  />
                </Tooltip>
              )}

              {canManagePerms && (
                <Dropdown
                  menu={createPermissionMenu(record)}
                  placement="bottomRight"
                  trigger={["click"]}
                >
                  <Tooltip title="Phân quyền">
                    <Button
                      icon={<SettingOutlined />}
                      size="small"
                    />
                  </Tooltip>
                </Dropdown>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 10px" }}>
      {contextHolder}

      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        {/* RESPONSIVE HEADER */}
        <Row
          gutter={[16, 16]}
          align="middle"
        >
          <Col
            xs={24}
            md={12}
          >
            {inTrashMode ? (
              <h3 style={{ margin: 0, color: "#ff4d4f" }}>
                <RestOutlined /> Thùng rác (Tài khoản đã xóa)
              </h3>
            ) : (
              <Space>
                {canCreate && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleOpenModal}
                  >
                    Thêm người dùng mới
                  </Button>
                )}
              </Space>
            )}
          </Col>

          <Col
            xs={24}
            md={12}
            style={{ textAlign: screens.md ? "right" : "left" }}
          >
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchUsers()}
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
                <Button
                  icon={<RestOutlined />}
                  danger
                  onClick={() => setInTrashMode(true)}
                >
                  Thùng rác
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        className="fixed-height-table"
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="maNguoiDung"
        pagination={{ pageSize: 5 }}
        // [QUAN TRỌNG] Cho phép cuộn ngang
        scroll={{ x: 1000 }}
        size={screens.md ? "middle" : "small"}
      />

      {/* MODAL FORM (Responsive Width) */}
      <Modal
        title={editingUser ? "Sửa người dùng" : "Tạo người dùng mới"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={screens.md ? 600 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          name="userForm"
        >
          <Row gutter={16}>
            <Col
              xs={24}
              md={12}
            >
              <Form.Item
                name="tenDangNhap"
                label="Tên Đăng Nhập"
                rules={[{ required: true,message:"Nhập tên đăng nhập" }]}
              >
                <Input disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              md={12}
            >
              <Form.Item
                name="hoTen"
                label="Họ Tên"
                rules={[{ required: true,message:"Nhập họ tên" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col
              xs={24}
              md={12}
            >
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: "email",message:"Nhập tên email" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              md={12}
            >
              <Form.Item
                name="sdt"
                label="Số Điện Thoại"
                rules={[{ required: true,message:"Nhập số điện thoại" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col
              xs={24}
              md={12}
            >
              <Form.Item
                name="maVaiTro"
                label="Vai Trò"
                rules={[{ required: true,message:"Chọn vai trò" }]}
              >
                <Select placeholder="Chọn một vai trò">
                  {danhSachVaiTro.map((vt) => (
                    <Option
                      key={vt.MaVaiTro}
                      value={vt.MaVaiTro}
                    >
                      {vt.TenVaiTro}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            {!editingUser && (
              <Col
                xs={24}
                md={12}
              >
                <Form.Item
                  name="matKhau"
                  label="Mật Khẩu"
                  rules={[{ required: true,message:"Nhập mật khẩu" }]}
                >
                  <Input.Password />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>

      {/* MODAL XÓA */}
      <Modal
        title="Xác nhận xóa"
        open={isDeleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText="Xóa"
        cancelText="Hủy"
        okType="danger"
      >
        <p>Bạn có chắc muốn xóa người dùng này?</p>
        <p style={{ fontSize: 12, color: "#888" }}>
          Tài khoản sẽ bị vô hiệu hóa và chuyển vào thùng rác.
        </p>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
