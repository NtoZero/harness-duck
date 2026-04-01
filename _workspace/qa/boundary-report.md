# ClaudeTeam -- Boundary Verification Report

**Date:** 2026-03-31 (3rd update -- post-feature implementation)
**Branch:** claude/stupefied-nash
**Scope:** Approval system, Token usage, AutoApproveRule, Settings persistence, SettingsPanel tabs

---

## 1. IPC Channel Consistency (types.ts -> preload.ts -> ipc-handlers.ts)

| Channel Constant | types.ts | preload.ts | ipc-handlers.ts | api.ts | Status |
|---|---|---|---|---|---|
| APPROVAL_RESPOND | L237 | L81 invoke | L111-121 handle | L111 unwrap | **PASS** |
| APPROVAL_GET_RULES | L238 | **MISSING** | L123-133 handle | **MISSING** | **FAIL** |
| APPROVAL_SAVE_RULES | L239 | **MISSING** | L135-145 handle | **MISSING** | **FAIL** |
| SETTINGS_GET | L245 | L105-106 invoke | L221-223 handle | L135-137 unwrap | PASS |
| SETTINGS_SAVE | L246 | L108-109 invoke | L225-230 handle | L138-140 unwrap | PASS |

### FAIL: APPROVAL_GET_RULES / APPROVAL_SAVE_RULES not exposed in preload

**Producer (ipc-handlers.ts L123-145):**
- `ipcMain.handle(IPC_CHANNELS.APPROVAL_GET_RULES, ...)` -- returns `ApiResponse<AutoApproveRule[]>`
- `ipcMain.handle(IPC_CHANNELS.APPROVAL_SAVE_RULES, ...)` -- accepts `AutoApproveRule[]`, returns `ApiResponse`

**Consumer (preload.ts):**
- `AutoApproveRule` is imported (L12) but never used in any method signature
- The `approval` object (L80-88) only has `respond` and `onRequest`
- Missing: `getRules` and `saveRules` methods

**Impact:** The renderer has NO way to load or persist auto-approve rules via IPC. The backend is fully wired but unreachable.

---

## 2. Preload <-> api.ts <-> Store Consistency

| Feature | preload.ts | api.ts | Store | Status |
|---|---|---|---|---|
| approval.respond | L81 | L111 | approvalStore.approve/deny | PASS |
| approval.onRequest | L84-88 | L114-116 | useIpcListeners L39-58 | PASS |
| approval.getRules | MISSING | MISSING | approvalStore -- no load call | **FAIL** |
| approval.saveRules | MISSING | MISSING | approvalStore.setAutoRules -- local only | **FAIL** |
| settings.get | L105-106 | L135-137 | App.tsx L44-46 | PASS |
| settings.save | L108-109 | L138-140 | App.tsx L74-77 | PASS |

### FAIL: AutoApproveRule round-trip broken

The `ApprovalDashboard` in App.tsx passes `onRuleChange={approvalStore.setAutoRules}` (L65). The store method `setAutoRules` (approvalStore.ts L53) only does `set({ autoRules: rules })` -- pure local state, no IPC call. Rules are never loaded from or saved to the backend.

---

## 3. Approval Workflow Completeness (end-to-end)

| # | Step | Location | Status |
|---|---|---|---|
| 1 | Terminal output `[Y/n]` detected | agent-manager.ts L34, L417-419 | PASS |
| 2 | Auto-approve check | agent-manager.ts L433-438, shouldAutoApprove L475-497 | PASS |
| 3 | Pending approval created (Map) | agent-manager.ts L441-448 | PASS |
| 4 | State -> `waiting_approval` | agent-manager.ts L450-451 | PASS |
| 5 | ApprovalRequest emitted via router-event | agent-manager.ts L453-472 | PASS |
| 6 | IPC forward to renderer | ipc-handlers.ts L272-274, case `approval_request` | PASS |
| 7 | Renderer receives + shows notification | useIpcListeners.ts L39-58, addApprovalRequest + addNotification | PASS |
| 8 | User approves/denies | approvalStore.approve/deny -> api.approval.respond | PASS |
| 9 | IPC handler processes | ipc-handlers.ts L111-121 -> agentManager.handleApprovalResponse | PASS |
| 10 | PTY write `y\n` or `n\n` | agent-manager.ts L244-245 | PASS |
| 11 | State restore to `running` | agent-manager.ts L248-249 | PASS |
| 12 | Audit log written | agent-manager.ts L252 | PASS |

**Verdict: PASS** -- The core approval workflow is fully connected end-to-end.

---

## 4. AutoApproveRule Flow

