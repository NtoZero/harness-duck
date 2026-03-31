// ClaudeTeam — Electron Main Process Entry Point

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { SessionStore } from './session-store';
import { MessageRouter } from './message-router';
import { AgentManager } from './agent-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { startRouterHttpServer } from './router-http-server';

let mainWindow: BrowserWindow | null = null;
let store: SessionStore;
let router: MessageRouter;
let agentManager: AgentManager;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Initialize backend services
  store = new SessionStore();
  const settings = store.getAppSettings();

  router = new MessageRouter(store, {
    maxConversationDepth: settings.maxConversationDepth,
  });

  agentManager = new AgentManager(store, router);

  // Register IPC handlers
  registerIpcHandlers(mainWindow, agentManager, router, store);

  // Start HTTP server for CLI/MCP tool access
  startRouterHttpServer(router, agentManager, store, settings.routerPort);

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  // Stop all agents gracefully
  if (agentManager) {
    await agentManager.killAll();
  }
  if (store) {
    store.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
