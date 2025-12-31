// src/services/phieuxuat.service.js

import api from "./api";

const API_ENDPOINT = "/phieuxuat";

// 1. Lấy tất cả phiếu xuất
export const getAllPhieuXuat = () => {
  return api.get(API_ENDPOINT);
};

// 2. Tạo phiếu xuất mới
export const createPhieuXuat = (data) => {
  return api.post(API_ENDPOINT, data);
};

// 3. Cập nhật phiếu xuất
export const updatePhieuXuat = (id, data) => {
  return api.put(`${API_ENDPOINT}/${id}`, data);
};

// 4. Xóa phiếu xuất
export const deletePhieuXuat = (id) => {
  return api.delete(`${API_ENDPOINT}/${id}`);
};

// 5. Duyệt phiếu xuất (POST)
export const approvePhieuXuat = (id) => {
  return api.post(`${API_ENDPOINT}/${id}/approve`);
};

// 6. Hủy phiếu xuất (POST)
export const rejectPhieuXuat = (id) => {
  return api.post(`${API_ENDPOINT}/${id}/cancel`);
};

export const getPhieuXuatById = (id) => {
  return api.get(`${API_ENDPOINT}/${id}`);
};

export const filterPhieuXuat = (data) => {
  return api.post(`${API_ENDPOINT}/filter`, data);
};

export const createPhieuXuatGiangVien = (data) => {
  return api.post(`${API_ENDPOINT}/giangvien/create`, data);
};
export const printPhieuXuat = (id) => {
  return api.get(`${API_ENDPOINT}/${id}/print`, { responseType: "blob" });
};