# ClaudeTeam -- Issue List

**Date:** 2026-04-01
**Branch:** claude/stupefied-nash
**Scope:** Post-feature implementation verification

---

## Critical (Runtime breakage)

### ISSUE-001: preload.ts missing approval.getRules / approval.saveRules

**Severity:** CRITICAL
**Category:** IPC channel gap (producer exists, consumer bridge missing)

**Where:**
- Producer: `src/main/ipc-handlers.ts` L123-145 -- handlers registered for `APPROVAL_GET_RULES` and `APPROVAL_SAVE_RULES`
- Gap: `src/main/preload.ts` L80-88 -- `approval` object only has `respond` and `onRequest`
- Gap: `src/renderer/ipc/api.ts` L109-117 -- `api.approval` only has `respond` and `onRequest`
- Gap: `src/renderer/stores/approvalStore.ts` L53 -- `setAutoRules` does local-only `set({ autoRules: rules })`, no IPC call

**Impact:** Auto-approve rules edited in the ApprovalDashboard are never saved to the backend. On app restart, all rules are lost. Rules are also never loaded from the backend on app start.

**Fix (3 files):**

1. **preload.ts** -- Add to `approval` object:
```typescript
getRules: (): Promise<ApiResponse<AutoApproveRule[]>> =>
  ipcRenderer.invoke(IPC_CHANNELS.APPROVAL_GET_RULES),

saveRules: (rules: AutoApproveRule[]): Promise<ApiResponse> =>
  ipcRenderer.invoke(IPC_CHANNELS.APPROVAL_SAVE_RULES, rules),
```

2. **api.ts** -- Add to `api.approval`:
```typescript
getRules: async (): Promise<AutoApproveRule[]> => {
  return unwrap(await getElectron().approval.getRules());
},
saveRules: async (rules: AutoApproveRule[]): Promise<void> => {
  unwrap(await getElectron().approval.saveRules(rules));
},
```
Also add `AutoApproveRule` to the import, and add `getRules`/`saveRules` to the mock's `approval` object.

3. **approvalStore.ts** -- Update `setAutoRules` to persist:
```typescript
setAutoRules: async (rules) => {
  await api.approval.saveRules(rules);
  set({ autoRules: rules });
},
```
Add a `loadRules` action or call `api.approval.getRules()` on init.

---

## Major (Incorrect behavior, no crash)

### ISSUE-002: SettingsPanel draft not synced with async settings load

**Severity:** MAJOR
**Category:** React state lifecycle (stale initial value)

**Where:** `src/renderer/components/modals/SettingsPanel.tsx` L21

**Symptom:** User opens Settings immediately after app launch. The panel shows `DEFAULT_SETTINGS` (theme: 'dark', killAllShortcut: 'Cmd+Shift+K') instead of the saved settings from SQLite (e.g., theme: 'system'). Saving from this state would overwrite the real settings with defaults.

**Fix:** Add after L21:
```tsx
React.useEffect(() => { setDraft(settings); }, [settings]);
```

### ISSUE-003: Default settings mismatch between App.tsx and session-store.ts

**Severity:** MAJOR
**Category:** Configuration inconsistency

**Where:**
- `src/renderer/App.tsx` L18-30: `theme: 'dark'`, `killAllShortcut: 'Cmd+Shift+K'`
- `src/main/session-store.ts` L333-345: `theme: 'system'`, `killAllShortcut: 'CmdOrCtrl+Shift+K'`

**Impact:** If the settings API call fails, the renderer shows different defaults than what the backend would use. The `killAllShortcut` format `'Cmd+Shift+K'` is macOS-only; Electron expects `'CmdOrCtrl+Shift+K'` for cross-platform support.

**Fix:** Align App.tsx DEFAULT_SETTINGS with session-store defaults. Use `'CmdOrCtrl+Shift+K'` and `'system'` theme in both places. Ideally, extract defaults to a shared constant in `src/shared/types.ts`.

---

## Minor (UX / code quality)

### ISSUE-004: Token warning reuses loop_warning event type

**Severity:** MINOR
**Category:** Semantic mismatch

**Where:** `src/main/agent-manager.ts` L519-524

**Detail:** Token budget exceeded is emitted as `type: 'loop_warning'`. The renderer shows it as a generic warning notification with title "Loop Warning". Users may confuse token exhaustion with a conversation loop.

**Fix:** Add a new RouterEvent variant `type: 'token_warning'` to `src/shared/types.ts` and handle it separately in `ipc-handlers.ts` / `useIpcListeners.ts`.

### ISSUE-005: Advanced tab duplicates fields from general and safeguards tabs

**Severity:** MINOR
**Category:** UX duplication

**Where:** `src/renderer/components/modals/SettingsPanel.tsx` L416-479

**Detail:** `routerPort` appears in both `general` and `advanced` tabs. `maxConversationDepth`, `tokenWarningThreshold`, `writeScope`, `killAllShortcut` appear in both `safeguards` and `advanced` tabs. Edits sync via shared draft, so no data inconsistency, but users may be confused.

**Fix:** Remove duplicated fields from `advanced` tab, or consolidate `safeguards` and `advanced` into one tab.

---

## Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 1 | Open |
| MAJOR | 2 | Open |
| MINOR | 2 | Open |
| **Total** | **5** | |
