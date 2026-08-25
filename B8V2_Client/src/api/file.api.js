import api from './axios';

export const uploadFile = async (file) => {
  const form = new FormData();
  form.append('file', file);

  const { data } = await api.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.data;
};

export const attachProcessFile = async (versionId, fileId, fileRole = 'PDF') => {
  const { data } = await api.post(
    `/files/process-version/${versionId}/${fileId}`,
    { fileRole }
  );
  return data.data;
};
