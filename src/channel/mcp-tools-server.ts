// ClaudeTeam — MCP Tools Server
// Claude Code 세션 내에서 팀 도구를 MCP 도구로 사용할 수 있게 하는 서버
// 일반 MCP 서버(채널이 아닌)로 등록되며, Claude Code가 필요에 따라 호출

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ROUTER_PORT = parseInt(process.env.CLAUDETEAM_ROUTER_PORT || '7632', 10);
const ROUTER_URL = `http://127.0.0.1:${ROUTER_PORT}`;
const AGENT_NAME = process.env.CLAUDETEAM_AGENT_NAME || 'unknown';

const server = new Server(
  { name: 'claudeteam-tools', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'team_message',
      description:
        'Send a message to the team chat. Use @agentname to mention specific agents.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          content: {
            type: 'string',
            description:
              'Message content. Use @agentname to specify recipients. Example: "@backend check the signup API spec"',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'team_read_file',
      description:
        "Read a file from another agent's repository. Only allowed paths are accessible.",
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to read' },
          lines: {
            type: 'string',
            description: 'Line range (e.g., "1-50", "100-200"). Omit for full file.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'team_list_files',
      description: "Browse an agent's repository directory structure.",
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent: { type: 'string', description: 'Agent name (e.g., "backend")' },
          subpath: {
            type: 'string',
            description: 'Sub-path within the repo (e.g., "src/auth"). Omit for root.',
          },
          depth: { type: 'number', description: 'Traversal depth (default: 2)' },
        },
        required: ['agent'],
      },
    },
    {
      name: 'team_search_files',
      description:
        'Search for a text pattern across team repositories using regex.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'Search pattern (regex supported)' },
          agent: {
            type: 'string',
            description: 'Search only in this agent\'s repo. Omit for all repos.',
          },
          glob: { type: 'string', description: 'File pattern filter (e.g., "*.ts")' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'team_status',
      description: 'Get the current status of all agents in the team.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'team_message': {
        const res = await fetch(`${ROUTER_URL}/api/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: AGENT_NAME,
            content: (args as any).content,
          }),
        });
        const data = await res.json();
        return {
          content: [
            { type: 'text' as const, text: `Message sent (chat_id: ${(data as any).chatId})` },
          ],
        };
      }

      case 'team_read_file': {
        const res = await fetch(`${ROUTER_URL}/api/fs/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: (args as any).path,
            lines: (args as any).lines,
            requester: AGENT_NAME,
          }),
        });
        const data = (await res.json()) as any;
        if (data.error) {
          return { content: [{ type: 'text' as const, text: `Error: ${data.error}` }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: data.content }] };
      }

      case 'team_list_files': {
        const res = await fetch(`${ROUTER_URL}/api/fs/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: (args as any).agent,
            subpath: (args as any).subpath,
            depth: (args as any).depth ?? 2,
          }),
        });
        const data = (await res.json()) as any;
        return { content: [{ type: 'text' as const, text: data.tree ?? 'No results' }] };
      }

      case 'team_search_files': {
        const res = await fetch(`${ROUTER_URL}/api/fs/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern: (args as any).pattern,
            agent: (args as any).agent,
            glob: (args as any).glob,
          }),
        });
        const data = (await res.json()) as any;
        const formatted = (data.results ?? [])
          .map((r: any) => `${r.file}:${r.line}: ${r.content}`)
          .join('\n');
        return { content: [{ type: 'text' as const, text: formatted || 'No results' }] };
      }

      case 'team_status': {
        const res = await fetch(`${ROUTER_URL}/api/agents`);
        const agents = (await res.json()) as any[];
        const formatted = agents
          .map((a) => `[${a.status}] ${a.name}: ${a.workingDirectory}`)
          .join('\n');
        return { content: [{ type: 'text' as const, text: formatted || 'No agents registered' }] };
      }

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

await server.connect(new StdioServerTransport());
