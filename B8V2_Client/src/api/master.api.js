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

export const getProductCustomers = async () => (await api.get('/master/product-customers')).data.data;

export const getProductCustomerTemplates = async customerCode => (await api.get('/master/product-customer-templates', { params: { customerCode } })).data.data;

export const updateProductCustomerTemplate = async (customerCode, documentTypeIds) =>
  (await api.put(`/master/product-customer-templates/${customerCode}`, { documentTypeIds })).data.data;

export const getDocumentTypeDefaultAudience = async documentTypeId =>
  (await api.get(`/master/document-types/${documentTypeId}/default-audience`)).data.data;

export const getProductionProcesses = async (includeInactive = false) =>
  (await api.get('/master/production-processes', { params: { includeInactive } })).data.data;

export const createProductionProcess = async payload => (await api.post('/master/production-processes', payload)).data.data;

export const updateProductionProcess = async (id, payload) => (await api.put(`/master/production-processes/${id}`, payload)).data.data;

export const setProductionProcessActive = async (id, isActive) =>
  (await api.patch(`/master/production-processes/${id}/active`, { isActive })).data.data;