| # | Step | Location | Status |
|---|---|---|---|
| 1 | DB table `auto_approve_rules` | session-store.ts L129-139, migration v2 | PASS |
| 2 | Store save (delete-all + re-insert) | session-store.ts L382-390 | PASS |
| 3 | Store load | session-store.ts L393-399 | PASS |
| 4 | AgentManager loads on constructor | agent-manager.ts L51 | PASS |
| 5 | AgentManager get/set methods | agent-manager.ts L257-264 | PASS |
| 6 | Pattern matching in shouldAutoApprove | agent-manager.ts L475-497 | PASS |
| 7 | IPC handler GET | ipc-handlers.ts L123-133 | PASS |
| 8 | IPC handler SAVE | ipc-handlers.ts L135-145 | PASS |
| 9 | **Preload exposure** | **MISSING** | **FAIL** |
| 10 | **api.ts wrapper** | **MISSING** | **FAIL** |
| 11 | **Store IPC integration** | approvalStore.setAutoRules -- local only | **FAIL** |

**Verdict: FAIL** -- Backend fully wired (steps 1-8 PASS). Renderer-side bridge is broken (steps 9-11 FAIL).

---

## 5. Settings Persistence

| # | Step | Location | Status |
|---|---|---|---|
| 1 | App.tsx loads on mount | L44-46, `api.settings.get().then(setSettings)` | PASS |
| 2 | SettingsPanel draft init | L21, `useState(settings)` | **ISSUE** |
| 3 | SettingsPanel onSave | App.tsx L74-77, `api.settings.save(newSettings)` | PASS |
| 4 | IPC SETTINGS_SAVE handler | ipc-handlers.ts L225-230 | PASS |
| 5 | SessionStore SQLite persist | session-store.ts L348-349 | PASS |

### ISSUE: Draft not synced with async prop update

`SettingsPanel` uses `useState(settings)` for the draft (L21). React's `useState` only uses the argument as the **initial** value. When `App.tsx` loads settings asynchronously (L44-46) and updates the prop, the SettingsPanel draft will NOT reflect the loaded values -- it will remain stuck at `DEFAULT_SETTINGS`.

**Fix:** Add to SettingsPanel:
```tsx
useEffect(() => { setDraft(settings); }, [settings]);
```

### Minor: Default value mismatch

| Field | App.tsx DEFAULT_SETTINGS | session-store default |
|---|---|---|
| theme | `'dark'` | `'system'` |
| killAllShortcut | `'Cmd+Shift+K'` | `'CmdOrCtrl+Shift+K'` |

If the DB has no saved settings, the store returns `theme: 'system'`. But if the API call fails/times-out, App.tsx falls back to `theme: 'dark'`. The killAllShortcut mismatch means `'Cmd+Shift+K'` (macOS only) vs `'CmdOrCtrl+Shift+K'` (cross-platform Electron format).

---

## 6. SettingsPanel Tab Implementation

| Tab | Content | Status |
|---|---|---|
| general | Theme radio, model select, router port input | PASS -- real UI |
| team | TeamPreset CRUD (add/remove preset, add/remove agents per preset, name/role/model editing), shared doc paths list | PASS -- real UI |
| safeguards | maxConversationDepth, tokenWarningThreshold, writeScope radio, killAllShortcut | PASS -- real UI |
| advanced | routerPort, maxConversationDepth, tokenWarningThreshold, writeScope select, killAllShortcut | PASS -- real UI |

**Note:** `advanced` tab duplicates fields from `general` (routerPort) and `safeguards` (maxConversationDepth, tokenWarningThreshold, writeScope, killAllShortcut). The shared draft means edits in one tab are visible in the other, so correctness is maintained. This is a UX concern, not a bug.

---

## 7. Token Usage

| # | Step | Location | Status |
|---|---|---|---|
| 1 | Regex patterns (2 fallbacks) | agent-manager.ts L35-37 | PASS |
| 2 | Output buffering (4KB cap) | agent-manager.ts L408-414 | PASS |
| 3 | Token parsing | agent-manager.ts L499-530 | PASS |
| 4 | State update emitted | agent-manager.ts L514 | PASS |
| 5 | Warning threshold from settings | agent-manager.ts L518 | PASS |
| 6 | Warning emitted via router-event | agent-manager.ts L519-524 | PASS |

**Semantic note:** Token warning reuses `type: 'loop_warning'` event. This is technically not a loop warning but a token budget warning. The renderer displays it as a generic warning notification via `useIpcListeners.ts L28-37`, so it works, but the `type` name is misleading.

---

## 8. Type Safety

| Check | Status |
|---|---|
| AutoApproveRule consistent across types.ts / agent-manager.ts / session-store.ts / ipc-handlers.ts | PASS |
| ApprovalRequest shape matches emission in agent-manager.ts L455-464 vs types.ts L49-59 | PASS |
| AgentState.tokenUsage matches TokenUsage interface | PASS |
| RouterEvent union includes `approval_request` variant | PASS |
| AppSettings fields match SettingsPanel usage | PASS |
| preload.ts imports AutoApproveRule (L12) but never uses it | PASS (confirms intent, not a type error) |
| AgentCreateInput.workingDirectory required in team preset editor (L339: empty string default) | PASS (required field, editor provides input) |

---
