# ClaudeTeam — Technical Architecture Document

**Version:** 0.1.0-draft  
**Date:** 2026-03-26  
**Status:** Initial Design

---

## 1. 시스템 아키텍처 개요

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ClaudeTeam Electron App                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Renderer Process (UI)                   │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │ Sidebar  │  │  Terminal    │  │   Team Chat       │  │   │
│  │  │ (Agent   │  │  Tabs        │  │   (Message View)  │  │   │
│  │  │  List)   │  │  (xterm.js)  │  │                   │  │   │
│  │  └──────────┘  └──────────────┘  └───────────────────┘  │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │ IPC (contextBridge)                    │
│  ┌──────────────────────┴───────────────────────────────────┐   │
│  │                    Main Process                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Agent        │  │ Message      │  │ Channel       │  │   │
│  │  │ Manager      │  │ Router       │  │ Server        │  │   │
│  │  │ (node-pty)   │  │              │  │ (MCP/HTTP)    │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │   │
│  │         │                 │                   │          │   │
│  │  ┌──────┴─────────────────┴───────────────────┴───────┐  │   │
│  │  │              Session Store (SQLite)                 │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                       │
│            ┌────────────┴────────────┐                          │
│            ▼                         ▼                          │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ Claude Code     │     │ Claude Code     │                   │
│  │ Session A       │     │ Session B       │                   │
│  │ (frontend repo) │     │ (backend repo)  │                   │
│  │ + Custom Channel│     │ + Custom Channel│                   │
│  └─────────────────┘     └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 설계 원칙

**로컬 우선(Local-first):** 모든 통신은 localhost 내에서 이루어진다. 외부 서비스(Telegram, Discord) 의존성이 없다.

**Custom Channel 기반:** Claude Code의 공식 Channels API(MCP 프로토콜)를 활용하여 커스텀 채널을 구축한다. 이는 Anthropic이 문서화한 공식 확장 방법이다.

**Hub-and-Spoke 모델:** Message Router가 중앙 허브 역할을 하며, 각 에이전트의 커스텀 채널 서버가 스포크 역할을 한다. 에이전트끼리 직접 통신하지 않고, 항상 라우터를 경유한다.

---

## 2. 핵심 컴포넌트 상세

### 2.1 Agent Manager

에이전트의 라이프사이클을 관리한다. 각 에이전트는 독립된 `node-pty` 프로세스로 실행된다.

**레퍼런스:** `node-pty`는 Microsoft가 관리하는 공식 라이브러리로, VS Code의 내장 터미널에서도 사용된다. Electron에서의 사용법은 `microsoft/node-pty/examples/electron`에 레퍼런스 구현이 있다. `coneilen/terminal-manager`는 이 패턴을 Claude Code 세션 관리에 적용한 기존 오픈소스 사례다.

```typescript
// Agent 정의
interface AgentConfig {
  id: string;
  name: string;                    // "프론트엔드", "백엔드"
  workingDirectory: string;        // "/Users/dev/repos/frontend"
  role: string;                    // CLAUDE.md에 삽입될 역할 설명
  model?: 'sonnet' | 'opus';      // 기본값: sonnet
  channelPort: number;             // 내장 채널 서버 포트 (자동 할당)
  autoApprovePatterns?: string[];  // 자동 승인 규칙
}

interface AgentState {
  id: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'error';
  pid?: number;
  tokenUsage: { input: number; output: number };
  lastActivity: Date;
}
```

**에이전트 시작 시퀀스:**

```
1. CLAUDE.md 생성/업데이트 (역할 + 통신 프로토콜 주입)
2. .mcp.json에 커스텀 채널 서버 등록
3. node-pty로 Claude Code 프로세스 시작
   → `claude --dangerously-load-development-channels server:claudeteam-channel`
4. 채널 서버의 HTTP 포트가 열릴 때까지 대기
5. Message Router에 에이전트 등록
6. 상태를 'running'으로 변경
```

### 2.2 Custom Channel Server (per Agent)

각 에이전트마다 하나의 커스텀 MCP 채널 서버가 실행된다. Claude Code가 이를 서브프로세스로 스폰하며, stdio 트랜스포트를 통해 통신한다.

**레퍼런스:** Anthropic의 공식 Channels Reference 문서에서 제시하는 커스텀 채널 구축 방법을 따른다. `claude/channel` capability를 선언하고, `notifications/claude/channel` 이벤트를 푸시하며, reply tool을 노출한다.

```typescript
// channel-server.ts — 각 에이전트에 대해 하나씩 실행됨
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const AGENT_NAME = process.env.CLAUDETEAM_AGENT_NAME!;
const ROUTER_PORT = parseInt(process.env.CLAUDETEAM_ROUTER_PORT!);
const CHANNEL_PORT = parseInt(process.env.CLAUDETEAM_CHANNEL_PORT!);

const mcp = new Server(
  { name: `claudeteam-${AGENT_NAME}`, version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `
당신은 "${AGENT_NAME}" 에이전트입니다.
팀 채팅에서 다른 에이전트나 사용자의 메시지가 <channel> 태그로 도착합니다.

메시지 형식:
<channel source="claudeteam" sender="프론트엔드" type="request">
  @백엔드 회원가입 API 응답에서 ci 필드가 누락되어 있어요.
  참조 파일: /Users/dev/repos/backend/src/routes/auth.ts
</channel>

응답 규칙:
1. @${AGENT_NAME}으로 멘션된 메시지에만 응답합니다.
2. 파일 경로가 포함되어 있으면 해당 파일을 직접 읽어서 분석합니다.
3. 응답할 때는 반드시 reply 도구를 사용합니다.
4. 먼저 질문하지 마세요. 요청받은 것에만 답하세요.
5. 응답이 끝나면 추가 대화를 시도하지 마세요.
    `.trim(),
  }
);

// Reply tool — Claude가 메시지를 보낼 때 사용
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: '팀 채팅에 메시지를 보냅니다.',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: '대화 ID' },
        text: { type: 'string', description: '보낼 메시지' },
      },
      required: ['chat_id', 'text'],
    },
  }],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'reply') {
    const { chat_id, text } = request.params.arguments;
    // Message Router로 응답 전달
    await fetch(`http://127.0.0.1:${ROUTER_PORT}/agent-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: AGENT_NAME,
        chatId: chat_id,
        text: text,
      }),
    });
    return { content: [{ type: 'text', text: 'Message sent.' }] };
  }
});

// 인바운드 HTTP — Message Router가 이 에이전트에게 메시지를 전달할 때 사용
Bun.serve({
  port: CHANNEL_PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const body = await req.json();
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: body.message,
        meta: {
          sender: body.from,
          chat_id: body.chatId,
          type: body.type,        // 'request' | 'response' | 'broadcast'
          files: body.files || [],
        },
      },
    });
    return new Response('ok');
  },
});

