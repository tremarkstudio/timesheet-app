// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  // Optional: add default headers, timeout, etc.
  // timeout: 10000,
  // headers: { 'Content-Type': 'application/json' },
});

export default api;