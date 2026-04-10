// ClaudeTeam — Message Router
// Hub-and-Spoke 메시지 라우팅, @멘션 파싱, 루프 방지

import fs from 'fs';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import type {
  ChatMessage,
  RouterEvent,
  AgentConfig,
} from '../shared/types';
import type { SessionStore } from './session-store';

interface RegisteredAgent {
  name: string;
  port: number;
  status: string;
  workingDirectory: string;
  lastHeartbeat: Date;
}

interface CooldownState {
  count: number;
  windowStart: number;
}

export class MessageRouter extends EventEmitter {
  private agents = new Map<string, RegisteredAgent>();
  private cooldowns = new Map<string, CooldownState>();
  private maxConversationDepth: number;
  private cooldownThreshold: { messages: number; windowSeconds: number };
  private emergencyStopped = false;

  constructor(
    private store: SessionStore,
    options?: {
      maxConversationDepth?: number;
      cooldownThreshold?: { messages: number; windowSeconds: number };
    },
  ) {
    super();
    this.maxConversationDepth = options?.maxConversationDepth ?? 5;
    this.cooldownThreshold = options?.cooldownThreshold ?? {
      messages: 5,
      windowSeconds: 30,
    };
  }

  // ─── Agent Registry ───

  registerAgent(
    name: string,
    port: number,
    workingDirectory: string,
  ): void {
    this.agents.set(name, {
      name,
      port,
      status: 'running',
      workingDirectory,
      lastHeartbeat: new Date(),
    });
  }

  deregisterAgent(name: string): void {
    this.agents.delete(name);
    this.cooldowns.delete(name);
  }

  updateAgentStatus(name: string, status: string): void {
    const agent = this.agents.get(name);
    if (agent) {
      agent.status = status;
    }
  }

  heartbeat(name: string): void {
    const agent = this.agents.get(name);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  getRegisteredAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(name: string): RegisteredAgent | undefined {
    return this.agents.get(name);
  }

  // ─── Emergency Stop ───

  emergencyStop(): void {
    this.emergencyStopped = true;
    this.emitToUI({
      type: 'loop_warning',
      message: 'Emergency stop activated. All routing halted.',
      conversation: '*',
    });
  }

  resumeRouting(): void {
    this.emergencyStopped = false;
  }

  // ─── Core Routing ───

  async routeMessage(msg: Omit<ChatMessage, 'id' | 'timestamp' | 'to'>): Promise<ChatMessage> {
    if (this.emergencyStopped) {
      throw new Error('Emergency stop is active. Call resumeRouting() first.');
    }

    const mentions = this.parseMentions(msg.content);
    const files = this.parseFilePaths(msg.content);

    const fullMsg: ChatMessage = {
      ...msg,
      id: uuid(),
      to: mentions,
      files: [...(msg.files ?? []), ...files],
      timestamp: new Date(),
    };

    // Loop prevention
    if (fullMsg.conversationDepth >= this.maxConversationDepth) {
      this.emitToUI({
        type: 'loop_warning',
        message: `Conversation depth limit (${this.maxConversationDepth}) reached.`,
        conversation: fullMsg.chatId,
      });
      this.store.saveMessage(fullMsg);
      return fullMsg;
    }

    // Cooldown check
    if (fullMsg.from !== 'human' && this.isCooledDown(fullMsg.from)) {
      this.emitToUI({
        type: 'loop_warning',
        message: `Agent "${fullMsg.from}" is sending too many messages. Cooldown applied.`,
        conversation: fullMsg.chatId,
      });
      this.store.saveMessage(fullMsg);
      return fullMsg;
    }

    // Persist
    this.store.saveMessage(fullMsg);

    // Track cooldown for non-human senders
    if (fullMsg.from !== 'human') {
      this.trackCooldown(fullMsg.from);
    }

    // Route to mentioned agents
    if (mentions.length === 0 && fullMsg.from !== 'human') {
      // No mentions from agent: just display in UI, don't forward
      this.emitToUI({ type: 'message', data: fullMsg });
      return fullMsg;
    }

    for (const target of mentions) {
      const agent = this.agents.get(target);
      if (!agent || agent.status !== 'running') {
        this.emitToUI({
          type: 'delivery_failed',
          target,
          reason: agent ? 'Agent not running' : 'Agent not found',
        });
        continue;
      }

      try {
        await fetch(`http://127.0.0.1:${agent.port}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fullMsg.from,
            chatId: fullMsg.chatId,
            message: this.formatChannelMessage(fullMsg),
            type: fullMsg.type,
            files: fullMsg.files,
          }),
        });
      } catch (err) {
        this.emitToUI({
          type: 'delivery_failed',
          target,
          reason: `Network error: ${(err as Error).message}`,
        });
      }
    }

    // Broadcast to UI
    this.emitToUI({ type: 'message', data: fullMsg });
    return fullMsg;
  }

  async handleAgentReply(
    from: string,
    chatId: string,
    text: string,
  ): Promise<ChatMessage> {
    const conversation = this.store.getMessagesByChatId(chatId);
    const depth = conversation.length > 0
      ? conversation[conversation.length - 1].conversationDepth + 1
      : 0;

    return this.routeMessage({
      chatId,
      from,
      content: text,
      files: [],
      type: 'response',
      conversationDepth: depth,
    });
  }

  // ─── @Mention Parsing ───

  parseMentions(content: string): string[] {
    const pattern = /@([\w가-힣][\w가-힣-]*)/g;
    const mentions: string[] = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (this.agents.has(name)) {
        mentions.push(name);
      }
    }
    return [...new Set(mentions)];
  }

  // ─── File Path Parsing ───

  parseFilePaths(content: string): string[] {
    const pattern = /(\/[\w\-./]+\.\w+)/g;
    const paths: string[] = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
      try {
        if (fs.existsSync(match[1])) {
          paths.push(match[1]);
        }
      } catch {
        // ignore invalid paths
      }
    }
    return [...new Set(paths)];
  }

  // ─── Channel Message Formatting ───

  private formatChannelMessage(msg: ChatMessage): string {
    let formatted = `<channel source="claudeteam" sender="${msg.from}" type="${msg.type}" chat_id="${msg.chatId}">\n${msg.content}\n</channel>`;

    // Inline file contents for cross-repo references
    for (const filePath of msg.files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const truncated = content.length > 50000
          ? content.substring(0, 50000) + '\n... [truncated]'
          : content;
        formatted += `\n\n--- file: ${filePath} ---\n${truncated}\n--- end file ---`;
      } catch {
        formatted += `\n[Failed to read file: ${filePath}]`;
      }
    }

    return formatted;
  }

  // ─── Cooldown ───

  private isCooledDown(agentName: string): boolean {
    const state = this.cooldowns.get(agentName);
    if (!state) return false;

    const now = Date.now();
    if (now - state.windowStart > this.cooldownThreshold.windowSeconds * 1000) {
      this.cooldowns.delete(agentName);
      return false;
    }

    return state.count >= this.cooldownThreshold.messages;
  }

  private trackCooldown(agentName: string): void {
    const now = Date.now();
    const state = this.cooldowns.get(agentName);

    if (!state || now - state.windowStart > this.cooldownThreshold.windowSeconds * 1000) {
      this.cooldowns.set(agentName, { count: 1, windowStart: now });
    } else {
      state.count++;
    }
  }

  // ─── Event Emission ───

  private emitToUI(event: RouterEvent): void {
    this.emit('router-event', event);
  }
}