await mcp.connect(new StdioServerTransport());
```

### 2.3 Message Router

모든 에이전트 간 메시지를 중앙에서 관리하는 HTTP 서버. Electron Main Process 내에서 실행된다.

```typescript
// message-router.ts
interface Message {
  id: string;
  chatId: string;
  from: string;          // 에이전트명 또는 'human'
  to: string[];          // @멘션된 에이전트명 목록
  content: string;
  files: string[];       // 절대경로 목록
  type: 'request' | 'response' | 'broadcast';
  timestamp: Date;
  conversationDepth: number;  // 루프 방지 카운터
}

class MessageRouter {
  private agents: Map<string, { port: number; status: string }>;
  private messageLog: Message[];
  private maxConversationDepth = 5;  // 기본 왕복 제한

  async routeMessage(msg: Message): Promise<void> {
    // 1. 루프 방지 체크
    if (msg.conversationDepth >= this.maxConversationDepth) {
      this.emitToUI({
        type: 'loop_warning',
        message: `대화 깊이 제한(${this.maxConversationDepth})에 도달했습니다.`,
        conversation: msg.chatId,
      });
      return;
    }

    // 2. 메시지 로깅
    this.messageLog.push(msg);
    this.persistMessage(msg);

    // 3. @멘션 파싱
    const mentions = this.parseMentions(msg.content);
    if (mentions.length === 0 && msg.from !== 'human') {
      // 멘션 없는 에이전트 메시지는 UI에만 표시 (전파 안 함)
      this.emitToUI({ type: 'message', data: msg });
      return;
    }

    // 4. 파일 참조 파싱
    const files = this.parseFilePaths(msg.content);

    // 5. 대상 에이전트에게 전달
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

      await fetch(`http://127.0.0.1:${agent.port}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: msg.from,
          chatId: msg.chatId,
          message: this.formatChannelMessage(msg),
          type: msg.type,
          files: files,
        }),
      });
    }

    // 6. UI 업데이트
    this.emitToUI({ type: 'message', data: msg });
  }

  private parseMentions(content: string): string[] {
    const pattern = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (this.agents.has(match[1])) {
        mentions.push(match[1]);
      }
    }
    return mentions;
  }

  private parseFilePaths(content: string): string[] {
    // 절대경로 패턴 매칭
    const pattern = /(\/[\w\-./]+\.\w+)/g;
    const paths: string[] = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (fs.existsSync(match[1])) {
        paths.push(match[1]);
      }
    }
    return paths;
  }

  private formatChannelMessage(msg: Message): string {
    let formatted = msg.content;
    // 파일 내용을 인라인으로 삽입 (수신 에이전트의 레포 외부 파일인 경우)
    const files = this.parseFilePaths(msg.content);
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        formatted += `\n\n--- 파일: ${filePath} ---\n${content}\n--- 파일 끝 ---`;
      } catch {
        formatted += `\n[파일 읽기 실패: ${filePath}]`;
      }
    }
    return formatted;
  }
}
```

### 2.4 CLAUDE.md 자동 생성

에이전트 시작 시, 작업 디렉토리의 CLAUDE.md에 역할과 통신 프로토콜을 주입한다.

```markdown
<!-- ClaudeTeam에 의해 자동 생성됨. 수정 시 에이전트 재시작 필요. -->

# 역할

당신은 "백엔드" 에이전트입니다. 이 레포지토리의 백엔드 코드를 담당합니다.

# 팀 구성

- 프론트엔드: /Users/dev/repos/frontend (React, Next.js)
- 백엔드 (나): /Users/dev/repos/backend (NestJS, PostgreSQL)
- 인프라: /Users/dev/repos/infra (Terraform, K8s)

# 공유 문서

- PRD: /Users/dev/docs/prd.md
- API 스펙: /Users/dev/docs/api-spec.yaml

# 통신 규칙

1. 팀 채팅 메시지가 <channel> 태그로 도착합니다.
2. @백엔드로 멘션된 요청에만 응답하세요.
3. 응답은 반드시 reply 도구를 사용하세요.
4. 파일 경로가 포함된 경우, 해당 파일을 직접 읽고 분석하세요.
5. 응답 후 추가 질문을 하지 마세요 (루프 방지).
6. 커밋 전에는 /Users/dev/docs/prd.md를 참조하여 구현 적합성을 검토하세요.
```

---

## 3. CLI MCP 도구 및 파일시스템 서버

### 3.1 아키텍처 개요

CLI MCP 도구는 두 가지 진입점을 제공한다. 하나는 독립 CLI 바이너리(`claudeteam`)이고, 다른 하나는 Claude Code 세션 내에서 MCP 도구로 호출할 수 있는 MCP 서버다. 둘 다 동일한 Message Router API를 호출한다.

```
┌──────────────────────────────────────────────────────────┐
│                    진입점 A: CLI 바이너리                   │
│  $ claudeteam msg @백엔드 "API 스펙 확인해줘"              │
│  $ claudeteam read /repos/backend/src/auth/dto/signup.ts  │
│  $ claudeteam status                                      │
│  $ claudeteam logs --tail 20                              │
│  $ claudeteam attach 백엔드   (tmux attach 방식)           │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP (127.0.0.1)
                         ▼
              ┌─────────────────────┐
              │   Message Router    │
              │   (HTTP API)        │
              │   Port: 7632        │
              └─────────┬───────────┘
                         ▲ HTTP (127.0.0.1)
┌────────────────────────┴─────────────────────────────────┐
│           진입점 B: MCP Server (Claude Code 내부)          │
│  Claude가 team_message, team_read_file 등 도구 호출       │
│  → MCP Server가 Router API로 프록시                       │
└──────────────────────────────────────────────────────────┘
```

### 3.2 CLI 바이너리 설계

```typescript
// cli/index.ts — claudeteam CLI 진입점
// 설치: npm install -g claudeteam

import { Command } from 'commander';

const program = new Command('claudeteam');
const ROUTER_URL = process.env.CLAUDETEAM_ROUTER_URL || 'http://127.0.0.1:7632';

program
  .command('msg <target> <message>')
  .description('에이전트에게 메시지 전송 (@멘션 자동 추가)')
  .option('--file <path>', '파일 첨부 (절대경로)')
  .action(async (target, message, opts) => {
    const content = opts.file
      ? `@${target} ${message}\n참조: ${opts.file}`
      : `@${target} ${message}`;
    const res = await fetch(`${ROUTER_URL}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'human', content }),
    });
    const data = await res.json();
    console.log(`✓ 메시지 전송됨 (chat_id: ${data.chatId})`);
  });

