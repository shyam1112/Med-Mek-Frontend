import axios from 'axios';

// In local dev this stays '/api', proxied to localhost:5000 by CRA's dev
// server (see package.json "proxy"). In production the backend lives on a
// different domain entirely (api.thecartnova.com/medmek-api), so the real
// build sets REACT_APP_API_URL — see .env.production.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
