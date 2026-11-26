import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './index.css';
import { AuthProvider, RequireRole } from './auth/session.tsx';
import LoginPage from './auth/LoginPage.tsx';
import RegisterPage from './auth/RegisterPage.tsx';
import AccountPage from './auth/AccountPage.tsx';
import CompanyManagePage from './company-management/CompanyManagePage.tsx';
import CompanyApprovalPage from './company-management/CompanyApprovalPage.tsx';
import RescueHomePage from './rescue-request/RescueHomePage.tsx';
import CreateRequestPage from './rescue-request/CreateRequestPage.tsx';
import TrackRequestPage from './rescue-request/TrackRequestPage.tsx';
import DispatchPage from './rescue-request/DispatchPage.tsx';
import UiKitPage from './shared/ui/UiKitPage.tsx';
import { NetworkBanner } from './shared/ui/feedback.tsx';

// Mỗi module thêm <Route> của mình vào đây (1 dòng/route), trang nằm trong thư mục module.
// Trang cần đăng nhập bọc trong <RequireRole roles={[...]}>.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NetworkBanner />
        <Routes>
          <Route path="/" element={<RequireRole roles={['USER']}><RescueHomePage /></RequireRole>} />
          <Route path="/requests/new" element={<RequireRole roles={['USER']}><CreateRequestPage /></RequireRole>} />
          <Route path="/requests/:id" element={<RequireRole roles={['USER']}><TrackRequestPage /></RequireRole>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<RequireRole><AccountPage /></RequireRole>} />
          <Route path="/company" element={<RequireRole roles={['COMPANY']}><CompanyManagePage /></RequireRole>} />
          <Route path="/company/dispatch" element={<RequireRole roles={['COMPANY']}><DispatchPage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={['ADMIN']}><CompanyApprovalPage /></RequireRole>} />
          <Route path="/ui-kit" element={<UiKitPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
