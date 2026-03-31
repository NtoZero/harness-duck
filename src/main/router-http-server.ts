// ClaudeTeam — Router HTTP Server
// CLI 및 MCP 도구 서버가 호출하는 REST API 제공

import { createServer, IncomingMessage, ServerResponse } from 'http';
import type { MessageRouter } from './message-router';
import type { AgentManager } from './agent-manager';
import type { SessionStore } from './session-store';

let sseClients: ServerResponse[] = [];

export function startRouterHttpServer(
  router: MessageRouter,
  agentManager: AgentManager,
  store: SessionStore,
  port: number,
): void {
  const server = createServer(async (req, res) => {
    // CORS for local access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    try {
      switch (url.pathname) {
        case '/api/message':
          return await handleMessage(req, res, router);

        case '/api/agents':
          return handleAgents(res, agentManager);

        case '/api/agents/register':
          return await handleAgentRegister(req, res, router);

        case '/api/agents/deregister':
          return await handleAgentDeregister(req, res, router);

        case '/api/agents/heartbeat':
          return await handleHeartbeat(req, res, router);

        case '/api/fs/read':
          return await handleFileRead(req, res);

        case '/api/fs/list':
          return await handleFileList(req, res, router);

        case '/api/fs/search':
          return await handleFileSearch(req, res, router);

        case '/api/messages':
          return handleMessages(url, res, store);

        case '/api/messages/stream':
          return handleSSE(res, router);

        case '/agent-reply':
          return await handleAgentReply(req, res, router);

        default:
          jsonResponse(res, 404, { success: false, error: 'Not Found' });
      }
    } catch (err) {
      jsonResponse(res, 500, { success: false, error: (err as Error).message });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`ClaudeTeam Router HTTP server listening on 127.0.0.1:${port}`);
  });
}

// ─── Handlers ───

async function handleMessage(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  const { from, content, chatId } = body;

  const msg = await router.routeMessage({
    chatId: chatId ?? `chat-${Date.now()}`,
    from: from ?? 'human',
    content,
    files: [],
    type: from === 'human' ? 'request' : 'response',
    conversationDepth: 0,
  });

  jsonResponse(res, 200, { success: true, chatId: msg.chatId, messageId: msg.id });
}

function handleAgents(res: ServerResponse, agentManager: AgentManager): void {
  const agents = agentManager.getAllAgentStates();
  jsonResponse(res, 200, agents);
}

async function handleAgentRegister(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  const { name, channelPort, workingDirectory } = body;

  if (!name || !channelPort) {
    jsonResponse(res, 400, { success: false, error: 'name and channelPort required' });
    return;
  }

  router.registerAgent(name, channelPort, workingDirectory ?? process.cwd());
  jsonResponse(res, 200, { success: true });
}

async function handleAgentDeregister(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  router.deregisterAgent(body.name);
  jsonResponse(res, 200, { success: true });
}

async function handleHeartbeat(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  router.heartbeat(body.name);
  jsonResponse(res, 200, { success: true });
}

async function handleFileRead(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  const { path: filePath, lines } = body;

  const fs = await import('fs');
  if (!fs.existsSync(filePath)) {
    jsonResponse(res, 404, { error: `File not found: ${filePath}` });
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  if (lines) {
    const [start, end] = lines.split('-').map(Number);
    const allLines = content.split('\n');
    content = allLines.slice(start - 1, end).join('\n');
  }

  if (content.length > 50000) {
    content = content.substring(0, 50000) + '\n... [truncated]';
  }

  jsonResponse(res, 200, { content });
}

async function handleFileList(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  const { target, depth } = body;

  const agent = router.getAgent(target);
  if (!agent) {
    jsonResponse(res, 404, { error: `Agent "${target}" not found` });
    return;
  }

  const fs = await import('fs');
  const pathMod = await import('path');

  const basePath = body.subpath
    ? pathMod.join(agent.workingDirectory, body.subpath)
    : agent.workingDirectory;

  const tree = buildTree(fs, pathMod, basePath, depth ?? 2);
  jsonResponse(res, 200, { tree });
}

async function handleFileSearch(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  const { pattern, agent: agentName } = body;

  const agents = router.getRegisteredAgents();
  const targetDirs = agentName
    ? agents.filter((a) => a.name === agentName).map((a) => a.workingDirectory)
    : agents.map((a) => a.workingDirectory);

  // Use grep approach for simple implementation
  const results: Array<{ file: string; line: number; content: string }> = [];
  const fs = await import('fs');
  const pathMod = await import('path');

  for (const dir of targetDirs) {
    searchDir(fs, pathMod, dir, pattern, results, 50);
  }

  jsonResponse(res, 200, { results });
}

function handleMessages(
  url: URL,
  res: ServerResponse,
  store: SessionStore,
): void {
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const messages = store.getMessages(limit);
  jsonResponse(res, 200, messages);
}

function handleSSE(res: ServerResponse, router: MessageRouter): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  sseClients.push(res);

  const handler = (event: any) => {
    if (event.type === 'message') {
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    }
  };

  router.on('router-event', handler);

  res.on('close', () => {
    router.removeListener('router-event', handler);
    sseClients = sseClients.filter((c) => c !== res);
  });
}

async function handleAgentReply(
  req: IncomingMessage,
  res: ServerResponse,
  router: MessageRouter,
): Promise<void> {
  const body = await readBody(req);
  const { from, chatId, text } = body;

  await router.handleAgentReply(from, chatId, text);
  jsonResponse(res, 200, { success: true });
}

// ─── Utilities ───

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function buildTree(
  fs: typeof import('fs'),
  pathMod: typeof import('path'),
  dirPath: string,
  maxDepth: number,
  depth = 0,
  prefix = '',
): string {
  if (depth >= maxDepth || !fs.existsSync(dirPath)) return '';

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const filtered = entries
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  let result = '';
  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    result += `${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;

    if (entry.isDirectory()) {
      result += buildTree(
        fs,
        pathMod,
        pathMod.join(dirPath, entry.name),
        maxDepth,
        depth + 1,
        prefix + childPrefix,
      );
    }
  }

  return result;
}

function searchDir(
  fs: typeof import('fs'),
  pathMod: typeof import('path'),
  dirPath: string,
  pattern: string,
  results: Array<{ file: string; line: number; content: string }>,
  maxResults: number,
): void {
  if (results.length >= maxResults || !fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const regex = new RegExp(pattern, 'gi');

  for (const entry of entries) {
    if (results.length >= maxResults) return;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const fullPath = pathMod.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      searchDir(fs, pathMod, fullPath, pattern, results, maxResults);
    } else {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          if (regex.test(lines[i])) {
            results.push({ file: fullPath, line: i + 1, content: lines[i].trim() });
            regex.lastIndex = 0;
          }
        }
      } catch {
        // Skip binary or unreadable files
      }
    }
  }
}
