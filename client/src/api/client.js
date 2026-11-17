import axios from "axios";
import config from "../component/config/config";

const api = axios.create({
  baseURL: config.API_ROOT,
  withCredentials: true,
});

let accessToken = null;
let refreshRequest = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const refreshAccessToken = () => {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(
        `${config.API_ROOT}/api/v1/auth/refresh`,
        {},
        { withCredentials: true, timeout: 10000 },
      )
      .then((response) => {
        const session = response.data.data;
        setAccessToken(session.accessToken);
        return session;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
};

api.interceptors.request.use((request) => {
  if (accessToken) {
    request.headers.Authorization = `Bearer ${accessToken}`;
  }
  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isAuthEndpoint =
      request?.url &&
      /\/api\/v1\/auth\/(login|register|refresh|logout)(?:\?|$)/.test(
        request.url,
      );

    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      const session = await refreshAccessToken();
      request.headers.Authorization = `Bearer ${session.accessToken}`;
      return api(request);
    } catch (refreshError) {
      if (refreshError.response?.status === 401) {
        setAccessToken(null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:expired"));
        }
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
