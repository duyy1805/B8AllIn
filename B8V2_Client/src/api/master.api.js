import api from './axios';

export const getDepartments = async (keyword = '') => {
  const { data } = await api.get('/master/departments', { params: { keyword } });
  return data.data;
};

export const getUsers = async (params = {}) => {
  const { data } = await api.get('/master/users', { params });
  return data.data;
};

export const updateUserEmail = async (userId, email) => {
  const { data } = await api.patch(`/master/users/${userId}/email`, { email });
  return data.data;
};

export const getDocumentTypes = async () => {
  const { data } = await api.get('/master/document-types');
  return data.data;
};

export const getAdminDocumentTypes = async () => {
  const { data } = await api.get('/master/document-types/admin');
  return data.data;
};

export const createDocumentType = async payload => {
  const { data } = await api.post('/master/document-types', payload);
  return data.data;
};

export const updateDocumentType = async (id, payload) => {
  const { data } = await api.put(`/master/document-types/${id}`, payload);
  return data.data;
};

export const setDocumentTypeActive = async (id, isActive) => {
  const { data } = await api.patch(`/master/document-types/${id}/active`, { isActive });
  return data.data;
};
