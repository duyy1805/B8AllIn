import api from './axios';

export const getRoles = async () => {
  const { data } = await api.get('/roles');
  return data.data;
};

export const getUserRoles = async (userId) => {
  const { data } = await api.get(`/roles/users/${userId}`);
  return data.data;
};

export const assignUserRole = async (userId, roleCode) => {
  const { data } = await api.post(`/roles/users/${userId}`, { roleCode });
  return data.data;
};

export const removeUserRole = async (userId, roleCode) => {
  const { data } = await api.delete(`/roles/users/${userId}/${roleCode}`);
  return data.data;
};
