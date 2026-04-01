// ClaudeTeam — Agent Manager
// node-pty 기반 Claude Code 프로세스 라이프사이클 관리

import * as pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import type { AgentConfig, AgentState, ApprovalRequest, AutoApproveRule } from '../shared/types';
import type { SessionStore } from './session-store';
import type { MessageRouter } from './message-router';

interface ManagedAgent {
  config: AgentConfig;
  state: AgentState;
  ptyProcess: pty.IPty | null;
  channelProcess: ChildProcessLike | null;
  outputBuffer: string;
}

interface ChildProcessLike {
  pid?: number;
  kill: (signal?: string) => void;
}

interface PendingApproval {
  agentId: string;
  agentName: string;
  description: string;
  timestamp: Date;
}

// Patterns for detecting Claude Code approval prompts
const APPROVAL_PATTERN = /\[Y\/n\]/;
// Patterns for parsing token usage from Claude Code output
const TOKEN_USAGE_PATTERN = /Total tokens:\s*input\s*=\s*(\d+),\s*output\s*=\s*(\d+)/i;
const TOKEN_COST_PATTERN = /(?:Total cost|Cost):\s*\$[\d.]+\s*.*?(\d+)\s*input.*?(\d+)\s*output/i;

export class AgentManager extends EventEmitter {
  private agents = new Map<string, ManagedAgent>();
  private nextPort = 7700;
  private pendingApprovals = new Map<string, PendingApproval>();
  private autoApproveRules: AutoApproveRule[] = [];

  constructor(
    private store: SessionStore,
    private router: MessageRouter,
  ) {
    super();
    this.restoreAgents();
    this.autoApproveRules = this.store.getAutoApproveRules();
  }

  // ─── Agent Lifecycle ───

  async createAgent(input: {
    name: string;
    workingDirectory: string;
    role: string;
    model?: 'sonnet' | 'opus';
    autoApprovePatterns?: string[];
    sharedDocPaths?: string[];
  }): Promise<AgentConfig> {
    if (this.agents.has(input.name)) {
      throw new Error(`Agent "${input.name}" already exists`);
    }

    if (!fs.existsSync(input.workingDirectory)) {
      throw new Error(`Working directory does not exist: ${input.workingDirectory}`);
    }

    const config: AgentConfig = {
      id: uuid(),
      name: input.name,
      workingDirectory: input.workingDirectory,
      role: input.role,
      model: input.model ?? 'sonnet',
      channelPort: this.allocatePort(),
      autoApprovePatterns: input.autoApprovePatterns,
      sharedDocPaths: input.sharedDocPaths,
    };

    const state: AgentState = {
      id: config.id,
      name: config.name,
      workingDirectory: config.workingDirectory,
      status: 'idle',
      model: config.model,
      pid: undefined,
      channelPort: config.channelPort,
      tokenUsage: { input: 0, output: 0 },
      lastActivity: new Date(),
    };

    this.agents.set(config.name, { config, state, ptyProcess: null, channelProcess: null, outputBuffer: '' });
    this.store.saveAgent(config);
    this.emitStateUpdate(state);

    return config;
  }

  async startAgent(nameOrId: string): Promise<void> {
    const managed = this.findAgent(nameOrId);
    if (!managed) throw new Error(`Agent not found: ${nameOrId}`);
    if (managed.state.status === 'running') return;

    const { config } = managed;

    // 1. Generate CLAUDE.md with role and communication protocol
    this.generateClaudeMd(config);

    // 2. Register MCP channel server in .mcp.json
    this.registerChannelServer(config);

    // 3. Spawn Claude Code via node-pty
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh';
    const claudeCmd = `claude --dangerously-load-development-channels server:claudeteam-channel`;

    const ptyProcess = pty.spawn(shell, ['-c', claudeCmd], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: config.workingDirectory,
      env: {
        ...process.env,
        CLAUDETEAM_AGENT_NAME: config.name,
        CLAUDETEAM_ROUTER_PORT: String(this.store.getAppSettings().routerPort),
        CLAUDETEAM_CHANNEL_PORT: String(config.channelPort),
      },
    });

