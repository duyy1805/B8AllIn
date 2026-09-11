import api from './axios';

export const getDepartmentMailRecipients = async departmentId => {
  const { data } = await api.get(`/notifications/departments/${departmentId}/recipients`);
  return data.data;
};
export const setDepartmentMailRecipients = async (departmentId, userIds) => {
  const { data } = await api.put(`/notifications/departments/${departmentId}/recipients`, { userIds });
  return data.data;
};
export const getMailDeliveries = async (params = {}) => {
  const { data } = await api.get('/notifications/deliveries', { params });
  return data.data;
};
export const resendMailDelivery = async deliveryId => {
  const { data } = await api.post(`/notifications/deliveries/${deliveryId}/resend`);
  return data.data;
};
