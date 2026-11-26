// UC02 Đăng nhập – màn hình A-01 (docs/design/M2-tuan1-xac-thuc.md §3).
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { BTN_PRIMARY, CARD, Field } from './form.tsx';
import { HOME_BY_ROLE, useAuth } from './session.tsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from as string | undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(from ?? HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-title text-center">Đăng nhập</h1>
      <form onSubmit={onSubmit} className={`${CARD} flex flex-col gap-4`} noValidate>
        {error && <p role="alert" className="rounded-control bg-status-closed-bg p-3 text-body-sm text-status-closed-fg">{error}</p>}
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Mật khẩu" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={BTN_PRIMARY} disabled={busy || !email || !password}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <p className="text-center text-body-sm text-text-sub">
        Chưa có tài khoản? <Link to="/register" className="font-medium text-primary">Đăng ký</Link>
      </p>
    </main>
  );
}