    managed.ptyProcess = ptyProcess;
    managed.state.pid = ptyProcess.pid;
    managed.state.status = 'running';
    managed.state.lastActivity = new Date();

    // Forward PTY data to renderer + detect approvals and token usage
    ptyProcess.onData((data) => {
      this.emit('terminal-data', { agentId: config.id, data });
      managed.state.lastActivity = new Date();
      this.processTerminalOutput(managed, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      managed.state.status = exitCode === 0 ? 'idle' : 'error';
      managed.state.pid = undefined;
      managed.ptyProcess = null;
      this.router.deregisterAgent(config.name);
      this.emitStateUpdate(managed.state);

      // Auto-restart on unexpected crash
      if (exitCode !== 0 && exitCode !== null) {
        setTimeout(() => {
          if (managed.state.status === 'error') {
            this.startAgent(config.name).catch(() => {});
          }
        }, 5000);
      }
    });

    // 4. Register with message router
    this.router.registerAgent(config.name, config.channelPort, config.workingDirectory);

    // 5. Emit state update
    this.emitStateUpdate(managed.state);
  }

  async stopAgent(nameOrId: string): Promise<void> {
    const managed = this.findAgent(nameOrId);
    if (!managed) throw new Error(`Agent not found: ${nameOrId}`);

    if (managed.ptyProcess) {
      managed.ptyProcess.kill();
      managed.ptyProcess = null;
    }

    if (managed.channelProcess) {
      managed.channelProcess.kill();
      managed.channelProcess = null;
    }

    managed.state.status = 'idle';
    managed.state.pid = undefined;
    this.router.deregisterAgent(managed.config.name);
    this.emitStateUpdate(managed.state);
  }

  async restartAgent(nameOrId: string): Promise<void> {
    await this.stopAgent(nameOrId);
    await new Promise((r) => setTimeout(r, 1000));
    await this.startAgent(nameOrId);
  }

  async killAll(): Promise<void> {
    this.router.emergencyStop();
    const promises = Array.from(this.agents.keys()).map((name) =>
      this.stopAgent(name).catch(() => {}),
    );
    await Promise.all(promises);
  }

  deleteAgent(nameOrId: string): void {
    const managed = this.findAgent(nameOrId);
    if (!managed) return;

    if (managed.state.status === 'running') {
      this.stopAgent(nameOrId).catch(() => {});
    }

    this.agents.delete(managed.config.name);
    this.store.deleteAgent(managed.config.id);
  }

  // ─── Terminal I/O ───

  writeToTerminal(agentId: string, data: string): void {
    const managed = this.findAgentById(agentId);
    if (managed?.ptyProcess) {
      managed.ptyProcess.write(data);
    }
  }

  resizeTerminal(agentId: string, cols: number, rows: number): void {
    const managed = this.findAgentById(agentId);
    if (managed?.ptyProcess) {
      managed.ptyProcess.resize(cols, rows);
    }
  }

  // ─── Approval System ───

