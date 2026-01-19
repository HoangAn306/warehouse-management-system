// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp } from 'antd';

// Import Component
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import AdminLayout from './layouts/AdminLayout';
import ForbiddenPage from './pages/403'; 

// Import các trang chức năng
import UserManagementPage from './pages/UserManagement';
import ProfilePage from './pages/ProfilePage';
import PhieuNhapPage from './pages/PhieuNhapPage'; 
import ProductPage from './pages/ProductPage';
import WarehousePage from './pages/WarehousePage';
import SupplierPage from './pages/SupplierPage';
import PhieuXuatPage from './pages/PhieuXuatPage';
import CustomerPage from './pages/CustomerPage';
import SystemLogPage from './pages/SystemLogPage';
import ReportPage from './pages/ReportPage';
import TransferPage from './pages/TransferPage';
import CategoryPage from './pages/CategoryPage';

import 'antd/dist/reset.css';
import './App.css';

// --- CẤU HÌNH MÃ QUYỀN (Theo danh sách bạn cung cấp) ---
const PERM = {
  DASHBOARD: 130,      // 'PERM_DASHBOARD_VIEW'
  USER_VIEW: 14,       // 'PERM_ADMIN_VIEW_USERS'
  
  // PRODUCT_VIEW: 50, // -> Đã bỏ dòng này vì bạn muốn ai cũng xem được SP
  
  CATEGORY_VIEW: 140,  // 'PERM_CATEGORY_VIEW'
  IMPORT_VIEW: 26,     // 'PERM_PHIEUNHAP_VIEW'
  EXPORT_VIEW: 27,     // 'PERM_PHIEUXUAT_VIEW'
  CUSTOMER_VIEW: 90,   // 'PERM_CUSTOMER_VIEW'
  SUPPLIER_VIEW: 60,   // 'PERM_SUPPLIER_VIEW'
  WAREHOUSE_VIEW: 70,  // 'PERM_KHO_VIEW'
  REPORT_VIEW: 30,     // 'PERM_VIEW_REPORT' (Xem báo cáo tổng hợp)
  LOG_VIEW: 100,       // 'PERM_SYSTEM_LOG'
  TRANSFER_VIEW: 110   // 'PERM_TRANSFER_VIEW'
};

function App() {
  return (
    <AntApp>
      <Router>
        <Routes>
          {/* Route công khai */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          {/* Route cần bảo vệ (Phải đăng nhập) */}
          <Route element={<AdminLayout />}>
            
            {/* --- NHÓM 1: CHỈ CẦN ĐĂNG NHẬP (KHÔNG CẦN QUYỀN CỤ THỂ) --- */}
            
            {/* Hồ sơ cá nhân */}
            <Route 
              path="/HoSo" 
              element={
                <PrivateRoute> 
                  <ProfilePage /> 
                </PrivateRoute>
              } 
            />

            {/* [QUAN TRỌNG] Trang Sản phẩm: Không truyền permId -> Ai cũng xem được */}
            <Route 
              path="/SanPham" 
              element={
                <PrivateRoute> 
                  <ProductPage /> 
                </PrivateRoute>
              } 
            />

            {/* --- NHÓM 2: CẦN QUYỀN CỤ THỂ (CÓ permId) --- */}
            
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute permId={PERM.DASHBOARD}>
                  <Dashboard />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/QuanLyNguoiDung" 
              element={
                <PrivateRoute permId={PERM.USER_VIEW}>
                  <UserManagementPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/Nhap" 
              element={
                <PrivateRoute permId={PERM.IMPORT_VIEW}>
                  <PhieuNhapPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/Xuat" 
              element={
                <PrivateRoute permId={PERM.EXPORT_VIEW}>
                  <PhieuXuatPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/LoaiHang" 
              element={
                <PrivateRoute permId={PERM.CATEGORY_VIEW}>
                  <CategoryPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/Kho" 
              element={
                <PrivateRoute permId={PERM.WAREHOUSE_VIEW}>
                  <WarehousePage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/NhaCungCap" 
              element={
                <PrivateRoute permId={PERM.SUPPLIER_VIEW}>
                  <SupplierPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/KhachHang" 
              element={
                <PrivateRoute permId={PERM.CUSTOMER_VIEW}>
                  <CustomerPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/NhatKyHeThong" 
              element={
                <PrivateRoute permId={PERM.LOG_VIEW}>
                  <SystemLogPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/BaoCao" 
              element={
                <PrivateRoute permId={PERM.REPORT_VIEW}>
                  <ReportPage />
                </PrivateRoute>
              } 
            />

            <Route 
              path="/DieuChuyen" 
              element={
                <PrivateRoute permId={PERM.TRANSFER_VIEW}>
                  <TransferPage />
                </PrivateRoute>
              } 
            />

          </Route>

          {/* Route mặc định */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AntApp>
  );
}

export default App;