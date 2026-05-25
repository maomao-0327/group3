import initSqlJs, { Database } from "sql.js";
import * as fs from "fs";
import * as path from "path";

let db: Database | null = null;
const dbPath = path.join(process.cwd(), "classroom_match.db");

export function getDb(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
}

export async function initializeDatabase() {
  const SQL = await initSqlJs();

  // ファイルが存在すればそれを読み込み、なければ新規作成
  let data: Buffer | undefined;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }

  db = new SQL.Database(data);

  // テーブル作成
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      nickname TEXT NOT NULL,
      games TEXT NOT NULL,
      availability TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      building TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      availableSlots TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      professorId TEXT NOT NULL,
      roomId TEXT NOT NULL,
      slot TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (professorId) REFERENCES users(id),
      FOREIGN KEY (roomId) REFERENCES rooms(id)
    );
  `);

  saveDatabase();
  console.log(`Database initialized at ${dbPath}`);
}

export function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}
