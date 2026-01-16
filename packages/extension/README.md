# DS-Pro Automation Hub — Chrome Extension

Manifest V3 Chrome extension for automating eBay-to-Amazon order processing.

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `extension` folder

## Architecture

### Single Codebase, Role-Based Behavior

The extension runs in multiple Chrome profiles:
- **eBay Profile**: Scans orders, creates backend jobs
- **Amazon Profile(s)**: Claims jobs, completes auto-orders

Role is determined during pairing (6-digit code from admin dashboard).

### Key Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 configuration |
| `service-worker.js` | Scheduler, locks, API calls |
| `sidepanel.html/css/js` | Hub UI (ONLY UI surface) |
| `content/overlay.js` | Lock overlay + message routing |
| `content/extract-ebay.js` | eBay page extraction |
| `content/extract-amazon.js` | Amazon page extraction |

### Event-Driven Scheduler

**No polling loops.** Scheduler triggers on:
- Task enqueue
- Lock release
- WebNavigation events
- Side panel commands

Alarms are used only for coarse periodic triggers:
- `ebay_scan`: Every 3 hours
- `job_poll`: Every 2 minutes
- `heartbeat`: Every 1 minute

### Resource Locks

UI-driving automations serialize per resource:
- `AMAZON_UI`: Max 1 concurrent
- `EBAY_UI`: Max 1 concurrent
- `BACKEND_API`: Unlimited concurrent

### Side Panel

The side panel is the **only** UI surface:
- Live status monitoring
- Task queue view
- Needs Attention inbox
- Pause/Resume/Emergency Stop controls

Enabled only on eBay/Amazon tabs via `chrome.sidePanel.setOptions()`.

### Lock Overlay

When automation is running:
- Banner shows at top: "DS-Pro Automation running"
- User input (click/scroll/keyboard) is blocked
- Programmatic DOM manipulation still works
- Emergency hotkeys always available:
  - `Ctrl+Shift+P`: Pause All
  - `Ctrl+Shift+X`: Emergency Stop

## Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `install_instance_id` | UUID | Unique per Chrome profile install |
| `agent_id` | UUID | Backend agent identifier |
| `install_token` | JWT | API authentication |
| `agent_role` | string | `EBAY_AGENT` or `AMAZON_AGENT` |
| `tasks` | object | Task queue (id -> task) |
| `locks` | object | Lock state (resource -> holder) |
| `attention_items` | array | Needs attention queue |
| `scheduler_status` | string | `running` / `paused` / `stopped` |

## Development Notes

### Extraction Selectors

The extraction scripts (`extract-ebay.js`, `extract-amazon.js`) contain **placeholder selectors** that must be updated based on actual page structure:

```javascript
// PLACEHOLDER SELECTOR - update based on real eBay/Amazon markup
const itemNameEl = document.querySelector(
  '[data-testid="item-title"], ' +
  '.item-title, ' +
  '.order-item-name'
);
```

eBay and Amazon frequently change their page structure. Expect to maintain these selectors.

### Tab Groups

Automation tabs are organized into groups:
- `DS-Pro | Auto` — Running tasks (collapsed, blue)
- `DS-Pro | ATTN` — Needs attention (expanded, red)

### Bookmarks (Optional)

When a task enters NEEDS_ATTENTION, a bookmark is created in "DS-Pro Needs Attention" folder pointing to the blocked page.

## Verification Checklist

- [ ] Extension installs without errors
- [ ] Side panel opens on eBay/Amazon tabs only
- [ ] Pairing flow stores agent credentials
- [ ] Fake tasks demonstrate lock serialization
- [ ] Lock overlay blocks user input
- [ ] `Ctrl+Shift+P` pauses all tasks
- [ ] `Ctrl+Shift+X` emergency stops all tasks
- [ ] Tab groups are created correctly
- [ ] Side panel shows live state updates

## Hotkeys

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Pause All |
| `Ctrl+Shift+X` / `Cmd+Shift+X` | Emergency Stop |
