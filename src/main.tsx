import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import './index.css';
import { AuthProvider, RequireRole } from './auth/session.tsx';
import LoginPage from './auth/LoginPage.tsx';
import RegisterPage from './auth/RegisterPage.tsx';
import AccountPage from './auth/AccountPage.tsx';

// Mỗi module thêm <Route> của mình vào đây (1 dòng/route), trang nằm trong thư mục module.
// Trang cần đăng nhập bọc trong <RequireRole roles={[...]}>.
function Home() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold text-primary">Hệ thống hỗ trợ sự cố xe trên đường</h1>
      <Link to="/account" className="text-primary">Tài khoản</Link>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RequireRole roles={['USER']}><Home /></RequireRole>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<RequireRole><AccountPage /></RequireRole>} />
          {/* M3 thay element bằng trang chính của Công ty / Admin */}
          <Route path="/company" element={<RequireRole roles={['COMPANY']}><AccountPage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AccountPage /></RequireRole>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