  handleApprovalResponse(approvalId: string, approved: boolean): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      throw new Error(`No pending approval found: ${approvalId}`);
    }

    const managed = this.findAgentById(pending.agentId);
    if (!managed?.ptyProcess) {
      this.pendingApprovals.delete(approvalId);
      throw new Error(`Agent not running: ${pending.agentName}`);
    }

    // Send 'y' or 'n' to the terminal
    managed.ptyProcess.write(approved ? 'y\n' : 'n\n');

    // Restore agent state
    managed.state.status = 'running';
    this.emitStateUpdate(managed.state);

    // Log to audit
    this.store.logAudit('human', approved ? 'approve' : 'deny', pending.agentName, approved);

    this.pendingApprovals.delete(approvalId);
  }

  setAutoApproveRules(rules: AutoApproveRule[]): void {
    this.autoApproveRules = rules;
    this.store.saveAutoApproveRules(rules);
  }

  getAutoApproveRules(): AutoApproveRule[] {
    return this.autoApproveRules;
  }

  // ─── Query ───

  getAgentState(nameOrId: string): AgentState | null {
    const managed = this.findAgent(nameOrId);
    return managed?.state ?? null;
  }

  getAllAgentStates(): AgentState[] {
    return Array.from(this.agents.values()).map((m) => ({ ...m.state }));
  }

  // ─── Internal Helpers ───

  private findAgent(nameOrId: string): ManagedAgent | undefined {
    return (
      this.agents.get(nameOrId) ??
      Array.from(this.agents.values()).find((m) => m.config.id === nameOrId)
    );
  }

  private findAgentById(id: string): ManagedAgent | undefined {
    return Array.from(this.agents.values()).find((m) => m.config.id === id);
  }

  private allocatePort(): number {
    return this.nextPort++;
  }

  private restoreAgents(): void {
    const saved = this.store.getAllAgents();
    for (const config of saved) {
      const state: AgentState = {
        id: config.id,
        name: config.name,
        workingDirectory: config.workingDirectory,
        status: 'idle',
        model: config.model,
        channelPort: config.channelPort,
        tokenUsage: { input: 0, output: 0 },
        lastActivity: new Date(),
      };
      this.agents.set(config.name, { config, state, ptyProcess: null, channelProcess: null, outputBuffer: '' });
      if (config.channelPort >= this.nextPort) {
        this.nextPort = config.channelPort + 1;
      }
    }
  }

  private generateClaudeMd(config: AgentConfig): void {
    const allAgents = Array.from(this.agents.values());
    const teamList = allAgents
      .map((a) => {
        const marker = a.config.name === config.name ? ' (me)' : '';
        return `- ${a.config.name}${marker}: ${a.config.workingDirectory}`;
      })
      .join('\n');

    const sharedDocs = (config.sharedDocPaths ?? [])
      .map((p) => `- ${p}`)
      .join('\n');

    const content = `<!-- Auto-generated by ClaudeTeam. Restart agent after editing. -->

# Role

You are the "${config.name}" agent. ${config.role}

# Team

${teamList}

${sharedDocs ? `# Shared Documents\n\n${sharedDocs}\n` : ''}
# Communication Rules

1. Team chat messages arrive in <channel> tags.
2. Only respond to messages that @mention "${config.name}".
3. Always use the reply tool to respond.
4. If file paths are included, read and analyze those files directly.
5. Do not ask follow-up questions after responding (loop prevention).
`;

    const claudeMdPath = path.join(config.workingDirectory, 'CLAUDE.md');

    // Preserve existing CLAUDE.md by prepending
    let existingContent = '';
    if (fs.existsSync(claudeMdPath)) {
      const existing = fs.readFileSync(claudeMdPath, 'utf-8');
      // Strip previously injected ClaudeTeam section
      const marker = '<!-- Auto-generated by ClaudeTeam';
      const endMarker = '# Communication Rules';
      if (existing.includes(marker)) {
        const endIdx = existing.indexOf('\n', existing.indexOf('5. Do not ask follow-up'));
        existingContent = existing.substring(endIdx !== -1 ? endIdx + 1 : existing.length).trim();
      } else {
        existingContent = existing;
      }
    }

    const finalContent = existingContent
      ? `${content}\n---\n\n${existingContent}`
      : content;

    fs.writeFileSync(claudeMdPath, finalContent, 'utf-8');
  }

  private registerChannelServer(config: AgentConfig): void {
    const mcpJsonPath = path.join(config.workingDirectory, '.mcp.json');
    let mcpConfig: Record<string, any> = {};

    if (fs.existsSync(mcpJsonPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
      } catch {
        mcpConfig = {};
      }
    }

    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    // Channel server entry pointing to our channel server script
    mcpConfig.mcpServers['claudeteam-channel'] = {
      command: 'bun',
      args: ['run', path.resolve(__dirname, '../channel/channel-server.ts')],
      env: {
        CLAUDETEAM_AGENT_NAME: config.name,
        CLAUDETEAM_ROUTER_PORT: String(this.store.getAppSettings().routerPort),
        CLAUDETEAM_CHANNEL_PORT: String(config.channelPort),
      },
    };

    fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  }

  private emitStateUpdate(state: AgentState): void {
    this.emit('agent-state-update', { ...state });
  }

  // ─── Terminal Output Processing ───

  private processTerminalOutput(managed: ManagedAgent, data: string): void {
    // Buffer output for multi-chunk pattern matching
    managed.outputBuffer += data;

    // Keep buffer from growing unbounded (retain last 4KB)
    if (managed.outputBuffer.length > 4096) {
      managed.outputBuffer = managed.outputBuffer.slice(-4096);
    }

    // Detect approval request pattern [Y/n]
    if (APPROVAL_PATTERN.test(data) && managed.state.status === 'running') {
      this.handleApprovalDetected(managed);
    }

    // Detect token usage pattern
    this.detectTokenUsage(managed);
  }

  private handleApprovalDetected(managed: ManagedAgent): void {
    // Extract description from recent output buffer (last few lines before [Y/n])
    const lines = managed.outputBuffer.split('\n');
    const lastLines = lines.slice(-5).join(' ').trim();
    // Strip ANSI escape codes for clean description
    const description = lastLines.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();

    // Check auto-approve rules first
    if (this.shouldAutoApprove(managed.config.name, description)) {
      if (managed.ptyProcess) {
        managed.ptyProcess.write('y\n');
      }
      this.store.logAudit('auto-approve', 'approve', managed.config.name, true);
      return;
    }

    // Create pending approval
    const approvalId = uuid();
    this.pendingApprovals.set(approvalId, {
      agentId: managed.config.id,
      agentName: managed.config.name,
      description,
      timestamp: new Date(),
    });

    // Transition state to waiting_approval
    managed.state.status = 'waiting_approval';
    this.emitStateUpdate(managed.state);

    // Emit approval request event
    const approvalRequest: ApprovalRequest = {
      id: approvalId,
      agentId: managed.config.id,
      agentName: managed.config.name,
      action: 'tool_use',
      target: managed.config.workingDirectory,
      description,
      status: 'pending',
      timestamp: new Date(),
    };

    this.emit('approval-request', approvalRequest);

    // Also emit via router-event so it reaches the renderer
    this.router.emit('router-event', {
      type: 'approval_request',
      data: approvalRequest,
    });
  }

  private shouldAutoApprove(agentName: string, description: string): boolean {
    for (const rule of this.autoApproveRules) {
      if (!rule.enabled) continue;

      // Check agent name match
      if (rule.agentName !== '*' && rule.agentName !== agentName) continue;

      // Check pattern match (simple glob-like: * matches anything)
      try {
        const regexStr = rule.pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        const regex = new RegExp(regexStr, 'i');
        if (regex.test(description)) {
          return true;
        }
      } catch {
        // Invalid pattern, skip
        continue;
      }
    }
    return false;
  }

  private detectTokenUsage(managed: ManagedAgent): void {
    let match = TOKEN_USAGE_PATTERN.exec(managed.outputBuffer);
    if (!match) {
      match = TOKEN_COST_PATTERN.exec(managed.outputBuffer);
    }

    if (match) {
      const inputTokens = parseInt(match[1], 10);
      const outputTokens = parseInt(match[2], 10);

      if (!isNaN(inputTokens) && !isNaN(outputTokens)) {
        managed.state.tokenUsage = {
          input: inputTokens,
          output: outputTokens,
        };
        this.emitStateUpdate(managed.state);

        // Check warning threshold
        const totalTokens = inputTokens + outputTokens;
        const threshold = this.store.getAppSettings().tokenWarningThreshold;
        if (totalTokens >= threshold) {
          this.router.emit('router-event', {
            type: 'loop_warning',
            message: `Agent "${managed.config.name}" token usage (${totalTokens}) exceeded threshold (${threshold}).`,
            conversation: '*',
          });
        }

        // Clear the matched portion from buffer to avoid re-matching
        managed.outputBuffer = '';
      }
    }
  }
}
