// Phiên đăng nhập phía client: lưu token, gọi API kèm token, chặn route theo vai trò. Module khác dùng:
//   apiFetch('/rescue-requests')        – tự gắn Authorization, ném ApiError theo định dạng lỗi chung
//   const { user } = useAuth()
//   <RequireRole roles={['COMPANY']}>…</RequireRole>
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from './auth-validation.ts';

export type User = { id: number; email: string; phone: string; fullName: string; role: Role; createdAt: string };

export const ROLE_LABEL: Record<Role, string> = { USER: 'Người gặp sự cố', COMPANY: 'Công ty cứu hộ', ADMIN: 'Quản trị viên' };
/** Trang chính của từng vai trò sau khi đăng nhập (UC02: "vào đúng giao diện theo vai trò"). */
export const HOME_BY_ROLE: Record<Role, string> = { USER: '/', COMPANY: '/company', ADMIN: '/admin' };

const TOKEN_KEY = 'token';

export class ApiError extends Error {
  status: number;
  code: string;
  field?: string;
  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  let r: Response;
  try {
    r = await fetch('/api' + path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không thể kết nối máy chủ, vui lòng thử lại.');
  }
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && token) { // token hết hạn → về trang đăng nhập
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign('/login');
    }
    const e = data.error ?? {};
    throw new ApiError(r.status, e.code ?? 'INTERNAL_ERROR', e.message ?? 'Lỗi máy chủ, vui lòng thử lại', e.details?.field);
  }
  return data;
}

type Session = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<User>;
  logout(): void;
};

const SessionContext = createContext<Session | null>(null);
export const useAuth = () => useContext(SessionContext)!;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ user: null as User | null, loading: !!localStorage.getItem(TOKEN_KEY) });

  async function reload() {
    const d = await apiFetch('/auth/me');
    setState({ user: d.user, loading: false });
    return d.user as User;
  }
  useEffect(() => {
    if (state.loading) reload().catch(() => setState({ user: null, loading: false }));
  }, []);

  const session: Session = {
    ...state,
    async login(email, password) {
      const d = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(TOKEN_KEY, d.token);
      return reload();
    },
    logout() {
      localStorage.removeItem(TOKEN_KEY);
      setState({ user: null, loading: false });
    },
  };
  return <SessionContext value={session}>{children}</SessionContext>;
}

/** Chưa đăng nhập → /login; sai vai trò → trang chính của vai trò đó. Bỏ `roles` = mọi vai trò đã đăng nhập. */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-4 text-text-sub">Đang tải…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}
