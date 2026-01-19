// src/utils/auth.js

// 1. Hàm lấy User từ LocalStorage
export const getUserInfo = () => {
  const storedUser = localStorage.getItem("user_info");
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser);
  } catch {
    return null;
  }
};

// 2. Hàm kiểm tra quyền chính (Trả về True/False)
export const checkPermission = (requiredPermId) => {
  const user = getUserInfo();
  if (!user) return false; // Chưa đăng nhập -> False

  // Lấy data user (xử lý trường hợp object lồng nhau)
  const userData = user.quyen && !Array.isArray(user.quyen) ? user.quyen : user;
  
  // Nếu là ADMIN -> Luôn đúng (return true)
  const role = (userData.vaiTro || userData.tenVaiTro || "").toUpperCase();
  if (role === "ADMIN") return true;

  // Nếu không yêu cầu quyền gì (requiredPermId = null) -> return true
  if (!requiredPermId) return true;

  // Lấy danh sách quyền sở hữu của user
  let rawPerms = userData.dsQuyenSoHuu || userData.quyen || [];
  if (!Array.isArray(rawPerms)) rawPerms = [];

  // Ép kiểu về số nguyên (để so sánh chính xác)
  const userPerms = rawPerms.map(p => 
    (typeof p === 'object' && p !== null) ? parseInt(p.maQuyen || p.id) : parseInt(p)
  );

  // Kiểm tra xem quyền yêu cầu có trong danh sách không
  return userPerms.includes(parseInt(requiredPermId));
};