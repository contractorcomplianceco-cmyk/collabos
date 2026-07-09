import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  setAuthTokenGetter,
  ApiError,
  type UserProfile,
} from "@workspace/api-client-react";

const TOKEN_KEY = "roseos_auth_token";

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

export type AuthStatus = "loading" | "anon" | "authed";

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStatus("anon");
      return;
    }
    getCurrentUser()
      .then((u) => {
        setUser(u);
        setStatus("authed");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setStatus("anon");
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const session = await apiLogin({ email, password });
      localStorage.setItem(TOKEN_KEY, session.token);
      setUser(session.user);
      setStatus("authed");
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: string } | undefined;
        throw new Error(data?.message ?? "Login failed");
      }
      throw new Error("Could not reach the sign-in service");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // session may already be gone; still clear locally
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setStatus("anon");
  }, []);

  const permissions = user?.permissions ?? [];
  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const refreshUser = useCallback((next: UserProfile) => {
    setUser(next);
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, permissions, hasPermission, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
