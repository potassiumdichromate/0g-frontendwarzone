const DEFAULT_API_ORIGIN = 'https://zerog-warzonewarriors.onrender.com';

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || DEFAULT_API_ORIGIN;
export const API_BASE_URL = API_ORIGIN;

export const buildApiUrl = (path = '') => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
