import axios from 'axios';

const api = api.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

export default api;
