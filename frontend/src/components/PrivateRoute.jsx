// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { checkPermission, getUserInfo } from '../utils/auth'; 
import ForbiddenPage from '../pages/403'; 

// Component nhận vào 2 tham số:
// 1. children: Nội dung trang web (Ví dụ: <Dashboard />)
// 2. permId: Mã quyền yêu cầu (Ví dụ: 130)
const PrivateRoute = ({ children, permId }) => {
  const user = getUserInfo(); // Kiểm tra xem đã đăng nhập chưa

  // TH1: Chưa đăng nhập -> Đá về Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // TH2: Đã đăng nhập nhưng KHÔNG CÓ QUYỀN -> Hiện trang 403
  // (Chỉ kiểm tra nếu permId được truyền vào)
  if (permId && !checkPermission(permId)) {
    return <ForbiddenPage />; 
  }

  // TH3: Thỏa mãn tất cả -> Cho hiển thị trang web
  return children;
};

export default PrivateRoute;