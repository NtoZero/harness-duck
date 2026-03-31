// ClaudeTeam — SQLite Session Store
// 메시지 히스토리, 에이전트 설정, 팀 프리셋 영속화

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type {
  AgentConfig,
  AgentState,
  ChatMessage,
  AppSettings,
  TeamPreset,
  AgentCreateInput,
} from '../shared/types';

const DATA_DIR = path.join(os.homedir(), '.claudeteam');
const DB_PATH = path.join(DATA_DIR, 'data.db');

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? DB_PATH;
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  // ─── Migrations ───

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    const current = this.db
      .prepare('SELECT MAX(version) as v FROM schema_version')
      .get() as { v: number | null };
    const currentVersion = current?.v ?? 0;

    if (currentVersion < 1) {
      this.db.exec(`
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          working_directory TEXT NOT NULL,
          role TEXT NOT NULL,
          model TEXT NOT NULL DEFAULT 'sonnet',
          channel_port INTEGER NOT NULL DEFAULT 0,
          auto_approve_patterns TEXT,  -- JSON array
          shared_doc_paths TEXT,       -- JSON array
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          recipients TEXT NOT NULL,     -- JSON array
          content TEXT NOT NULL,
          files TEXT NOT NULL DEFAULT '[]', -- JSON array
          type TEXT NOT NULL CHECK(type IN ('request','response','broadcast')),
          conversation_depth INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX idx_messages_created_at ON messages(created_at);

        CREATE TABLE team_presets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          agents_json TEXT NOT NULL,    -- JSON array of AgentCreateInput
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          requester TEXT NOT NULL,
          action TEXT NOT NULL,
          target TEXT NOT NULL,
          allowed INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_audit_created ON audit_log(created_at);

        INSERT INTO schema_version (version) VALUES (1);
      `);
    }
  }

  // ─── Agent CRUD ───

  saveAgent(config: AgentConfig): void {
    this.db.prepare(`
      INSERT INTO agents (id, name, working_directory, role, model, channel_port, auto_approve_patterns, shared_doc_paths)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        working_directory = excluded.working_directory,
        role = excluded.role,
        model = excluded.model,
        channel_port = excluded.channel_port,
        auto_approve_patterns = excluded.auto_approve_patterns,
        shared_doc_paths = excluded.shared_doc_paths,
        updated_at = datetime('now')
    `).run(
      config.id,
      config.name,
      config.workingDirectory,
      config.role,
      config.model,
      config.channelPort,
      JSON.stringify(config.autoApprovePatterns ?? []),
      JSON.stringify(config.sharedDocPaths ?? []),
    );
  }

  getAgent(id: string): AgentConfig | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    return row ? this.rowToAgentConfig(row) : null;
  }

  getAgentByName(name: string): AgentConfig | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE name = ?').get(name) as any;
    return row ? this.rowToAgentConfig(row) : null;
  }

  getAllAgents(): AgentConfig[] {
    const rows = this.db.prepare('SELECT * FROM agents ORDER BY name').all() as any[];
    return rows.map((r) => this.rowToAgentConfig(r));
  }

  deleteAgent(id: string): void {
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  }

  private rowToAgentConfig(row: any): AgentConfig {
    return {
      id: row.id,
      name: row.name,
      workingDirectory: row.working_directory,
      role: row.role,
      model: row.model,
      channelPort: row.channel_port,
      autoApprovePatterns: JSON.parse(row.auto_approve_patterns || '[]'),
      sharedDocPaths: JSON.parse(row.shared_doc_paths || '[]'),
    };
  }

  // ─── Messages ───

  saveMessage(msg: ChatMessage): void {
    this.db.prepare(`
      INSERT INTO messages (id, chat_id, sender, recipients, content, files, type, conversation_depth, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.chatId,
      msg.from,
      JSON.stringify(msg.to),
      msg.content,
      JSON.stringify(msg.files),
      msg.type,
      msg.conversationDepth,
      msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    );
  }

  getMessages(limit = 50, chatId?: string): ChatMessage[] {
    let query = 'SELECT * FROM messages';
    const params: any[] = [];
    if (chatId) {
      query += ' WHERE chat_id = ?';
      params.push(chatId);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.reverse().map((r) => this.rowToMessage(r));
  }

  getMessagesByChatId(chatId: string): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at')
      .all(chatId) as any[];
    return rows.map((r) => this.rowToMessage(r));
  }

  private rowToMessage(row: any): ChatMessage {
    return {
      id: row.id,
      chatId: row.chat_id,
      from: row.sender,
      to: JSON.parse(row.recipients),
      content: row.content,
      files: JSON.parse(row.files),
      type: row.type,
      timestamp: new Date(row.created_at),
      conversationDepth: row.conversation_depth,
    };
  }

  // ─── Team Presets ───

  savePreset(preset: TeamPreset): void {
    this.db.prepare(`
      INSERT INTO team_presets (id, name, agents_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        agents_json = excluded.agents_json
    `).run(
      preset.id,
      preset.name,
      JSON.stringify(preset.agents),
      preset.createdAt instanceof Date ? preset.createdAt.toISOString() : preset.createdAt,
    );
  }

  getPresets(): TeamPreset[] {
    const rows = this.db
      .prepare('SELECT * FROM team_presets ORDER BY created_at DESC')
      .all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      agents: JSON.parse(r.agents_json) as AgentCreateInput[],
      createdAt: new Date(r.created_at),
    }));
  }

  deletePreset(id: string): void {
    this.db.prepare('DELETE FROM team_presets WHERE id = ?').run(id);
  }

  // ─── Settings ───

  getSetting<T>(key: string, defaultValue: T): T {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  }

  setSetting(key: string, value: unknown): void {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  }

  getAppSettings(): AppSettings {
    return this.getSetting<AppSettings>('app_settings', {
      theme: 'system',
      language: 'ko',
      defaultModel: 'sonnet',
      routerPort: 7632,
      maxConversationDepth: 5,
      tokenWarningThreshold: 100000,
      writeScope: 'own_repo',
      killAllShortcut: 'CmdOrCtrl+Shift+K',
      teamPresets: [],
      sharedDocPaths: [],
      allowedReadPaths: [],
    });
  }

  saveAppSettings(settings: AppSettings): void {
    this.setSetting('app_settings', settings);
  }

  // ─── Audit Log ───

  logAudit(requester: string, action: string, target: string, allowed: boolean): void {
    this.db.prepare(`
      INSERT INTO audit_log (requester, action, target, allowed)
      VALUES (?, ?, ?, ?)
    `).run(requester, action, target, allowed ? 1 : 0);
  }

  getAuditLog(limit = 100): Array<{
    requester: string;
    action: string;
    target: string;
    allowed: boolean;
    createdAt: Date;
  }> {
    const rows = this.db
      .prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      requester: r.requester,
      action: r.action,
      target: r.target,
      allowed: r.allowed === 1,
      createdAt: new Date(r.created_at),
    }));
  }

  // ─── Cleanup ───

  close(): void {
    this.db.close();
  }
}