program
  .command('read <filepath>')
  .description('팀 내 허용된 파일 읽기')
  .option('--lines <range>', '라인 범위 (예: 1-50)')
  .action(async (filepath, opts) => {
    const res = await fetch(`${ROUTER_URL}/api/fs/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filepath, lines: opts.lines }),
    });
    const data = await res.json();
    if (data.error) { console.error(`✗ ${data.error}`); return; }
    console.log(data.content);
  });

program
  .command('status')
  .description('모든 에이전트 상태 조회')
  .action(async () => {
    const res = await fetch(`${ROUTER_URL}/api/agents`);
    const agents = await res.json();
    for (const a of agents) {
      const icon = { running: '🟢', idle: '⚪', error: '🔴', waiting_approval: '🟡' }[a.status];
      console.log(`${icon} ${a.name.padEnd(12)} ${a.status.padEnd(18)} ${a.workingDirectory}`);
    }
  });

program
  .command('logs')
  .description('팀 채팅 로그 조회')
  .option('--tail <n>', '마지막 N개 메시지', '20')
  .option('--follow', '실시간 스트리밍', false)
  .action(async (opts) => {
    if (opts.follow) {
      // SSE 스트리밍
      const evtSource = new EventSource(`${ROUTER_URL}/api/messages/stream`);
      evtSource.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        console.log(`[${msg.from}] ${msg.content.substring(0, 120)}`);
      };
    } else {
      const res = await fetch(`${ROUTER_URL}/api/messages?limit=${opts.tail}`);
      const msgs = await res.json();
      for (const m of msgs) {
        const time = new Date(m.timestamp).toLocaleTimeString();
        console.log(`${time} [${m.from}] ${m.content.substring(0, 120)}`);
      }
    }
  });

program
  .command('attach <agentName>')
  .description('에이전트 터미널에 직접 연결 (tmux attach 방식)')
  .action(async (agentName) => {
    // WebSocket을 통해 에이전트의 PTY 스트림에 연결
    const ws = new WebSocket(`ws://127.0.0.1:7632/api/terminal/${agentName}`);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    ws.on('message', (data) => process.stdout.write(data));
    process.stdin.on('data', (data) => ws.send(data));
    // Ctrl+B, D로 디태치 (tmux 방식)
    console.log('연결됨. Ctrl+B, D로 디태치합니다.');
  });

program
  .command('ls <agentNameOrPath>')
  .description('에이전트 레포 또는 경로의 디렉토리 구조 탐색')
  .option('--depth <n>', '탐색 깊이', '2')
  .action(async (target, opts) => {
    const res = await fetch(`${ROUTER_URL}/api/fs/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, depth: parseInt(opts.depth) }),
    });
    const data = await res.json();
    console.log(data.tree);
  });

program
  .command('search <pattern>')
  .description('팀 전체 레포에서 패턴 검색 (ripgrep)')
  .option('--agent <name>', '특정 에이전트 레포만 검색')
  .action(async (pattern, opts) => {
    const res = await fetch(`${ROUTER_URL}/api/fs/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, agent: opts.agent }),
    });
    const data = await res.json();
    for (const r of data.results) {
      console.log(`${r.file}:${r.line}: ${r.content}`);
    }
  });

program.parse();
```

### 3.3 MCP 도구 서버 (Claude Code 내부 사용)

독립 터미널의 Claude Code 세션에서 팀 도구를 MCP 도구로 사용할 수 있다. 이 MCP 서버는 일반 MCP 서버(채널이 아닌)로 등록되며, Claude Code가 필요에 따라 호출한다.

```typescript
// mcp-tools-server.ts — Claude Code에 등록되는 MCP 도구 서버
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const ROUTER_URL = process.env.CLAUDETEAM_ROUTER_URL || 'http://127.0.0.1:7632';
const AGENT_NAME = process.env.CLAUDETEAM_AGENT_NAME || 'unknown';

const server = new Server(
  { name: 'claudeteam-tools', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'team_message',
      description: '팀 채팅에 메시지를 보냅니다. @에이전트명으로 특정 에이전트를 멘션할 수 있습니다.',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '메시지 내용. @에이전트명으로 수신자 지정. 예: "@백엔드 API 스펙 확인해주세요"',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'team_read_file',
      description: '팀 내 다른 에이전트의 레포에 있는 파일을 읽습니다. 허용된 경로만 접근 가능합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '읽을 파일의 절대경로' },
          lines: { type: 'string', description: '라인 범위 (예: "1-50", "100-200"). 생략 시 전체' },
        },
        required: ['path'],
      },
    },
    {
      name: 'team_list_files',
      description: '에이전트의 레포 디렉토리 구조를 탐색합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: '에이전트 이름 (예: "백엔드")' },
          subpath: { type: 'string', description: '하위 경로 (예: "src/auth"). 생략 시 루트' },
          depth: { type: 'number', description: '탐색 깊이 (기본: 2)' },
        },
        required: ['agent'],
      },
    },
    {
      name: 'team_search_files',
      description: '팀 전체 또는 특정 에이전트의 레포에서 텍스트 패턴을 검색합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '검색 패턴 (정규식 지원)' },
          agent: { type: 'string', description: '특정 에이전트 레포만 검색. 생략 시 전체' },
          glob: { type: 'string', description: '파일 패턴 필터 (예: "*.ts")' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'team_status',
      description: '팀 내 모든 에이전트의 현재 상태를 조회합니다.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'team_message': {
      const res = await fetch(`${ROUTER_URL}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: AGENT_NAME, content: args.content }),
      });
      const data = await res.json();
      return { content: [{ type: 'text', text: `메시지 전송됨 (chat_id: ${data.chatId})` }] };
    }

    case 'team_read_file': {
      const res = await fetch(`${ROUTER_URL}/api/fs/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: args.path,
          lines: args.lines,
          requester: AGENT_NAME,
        }),
      });
      const data = await res.json();
      if (data.error) return { content: [{ type: 'text', text: `오류: ${data.error}` }] };
      return { content: [{ type: 'text', text: data.content }] };
    }

    case 'team_list_files': {
      const res = await fetch(`${ROUTER_URL}/api/fs/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: args.agent,
          subpath: args.subpath,
          depth: args.depth || 2,
        }),
      });
      const data = await res.json();
      return { content: [{ type: 'text', text: data.tree }] };
    }

    case 'team_search_files': {
      const res = await fetch(`${ROUTER_URL}/api/fs/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: args.pattern,
          agent: args.agent,
          glob: args.glob,
        }),
      });
      const data = await res.json();
      const formatted = data.results
        .map((r: any) => `${r.file}:${r.line}: ${r.content}`)
        .join('\n');
      return { content: [{ type: 'text', text: formatted || '결과 없음' }] };
    }

    case 'team_status': {
      const res = await fetch(`${ROUTER_URL}/api/agents`);
      const agents = await res.json();
      const formatted = agents
        .map((a: any) => `[${a.status}] ${a.name}: ${a.workingDirectory}`)
        .join('\n');
      return { content: [{ type: 'text', text: formatted }] };
    }
  }
});

await server.connect(new StdioServerTransport());
```

**Claude Code에 등록하는 방법:**

```bash
# 사용자의 MCP 설정에 추가
claude mcp add claudeteam-tools --scope user -- \
  bun run /path/to/claudeteam/mcp-tools-server.ts

# 또는 .mcp.json에 직접 추가
{
  "mcpServers": {
    "claudeteam-tools": {
      "command": "bun",
      "args": ["run", "/path/to/claudeteam/mcp-tools-server.ts"],
      "env": {
        "CLAUDETEAM_ROUTER_URL": "http://127.0.0.1:7632",
        "CLAUDETEAM_AGENT_NAME": "프론트엔드"
      }
    }
  }
}
```

### 3.4 Message Router REST API

CLI와 MCP 도구 서버가 호출하는 통합 API 엔드포인트.

```typescript
// router/api-routes.ts — Message Router에 추가되는 REST 엔드포인트

