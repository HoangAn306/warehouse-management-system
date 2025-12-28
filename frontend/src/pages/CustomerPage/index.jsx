// src/pages/CustomerPage/index.jsx

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
  Grid, // [1] Import Grid để kiểm tra kích thước màn hình
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  RestOutlined,
  UndoOutlined,
  ArrowLeftOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import * as customerService from "../../services/customer.service";

// --- CẤU HÌNH ID QUYỀN (KHÁCH HÀNG) ---
const PERM_VIEW = 90;
const PERM_CREATE = 91;
const PERM_EDIT = 92;
const PERM_DELETE = 93;

const CustomerPage = () => {
  // [2] Hook kiểm tra màn hình
  // screens.lg = true (>= 992px) -> Máy tính. False -> Mobile/Tablet.
  const screens = Grid.useBreakpoint();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // State: Chế độ Thùng rác
  const [inTrashMode, setInTrashMode] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // State Quyền hạn
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [keyword, setKeyword] = useState("");

  // 1. LẤY DỮ LIỆU
  const fetchCustomers = useCallback(
    async (searchKey = "") => {
      setLoading(true);
      try {
        let response;
        if (inTrashMode) {
          response = await customerService.getTrashCustomers();
        } else {
          if (searchKey) {
            response = await customerService.searchCustomers(searchKey);
          } else {
            response = await customerService.getAllCustomers();
          }
        }

        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.content || [];
        setCustomers(data);
      } catch (error) {
        messageApi.error("Không thể tải danh sách khách hàng!");
      }
      setLoading(false);
    },
    [messageApi, inTrashMode]
  );

  // 2. KHỞI TẠO & PHÂN QUYỀN
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
          // [SỬA LỖI TẠI ĐÂY]
          // Gọi không tham số để tải lại danh sách đầy đủ khi init hoặc đổi chế độ
          fetchCustomers(); 
        } else {
          setLoading(false);
        }
      } catch (e) {
        setPermissions([]);
      }
    } else {
      setLoading(false);
    }
    // [SỬA LỖI TẠI ĐÂY] Thêm fetchCustomers vào dependency
  }, [fetchCustomers]);

  const handleSearch = () => fetchCustomers(keyword);
  const handleReset = () => {
    setKeyword("");
    fetchCustomers("");
  };

  const checkPerm = (id) => isAdmin || permissions.includes(id);

  // --- HANDLERS MODAL ---
  const handleOpenModal = () => {
    setEditingCustomer(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingCustomer(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleRestore = async (record) => {
    try {
      await customerService.restoreCustomer(record.maKH);
      messageApi.success("Khôi phục thành công!");
      fetchCustomers();
    } catch (error) {
      messageApi.error(error.response?.data?.message || "Lỗi khi khôi phục!");
    }
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        const inputName = values.tenKH.trim().toLowerCase();
        const inputPhone = (values.sdt || "").trim();

        const isDuplicate = customers.some((kh) => {
          if (editingCustomer && kh.maKH === editingCustomer.maKH) return false;
          return (
            kh.tenKH.trim().toLowerCase() === inputName &&
            (kh.sdt || "").trim() === inputPhone
          );
        });

        if (isDuplicate) {
          messageApi.error(
            `Khách hàng "${values.tenKH}" - SĐT "${values.sdt}" đã tồn tại!`
          );
          return;
        }

        setSubmitLoading(true);
        try {
          if (editingCustomer) {
            await customerService.updateCustomer(editingCustomer.maKH, values);
            messageApi.success("Cập nhật thành công!");
          } else {
            await customerService.createCustomer(values);
            messageApi.success("Thêm mới thành công!");
          }
          setIsModalVisible(false);
          fetchCustomers(keyword);
        } catch (error) {
          messageApi.error(error.response?.data?.message || "Có lỗi xảy ra!");
        } finally {
          setSubmitLoading(false);
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
      await customerService.deleteCustomer(deletingId);
      messageApi.success("Đã chuyển vào thùng rác!");
      fetchCustomers(keyword);
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Lỗi khi xóa!";
      messageApi.error(errorMsg);
    }
    setIsDeleteModalOpen(false);
    setDeletingId(null);
  };

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  // Logic: screens.lg (PC) thì ghim cột. Mobile thì thả lỏng.
  const columns = [
    {
      title: "Tên Khách Hàng",
      dataIndex: "tenKH",
      width: 200,
      // Ghim trái trên PC
      fixed: screens.lg ? "left" : null,
      render: (t) => <b>{t}</b>,
    },
    { title: "SĐT", dataIndex: "sdt", width: 120 },
    { title: "Email", dataIndex: "email", width: 180 },
    { title: "Địa Chỉ", dataIndex: "diaChi", width: 200 },
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
      width: 150,
      align: "center",
      // Ghim phải trên PC
      fixed: screens.lg ? "right" : null,
      render: (_, record) => {
        const allowEdit = checkPerm(PERM_EDIT);
        const allowDelete = checkPerm(PERM_DELETE);

        return (
          <Space size="middle">
            {inTrashMode ? (
              allowDelete && (
                <Tooltip title="Khôi phục">
                  <Button
                    type="primary"
                    ghost
                    icon={<UndoOutlined />}
                    onClick={() => handleRestore(record)}
                  >
                    Khôi phục
                  </Button>
                </Tooltip>
              )
            ) : (
              <>
                {allowEdit && (
                  <Tooltip title="Sửa thông tin">
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    />
                  </Tooltip>
                )}
                {allowDelete && (
                  <Tooltip title="Xóa tạm thời">
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => handleDelete(record.maKH)}
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
        <p>Bạn không có quyền xem danh sách Khách hàng.</p>
        <p>
          Vui lòng liên hệ Admin để cấp quyền mã: <b>{PERM_VIEW}</b>
        </p>
      </Card>
    );
  }

  return (
    <div style={{ padding: "0 10px" }}> {/* Padding nhỏ cho mobile */}
      {contextHolder}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px" }}
      >
        <Row
          gutter={[16, 16]}
          align="middle"
          justify="space-between"
        >
          {/* Cụm tìm kiếm: Full width trên mobile */}
          <Col xs={24} md={12}>
            {inTrashMode ? (
              <h3 style={{ margin: 0, color: "#ff4d4f" }}>
                <RestOutlined /> Thùng rác
              </h3>
            ) : (
              <Input
                placeholder="Tìm kiếm theo tên hoặc SĐT..."
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                // Responsive width
                style={{ width: screens.md ? 400 : "100%" }}
              />
            )}
          </Col>
          
          {/* Cụm nút bấm: Full width trên mobile, canh phải trên PC */}
          <Col 
            xs={24} md={12} 
            style={{ textAlign: screens.md ? 'right' : 'left' }}
          >
            <Space wrap>
              {!inTrashMode && (
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                >
                  Tìm kiếm
                </Button>
              )}

              <Button
                icon={<ClearOutlined />}
                onClick={handleReset}
              >
                Xóa tìm
              </Button>

              {inTrashMode ? (
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => {
                    setInTrashMode(false);
                    setKeyword("");
                  }}
                >
                  Quay lại danh sách
                </Button>
              ) : (
                <>
                  {(isAdmin || checkPerm(PERM_DELETE)) && (
                    <Button
                      icon={<RestOutlined />}
                      danger
                      onClick={() => {
                        setInTrashMode(true);
                        setKeyword("");
                      }}
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
                      Thêm Khách Hàng
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
        dataSource={customers}
        loading={loading}
        rowKey="maKH"
        pagination={{ pageSize: 5, size: 'small' }}
        // [QUAN TRỌNG] Cho phép cuộn ngang
        scroll={{ x: 1000 }}
        size="small"
      />

      {/* MODAL THÊM/SỬA */}
      <Modal
        title={editingCustomer ? "Sửa Khách Hàng" : "Thêm Khách Hàng"}
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={submitLoading}
        onCancel={() => setIsModalVisible(false)}
        // Responsive width
        width={screens.md ? 600 : "100%"}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="tenKH"
            label="Tên Khách Hàng"
            rules={[{ required: true, message: "Vui lòng nhập Tên" }]}
          >
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item
            name="sdt"
            label="Số Điện Thoại"
            rules={[{ required: true, message: "Vui lòng nhập SĐT" }]}
          >
            <Input placeholder="Ví dụ: 0909..." />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email" }]}
          >
            <Input placeholder="Ví dụ: email@domain.com" />
          </Form.Item>
          <Form.Item
            name="diaChi"
            label="Địa Chỉ"
            rules={[{ required: true, message: "Vui lòng nhập Địa Chỉ" }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Ví dụ: TP.HCM..."
            />
          </Form.Item>
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
        <p>Bạn có chắc muốn xóa khách hàng này không?</p>
        <p style={{ fontSize: 12, color: "#888" }}>
          Dữ liệu sẽ được chuyển vào thùng rác.
        </p>
      </Modal>
    </div>
  );
};

export default CustomerPage;