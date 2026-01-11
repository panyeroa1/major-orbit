# DEV SESSION LOG

## Session ID: 20250523-171500
**Start Timestamp**: 2025-05-23 17:15:00

### Objective(s)
1. Decouple `appMode` from persistence so different browser tabs can act as different roles (Host/Transcriber vs Subscriber/Translator).
2. Refine bottom navbar visualizers: Mic icon (Transcribe) and Speaker icon (Translate).
3. Ensure "Neural Transcription" stage is the primary render target for live text in transcription mode.
4. Implement Meeting ID persistence and "Copy to Clipboard" management in the sidebar.

### Scope Boundaries
- `lib/state.ts`: Remove `appMode` from `persist` partialize.
- `ControlTray.tsx`: Positioning and logic for icon-based visualizers.
- `Sidebar.tsx`: UI polish for Meeting ID management.

### Files Inspected
- `lib/state.ts`
- `components/console/control-tray/ControlTray.tsx`
- `components/Sidebar.tsx`
- `index.css`

### Assumptions / Risks
- Assumption: Users will open one tab for Transcribing (Host) and another for Translating (Subscriber).
- Risk: Local cross-tab communication relies on `BroadcastChannel`, which is filtered by `meetingId`.

---
**Status**: IN_PROGRESS
