import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const schema = readFileSync(new URL('../../docs/contracts/schema.sql', import.meta.url), 'utf8');

/** Mở CSDL SQLite và áp schema (idempotent). Dùng ':memory:' cho test. */
export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(schema);
  return db;
}

let instance: DatabaseSync | undefined;

/** CSDL dùng chung cho toàn bộ server. Các module gọi getDb() thay vì tự mở kết nối. */
export function getDb(): DatabaseSync {
  return (instance ??= openDb(process.env.DB_PATH ?? 'data/app.db'));
}
