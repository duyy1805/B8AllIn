import api from './axios';

export const getRoles = async (includeInactive = false) => {
  const { data } = await api.get('/roles', { params: { includeInactive } });
  return data.data;
};

export const createRole = async (payload) => {
  const { data } = await api.post('/roles', payload);
  return data.data;
};

export const updateRole = async (roleId, payload) => {
  const { data } = await api.put(`/roles/${roleId}`, payload);
  return data.data;
};

export const setRoleActive = async (roleId, isActive) => {
  const { data } = await api.patch(`/roles/${roleId}/active`, { isActive });
  return data.data;
};

export const deactivateRole = async (roleId) => {
  const { data } = await api.delete(`/roles/${roleId}`);
  return data.data;
};

export const getUserRoles = async (userId) => {
  const { data } = await api.get(`/roles/users/${userId}`);
  return data.data;
};

export const getPermissions = async () => {
  const { data } = await api.get('/roles/permissions');
  return data.data;
};

export const getRolePermissions = async (roleId) => {
  const { data } = await api.get(`/roles/${roleId}/permissions`);
  return data.data;
};

export const updateRolePermissions = async (roleId, permissionCodes) => {
  const { data } = await api.put(`/roles/${roleId}/permissions`, { permissionCodes });
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