// POST /api/message — 메시지 전송
// POST /api/fs/read — 파일 읽기 (접근 제어 적용)
// POST /api/fs/list — 디렉토리 탐색
// POST /api/fs/search — 파일 검색
// GET  /api/agents — 에이전트 목록 및 상태
// GET  /api/messages?limit=N — 최근 메시지 조회
// GET  /api/messages/stream — SSE 실시간 메시지 스트리밍
// WS   /api/terminal/:agentName — PTY 웹소켓 연결 (attach)

interface FileReadRequest {
  path: string;
  lines?: string;      // "1-50"
  requester: string;   // 요청자 에이전트명
}

interface FileReadResponse {
  content?: string;
  error?: string;
  accessLog: {
    requester: string;
    path: string;
    timestamp: Date;
    allowed: boolean;
  };
}

class FileSystemService {
  private allowedPaths: Map<string, string[]>;  // 에이전트별 허용 경로
  private auditLog: AuditEntry[];

  async readFile(req: FileReadRequest): Promise<FileReadResponse> {
    // 1. 접근 제어 검증
    if (!this.isPathAllowed(req.requester, req.path)) {
      this.logAudit(req.requester, req.path, false);
      return { error: `접근 거부: ${req.path}는 허용 범위에 없습니다.` };
    }

    // 2. 파일 존재 확인
    if (!fs.existsSync(req.path)) {
      return { error: `파일 없음: ${req.path}` };
    }

    // 3. 파일 읽기 (라인 범위 적용)
    const fullContent = fs.readFileSync(req.path, 'utf-8');
    let content = fullContent;

    if (req.lines) {
      const [start, end] = req.lines.split('-').map(Number);
      const lines = fullContent.split('\n');
      content = lines.slice(start - 1, end).join('\n');
    }

    // 4. 크기 제한 (컨텍스트 윈도우 보호)
    if (content.length > 50000) {
      content = content.substring(0, 50000) + '\n\n... [파일이 50,000자를 초과하여 잘림]';
    }

    // 5. 감사 로그
    this.logAudit(req.requester, req.path, true);

    return { content, accessLog: { requester: req.requester, path: req.path, timestamp: new Date(), allowed: true } };
  }

  async listDirectory(agent: string, subpath?: string, depth = 2): Promise<string> {
    const agentConfig = this.getAgentConfig(agent);
    if (!agentConfig) return `에이전트 "${agent}"를 찾을 수 없습니다.`;

    const basePath = subpath
      ? path.join(agentConfig.workingDirectory, subpath)
      : agentConfig.workingDirectory;

    // tree 명령 사용 또는 커스텀 구현
    return this.buildTree(basePath, depth);
  }

  async searchFiles(pattern: string, agent?: string, glob?: string): Promise<SearchResult[]> {
    const targetDirs = agent
      ? [this.getAgentConfig(agent)?.workingDirectory].filter(Boolean)
      : Array.from(this.agents.values()).map(a => a.workingDirectory);

    const results: SearchResult[] = [];

    for (const dir of targetDirs) {
      // ripgrep 사용 (성능)
      const args = ['--json', pattern, dir!];
      if (glob) args.push('--glob', glob);

      const proc = Bun.spawn(['rg', ...args]);
      const output = await new Response(proc.stdout).text();

      // ripgrep JSON 출력 파싱
      for (const line of output.split('\n').filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'match') {
            results.push({
              file: entry.data.path.text,
              line: entry.data.line_number,
              content: entry.data.lines.text.trim(),
            });
          }
        } catch {}
      }
    }

    return results.slice(0, 50);  // 최대 50개 결과
  }

  private isPathAllowed(requester: string, filePath: string): boolean {
    // 자기 레포 내 파일은 항상 허용
    const agentConfig = this.getAgentConfig(requester);
    if (agentConfig && filePath.startsWith(agentConfig.workingDirectory)) {
      return true;
    }

    // 공유 문서 경로는 모든 에이전트에게 허용
    const teamConfig = this.getTeamConfig();
    if (teamConfig.sharedDocuments.some(doc => filePath.startsWith(doc) || filePath === doc)) {
      return true;
    }

    // 에이전트별 allowedReadPaths 확인
    const allowed = this.allowedPaths.get(requester) || [];
    return allowed.some(p => filePath.startsWith(p));
  }
}
```

---

## 4. Headless 모드 — 독립 터미널에서 에이전트 팀 운용

### 4.1 아키텍처

Electron 앱 없이 순수 터미널 환경에서 에이전트 팀을 운용하는 모드. Message Router가 별도 데몬 프로세스로 실행된다.

```
터미널 1                  터미널 2                  터미널 3
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Claude Code  │         │ Claude Code  │         │ claudeteam   │
│ + Channel    │         │ + Channel    │         │ CLI          │
│ (프론트엔드)  │         │ (백엔드)     │         │ (사용자 조작) │
│ --channels   │         │ --channels   │         │              │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │         HTTP (127.0.0.1:7632)                   │
       ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│              Message Router Daemon (백그라운드)                │
│              claudeteam daemon start                          │
│                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ HTTP API   │  │ Agent        │  │ FileSystem         │   │
│  │ :7632      │  │ Registry     │  │ Service            │   │
│  └────────────┘  └──────────────┘  └────────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              SQLite (messages, audit, config)           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 데몬 프로세스

```typescript
// daemon/index.ts
// 실행: claudeteam daemon start
// 종료: claudeteam daemon stop

import { createServer } from 'http';
import { MessageRouter } from '../router/message-router';
import { FileSystemService } from '../router/filesystem-service';
import { Database } from 'better-sqlite3';

class ClaudeTeamDaemon {
  private router: MessageRouter;
  private fs: FileSystemService;
  private db: Database;
  private httpServer: ReturnType<typeof createServer>;

  async start(configPath: string) {
    // 1. 팀 설정 로드
    const config = JSON.parse(
      await Bun.file(configPath).text()
    );

    // 2. SQLite 초기화
    this.db = new Database(
      path.join(os.homedir(), '.claudeteam', 'data.db')
    );
    this.runMigrations();

    // 3. 서비스 초기화
    this.router = new MessageRouter(config, this.db);
    this.fs = new FileSystemService(config, this.db);

    // 4. HTTP 서버 시작
    this.httpServer = Bun.serve({
      port: 7632,
      hostname: '127.0.0.1',
      fetch: (req) => this.handleRequest(req),
    });

    // 5. PID 파일 기록
    fs.writeFileSync(
      path.join(os.homedir(), '.claudeteam', 'daemon.pid'),
      String(process.pid)
    );

    console.log('ClaudeTeam 데몬 시작됨 (port: 7632)');
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // REST API 라우팅
    switch (url.pathname) {
      case '/api/message':       return this.handleMessage(req);
      case '/api/agents':        return this.handleAgents(req);
      case '/api/agents/register': return this.handleAgentRegister(req);
      case '/api/fs/read':       return this.handleFileRead(req);
      case '/api/fs/list':       return this.handleFileList(req);
      case '/api/fs/search':     return this.handleFileSearch(req);
      case '/api/messages':      return this.handleMessageLog(req);
      case '/api/messages/stream': return this.handleSSE(req);
      case '/agent-reply':       return this.handleAgentReply(req);
      default:
        // WebSocket 업그레이드 (terminal attach)
        if (url.pathname.startsWith('/api/terminal/')) {
          return this.handleTerminalAttach(req, url.pathname.split('/').pop()!);
        }
        return new Response('Not Found', { status: 404 });
    }
  }
}
```

