export const API_BASE_URL = typeof window !== 'undefined' && window.location.port === '4200'
  ? 'http://localhost:5025/api/v1'
  : '/api/v1';
