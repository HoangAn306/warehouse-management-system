// src/services/dashboard.service.js

import api from "./api";

const DASHBOARD_ENDPOINT = "/dashboard";
const REPORT_ENDPOINT = "/baocao";

// 1. Lấy số liệu tổng quan (Stats)

export const getStats = (params) => {
  return api.get(`${DASHBOARD_ENDPOINT}/stats`, { params });
};

// 2. Lấy dữ liệu biểu đồ (Chart)

export const getChartData = (year) => {
  return api.get(`${DASHBOARD_ENDPOINT}/chart`, { 
    params: { year } 
  });
};

// 3. Lấy Top sản phẩm
export const getTopProducts = (params) => {
  return api.get(`${DASHBOARD_ENDPOINT}/top-products`, { params });
};

// 4. Lấy cảnh báo tồn kho (Alerts)
export const getAlerts = () => {
  return api.get(`${DASHBOARD_ENDPOINT}/alerts`);
};

// 5. Báo cáo NXT chi tiết (Dành cho trang Báo cáo hoặc modal xem nhanh)
export const getNXTReport = (params) => {
  return api.get(`${REPORT_ENDPOINT}/nxt-chitiet`, { params });
};