### 4.3 독립 터미널에서 팀 합류

각 터미널에서 Claude Code를 직접 시작하되, ClaudeTeam 채널 서버를 로드하여 팀에 합류한다.

```bash
# 터미널 1: 데몬 시작
claudeteam daemon start --config ./claudeteam.json

# 터미널 2: 프론트엔드 에이전트 시작
cd /Users/dev/repos/shop-frontend
claude --dangerously-load-development-channels server:claudeteam-agent \
  -- --team shop --name 프론트엔드 --router http://127.0.0.1:7632

# 터미널 3: 백엔드 에이전트 시작
cd /Users/dev/repos/shop-backend
claude --dangerously-load-development-channels server:claudeteam-agent \
  -- --team shop --name 백엔드 --router http://127.0.0.1:7632

# 터미널 4: 사용자 CLI (메시지 송수신)
claudeteam msg @프론트엔드 "회원가입 페이지 구현 시작해줘"
claudeteam logs --follow
```

### 4.4 공유 설정 파일 (`.claudeteam.json`)

프로젝트 루트 또는 홈 디렉토리에 위치하며, 여러 터미널이 동일 설정을 참조한다.

```json
{
  "version": "1.0",
  "teamName": "쇼핑몰 프로젝트",
  "router": {
    "port": 7632,
    "host": "127.0.0.1"
  },
  "sharedDocuments": [
    "/Users/dev/docs/prd.md",
    "/Users/dev/docs/api-spec.yaml"
  ],
  "agents": {
    "프론트엔드": {
      "workingDirectory": "/Users/dev/repos/shop-frontend",
      "model": "sonnet",
      "role": "React/Next.js 프론트엔드 담당",
      "allowedReadPaths": [
        "/Users/dev/repos/shop-backend/src/auth/dto/",
        "/Users/dev/repos/shop-backend/src/order/dto/"
      ]
    },
    "백엔드": {
      "workingDirectory": "/Users/dev/repos/shop-backend",
      "model": "sonnet",
      "role": "NestJS 백엔드 API 담당",
      "allowedReadPaths": [
        "/Users/dev/repos/shop-frontend/src/types/",
        "/Users/dev/repos/shop-frontend/src/api/"
      ]
    }
  },
  "rules": {
    "maxConversationDepth": 5,
    "maxFileReadSize": 50000,
    "cooldownThreshold": { "messages": 5, "windowSeconds": 30 }
  }
}
```

### 4.5 에이전트 자동 등록 (채널 서버 시작 시)

독립 터미널에서 에이전트가 시작되면, 채널 서버가 데몬에 자동 등록한다.

```typescript
// channel/agent-channel.ts — 독립 터미널용 채널 서버 (수정본)

// 시작 시 데몬에 자신을 등록
async function registerWithDaemon() {
  const res = await fetch(`${ROUTER_URL}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: AGENT_NAME,
      channelPort: CHANNEL_PORT,
      workingDirectory: process.cwd(),
      pid: process.pid,
    }),
  });

  if (!res.ok) {
    console.error('데몬 등록 실패. 데몬이 실행 중인지 확인하세요: claudeteam daemon start');
    process.exit(1);
  }
}

// 종료 시 등록 해제
process.on('SIGINT', async () => {
  await fetch(`${ROUTER_URL}/api/agents/deregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: AGENT_NAME }),
  });
  process.exit(0);
});

// heartbeat — 데몬이 에이전트 생존을 확인
setInterval(async () => {
  await fetch(`${ROUTER_URL}/api/agents/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: AGENT_NAME, channelPort: CHANNEL_PORT }),
  });
}, 10_000);  // 10초마다
```

### 4.6 Electron + Headless 혼용

Electron 앱의 Message Router가 데몬과 동일한 포트(7632)를 사용하므로, 둘 중 하나만 실행 가능하다. 혼용 시나리오는 다음과 같다:

```
시나리오 A: Electron 앱이 데몬 역할
┌────────────────────────────────────────┐
│ Electron App (내장 Router on :7632)    │
│  에이전트 A, B (앱 내 터미널)          │
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
  독립 터미널 C           독립 터미널 D
  (--channels로 합류)    (CLI로 조작)

시나리오 B: 데몬이 독립 실행, 앱은 UI만
┌────────────────────────────────────────┐
│ Daemon (Router on :7632)               │
└──────────────────┬─────────────────────┘
     ┌─────────────┼──────────────┐
     ▼             ▼              ▼
 Electron App   독립 터미널 A   독립 터미널 B
 (UI only,      (Claude Code)   (Claude Code)
  Router 미사용)
```

---

## 5. 통신 프로토콜

### 5.1 메시지 흐름

```
User types in Chat UI
       │
       ▼
  [Renderer Process]
       │ IPC: 'send-message'
       ▼
  [Main Process: Message Router]
       │
       ├─ Parse @mentions → ["백엔드"]
       ├─ Parse file paths → ["/Users/.../auth.ts"]
       ├─ Check conversation depth → OK (depth: 0)
       │
       ▼
  HTTP POST to Agent "백엔드" Channel Server (127.0.0.1:PORT)
       │
       ▼
  [Channel Server: MCP notification]
       │
       ▼
  [Claude Code Session "백엔드"]
       │ Claude reads files, analyzes code
       │ Claude calls 'reply' tool
       ▼
  HTTP POST to Message Router /agent-reply
       │
       ├─ depth++ → depth: 1
       ├─ Parse @mentions in response
       ├─ If mentions found AND depth < limit → route to next agent
       ├─ If no mentions → display in UI only
       │
       ▼
  [Renderer Process: Chat UI updated]
```

### 5.2 루프 방지 메커니즘

```typescript
interface ConversationState {
  id: string;
  depth: number;            // 현재 왕복 횟수
  maxDepth: number;         // 제한 (기본 5)
  participants: Set<string>; // 참여 에이전트
  startedAt: Date;
  lastMessageAt: Date;
}

