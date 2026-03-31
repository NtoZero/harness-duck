/// <reference types="bun-types" />
// ClaudeTeam — Custom MCP Channel Server (per Agent)
// Each agent gets one instance. Claude Code spawns this as a subprocess.
// stdio transport for MCP, HTTP inbound for message delivery from Router.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const AGENT_NAME = process.env.CLAUDETEAM_AGENT_NAME!;
const ROUTER_PORT = parseInt(process.env.CLAUDETEAM_ROUTER_PORT || '7632', 10);
const CHANNEL_PORT = parseInt(process.env.CLAUDETEAM_CHANNEL_PORT || '0', 10);

if (!AGENT_NAME) {
  console.error('CLAUDETEAM_AGENT_NAME environment variable is required');
  process.exit(1);
}

// ─── MCP Server Setup ───

const mcp = new Server(
  { name: `claudeteam-${AGENT_NAME}`, version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `
You are the "${AGENT_NAME}" agent in a ClaudeTeam.
Team chat messages from other agents or users arrive in <channel> tags.

Message format:
<channel source="claudeteam" sender="SenderName" type="request" chat_id="xxx">
  @${AGENT_NAME} message content here
  Referenced file: /path/to/file.ts
</channel>

Response rules:
1. Only respond to messages that @mention "${AGENT_NAME}".
2. If file paths are included, read those files directly and analyze them.
3. Always use the reply tool to respond.
4. Do not ask follow-up questions. Answer what was asked.
5. Do not initiate further conversation after responding.
    `.trim(),
  },
);

// ─── Reply Tool ───

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description: 'Send a message to the team chat. Use this to respond to incoming messages.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          chat_id: {
            type: 'string',
            description: 'The conversation ID from the incoming message',
          },
          text: {
            type: 'string',
            description: 'The response message text',
          },
        },
        required: ['chat_id', 'text'],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'reply') {
    const { chat_id, text } = request.params.arguments as {
      chat_id: string;
      text: string;
    };

    try {
      await fetch(`http://127.0.0.1:${ROUTER_PORT}/agent-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: AGENT_NAME,
          chatId: chat_id,
          text,
        }),
      });
      return { content: [{ type: 'text' as const, text: 'Message sent.' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to send message: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: 'text' as const, text: `Unknown tool: ${request.params.name}` }],
    isError: true,
  };
});

// ─── Inbound HTTP Server (receives messages from Router) ───

if (CHANNEL_PORT > 0) {
  const httpServer = Bun.serve({
    port: CHANNEL_PORT,
    hostname: '127.0.0.1',
    async fetch(req) {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const body = (await req.json()) as {
          from: string;
          chatId: string;
          message: string;
          type: string;
          files?: string[];
        };

        // Push notification to Claude Code via MCP channel
        await mcp.notification({
          method: 'notifications/claude/channel',
          params: {
            content: body.message,
            meta: {
              sender: body.from,
              chat_id: body.chatId,
              type: body.type,
              files: body.files ?? [],
            },
          },
        });

        return new Response('ok', { status: 200 });
      } catch (err) {
        return new Response(`Error: ${(err as Error).message}`, { status: 500 });
      }
    },
  });

  console.error(
    `[claudeteam-channel] Agent "${AGENT_NAME}" channel server on port ${CHANNEL_PORT}`,
  );
}

// ─── Auto-register with daemon (Headless mode) ───

async function registerWithDaemon(): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${ROUTER_PORT}/api/agents/register`, {
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
      console.error('[claudeteam-channel] Failed to register with daemon');
    }
  } catch {
    // Daemon might not be running (Electron mode manages registration)
  }
}

// Deregister on shutdown
async function deregisterFromDaemon(): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${ROUTER_PORT}/api/agents/deregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: AGENT_NAME }),
    });
  } catch {
    // Best effort
  }
}

process.on('SIGINT', async () => {
  await deregisterFromDaemon();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await deregisterFromDaemon();
  process.exit(0);
});

// Heartbeat to daemon
setInterval(async () => {
  try {
    await fetch(`http://127.0.0.1:${ROUTER_PORT}/api/agents/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: AGENT_NAME, channelPort: CHANNEL_PORT }),
    });
  } catch {
    // Daemon might not be running
  }
}, 10_000);

// ─── Start ───

await registerWithDaemon();
await mcp.connect(new StdioServerTransport());
