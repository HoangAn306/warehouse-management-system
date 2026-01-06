// src/pages/SupplierPage/index.jsx

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
  Tooltip,
  //Tag,
  Grid, // [1] Import Grid để kiểm tra kích thước màn hình
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  RestOutlined,
  UndoOutlined,
  ArrowLeftOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import * as supplierService from "../../services/supplier.service";

// --- CẤU HÌNH ID QUYỀN (NHÀ CUNG CẤP) ---
const PERM_VIEW = 60; // Xem danh sách
const PERM_CREATE = 61; // Tạo mới
const PERM_EDIT = 62; // Cập nhật
const PERM_DELETE = 63; // Xóa (kiêm Khôi phục / Thùng rác)

const SupplierPage = () => {
  // [2] Hook kiểm tra màn hình
  // screens.lg = true (>= 992px) -> Máy tính. False -> Mobile/Tablet.
  const screens = Grid.useBreakpoint();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  // State: Đang ở chế độ xem thùng rác hay không?
  const [inTrashMode, setInTrashMode] = useState(false);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // State Quyền hạn
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- 1. LẤY DỮ LIỆU ---
  const fetchSuppliers = useCallback(
    async (searchKey = "") => {
      setLoading(true);
      try {
        let response;

        if (inTrashMode) {
          // A. Nếu đang ở THÙNG RÁC
          response = await supplierService.getTrashSuppliers();
        } else {
          // B. Nếu đang ở DANH SÁCH CHÍNH
          if (searchKey) {
            response = await supplierService.searchSuppliers(searchKey);
          } else {
            response = await supplierService.getAllSuppliers();
          }
        }

        // Xử lý dữ liệu trả về
        let rawData = [];
        if (Array.isArray(response.data)) {
          rawData = response.data;
        } else if (response.data && Array.isArray(response.data.content)) {
          rawData = response.data.content;
        }

        setSuppliers(rawData);
      } catch (error) {
        // console.error("Lỗi tải dữ liệu:", error);
        messageApi.error("Không thể tải danh sách!");
      }
      setLoading(false);
    },
    [messageApi, inTrashMode]
  );

  // --- 2. KHỞI TẠO & PHÂN QUYỀN (QUAN TRỌNG) ---
  useEffect(() => {
    const storedUser = localStorage.getItem("user_info");
    if (storedUser) {
      try {
        let user = JSON.parse(storedUser);
        // Fix lỗi cấu trúc user bị lồng
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

        // Chuyển quyền về dạng số nguyên
        const parsedPerms = rawPerms.map((p) => {
          if (typeof p === "object" && p !== null)
            return parseInt(p.maQuyen || p.id);
          return parseInt(p);
        });

        // [!] LƯU QUYỀN VÀO STATE
        setPermissions(parsedPerms);

        // Check quyền Xem (ID 60)
        const hasViewPerm = parsedPerms.includes(PERM_VIEW);

        if (roleName === "ADMIN" || hasViewPerm) {
          fetchSuppliers(keyword);
        } else {
          setLoading(false);
        }
      } catch (e) {
        setPermissions([]);
      }
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTrashMode]); // Re-fetch khi chế độ thùng rác thay đổi

  // Hàm check quyền nhanh
  const checkPerm = (id) => isAdmin || permissions.includes(id);

  // --- HANDLERS ---
  const handleSearch = () => fetchSuppliers(keyword);

  const handleReload = () => {
    setKeyword("");
    fetchSuppliers("");
  };

  const handleRestore = async (record) => {
    try {
      setLoading(true);
      await supplierService.restoreSupplier(record.maNCC);
      messageApi.success("Khôi phục thành công!");
      fetchSuppliers();
    } catch (error) {
      messageApi.error("Lỗi khi khôi phục!");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (record) => {
    setDeletingRecord(record);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return;
    try {
      await supplierService.deleteSupplier(deletingRecord.maNCC);
      messageApi.success("Đã chuyển vào thùng rác!");
      fetchSuppliers(keyword);
    } catch (error) {
      messageApi.error("Lỗi khi xóa!");
    }
    setIsDeleteModalOpen(false);
    setDeletingRecord(null);
  };

  const handleOpenModal = () => {
    setEditingSupplier(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingSupplier(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          if (editingSupplier) {
            await supplierService.updateSupplier(editingSupplier.maNCC, values);
            messageApi.success("Cập nhật thành công!");
          } else {
            await supplierService.createSupplier(values);
            messageApi.success("Tạo mới thành công!");
          }
          setIsModalVisible(false);
          fetchSuppliers(keyword);
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

  // --- [3] CẤU HÌNH CỘT RESPONSIVE ---
  // Logic: screens.lg (PC) thì ghim cột. Mobile thì thả lỏng.
  const columns = [
    {
      title: "Mã",
      dataIndex: "maNCC",
      width: 80,
      align: "center",
      // Ghim trái trên PC
      fixed: screens.lg ? "left" : null,
    },
    {
      title: "Tên NCC",
      dataIndex: "tenNCC",
      key: "tenNCC",
      width: 200,
      // Ghim trái trên PC
      fixed: screens.lg ? "left" : null,
      render: (t) => <b>{t}</b>,
    },
    {
      title: "Người Liên Hệ",
      dataIndex: "nguoiLienHe",
      key: "nguoiLienHe",
      width: 150,
    },
    {
      title: "SĐT",
      dataIndex: "sdt",
      key: "sdt",
      width: 120,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 180,
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
      width: 150,
      // Ghim phải trên PC
      fixed: screens.lg ? "right" : null,
      render: (_, record) => {
        // [CHECK QUYỀN]
        const allowEdit = checkPerm(PERM_EDIT); // 62
        const allowDelete = checkPerm(PERM_DELETE); // 63

        return (
          <Space size="small">
            {inTrashMode ? (
              // 1. TRONG THÙNG RÁC: Chỉ hiện Khôi phục (Cần quyền Xóa 63)
              allowDelete && (
                <Tooltip title="Khôi phục hoạt động ">
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
              // 2. DANH SÁCH CHÍNH: Hiện Sửa (62) / Xóa (63)
              <>
                {allowEdit && (
                  <Tooltip title="Cập nhật ">
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    />
                  </Tooltip>
                )}

                {allowDelete && (
                  <Tooltip title="Xóa tạm thời ">
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => handleDeleteClick(record)}
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

  // Chặn truy cập nếu không có quyền Xem (60)
  if (!loading && permissions.length > 0 && !checkPerm(PERM_VIEW)) {
    return (
      <Card style={{ margin: 20, textAlign: "center" }}>
        <h2 style={{ color: "red" }}>Truy cập bị từ chối</h2>
        <p>Bạn không có quyền xem danh sách Nhà cung cấp.</p>
        <p>
          Vui lòng liên hệ Admin để cấp quyền mã: <b>{PERM_VIEW}</b>
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
          gutter={[16, 16]}
          align="middle"
          justify="space-between"
        >
          {/* Cụm tìm kiếm: Full width trên mobile */}
          <Col
            xs={24}
            md={12}
          >
            {!inTrashMode ? (
              <Space
                wrap
                style={{ width: "100%" }}
              >
                <Input
                  placeholder="Tìm kiếm NCC..."
                  prefix={<SearchOutlined />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={handleSearch}
                  // Responsive input width
                  style={{ width: screens.md ? 250 : "100%" }}
                />
                <Button
                  type="primary"
                  onClick={handleSearch}
                >
                  Tìm
                </Button>
                <Button
                  icon={<ClearOutlined />}
                  onClick={() => {
                    setKeyword("");
                    fetchSuppliers("");
                  }}
                >
                  Xóa tìm
                </Button>
              </Space>
            ) : (
              <h3 style={{ margin: 0, color: "#ff4d4f" }}>
                <RestOutlined /> Thùng rác
              </h3>
            )}
          </Col>

          {/* Cụm nút bấm: Full width trên mobile, canh phải trên PC */}
          <Col
            xs={24}
            md={12}
            style={{ textAlign: screens.md ? "right" : "left" }}
          >
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleReload}
              >
                Tải lại
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
                  {/* Nút vào Thùng rác (Cần quyền 63 hoặc Admin) */}
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

                  {/* Nút Thêm Mới (Cần quyền 61) */}
                  {checkPerm(PERM_CREATE) && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleOpenModal}
                    >
                      Thêm NCC Mới
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
        dataSource={suppliers}
        loading={loading}
        rowKey="maNCC"
        pagination={{ pageSize: 5, size: "small" }}
        // [QUAN TRỌNG] Cho phép cuộn ngang
        scroll={{ x: 1000 }}
        size="small"
      />
      {/* MODAL THÊM/SỬA */}
      <Modal
        title={editingSupplier ? "Sửa Nhà Cung Cấp" : "Thêm Nhà Cung Cấp"}
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
            name="tenNCC"
            label="Tên Nhà Cung Cấp"
            rules={[{ required: true, message: "Nhập tên nhà cung cấp" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="nguoiLienHe"
            label="Người Liên Hệ"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="sdt"
            label="Số Điện Thoại"
            rules={[{ required: true, message: "Nhập số điện thoại" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="diaChi"
            label="Địa Chỉ"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      {/* MODAL XÁA */}
      <Modal
        title="Xác nhận xóa"
        open={isDeleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText="Xóa"
        cancelText="Hủy"
        okType="danger"
      >
        <p>
          Bạn có chắc muốn xóa <b>{deletingRecord?.tenNCC}</b>?
        </p>
        <p style={{ fontSize: "12px", color: "#888" }}>
          Dữ liệu sẽ được chuyển vào thùng rác và có thể khôi phục sau này.
        </p>
      </Modal>
    </div>
  );
};

export default SupplierPage;