// 루프 방지 규칙:
// 1. 대화 깊이 초과 시 → 차단 + UI 경고
// 2. 동일 에이전트가 동일 대화에서 3회 이상 연속 응답 시 → 차단
// 3. 에이전트 응답에 @멘션이 없으면 대화 종료로 간주
// 4. 30초 내 동일 에이전트 간 5회 이상 메시지 교환 시 → 쿨다운
```

### 5.3 파일 참조 처리 전략

에이전트가 자기 레포 외부의 파일을 참조해야 할 때, 두 가지 전략이 있다:

**전략 A: 인라인 삽입 (기본값)**

Message Router가 파일 내용을 읽어서 메시지 본문에 삽입한다. 수신 에이전트는 별도의 파일시스템 접근 없이 메시지 내에서 파일 내용을 확인한다.

장점: 에이전트의 파일시스템 접근 범위를 제한할 수 있음
단점: 대용량 파일의 경우 컨텍스트 윈도우를 소모

**전략 B: 직접 읽기 (opt-in)**

수신 에이전트에게 파일 경로만 전달하고, 에이전트가 직접 해당 파일을 읽는다. `readFilePaths`를 에이전트의 허용 목록에 추가해야 한다.

장점: 대용량 파일도 에이전트가 필요한 부분만 읽을 수 있음
단점: 에이전트의 파일시스템 접근 범위가 넓어짐

```typescript
// AgentConfig에 추가
interface AgentConfig {
  // ...
  fileAccessMode: 'inline' | 'direct';
  allowedReadPaths?: string[];  // direct 모드 시 읽기 허용 경로
}
```

---

## 6. 기술 스택

### 4.1 Core

| 구분 | 기술 | 버전 | 사유 |
|------|------|------|------|
| Framework | Electron | 33+ | 데스크톱 앱, node-pty 네이티브 모듈 지원 |
| Runtime | Node.js | 20 LTS | Electron 33 내장 |
| Channel Runtime | Bun | 1.1+ | Claude Code 채널 플러그인 공식 런타임 |
| MCP SDK | @modelcontextprotocol/sdk | latest | 채널 서버 구축 |
| Terminal | xterm.js | 5+ | 터미널 UI 렌더링 |
| PTY | node-pty | 1+ | 의사 터미널 프로세스 관리 |
| DB | better-sqlite3 | latest | 메시지 로그, 세션 데이터 |
| Build | Electron Forge | latest | 패키징, 네이티브 모듈 리빌드 |

### 6.2 Renderer (UI)

| 구분 | 기술 | 사유 |
|------|------|------|
| Framework | React 19 | 컴포넌트 기반 UI |
| State | Zustand | 경량 상태 관리 |
| Styling | Tailwind CSS 4 | 유틸리티 기반 |
| Terminal | @xterm/xterm + @xterm/addon-fit | 반응형 터미널 |
| Code Viewer | @monaco-editor/react | VS Code 동일 엔진, 구문 강조 |
| Markdown | react-markdown + remark-gfm | GFM 테이블/체크리스트 지원 |
| Syntax Highlight | shiki | 코드블록 구문 강조 (채팅 내) |
| File Tree | Custom (react-arborist) | 가상 스크롤 파일 트리 |
| Diff Viewer | react-diff-viewer-continued | Git diff 인라인/사이드바이사이드 |

---

### 6.3 관리자 화면 레이아웃 설계

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ClaudeTeam                                              ─  □  ✕      │
├──────────┬──────────────────────────────────────┬───────────────────────┤
│          │                                      │                       │
│ SIDEBAR  │         MAIN PANEL                   │   RIGHT PANEL         │
│          │    (탭 전환: 채팅 / 터미널)            │   (파일 뷰어)          │
│ ┌──────┐ │                                      │                       │
│ │ 팀명 │ │  ┌─ 채팅 탭 ─────────────────────┐   │  ┌─ 파일 트리 ───────┐ │
│ └──────┘ │  │                               │   │  │ 📁 프론트엔드     │ │
│          │  │  🟣 프론트엔드 (10:31)          │   │  │  📁 src/          │ │
│ Agents   │  │  ┌────────────────────────┐   │   │  │   📁 api/         │ │
│ ┌──────┐ │  │  │ @백엔드 회원가입 API    │   │   │  │    📄 auth.ts ◄── │ │
│ │🟢 FE │ │  │  │ 응답에서 ci 필드가      │   │   │  │  📁 types/        │ │
│ │🟢 BE │ │  │  │ 누락되어 있습니다.      │   │   │  │ 📁 백엔드         │ │
│ │⚪ IF │ │  │  │                        │   │   │  │  📁 src/          │ │
│ └──────┘ │  │  │ 참조:                  │   │   │  │   📁 auth/dto/    │ │
│          │  │  │ ┌──────────────────┐   │   │   │  └───────────────────┘ │
│ Actions  │  │  │ │📄 api-spec.yaml │   │   │   │                       │
│ ┌──────┐ │  │  │ │ (클릭→우측패널)  │   │   │   │  ┌─ 파일 뷰어 ───────┐ │
│ │ Kill │ │  │  │ └──────────────────┘   │   │   │  │ signup-response   │ │
│ │ All  │ │  │  └────────────────────────┘   │   │  │ .dto.ts           │ │
│ └──────┘ │  │                               │   │  │─────────────────── │ │
│          │  │  🔵 백엔드 (10:32)              │   │  │ 1│ export class   │ │
│ Monitor  │  │  ┌────────────────────────┐   │   │  │ 2│  SignupResp {   │ │
│ ┌──────┐ │  │  │ 확인했습니다.           │   │   │  │ 3│  id: string;   │ │
│ │Tokens│ │  │  │ SignupResponseDto에     │   │   │  │ 4│  email: string; │ │
│ │ 12.4k│ │  │  │ ci 필드 추가 완료.     │   │   │  │ 5│  ci: string;   │ │
│ └──────┘ │  │  │                        │   │   │  │ 6│ }              │ │
│          │  │  │ ```diff               │   │   │  │                   │ │
│          │  │  │ + ci: string;         │   │   │  └───────────────────┘ │
│          │  │  │ ```                    │   │   │                       │
│          │  │  └────────────────────────┘   │   │  ┌─ 마크다운 뷰 ─────┐ │
│          │  │                               │   │  │ (PRD 등 .md 파일  │ │
│          │  │  ┌─ 입력창 ───────────────┐   │   │  │  렌더링 표시)      │ │
│          │  │  │ @백엔드 메시지 입력...  │   │   │  └───────────────────┘ │
│          │  │  └────────────────────────┘   │   │                       │
│          │  └───────────────────────────────┘   │                       │
│          │                                      │                       │
│          │  ┌─ 터미널 탭 ───────────────────┐   │                       │
│          │  │  (선택한 에이전트의 xterm.js)   │   │                       │
│          │  └───────────────────────────────┘   │                       │
├──────────┴──────────────────────────────────────┴───────────────────────┤
│  ⚠ 권한 승인 대기: 백엔드 → Bash(git commit) [승인] [거부]    📊 12.4k │
└─────────────────────────────────────────────────────────────────────────┘
```

**3-패널 구성:**

- **Left: Sidebar** — 에이전트 목록(상태 아이콘), 긴급 정지, 토큰 모니터 요약
- **Center: Main Panel** — 탭 전환으로 채팅 뷰 / 터미널 뷰 교체
- **Right: File Panel** — 파일 트리 + 코드/마크다운 뷰어 (토글 가능, 기본 숨김)
- **Bottom Bar** — 권한 승인 대기 알림, 전체 토큰 사용량

### 6.4 관리자 채팅 뷰 컴포넌트 상세

