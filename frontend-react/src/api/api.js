import axios from "axios";

const api = axios.create({
  baseURL: "/", // uses the proxy to hit your backend
});

export default api;
