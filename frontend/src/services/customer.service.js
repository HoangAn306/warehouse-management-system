// src/services/customer.service.js

import api from "./api";// Import axios

const API_ENDPOINT = "/khachhang";// Đường dẫn gốc

// 1. Lấy danh sách tất cả khách hàng
export const getAllCustomers = () => {
  return api.get(API_ENDPOINT);
};

// 2. Tạo khách hàng mới
export const createCustomer = (data) => {
  return api.post(API_ENDPOINT, data);
};

// 3. Cập nhật khách hàng
export const updateCustomer = (id, data) => {
  return api.put(`${API_ENDPOINT}/${id}`, data);
};

// 4. Xóa khách hàng
export const deleteCustomer = (id) => {
  return api.delete(`${API_ENDPOINT}/${id}`);
};
// 5. Tìm kiếm khách hàng
export const searchCustomers = (keyword) => {
  return api.get(`${API_ENDPOINT}/search`, {
    params: { query: keyword } 
  });
};
// 6. Lấy danh sách khách hàng trong thùng rác
export const getTrashCustomers = () => {
  return api.get(`${API_ENDPOINT}/trash`);
};
// 7. Khôi phục khách hàng từ thùng rác
export const restoreCustomer = (id) => {
  return api.put(`${API_ENDPOINT}/${id}/restore`);
};