```typescript
// 메시지 렌더링 규칙
interface ChatMessageProps {
  message: Message;
  agentConfig?: AgentConfig;  // 에이전트 색상, 아바타 등
}

// 에이전트별 시각 구분
const AGENT_THEME = {
  // 에이전트 생성 시 자동 할당, 사용자 커스텀 가능
  colors: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
  // 역할 기반 아이콘
  icons: {
    '프론트엔드': '🟣',
    '백엔드': '🔵',
    '인프라': '🟢',
    'human': '👤',
    'system': '⚙️',
  },
};

// 메시지 본문 내 특수 요소 렌더링
// 1. @멘션 → 클릭 가능 뱃지 (해당 에이전트 색상)
// 2. 절대경로 → 클릭 시 Right Panel 파일 뷰어에서 열기
// 3. ```코드블록``` → shiki 구문 강조
// 4. ```diff → diff 하이라이팅 (추가: 초록, 삭제: 빨강)
// 5. 인라인 `코드` → 모노스페이스 뱃지
// 6. 마크다운 기본 문법 → react-markdown 렌더링
```

**파일 첨부 인라인 프리뷰 규칙:**

```
첨부 파일 유형별 렌더링:
├─ .ts/.js/.py/.go 등 코드 → 구문 강조된 코드 프리뷰 (최대 20줄, 접기/펼치기)
├─ .md → 렌더링된 마크다운 프리뷰
├─ .yaml/.json → 구문 강조된 프리뷰
├─ .png/.jpg/.svg → 인라인 이미지 썸네일
└─ 기타 → 파일명 + 크기 + "열기" 링크

모든 파일 프리뷰에 "파일 뷰어에서 열기" 버튼 표시
→ 클릭 시 Right Panel에서 전체 파일 열림
```

### 6.5 파일 뷰어 컴포넌트 상세

```typescript
// FileExplorer — 좌측 트리
interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  agent: string;           // 소속 에이전트
  children?: FileTreeNode[];
  modified?: Date;         // 최근 수정 시각 (에이전트에 의한)
}

// FileViewer — 우측 뷰어
interface FileViewerProps {
  filePath: string;
  mode: 'code' | 'markdown' | 'diff' | 'image';
  // mode는 확장자 기반 자동 판별, 수동 전환 가능
}

// 자동 모드 판별
function detectViewMode(filePath: string): ViewMode {
  const ext = path.extname(filePath).toLowerCase();
  if (['.md', '.mdx'].includes(ext)) return 'markdown';
  if (['.png', '.jpg', '.jpeg', '.svg', '.gif'].includes(ext)) return 'image';
  return 'code';  // 기본값: Monaco 코드 뷰어
}

// 마크다운 뷰어 기능:
// - GFM (GitHub Flavored Markdown) 완전 지원
// - 코드블록 내 구문 강조
// - 체크리스트 렌더링
// - 테이블 렌더링
// - 이미지 (로컬 절대경로 지원)
// - 목차(TOC) 자동 생성
// - "원본 보기" 토글 (렌더링 ↔ 소스)

// 코드 뷰어 기능:
// - Monaco Editor (읽기 전용 모드)
// - 자동 언어 감지 + 구문 강조
// - 라인 넘버
// - 미니맵
// - 검색 (Cmd+F)
// - "에이전트에게 이 파일에 대해 질문" 버튼
//   → 클릭 시 채팅 입력창에 "@에이전트 파일경로" 자동 삽입
```

### 6.6 빌드 및 배포

```
electron-forge
├── @electron-forge/maker-dmg     (macOS)
├── @electron-forge/maker-squirrel (Windows)
├── @electron-forge/maker-deb      (Linux)
└── @electron/rebuild              (node-pty 네이티브 리빌드)
```

---

## 7. 데이터 모델

### 7.1 SQLite 스키마

```sql
-- 팀 설정
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  config JSON NOT NULL  -- 전체 팀 설정 (공유 문서 경로 등)
);

-- 에이전트 설정
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id),
  name TEXT NOT NULL,
  working_directory TEXT NOT NULL,
  role TEXT NOT NULL,
  model TEXT DEFAULT 'sonnet',
  channel_port INTEGER,
  file_access_mode TEXT DEFAULT 'inline',
  config JSON  -- 추가 설정
);

-- 메시지 로그
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  to_agents JSON,           -- ["백엔드", "인프라"]
  content TEXT NOT NULL,
  files JSON,               -- ["/path/to/file"]
  type TEXT NOT NULL,        -- request | response | broadcast
  conversation_depth INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 토큰 사용량
CREATE TABLE token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  input_tokens INTEGER,
  output_tokens INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. IPC 통신 설계

Electron의 Main-Renderer 간 통신은 `contextBridge`를 사용한다.

```typescript
// preload.ts
contextBridge.exposeInMainWorld('claudeTeam', {
  // 에이전트 관리
  createAgent: (config: AgentConfig) => ipcRenderer.invoke('agent:create', config),
  startAgent: (id: string) => ipcRenderer.invoke('agent:start', id),
  stopAgent: (id: string) => ipcRenderer.invoke('agent:stop', id),
  getAgents: () => ipcRenderer.invoke('agent:list'),

  // 메시지
  sendMessage: (msg: { content: string; chatId: string }) =>
    ipcRenderer.invoke('message:send', msg),
  onMessage: (cb: (msg: Message) => void) =>
    ipcRenderer.on('message:received', (_, msg) => cb(msg)),

  // 터미널
  onTerminalData: (agentId: string, cb: (data: string) => void) =>
    ipcRenderer.on(`terminal:data:${agentId}`, (_, data) => cb(data)),
  writeTerminal: (agentId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', { agentId, data }),
  resizeTerminal: (agentId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { agentId, cols, rows }),

  // 권한
  onPermissionRequest: (cb: (req: PermissionRequest) => void) =>
    ipcRenderer.on('permission:request', (_, req) => cb(req)),
  respondPermission: (reqId: string, approved: boolean) =>
    ipcRenderer.invoke('permission:respond', { reqId, approved }),

  // 모니터링
  onTokenUsage: (cb: (usage: TokenUsage) => void) =>
    ipcRenderer.on('monitor:tokens', (_, usage) => cb(usage)),
});
```

---

## 9. 보안 고려사항

### 7.1 파일시스템 격리

- 에이전트는 기본적으로 자기 `workingDirectory` 내에서만 쓰기 가능
- 다른 에이전트의 레포 파일은 Message Router를 통한 인라인 삽입으로만 읽기 가능 (기본값)
- `allowedReadPaths` 설정으로 추가 읽기 경로를 명시적으로 허용 가능

### 7.2 프로세스 격리

- 각 에이전트는 독립된 `node-pty` 프로세스로 실행
- 채널 서버는 에이전트당 독립된 포트에서 `127.0.0.1`에만 바인딩
- Message Router는 등록된 에이전트의 포트만 호출

### 7.3 루프 방지

- 대화 깊이 제한 (기본 5회 왕복)
- 시간 기반 쿨다운 (30초 내 5회 이상 교환 시)
- 에이전트 응답에 멘션 없으면 대화 자동 종료
- Kill All 버튼으로 모든 에이전트 즉시 중단 가능

---

## 10. 기존 레퍼런스 및 선행 사례

### 8.1 Claude Code Channels (공식)

