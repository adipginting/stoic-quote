import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Database = require('better-sqlite3');

export type SqliteDatabase = Database.Database;

export const SQLITE_DB = 'SQLITE_DB';

export function createDatabase(): SqliteDatabase {
  const file =
    process.env.SQLITE_PATH ?? path.join(process.cwd(), '.data', 'stoic.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS favourites (
      visitor_id TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (visitor_id, quote_id)
    );

    CREATE TABLE IF NOT EXISTS explanations (
      quote_id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      prompt_version INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      quote_id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      photo_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);

  return db;
}

@Injectable()
export class DatabaseLifecycle implements OnModuleDestroy {
  constructor(@Inject(SQLITE_DB) private readonly db: SqliteDatabase) {}

  onModuleDestroy(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
}
