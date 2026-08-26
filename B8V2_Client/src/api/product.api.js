import api from './axios';

export const getProducts = async (params = {}) => (await api.get('/products', { params })).data.data;
export const getProductDetail = async id => (await api.get(`/products/${id}/detail`)).data.data;
export const upsertProduct = async payload => (await api.post('/products/upsert', payload)).data.data;
export const updateProduct = async (id, payload) => (await api.put(`/products/${id}`, payload)).data.data;
export const deleteProduct = async id => (await api.delete(`/products/${id}`)).data.data;
export const restoreProduct = async id => (await api.post(`/products/${id}/restore`)).data.data;

export const getProductDocuments = async (params = {}) => (await api.get('/product-documents', { params })).data.data;
export const getProductDocumentDetail = async id => (await api.get(`/product-documents/${id}`)).data.data;
export const createProductDocument = async payload => (await api.post('/product-documents', payload)).data.data;
export const updateProductDocument = async (id, payload) => (await api.put(`/product-documents/${id}`, payload)).data.data;
export const deleteProductDocument = async id => (await api.delete(`/product-documents/${id}`)).data.data;
export const restoreProductDocument = async id => (await api.post(`/product-documents/${id}/restore`)).data.data;
export const mapProductDocument = async (id, payload) => (await api.post(`/product-documents/${id}/itemcodes`, payload)).data.data;
export const unmapProductDocument = async (id, itemCode) => (await api.delete(`/product-documents/${id}/itemcodes/${encodeURIComponent(itemCode)}`)).data.data;
export const createProductDocumentVersion = async (id, payload) => (await api.post(`/product-documents/${id}/versions`, payload)).data.data;

export const getProductDocumentVersionDetail = async id => (await api.get(`/product-document-versions/${id}`)).data.data;
export const updateProductDocumentVersion = async (id, payload) => (await api.put(`/product-document-versions/${id}`, payload)).data.data;
export const deleteProductDocumentVersion = async id => (await api.delete(`/product-document-versions/${id}`)).data.data;
export const restoreProductDocumentVersion = async id => (await api.post(`/product-document-versions/${id}/restore`)).data.data;
