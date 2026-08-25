import api from './axios';

export const getDashboard = async () => {
  const { data } = await api.get('/dashboard');
  return data.data;
};
