// src/services/phieunhap.service.js

import api from "./api"; 


const API_ENDPOINT = "/phieunhap";

// 1. Lấy tất cả phiếu nhập
export const getAllPhieuNhap = () => {
  return api.get(API_ENDPOINT);
};

// 2. Tạo phiếu nhập mới 
export const createPhieuNhap = (phieuNhapData) => {
  return api.post(API_ENDPOINT, phieuNhapData);
};
// 3. Xóa phiếu nhập
export const deletePhieuNhap = (phieuNhapId) => {
  return api.delete(`${API_ENDPOINT}/${phieuNhapId}`);
};
// 4. Cập nhật phiếu nhập
export const updatePhieuNhap = (phieuNhapId, updateData) => {
  return api.put(`${API_ENDPOINT}/${phieuNhapId}`, updateData);
};

// 5. Duyệt phiếu
export const approvePhieuNhap = (phieuNhapId) => {
  return api.post(`${API_ENDPOINT}/${phieuNhapId}/approve`);
};

// 6. Hủy phiếu
export const rejectPhieuNhap = (phieuNhapId) => {
  return api.post(`${API_ENDPOINT}/${phieuNhapId}/cancel`);
};
// 7. Lấy chi tiết một phiếu
export const getPhieuNhapById = (id) => {
  return api.get(`${API_ENDPOINT}/${id}`);
};
// 8. Chức năng Lọc & Tìm kiếm nâng cao
export const filterPhieuNhap = (data) => {
  return api.post(`${API_ENDPOINT}/filter`, data);
};
// 9. In phiếu nhập
export const printPhieuNhap = (id) => {
  return api.get(`${API_ENDPOINT}/${id}/print`, { responseType: "blob" });
};