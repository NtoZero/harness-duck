#!/usr/bin/env node

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(import.meta.dirname, "..", "mine", "prompts");
mkdirSync(LOG_DIR, { recursive: true });

// Date-based log file: YYYY-MM-DD.json (local timezone)
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const LOG_FILE = join(LOG_DIR, `${today}.json`);

// Read hook input from stdin
const raw = readFileSync(process.stdin.fd, "utf-8");
const input = JSON.parse(raw);

const event = input.hook_event_name;
let entry;

if (event === "UserPromptSubmit") {
  entry = {
    timestamp: new Date().toISOString(),
    role: "user",
    session_id: input.session_id,
    content: input.prompt,
  };
} else if (event === "Stop") {
  // Read transcript to extract the last assistant message
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    process.exit(0);
  }

  const lines = readFileSync(transcriptPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean);

  // Walk backward to find the last assistant message
  let assistantContent = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const msg = JSON.parse(lines[i]);
      if (msg.role === "assistant") {
        // Extract text from content blocks
        if (typeof msg.content === "string") {
          assistantContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          assistantContent = msg.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        }
        break;
      }
    } catch {
      continue;
    }
  }

  if (!assistantContent) {
    process.exit(0);
  }

  entry = {
    timestamp: new Date().toISOString(),
    role: "assistant",
    session_id: input.session_id,
    content: assistantContent,
  };
} else {
  process.exit(0);
}

// Append to daily JSON array
let logs = [];
if (existsSync(LOG_FILE)) {
  try {
    logs = JSON.parse(readFileSync(LOG_FILE, "utf-8"));
  } catch {
    logs = [];
  }
}
logs.push(entry);
writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2) + "\n");

process.exit(0);
