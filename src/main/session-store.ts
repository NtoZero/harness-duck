// ClaudeTeam — SQLite Session Store (sql.js — WebAssembly, no native build)
// 메시지 히스토리, 에이전트 설정, 팀 프리셋 영속화

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type {
  AgentConfig,
  ChatMessage,
  AppSettings,
  TeamPreset,
  AgentCreateInput,
  AutoApproveRule,
} from '../shared/types';

const DATA_DIR = path.join(os.homedir(), '.claudeteam');
const DB_PATH = path.join(DATA_DIR, 'data.db');

export class SessionStore {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private ready: Promise<void>;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DB_PATH;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');
    this.runMigrations();
    this.persist();
  }

  async waitReady(): Promise<void> {
    await this.ready;
  }

  private persist(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // ─── Migrations ───

  private runMigrations(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    const result = this.db.exec('SELECT MAX(version) as v FROM schema_version');
    const currentVersion = result.length > 0 && result[0].values.length > 0
      ? (result[0].values[0][0] as number | null) ?? 0
      : 0;

    if (currentVersion < 1) {
      this.db.run(`
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          working_directory TEXT NOT NULL,
          role TEXT NOT NULL,
          model TEXT NOT NULL DEFAULT 'sonnet',
          channel_port INTEGER NOT NULL DEFAULT 0,
          auto_approve_patterns TEXT,
          shared_doc_paths TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      this.db.run(`
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          recipients TEXT NOT NULL,
          content TEXT NOT NULL,
          files TEXT NOT NULL DEFAULT '[]',
          type TEXT NOT NULL CHECK(type IN ('request','response','broadcast')),
          conversation_depth INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      this.db.run('CREATE INDEX idx_messages_chat_id ON messages(chat_id)');
      this.db.run('CREATE INDEX idx_messages_created_at ON messages(created_at)');
      this.db.run(`
        CREATE TABLE team_presets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          agents_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      this.db.run(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      this.db.run(`
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          requester TEXT NOT NULL,
          action TEXT NOT NULL,
          target TEXT NOT NULL,
          allowed INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      this.db.run('CREATE INDEX idx_audit_created ON audit_log(created_at)');
      this.db.run('INSERT INTO schema_version (version) VALUES (1)');
    }

    if (currentVersion < 2) {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS auto_approve_rules (
          id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          pattern TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1
        );
      `);
      this.db.run('INSERT OR IGNORE INTO schema_version (version) VALUES (2)');
    }
  }

  // ─── Helpers ───

  private queryOne(sql: string, params: any[] = []): Record<string, any> | null {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row as Record<string, any>;
    }
    stmt.free();
    return null;
  }

  private queryAll(sql: string, params: any[] = []): Record<string, any>[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, any>);
    }
    stmt.free();
    return rows;
  }

  private execute(sql: string, params: any[] = []): void {
    this.db.run(sql, params);
    this.persist();
  }

  // ─── Agent CRUD ───

  saveAgent(config: AgentConfig): void {
    this.execute(`
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
    `, [
      config.id,
      config.name,
      config.workingDirectory,
      config.role,
      config.model,
      config.channelPort,
      JSON.stringify(config.autoApprovePatterns ?? []),
      JSON.stringify(config.sharedDocPaths ?? []),
    ]);
  }

  getAgent(id: string): AgentConfig | null {
    const row = this.queryOne('SELECT * FROM agents WHERE id = ?', [id]);
    return row ? this.rowToAgentConfig(row) : null;
  }

  getAgentByName(name: string): AgentConfig | null {
    const row = this.queryOne('SELECT * FROM agents WHERE name = ?', [name]);
    return row ? this.rowToAgentConfig(row) : null;
  }

  getAllAgents(): AgentConfig[] {
    return this.queryAll('SELECT * FROM agents ORDER BY name').map((r) => this.rowToAgentConfig(r));
  }

  deleteAgent(id: string): void {
    this.execute('DELETE FROM agents WHERE id = ?', [id]);
  }

  private rowToAgentConfig(row: Record<string, any>): AgentConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      workingDirectory: row.working_directory as string,
      role: row.role as string,
      model: row.model as 'sonnet' | 'opus',
      channelPort: row.channel_port as number,
      autoApprovePatterns: JSON.parse((row.auto_approve_patterns as string) || '[]'),
      sharedDocPaths: JSON.parse((row.shared_doc_paths as string) || '[]'),
    };
  }

  // ─── Messages ───

  saveMessage(msg: ChatMessage): void {
    this.execute(`
      INSERT INTO messages (id, chat_id, sender, recipients, content, files, type, conversation_depth, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      msg.id,
      msg.chatId,
      msg.from,
      JSON.stringify(msg.to),
      msg.content,
      JSON.stringify(msg.files),
      msg.type,
      msg.conversationDepth,
      msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    ]);
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

    return this.queryAll(query, params).reverse().map((r) => this.rowToMessage(r));
  }

  getMessagesByChatId(chatId: string): ChatMessage[] {
    return this.queryAll(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at',
      [chatId],
    ).map((r) => this.rowToMessage(r));
  }

  private rowToMessage(row: Record<string, any>): ChatMessage {
    return {
      id: row.id as string,
      chatId: row.chat_id as string,
      from: row.sender as string,
      to: JSON.parse(row.recipients as string),
      content: row.content as string,
      files: JSON.parse(row.files as string),
      type: row.type as ChatMessage['type'],
      timestamp: new Date(row.created_at as string),
      conversationDepth: row.conversation_depth as number,
    };
  }

  // ─── Team Presets ───

  savePreset(preset: TeamPreset): void {
    this.execute(`
      INSERT INTO team_presets (id, name, agents_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        agents_json = excluded.agents_json
    `, [
      preset.id,
      preset.name,
      JSON.stringify(preset.agents),
      preset.createdAt instanceof Date ? preset.createdAt.toISOString() : preset.createdAt,
    ]);
  }

  getPresets(): TeamPreset[] {
    return this.queryAll('SELECT * FROM team_presets ORDER BY created_at DESC').map((r) => ({
      id: r.id as string,
      name: r.name as string,
      agents: JSON.parse(r.agents_json as string) as AgentCreateInput[],
      createdAt: new Date(r.created_at as string),
    }));
  }

  deletePreset(id: string): void {
    this.execute('DELETE FROM team_presets WHERE id = ?', [id]);
  }

  // ─── Settings ───

  getSetting<T>(key: string, defaultValue: T): T {
    const row = this.queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value as string) as T;
    } catch {
      return defaultValue;
    }
  }

  setSetting(key: string, value: unknown): void {
    this.execute(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, JSON.stringify(value)]);
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
    this.execute(`
      INSERT INTO audit_log (requester, action, target, allowed)
      VALUES (?, ?, ?, ?)
    `, [requester, action, target, allowed ? 1 : 0]);
  }

  getAuditLog(limit = 100): Array<{
    requester: string;
    action: string;
    target: string;
    allowed: boolean;
    createdAt: Date;
  }> {
    return this.queryAll(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?',
      [limit],
    ).map((r) => ({
      requester: r.requester as string,
      action: r.action as string,
      target: r.target as string,
      allowed: r.allowed === 1,
      createdAt: new Date(r.created_at as string),
    }));
  }

  // ─── Auto Approve Rules ───

  saveAutoApproveRules(rules: AutoApproveRule[]): void {
    this.db.run('DELETE FROM auto_approve_rules');
    for (const rule of rules) {
      this.db.run(
        'INSERT INTO auto_approve_rules (id, agent_name, pattern, enabled) VALUES (?, ?, ?, ?)',
        [rule.id, rule.agentName, rule.pattern, rule.enabled ? 1 : 0],
      );
    }
    this.persist();
  }

  getAutoApproveRules(): AutoApproveRule[] {
    return this.queryAll('SELECT * FROM auto_approve_rules').map((r) => ({
      id: r.id as string,
      agentName: r.agent_name as string,
      pattern: r.pattern as string,
      enabled: r.enabled === 1,
    }));
  }

  // ─── Cleanup ───

  close(): void {
    this.persist();
    this.db.close();
  }
}
