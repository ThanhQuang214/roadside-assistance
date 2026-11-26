import express from 'express';
import { getDb } from './shared/db.ts';
import { errorHandler } from './shared/http.ts';
import { authRouter } from './auth/auth.api.ts';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Danh mục cố định (seed trong schema.sql) – dùng chung cho mọi module.
app.get('/api/catalog/service-types', (_req, res) => {
  res.json({ items: getDb().prepare('SELECT id, code, name FROM service_types ORDER BY id').all() });
});
app.get('/api/catalog/vehicle-types', (_req, res) => {
  res.json({ items: getDb().prepare('SELECT id, code, name FROM vehicle_types ORDER BY id').all() });
});

// Mỗi module mount router của mình tại đây (1 dòng/module), ví dụ:
app.use('/api', authRouter);                          // M2 – src/auth (/auth/*, /uploads)
// app.use('/api/rescue-requests', rescueRouter);     // M2 + M3 – src/rescue-request
// app.use('/api/companies', companyRouter);          // M3 – src/company-management
// app.use('/api/admin', adminRouter);                // M3 – src/company-management
// app.use('/api', matchingAiRouter);                 // M1 – src/matching-ai
// app.use('/api', feedbackChatRouter);               // M2 + M4 – src/feedback-chat

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API' } });
});
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API: http://localhost:${port}`));
