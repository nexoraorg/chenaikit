import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import axios from "axios";

export interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (
    email: string,
    password: string,
    rememberMe: boolean,
  ) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_TOKEN_KEY = "chenaikit_refresh_token";
const REMEMBER_ME_KEY = "chenaikit_remember_me";

// Helper to decode JWT without external dependencies
const decodeJwt = (token: string): User | null => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const decoded = JSON.parse(jsonPayload);
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || "user",
    };
  } catch (e) {
    return null;
  }
};

// Helper to get token expiration time in ms
const getJwtExpiration = (token: string): number | null => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(base64));
    return decoded.exp ? decoded.exp * 1000 : null; // exp is in seconds
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshingPromiseRef = useRef<Promise<string> | null>(null);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Set tokens and user session
  const setSession = useCallback(
    (newAccessToken: string, newRefreshToken: string, rememberMe: boolean) => {
      setAccessToken(newAccessToken);
      const decodedUser = decodeJwt(newAccessToken);
      setUser(decodedUser);

      if (rememberMe) {
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
        localStorage.setItem(REMEMBER_ME_KEY, "true");
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      // Schedule token refresh
      const exp = getJwtExpiration(newAccessToken);
      if (exp) {
        const delay = exp - Date.now() - 60000; // refresh 1 minute before expiry
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        if (delay > 0) {
          refreshTimeoutRef.current = setTimeout(() => {
            triggerRefresh();
          }, delay);
        }
      }
    },
    [],
  );

  // Clear session / logout
  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    setError(null);
  }, []);

  // Refresh token request handler
  const triggerRefresh = useCallback(async (): Promise<string> => {
    // If a refresh is already in progress, return the existing promise
    if (refreshingPromiseRef.current) {
      return refreshingPromiseRef.current;
    }

    const currentRefreshToken =
      localStorage.getItem(REFRESH_TOKEN_KEY) ||
      sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";

    if (!currentRefreshToken) {
      logout();
      return Promise.reject(new Error("No refresh token available"));
    }

    const refreshPromise = async () => {
      try {
        const response = await axios.post("/api/auth/refresh", {
          token: currentRefreshToken,
        });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data;
        // In backend, refreshToken might be rotated (so returned). If not, we keep the current one.
        const rotatedToken = newRefreshToken || currentRefreshToken;
        setSession(newAccessToken, rotatedToken, rememberMe);
        return newAccessToken;
      } catch (err) {
        logout();
        throw err;
      } finally {
        refreshingPromiseRef.current = null;
      }
    };

    refreshingPromiseRef.current = refreshPromise();
    return refreshingPromiseRef.current;
  }, [logout, setSession]);

  // Login handler
  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.post("/api/auth/login", {
          email,
          password,
        });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data;
        setSession(newAccessToken, newRefreshToken, rememberMe);
      } catch (err: any) {
        const errMsg =
          err.response?.data?.message ||
          "Login failed. Please verify your credentials.";
        setError(errMsg);
        throw new Error(errMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [setSession],
  );

  // Register handler
  const register = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await axios.post("/api/auth/register", { email, password });
      // Registration is successful. Wait for email verification or log them in automatically if the backend returns tokens
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        "Registration failed. Please check the entered data.";
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const hasRefreshToken = !!(
        localStorage.getItem(REFRESH_TOKEN_KEY) ||
        sessionStorage.getItem(REFRESH_TOKEN_KEY)
      );
      if (hasRefreshToken) {
        try {
          await triggerRefresh();
        } catch {
          // Silent failure on startup refresh
        }
      }
      setIsLoading(false);
    };

    initializeAuth();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [triggerRefresh]);

  // Axios Interceptors for Auth Headers & Token Refreshing
  useEffect(() => {
    // Request interceptor: add authorization header
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (accessToken && config.headers && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor: automatically refresh expired access token
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (err) => {
        const originalRequest = err.config;
        // Check if error is unauthorized (401 or 403) and request hasn't been retried yet
        if (
          err.response &&
          (err.response.status === 401 || err.response.status === 403) &&
          !originalRequest._retry &&
          !originalRequest.url.includes("/api/auth/login") &&
          !originalRequest.url.includes("/api/auth/refresh")
        ) {
          originalRequest._retry = true;
          try {
            const newAccessToken = await triggerRefresh();
            // Retry request with new token
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return axios(originalRequest);
          } catch (refreshErr) {
            return Promise.reject(refreshErr);
          }
        }
        return Promise.reject(err);
      },
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [accessToken, triggerRefresh]);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