- 문서: `code.claude.com/docs/en/channels`, `code.claude.com/docs/en/channels-reference`
- 커스텀 채널 구축은 공식적으로 문서화된 방법이며, `--dangerously-load-development-channels` 플래그로 로컬 테스트 가능
- MCP SDK (`@modelcontextprotocol/sdk`)를 사용한 채널 서버 구현 예제 공개

### 8.2 terminal-manager (오픈소스)

- 레포: `github.com/coneilen/terminal-manager`
- Electron + node-pty + xterm.js로 Claude Code 세션을 관리하는 데스크톱 앱
- Lazy Activation, Session Persistence, LAN Tunneling 등 구현
- ClaudeTeam의 Agent Manager 설계 시 참고 가능

### 8.3 Fakechat (Anthropic 공식 데모)

- Claude Code 플러그인으로 제공되는 로컬 전용 채팅 UI
- 커스텀 채널의 이벤트 흐름을 검증하는 데 사용
- `claude-plugins-official` 마켓플레이스에서 설치 가능

### 8.4 Hookdeck + Claude Code Channels

- 외부 웹훅을 Claude Code 세션에 연결하는 패턴
- 이벤트 리플레이를 활용한 채널 개발 워크플로우 제시

---

## 11. 알려진 제약사항 및 리스크

| 제약 | 영향 | 완화 방안 |
|------|------|----------|
| `--dangerously-load-development-channels` 필수 | 리서치 프리뷰 기간 동안 커스텀 채널에 필요 | 정식 출시 시 마켓플레이스 등록 신청 |
| Claude Code 인증 방식 제한 | claude.ai 로그인만 지원, API 키 불가 | 사용자에게 로그인 선행 안내 |
| 메시지 큐 부재 | 에이전트 세션 다운 시 메시지 유실 | Message Router에서 큐잉 후 재전송 |
| 토큰 비용 | 에이전트 수 × 독립 컨텍스트 | 토큰 모니터링 + 에이전트별 예산 제한 |
| 동시 Git 충돌 | 공유 파일 동시 수정 시 충돌 | CLAUDE.md에 파일 소유권 규칙 명시 |

---

## 12. 디렉토리 구조 (프로젝트)

```
claudeteam/
├── package.json
├── forge.config.ts
├── tsconfig.json
├── src/
│   ├── main/                       # Electron Main Process
│   │   ├── index.ts                # 앱 진입점
│   │   ├── ipc.ts                  # IPC 핸들러 등록
│   │   ├── agent/
│   │   │   ├── manager.ts          # Agent 라이프사이클
│   │   │   ├── pty.ts              # node-pty 래퍼
│   │   │   ├── claude-md.ts        # CLAUDE.md 생성기
│   │   │   └── types.ts
│   │   ├── router/
│   │   │   ├── message-router.ts   # 중앙 메시지 라우터
│   │   │   ├── api-routes.ts       # REST API 엔드포인트
│   │   │   ├── loop-guard.ts       # 루프 방지 로직
│   │   │   ├── file-resolver.ts    # 파일 참조 처리 (인라인)
│   │   │   └── filesystem-service.ts # 파일시스템 읽기/검색/탐색
│   │   ├── store/
│   │   │   ├── database.ts         # SQLite 연결
│   │   │   └── migrations/
│   │   └── permission/
│   │       └── manager.ts          # 권한 승인 관리
│   │
│   ├── channel/                    # Custom Channel Server (Bun)
│   │   ├── server.ts               # MCP 채널 서버 (Electron 모드)
│   │   ├── agent-channel.ts        # MCP 채널 서버 (Headless 모드)
│   │   └── package.json            # Bun 의존성
│   │
│   ├── mcp-tools/                  # MCP 도구 서버 (Claude Code 내부)
│   │   ├── server.ts               # team_message, team_read_file 등
│   │   └── package.json
│   │
│   ├── cli/                        # CLI 바이너리
│   │   ├── index.ts                # claudeteam 명령어 진입점
│   │   ├── commands/
│   │   │   ├── msg.ts              # claudeteam msg
│   │   │   ├── read.ts             # claudeteam read
│   │   │   ├── status.ts           # claudeteam status
│   │   │   ├── logs.ts             # claudeteam logs
│   │   │   ├── attach.ts           # claudeteam attach
│   │   │   ├── ls.ts               # claudeteam ls
│   │   │   ├── search.ts           # claudeteam search
│   │   │   └── daemon.ts           # claudeteam daemon start/stop
│   │   └── package.json
│   │
│   ├── daemon/                     # Headless 데몬 프로세스
│   │   ├── index.ts                # 데몬 진입점
│   │   ├── health.ts               # 에이전트 heartbeat 관리
│   │   └── package.json
│   │
│   ├── preload/
│   │   └── index.ts                # contextBridge
│   │
│   └── renderer/                   # React UI
│       ├── App.tsx
│       ├── components/
│       │   ├── Layout/             # 3-패널 레이아웃 셸
│       │   │   ├── AppShell.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── MainPanel.tsx
│       │   │   ├── RightPanel.tsx
│       │   │   └── BottomBar.tsx
│       │   ├── Chat/               # 관리자 채팅 뷰
│       │   │   ├── ChatView.tsx
│       │   │   ├── ChatMessage.tsx       # 역할별 스타일 메시지
│       │   │   ├── MessageInput.tsx      # @멘션 자동완성
│       │   │   ├── FileAttachPreview.tsx  # 인라인 파일 프리뷰
│       │   │   ├── CodeBlock.tsx         # shiki 구문 강조 블록
│       │   │   ├── DiffBlock.tsx         # diff 하이라이팅 블록
│       │   │   └── AgentBadge.tsx        # 에이전트 아바타+색상 뱃지
│       │   ├── Terminal/           # xterm.js 터미널 탭
│       │   │   ├── TerminalView.tsx
│       │   │   └── TerminalTab.tsx
│       │   ├── FileViewer/         # 파일 뷰어 + 탐색기
│       │   │   ├── FileTree.tsx          # 크로스 레포 트리 (react-arborist)
│       │   │   ├── CodeViewer.tsx        # Monaco 읽기전용 뷰어
│       │   │   ├── MarkdownViewer.tsx    # react-markdown 렌더링
│       │   │   ├── DiffViewer.tsx        # Git diff 뷰어
│       │   │   ├── ImageViewer.tsx       # 이미지 미리보기
│       │   │   └── QuickOpen.tsx         # Cmd+P 퍼지 파일 검색
│       │   ├── Permission/         # 권한 승인 패널
│       │   └── Monitor/            # 토큰/상태 모니터
│       ├── stores/
│       │   ├── agentStore.ts
│       │   ├── messageStore.ts
│       │   ├── fileStore.ts
│       │   └── uiStore.ts
│       └── styles/
│           └── globals.css
│
├── resources/                      # 아이콘, 템플릿
│   └── templates/
│       └── claude-md.hbs           # CLAUDE.md 핸들바 템플릿
│
└── tests/
    ├── unit/
    │   ├── router/
    │   ├── filesystem/
    │   └── cli/
    ├── integration/
    │   ├── channel-flow/
    │   └── headless/
    └── e2e/
```
