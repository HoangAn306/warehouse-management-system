// src/services/transfer.service.js
import api from "./api";

const API_ENDPOINT = "/dieuchuyen";

export const getAllTransfers = () => {
  return api.get(API_ENDPOINT);
};

export const getTransferById = (id) => {
  return api.get(`${API_ENDPOINT}/${id}`);
};

export const createTransfer = (data) => {
  return api.post(API_ENDPOINT, data);
};

export const deleteTransfer = (id) => {
  return api.delete(`${API_ENDPOINT}/${id}`);
};

export const approveTransfer = (id) => {
  return api.post(`${API_ENDPOINT}/${id}/approve`);
};

export const rejectTransfer = (id) => {
  return api.post(`${API_ENDPOINT}/${id}/cancel`);
};
export const updateTransfer = (id, data) => {
  return api.put(`${API_ENDPOINT}/${id}`, data);
};
export const filterTransfers = (data) => {
  return api.post(`${API_ENDPOINT}/filter`, data);
};
export const printTransfer = (id) => {
  return api.get(`${API_ENDPOINT}/${id}/print`, { responseType: "blob" });
};