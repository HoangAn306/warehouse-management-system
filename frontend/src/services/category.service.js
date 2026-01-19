// src/services/category.service.js
import api from "./api"; // Import cấu hình Axios (đã có base URL và Token)

const API_ENDPOINT = "/loaihang"; // Đường dẫn gốc của API loại hàng
// 1. Lấy danh sách tất cả loại hàng (đang hoạt động)
export const getAllCategories = () => {
  return api.get(API_ENDPOINT);
};
// 2. Tạo mới một loại hàng
export const createCategory = (data) => {
  return api.post(API_ENDPOINT, data);
};
// 3. Cập nhật thông tin loại hàng
export const updateCategory = (id, data) => {
  return api.put(`${API_ENDPOINT}/${id}`, data);
};
// 4. Xóa mềm loại hàng (Chuyển vào thùng rác)
export const deleteCategory = (id) => {
  return api.delete(`${API_ENDPOINT}/${id}`);
};
// 5. Lấy danh sách loại hàng trong thùng rác (đã bị xóa mềm)
export const getTrashCategories = () => {
  return api.get(`${API_ENDPOINT}/trash`);
};
// 6. Khôi phục loại hàng từ thùng rác
export const restoreCategory = (id) => {
  return api.put(`${API_ENDPOINT}/${id}/restore`);
};
