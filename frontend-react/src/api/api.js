import axios from "axios";

const api = axios.create({
  baseURL: "https://attendance-tracking-system-nu.vercel.app/", // uses the proxy to hit your backend
});

export default api;
