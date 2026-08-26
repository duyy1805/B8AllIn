import api from './axios';

export const getProcesses = async (params = {}) => {
  const { data } = await api.get('/processes', { params });
  return data.data;
};

export const createProcess = async (payload) => {
  const { data } = await api.post('/processes', payload);
  return data.data;
};

export const updateProcess = async (id, payload) => {
  const { data } = await api.put(`/processes/${id}`, payload);
  return data.data;
};

export const deleteProcess = async (id) => {
  const { data } = await api.delete(`/processes/${id}`);
  return data.data;
};

export const restoreProcess = async (id) => {
  const { data } = await api.post(`/processes/${id}/restore`);
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

export const updateProcessVersion = async (id, payload) => {
  const { data } = await api.put(`/process-versions/${id}`, payload);
  return data.data;
};

export const deleteProcessVersion = async (id) => {
  const { data } = await api.delete(`/process-versions/${id}`);
  return data.data;
};

export const restoreProcessVersion = async (id) => {
  const { data } = await api.post(`/process-versions/${id}/restore`);
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

export const getMyProcessDocuments = async (params = {}) => {
  const { data } = await api.get('/processes/my-documents', { params });
  return data.data;
};

export const getMyAssignedProcessVersions = async (processId) => {
  const { data } = await api.get(`/processes/${processId}/my-versions`);
  return data.data;
};

export const getProcessTrainingConfirmation = async (id) => {
  const { data } = await api.get(`/process-versions/${id}/training-confirmation`);
  return data.data;
};

export const confirmProcessTraining = async (id, { files, comment }) => {
  const form = new FormData();
  files.forEach(file => form.append('files', file));
  if (comment) form.append('comment', comment);
  const { data } = await api.post(`/process-versions/${id}/training-confirmations`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  });
  return data.data;
};

export const getProcessDepartmentProgress = async (id) => {
  const { data } = await api.get(`/process-versions/${id}/department-progress`);
  return data.data;
};

export const deleteProcessTrainingEvidence = async (evidenceId) => {
  const { data } = await api.delete(`/process-training-evidence/${evidenceId}`);
  return data.data;
};
