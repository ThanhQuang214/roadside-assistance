import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './index.css';

// Mỗi module thêm <Route> của mình vào đây (1 dòng/route), trang nằm trong thư mục module.
function Home() {
  return <h1 className="p-4 text-2xl font-bold text-primary">Hệ thống hỗ trợ sự cố xe trên đường</h1>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
