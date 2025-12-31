// src/services/phieunhap.service.js

import api from "./api"; // Import client API đã cấu hình

// [!] Đường dẫn API dựa trên Postman
const API_ENDPOINT = "/phieunhap";

// 1. Lấy tất cả phiếu nhập (cho bảng)
export const getAllPhieuNhap = () => {
  return api.get(API_ENDPOINT);
};

// 2. Tạo phiếu nhập mới (cho form)
export const createPhieuNhap = (phieuNhapData) => {
  // phieuNhapData sẽ có dạng { maNCC, maKho, chiTiet: [...] }
  return api.post(API_ENDPOINT, phieuNhapData);
};

export const deletePhieuNhap = (phieuNhapId) => {
  return api.delete(`${API_ENDPOINT}/${phieuNhapId}`);
};

export const updatePhieuNhap = (phieuNhapId, updateData) => {
  return api.put(`${API_ENDPOINT}/${phieuNhapId}`, updateData);
};


export const approvePhieuNhap = (phieuNhapId) => {
  return api.post(`${API_ENDPOINT}/${phieuNhapId}/approve`);
};


export const rejectPhieuNhap = (phieuNhapId) => {
  return api.post(`${API_ENDPOINT}/${phieuNhapId}/cancel`);
};

export const getPhieuNhapById = (id) => {
  return api.get(`${API_ENDPOINT}/${id}`);
};
export const filterPhieuNhap = (data) => {
  return api.post(`${API_ENDPOINT}/filter`, data);
};
export const printPhieuNhap = (id) => {
  return api.get(`${API_ENDPOINT}/${id}/print`, { responseType: "blob" });
};