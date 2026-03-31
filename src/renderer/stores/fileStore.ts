import { create } from 'zustand';
import type { FileContent } from '@shared/types';
import { api } from '../ipc/api';

interface FileStore {
  openFiles: Map<string, FileContent>;
  selectedPath: string | null;
  fileTreeState: Map<string, boolean>;
  /** Raw directory tree text per agent. Main returns string, not FileTreeNode[]. */
  fileTrees: Map<string, string>;

  selectFile: (path: string | null) => void;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  toggleTreeNode: (path: string) => void;
  loadFileTree: (agentName: string) => Promise<void>;
}

export const useFileStore = create<FileStore>((set, get) => ({
  openFiles: new Map(),
  selectedPath: null,
  fileTreeState: new Map(),
  fileTrees: new Map(),

  selectFile: (path) => set({ selectedPath: path }),

  openFile: async (filePath) => {
    if (get().openFiles.has(filePath)) {
      set({ selectedPath: filePath });
      return;
    }
    // Main expects FileReadRequest: { path, lines?, requester? }
    const contentText = await api.file.read({ path: filePath });

    // Determine language from file extension
    const ext = filePath.split('.').pop() ?? '';
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', md: 'Markdown',
      json: 'JSON', yaml: 'YAML', yml: 'YAML', css: 'CSS', html: 'HTML',
      sql: 'SQL', sh: 'Shell', bash: 'Shell',
    };
    const language = langMap[ext] ?? ext;

    const fileContent: FileContent = {
      path: filePath,
      content: contentText,
      language,
      agentName: '',
      lastModified: new Date(),
    };

    set((s) => {
      const next = new Map(s.openFiles);
      next.set(filePath, fileContent);
      return { openFiles: next, selectedPath: filePath };
    });
  },

  closeFile: (path) => {
    set((s) => {
      const next = new Map(s.openFiles);
      next.delete(path);
      const selectedPath = s.selectedPath === path
        ? (next.size > 0 ? next.keys().next().value ?? null : null)
        : s.selectedPath;
      return { openFiles: next, selectedPath };
    });
  },

  toggleTreeNode: (path) => {
    set((s) => {
      const next = new Map(s.fileTreeState);
      next.set(path, !next.get(path));
      return { fileTreeState: next };
    });
  },

  loadFileTree: async (agentName) => {
    // Main expects FileListRequest: { target (agent name), subpath?, depth? }
    const tree = await api.file.list({ target: agentName, depth: 3 });
    set((s) => {
      const next = new Map(s.fileTrees);
      next.set(agentName, tree);
      return { fileTrees: next };
    });
  },
}));
