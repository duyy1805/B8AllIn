import api from './axios';

export const getDepartments = async (keyword = '') => {
  const { data } = await api.get('/master/departments', { params: { keyword } });
  return data.data;
};

export const getUsers = async (params = {}) => {
  const { data } = await api.get('/master/users', { params });
  return data.data;
};

export const getDocumentTypes = async () => {
  const { data } = await api.get('/master/document-types');
  return data.data;
};
