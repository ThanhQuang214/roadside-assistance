import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import './index.css';
import { AuthProvider, RequireRole } from './auth/session.tsx';
import LoginPage from './auth/LoginPage.tsx';
import RegisterPage from './auth/RegisterPage.tsx';
import AccountPage from './auth/AccountPage.tsx';
import CompanyManagePage from './company-management/CompanyManagePage.tsx';
import CompanyApprovalPage from './company-management/CompanyApprovalPage.tsx';
import UiKitPage from './shared/ui/UiKitPage.tsx';
import { NetworkBanner } from './shared/ui/feedback.tsx';

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
        <NetworkBanner />
        <Routes>
          <Route path="/" element={<RequireRole roles={['USER']}><Home /></RequireRole>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<RequireRole><AccountPage /></RequireRole>} />
          <Route path="/company" element={<RequireRole roles={['COMPANY']}><CompanyManagePage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={['ADMIN']}><CompanyApprovalPage /></RequireRole>} />
          <Route path="/ui-kit" element={<UiKitPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
