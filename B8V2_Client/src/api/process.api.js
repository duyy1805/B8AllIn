import api from './axios';

export const getProcesses = async (params = {}) => {
  const { data } = await api.get('/processes', { params });
  return data.data;
};

export const createProcess = async (payload) => {
  const { data } = await api.post('/processes', payload);
  return data.data;
};

export const getProcessDetail = async (id) => {
  const { data } = await api.get(`/processes/${id}`);
  return data.data;
};

export const createProcessVersion = async (processId, payload) => {
  const { data } = await api.post(`/processes/${processId}/versions`, payload);
  return data.data;
};

export const getProcessVersionDetail = async (id) => {
  const { data } = await api.get(`/process-versions/${id}`);
  return data.data;
};

export const submitProcessVersion = async (id) => {
  const { data } = await api.post(`/process-versions/${id}/submit`);
  return data.data;
};

export const reviewProcessVersion = async (id) => {
  const { data } = await api.post(`/process-versions/${id}/review`);
  return data.data;
};

export const publishProcessVersion = async (id) => {
  const { data } = await api.post(`/process-versions/${id}/publish`);
  return data.data;
};

export const assignProcessAudience = async (id, payload) => {
  const { data } = await api.post(`/process-versions/${id}/audiences`, payload);
  return data.data;
};

export const removeProcessAudience = async (id, departmentId) => {
  const { data } = await api.delete(`/process-versions/${id}/audiences/${departmentId}`);
  return data.data;
};

export const markProcessViewed = async (id) => {
  const { data } = await api.post(`/process-versions/${id}/view`);
  return data.data;
};

export const acknowledgeProcess = async (id) => {
  const { data } = await api.post(`/process-versions/${id}/acknowledge`);
  return data.data;
};

export const getMyProcessDocuments = async (params = {}) => {
  const { data } = await api.get('/processes/my-documents', { params });
  return data.data;
};
