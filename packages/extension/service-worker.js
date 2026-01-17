/**
 * DS-Pro Automation Hub — Service Worker
 *
 * Event-driven scheduler with resource locks.
 * No polling loops — uses alarms for coarse triggers only.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const API_BASE = 'http://localhost:8000'; // TODO: Configure for production

const LOCK_RESOURCES = {
  AMAZON_UI: { maxConcurrency: 1 },
  EBAY_UI: { maxConcurrency: 1 },
  BACKEND_API: { maxConcurrency: 10 },
};

const TAB_GROUPS = {
  AUTO: { title: 'DS-Pro | Auto', color: 'blue' },
  ATTN: { title: 'DS-Pro | ATTN', color: 'red' },
};

const TASK_STATES = {
  PENDING: 'PENDING',
  LOCKED: 'LOCKED',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/** @type {Set<chrome.runtime.Port>} */
const sidePanelPorts = new Set();

/**
 * Get current state from storage
 */
async function getState() {
  const data = await chrome.storage.local.get([
    'install_instance_id',
    'agent_id',
    'install_token',
    'agent_role',
    'label',
    'account_name',
    'tasks',
    'locks',
    'attention_items',
    'active_tabs',
    'scheduler_status',
    // Pairing flow state
    'pairing_request_id',
    'pairing_status',
    'device_status',
    'next_allowed_at',
    'cooldown_seconds',
    'lifetime_request_count',
    'pairing_error',
    'pairing_expires_at',
  ]);
  return {
    install_instance_id: data.install_instance_id || null,
    agent_id: data.agent_id || null,
    install_token: data.install_token || null,
    agent_role: data.agent_role || null,
    label: data.label || null,
    account_name: data.account_name || null,
    tasks: data.tasks || {},
    locks: data.locks || {},
    attention_items: data.attention_items || [],
    active_tabs: data.active_tabs || {},
    scheduler_status: data.scheduler_status || 'stopped',
    // Pairing flow state
    pairing_request_id: data.pairing_request_id || null,
    pairing_status: data.pairing_status || null,
    device_status: data.device_status || null,
    next_allowed_at: data.next_allowed_at || null,
    cooldown_seconds: data.cooldown_seconds || 0,
    lifetime_request_count: data.lifetime_request_count || 0,
    pairing_error: data.pairing_error || null,
    pairing_expires_at: data.pairing_expires_at || null,
  };
}

/**
 * Update state in storage and broadcast to side panels
 */
async function updateState(updates) {
  await chrome.storage.local.set(updates);
  broadcastState();
}

/**
 * Broadcast current state to all connected side panels
 */
async function broadcastState() {
  const state = await getState();
  const summary = buildStateSummary(state);
  for (const port of sidePanelPorts) {
    try {
      port.postMessage({ type: 'STATE_UPDATE', state: summary });
    } catch (e) {
      console.warn('[SW] Failed to send to port:', e);
    }
  }
}

/**
 * Build summary for side panel display
 * NOTE: Never include install_token or other secrets here
 */
function buildStateSummary(state) {
  const tasks = Object.values(state.tasks);
  const runningTask = tasks.find(t => t.state === TASK_STATES.RUNNING);
  const pendingTasks = tasks.filter(t => t.state === TASK_STATES.PENDING);

  return {
    paired: !!state.agent_id,
    agent_role: state.agent_role,
    label: state.label,
    account_name: state.account_name,
    install_instance_id: state.install_instance_id,  // For display
    scheduler_status: state.scheduler_status,
    running_task: runningTask ? {
      id: runningTask.id,
      type: runningTask.automation_type,
      stage: runningTask.current_stage,
      started_at: runningTask.started_at,
      last_action: runningTask.last_action,
    } : null,
    pending_count: pendingTasks.length,
    attention_count: state.attention_items.length,
    attention_items: state.attention_items,
    // Pairing flow state (no secrets)
    pairing_request_id: state.pairing_request_id,
    pairing_status: state.pairing_status,
    device_status: state.device_status,
    next_allowed_at: state.next_allowed_at,
    cooldown_seconds: state.cooldown_seconds,
    lifetime_request_count: state.lifetime_request_count,
    pairing_error: state.pairing_error,
    pairing_expires_at: state.pairing_expires_at,
  };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize extension on first install or startup
 */
async function initialize() {
  console.log('[SW] Initializing...');

  // Generate install_instance_id if not exists
  const { install_instance_id } = await chrome.storage.local.get('install_instance_id');
  if (!install_instance_id) {
    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ install_instance_id: newId });
    console.log('[SW] Generated install_instance_id:', newId);
  }

  // Initialize default state
  const state = await getState();
  if (!state.locks || Object.keys(state.locks).length === 0) {
    const locks = {};
    for (const resource of Object.keys(LOCK_RESOURCES)) {
      locks[resource] = { held_by: null, acquired_at: null };
    }
    await chrome.storage.local.set({ locks });
  }

  // Configure side panel to open on extension icon click
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Set up alarms (coarse triggers only)
  await setupAlarms();

  // Recover any interrupted tasks
  await recoverTasks();

  console.log('[SW] Initialization complete');
}

/**
 * Set up periodic alarms
 */
async function setupAlarms() {
  // Clear existing alarms
  await chrome.alarms.clearAll();

  // Job poll every 2 minutes (for Amazon agent)
  chrome.alarms.create('job_poll', { periodInMinutes: 2 });

  // eBay scan every 3 hours (for eBay agent)
  chrome.alarms.create('ebay_scan', { periodInMinutes: 180 });

  // Heartbeat every 1 minute
  chrome.alarms.create('heartbeat', { periodInMinutes: 1 });

  console.log('[SW] Alarms configured');
}

/**
 * Recover tasks after service worker restart
 */
async function recoverTasks() {
  const state = await getState();
  const tasks = state.tasks;

  for (const task of Object.values(tasks)) {
    if (task.state === TASK_STATES.RUNNING || task.state === TASK_STATES.LOCKED) {
      console.log('[SW] Recovering task:', task.id);

      if (task.checkpoints && task.checkpoints.length > 0) {
        // Has checkpoints, try to resume
        task.state = TASK_STATES.PENDING;
        task.resumed_from = task.checkpoints[task.checkpoints.length - 1].stage;
      } else {
        // No checkpoints, mark needs attention
        await markNeedsAttention(task.id, 'RESTART_NO_CHECKPOINT');
      }
    }
  }

  // Release any orphaned locks
  const locks = { ...state.locks };
  for (const [resource, lock] of Object.entries(locks)) {
    if (lock.held_by && !tasks[lock.held_by]) {
      locks[resource] = { held_by: null, acquired_at: null };
      console.log('[SW] Released orphaned lock:', resource);
    }
  }

  await updateState({ tasks, locks });
  await tryStartNextTask();
}

// =============================================================================
// SCHEDULER — EVENT-DRIVEN
// =============================================================================

/**
 * Try to start the next pending task (called on various events)
 */
async function tryStartNextTask() {
  const state = await getState();

  if (state.scheduler_status !== 'running') {
    return;
  }

  // Find pending tasks sorted by creation time
  const pendingTasks = Object.values(state.tasks)
    .filter(t => t.state === TASK_STATES.PENDING)
    .sort((a, b) => a.created_at - b.created_at);

  for (const task of pendingTasks) {
    const acquired = await acquireLocks(task.id, task.required_locks);
    if (acquired) {
      await startTask(task.id);
      return; // Start one task at a time
    }
  }
}

/**
 * Attempt to acquire all required locks atomically
 */
async function acquireLocks(taskId, requiredLocks) {
  const state = await getState();
  const locks = { ...state.locks };
  const tasks = { ...state.tasks };

  // Check if all locks are available
  for (const resource of requiredLocks) {
    const lock = locks[resource];
    if (lock && lock.held_by && lock.held_by !== taskId) {
      return false; // Lock not available
    }
  }

  // Acquire all locks
  const now = Date.now();
  for (const resource of requiredLocks) {
    locks[resource] = { held_by: taskId, acquired_at: now };
  }

  // Update task state
  if (tasks[taskId]) {
    tasks[taskId].state = TASK_STATES.LOCKED;
    tasks[taskId].locked_at = now;
  }

  await updateState({ locks, tasks });
  console.log('[SW] Acquired locks for task:', taskId, requiredLocks);
  return true;
}

/**
 * Release locks held by a task
 */
async function releaseLocks(taskId) {
  const state = await getState();
  const locks = { ...state.locks };

  for (const [resource, lock] of Object.entries(locks)) {
    if (lock.held_by === taskId) {
      locks[resource] = { held_by: null, acquired_at: null };
      console.log('[SW] Released lock:', resource);
    }
  }

  await updateState({ locks });

  // Trigger next task
  await tryStartNextTask();
}

/**
 * Start a task that has acquired its locks
 */
async function startTask(taskId) {
  const state = await getState();
  const tasks = { ...state.tasks };
  const task = tasks[taskId];

  if (!task) {
    console.error('[SW] Task not found:', taskId);
    return;
  }

  task.state = TASK_STATES.RUNNING;
  task.started_at = Date.now();
  task.current_stage = task.stages?.[0] || 'STARTED';
  task.last_action = 'Task started';

  await updateState({ tasks });
  console.log('[SW] Started task:', taskId);

  // For demo: if this is a fake task, simulate progress
  if (task.automation_type === 'FAKE_TASK') {
    await simulateFakeTask(taskId);
  }
}

/**
 * Complete a task successfully
 */
async function completeTask(taskId) {
  const state = await getState();
  const tasks = { ...state.tasks };
  const task = tasks[taskId];

  if (!task) return;

  task.state = TASK_STATES.COMPLETED;
  task.completed_at = Date.now();
  task.last_action = 'Task completed';

  await updateState({ tasks });
  await releaseLocks(taskId);

  console.log('[SW] Completed task:', taskId);
}

/**
 * Fail a task
 */
async function failTask(taskId, reason) {
  const state = await getState();
  const tasks = { ...state.tasks };
  const task = tasks[taskId];

  if (!task) return;

  task.state = TASK_STATES.FAILED;
  task.failed_at = Date.now();
  task.failure_reason = reason;
  task.last_action = `Failed: ${reason}`;

  await updateState({ tasks });
  await releaseLocks(taskId);

  console.log('[SW] Failed task:', taskId, reason);
}

/**
 * Mark task as needing attention
 */
async function markNeedsAttention(taskId, reason) {
  const state = await getState();
  const tasks = { ...state.tasks };
  const task = tasks[taskId];

  if (!task) return;

  task.state = TASK_STATES.NEEDS_ATTENTION;
  task.attention_reason = reason;
  task.last_action = `Needs attention: ${reason}`;

  // Add to attention items
  const attention_items = [...state.attention_items];
  attention_items.push({
    id: crypto.randomUUID(),
    task_id: taskId,
    reason,
    created_at: Date.now(),
    tab_id: task.tab_id,
  });

  await updateState({ tasks, attention_items });
  await releaseLocks(taskId);

  // Move tab to ATTN group if exists
  if (task.tab_id) {
    await moveTabToGroup(task.tab_id, TAB_GROUPS.ATTN.title, false);
    await unlockTab(task.tab_id);
  }

  // Create bookmark (optional)
  if (task.url) {
    await createAttentionBookmark(taskId, task.url, reason);
  }

  console.log('[SW] Task needs attention:', taskId, reason);
}

// =============================================================================
// TASK MANAGEMENT API
// =============================================================================

/**
 * Queue a new task
 */
async function queueTask(taskDef) {
  const state = await getState();
  const tasks = { ...state.tasks };

  const task = {
    id: crypto.randomUUID(),
    automation_type: taskDef.type,
    required_locks: taskDef.locks || [],
    timeout_ms: taskDef.timeout || 600000,
    stages: taskDef.stages || [],
    context: taskDef.context || {},
    state: TASK_STATES.PENDING,
    checkpoints: [],
    created_at: Date.now(),
    current_stage: null,
    last_action: 'Queued',
  };

  tasks[task.id] = task;
  await updateState({ tasks });

  console.log('[SW] Queued task:', task.id, task.automation_type);

  // Trigger scheduler
  await tryStartNextTask();

  return task.id;
}

/**
 * Pause all running tasks
 */
async function pauseAll() {
  const state = await getState();
  const tasks = { ...state.tasks };

  for (const task of Object.values(tasks)) {
    if (task.state === TASK_STATES.RUNNING) {
      task.state = TASK_STATES.PAUSED;
      task.paused_at = Date.now();
      task.last_action = 'Paused by user';

      // Unlock the tab
      if (task.tab_id) {
        await unlockTab(task.tab_id);
      }
    }
  }

  await updateState({ tasks, scheduler_status: 'paused' });
  console.log('[SW] Paused all tasks');
}

/**
 * Resume paused tasks
 */
async function resumeAll() {
  const state = await getState();
  const tasks = { ...state.tasks };

  for (const task of Object.values(tasks)) {
    if (task.state === TASK_STATES.PAUSED) {
      task.state = TASK_STATES.PENDING;
      task.last_action = 'Resumed';
    }
  }

  await updateState({ tasks, scheduler_status: 'running' });
  await tryStartNextTask();
  console.log('[SW] Resumed all tasks');
}

/**
 * Emergency stop - abort everything
 */
async function emergencyStop() {
  const state = await getState();
  const tasks = { ...state.tasks };

  // Fail all running/pending/paused tasks
  for (const task of Object.values(tasks)) {
    if ([TASK_STATES.RUNNING, TASK_STATES.PENDING, TASK_STATES.PAUSED, TASK_STATES.LOCKED].includes(task.state)) {
      task.state = TASK_STATES.FAILED;
      task.failure_reason = 'EMERGENCY_STOP';
      task.last_action = 'Emergency stopped';

      if (task.tab_id) {
        await unlockTab(task.tab_id);
      }
    }
  }

  // Release all locks
  const locks = {};
  for (const resource of Object.keys(LOCK_RESOURCES)) {
    locks[resource] = { held_by: null, acquired_at: null };
  }

  await updateState({ tasks, locks, scheduler_status: 'stopped' });
  console.log('[SW] Emergency stop executed');
}

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

/**
 * Get or create a tab group
 */
async function getOrCreateTabGroup(title, color = 'blue') {
  try {
    const groups = await chrome.tabGroups.query({ title });
    if (groups.length > 0) {
      return groups[0].id;
    }

    // Need to create group with at least one tab
    // First check if we have any tabs in the current window
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currentTab) {
      return null;
    }

    // Create a temporary tab, group it, then close it
    // This is a workaround since we can't create empty groups
    return null; // Will create group when first tab is added
  } catch (e) {
    console.warn('[SW] Error getting tab group:', e);
    return null;
  }
}

/**
 * Move a tab to a named group
 */
async function moveTabToGroup(tabId, groupTitle, collapsed = true) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return;

    const groups = await chrome.tabGroups.query({ title: groupTitle, windowId: tab.windowId });
    let groupId;

    if (groups.length > 0) {
      groupId = groups[0].id;
    } else {
      // Create new group with this tab
      groupId = await chrome.tabs.group({ tabIds: [tabId], createProperties: { windowId: tab.windowId } });
      const color = groupTitle.includes('ATTN') ? 'red' : 'blue';
      await chrome.tabGroups.update(groupId, { title: groupTitle, color, collapsed });
      return;
    }

    // Add tab to existing group
    await chrome.tabs.group({ tabIds: [tabId], groupId });

    // Update collapse state
    const color = groupTitle.includes('ATTN') ? 'red' : 'blue';
    await chrome.tabGroups.update(groupId, { collapsed, color });

  } catch (e) {
    console.warn('[SW] Error moving tab to group:', e);
  }
}

/**
 * Lock a tab (inject overlay)
 */
async function lockTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'LOCK_TAB' });
    console.log('[SW] Locked tab:', tabId);
  } catch (e) {
    console.warn('[SW] Error locking tab:', e);
  }
}

/**
 * Unlock a tab (remove overlay)
 */
async function unlockTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'UNLOCK_TAB' });
    console.log('[SW] Unlocked tab:', tabId);
  } catch (e) {
    console.warn('[SW] Error unlocking tab:', e);
  }
}

/**
 * Focus a specific tab
 */
async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch (e) {
    console.warn('[SW] Error focusing tab:', e);
  }
}

// =============================================================================
// BOOKMARKS
// =============================================================================

const ATTENTION_FOLDER_NAME = 'DS-Pro Needs Attention';

/**
 * Get or create the attention bookmark folder
 */
async function getOrCreateAttentionFolder() {
  try {
    const tree = await chrome.bookmarks.getTree();

    // Search recursively for existing folder
    function findFolder(nodes) {
      for (const node of nodes) {
        if (node.title === ATTENTION_FOLDER_NAME && !node.url) {
          return node.id;
        }
        if (node.children) {
          const found = findFolder(node.children);
          if (found) return found;
        }
      }
      return null;
    }

    const existingId = findFolder(tree);
    if (existingId) return existingId;

    // Create in "Other Bookmarks" (usually id '2' but find it properly)
    const otherBookmarks = tree[0]?.children?.find(c => c.title === 'Other Bookmarks' || c.title === 'Other bookmarks');
    const parentId = otherBookmarks?.id || tree[0]?.children?.[1]?.id || '1';

    const folder = await chrome.bookmarks.create({
      parentId,
      title: ATTENTION_FOLDER_NAME,
    });

    return folder.id;
  } catch (e) {
    console.warn('[SW] Error with bookmarks:', e);
    return null;
  }
}

/**
 * Create an attention bookmark
 */
async function createAttentionBookmark(taskId, url, reason) {
  try {
    const folderId = await getOrCreateAttentionFolder();
    if (!folderId) return null;

    // Check for duplicate
    const existing = await chrome.bookmarks.search({ url });
    if (existing.some(b => b.parentId === folderId)) {
      return existing[0].id;
    }

    const code = taskId.slice(0, 6).toUpperCase();
    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title: `ATTN-${code} | ${reason}`,
      url,
    });

    return bookmark.id;
  } catch (e) {
    console.warn('[SW] Error creating bookmark:', e);
    return null;
  }
}

// =============================================================================
// API HELPER
// =============================================================================

/**
 * Make an API request with auth and error handling
 * @returns {{ ok: true, data: any } | { ok: false, status: number, error: string }}
 */
async function apiRequest(endpoint, options = {}) {
  const state = await getState();
  const headers = { 'Content-Type': 'application/json' };
  if (state.install_token) {
    headers['Authorization'] = `Bearer ${state.install_token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Central 401 handling
    if (response.status === 401) {
      await handleTokenExpiry();
      return { ok: false, status: 401, error: 'Unauthorized' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { ok: false, status: response.status, error: errorData.detail || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    console.warn('[SW] API request error:', err.message);
    return { ok: false, status: 0, error: 'Network error' };
  }
}

/**
 * Handle token expiry - clear credentials and notify user
 */
async function handleTokenExpiry() {
  await updateState({
    agent_id: null,
    install_token: null,
    agent_role: null,
    label: null,
    scheduler_status: 'stopped',
    pairing_error: 'Session expired. Please pair again.',
  });
  console.log('[SW] Token expired, credentials cleared');
}

// =============================================================================
// ACCOUNT DETECTION
// =============================================================================

// Invalid identifier patterns (generic greetings)
const INVALID_IDENTIFIERS = [
  'hello,',
  'sign in',
  'register',
  'hi there',
  'hi,',
  'welcome',
  'guest',
];

/**
 * Check if value is a valid unique identifier
 */
function isValidIdentifier(value) {
  if (!value || value.length < 3) return false;
  const lower = value.toLowerCase();
  return !INVALID_IDENTIFIERS.some(invalid => lower.startsWith(invalid));
}

/**
 * Detect eBay store name from Seller Hub page
 * @param {number|null} specificTabId - If provided, only check this tab
 */
async function detectEbayAccount(specificTabId = null) {
  try {
    let tabs;
    if (specificTabId) {
      const tab = await chrome.tabs.get(specificTabId);
      tabs = [tab];
    } else {
      tabs = await chrome.tabs.query({ url: '*://*.ebay.com/*' });
    }
    for (const tab of tabs) {
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Seller Hub page - store name in header
            // Structure: <a class="shui-header__link">storename<span class="clipped">View profile</span></a>
            const el = document.querySelector('.shui-header__user-profile > a.shui-header__link');
            if (el) {
              // Clone and remove the <span class="clipped"> to get just the store name
              const clone = el.cloneNode(true);
              const clipped = clone.querySelector('.clipped');
              if (clipped) clipped.remove();
              const storeName = clone.textContent?.trim();
              if (storeName) return storeName;
            }
            return null;
          }
        });
        const value = result[0]?.result;
        if (value && isValidIdentifier(value)) {
          return { key: value.toLowerCase().trim(), display: value };
        }
      } catch (e) {
        // Tab might not be accessible, continue
        console.warn('[SW] eBay detection script error:', e);
      }
    }
  } catch (e) {
    console.warn('[SW] Error detecting eBay account:', e);
  }
  return null;
}

/**
 * Detect Amazon account from open tabs or a specific tab
 * @param {number|null} specificTabId - If provided, only check this tab
 */
async function detectAmazonAccount(specificTabId = null) {
  try {
    let tabs;
    if (specificTabId) {
      const tab = await chrome.tabs.get(specificTabId);
      tabs = [tab];
    } else {
      tabs = await chrome.tabs.query({ url: '*://*.amazon.com/*' });
    }
    for (const tab of tabs) {
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Try multiple selectors for Amazon account name
            const selectors = [
              '#nav-link-accountList .nav-line-1',
              '#nav-tools .nav-line-1',
              '#nav-link-accountList-nav-line-1',
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el?.textContent?.trim()) {
                // Amazon shows "Hello, Name" format
                const text = el.textContent.trim();
                // Extract name after "Hello, " if present
                const match = text.match(/Hello,\s*(.+)/i);
                if (match && match[1]) {
                  return match[1].trim();
                }
                return text;
              }
            }
            return null;
          }
        });
        const value = result[0]?.result;
        if (value && isValidIdentifier(value)) {
          return { key: value.toLowerCase().trim(), display: value };
        }
      } catch (e) {
        // Tab might not be accessible, continue
      }
    }
  } catch (e) {
    console.warn('[SW] Error detecting Amazon account:', e);
  }
  return null;
}

/**
 * Opens a minimized window with eBay and Amazon tabs for account detection.
 *
 * URLs opened:
 * - https://www.ebay.com (to detect eBay username from page header)
 * - https://www.amazon.com (to detect Amazon username from "Hello, Name" in nav)
 */
async function openDetectionWindow() {
  try {
    console.log('[SW] Creating detection window with eBay and Amazon tabs...');

    // Create window first (without state parameter to avoid API conflict)
    const win = await chrome.windows.create({
      url: ['https://www.ebay.com/sh/ord', 'https://www.amazon.com'],
      type: 'normal',
      width: 800,
      height: 600,
      focused: false
    });

    console.log('[SW] Window created:', win.id, 'with', win.tabs?.length, 'tabs');

    // Minimize window after creation (workaround for API restriction)
    await chrome.windows.update(win.id, { state: 'minimized' });

    // Pin both tabs
    for (const tab of win.tabs) {
      await chrome.tabs.update(tab.id, { pinned: true });
      console.log('[SW] Tab:', tab.id, 'URL:', tab.url || tab.pendingUrl);
    }

    return {
      windowId: win.id,
      tabIds: win.tabs.map(t => t.id),
      ebayTabId: win.tabs.find(t => (t.url || t.pendingUrl)?.includes('ebay'))?.id,
      amazonTabId: win.tabs.find(t => (t.url || t.pendingUrl)?.includes('amazon'))?.id
    };
  } catch (e) {
    console.error('[SW] Error opening detection window:', e);
    return null;
  }
}

/**
 * Closes the detection window.
 */
async function closeDetectionWindow(windowId) {
  try {
    await chrome.windows.remove(windowId);
    console.log('[SW] Closed detection window');
  } catch (e) {
    // Window may already be closed
  }
}

/**
 * Wait for a tab to finish loading
 */
function waitForTabLoad(tabId, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve(true);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(checkTab, 500);
      } catch (e) {
        resolve(false);
      }
    };

    checkTab();
  });
}

// =============================================================================
// PAIRING API
// =============================================================================

/**
 * Request pairing from backend with account detection
 * Opens minimized eBay/Amazon windows to detect logged-in usernames
 */
async function requestPairing() {
  const state = await getState();
  let detectionWindow = null;

  try {
    // Show detecting state in UI immediately
    await updateState({
      device_status: 'detecting',
      pairing_error: null,
    });

    // Open minimized window with eBay and Amazon to detect logged-in accounts
    console.log('[SW] Opening detection window...');
    detectionWindow = await openDetectionWindow();

    let ebay = null;
    let amazon = null;

    if (detectionWindow) {
      // Wait for both tabs to load
      const loadPromises = [];
      if (detectionWindow.ebayTabId) {
        loadPromises.push(waitForTabLoad(detectionWindow.ebayTabId, 15000));
      }
      if (detectionWindow.amazonTabId) {
        loadPromises.push(waitForTabLoad(detectionWindow.amazonTabId, 15000));
      }
      await Promise.all(loadPromises);

      // Extra delay for page rendering and login state to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Detect logged-in usernames from the pages
      if (detectionWindow.ebayTabId) {
        ebay = await detectEbayAccount(detectionWindow.ebayTabId);
      }
      if (detectionWindow.amazonTabId) {
        amazon = await detectAmazonAccount(detectionWindow.amazonTabId);
      }

      console.log('[SW] Detected - eBay store:', ebay?.display || 'not found', '| Amazon account:', amazon?.display || 'not found');

      // If BOTH detected, discard Amazon (eBay takes priority)
      // Accounts represent eBay sellers only - Amazon agents don't have accounts
      if (ebay && amazon) {
        console.log('[SW] Both eBay and Amazon detected - discarding Amazon, using eBay only');
        amazon = null;
      }
    } else {
      console.log('[SW] Failed to open detection window');
    }

    // If NEITHER account detected, show error and don't proceed
    if (!ebay && !amazon) {
      console.log('[SW] Detection failed - neither eBay nor Amazon account found');
      await updateState({
        pairing_error: 'Could not detect eBay or Amazon account. Please ensure you are logged in to eBay Seller Hub and/or Amazon.',
        pairing_status: null,
        device_status: null,  // Clear detecting state
      });
      return { ok: false, error: 'Detection failed' };
    }

    // Clear detecting state before proceeding with API request
    await updateState({ device_status: null });

    // Proceed with pairing request - backend handles auto-approve vs pending
    const result = await apiRequest('/automation/pairing/request', {
      method: 'POST',
      body: {
        install_instance_id: state.install_instance_id,
        ebay_account_key: ebay?.key,
        amazon_account_key: amazon?.key,
        ebay_account_display: ebay?.display,
        amazon_account_display: amazon?.display,
      },
    });

    if (result.ok) {
      // Check if auto-approved
      if (result.data.device_status === 'auto_approved') {
        console.log('[SW] Auto-approved! Agent:', result.data.agent_id);

        // Store credentials immediately
        await updateState({
          agent_id: result.data.agent_id,
          install_token: result.data.install_token,
          agent_role: result.data.role,
          label: result.data.label,
          account_name: result.data.account_name,
          pairing_request_id: null,
          pairing_status: null,
          device_status: 'auto_approved',
          pairing_error: null,
          pairing_expires_at: null,
        });

        // Immediately call checkin to confirm replacement
        const checkinResult = await apiRequest('/automation/agents/me/checkin', {
          method: 'POST',
        });
        console.log('[SW] Checkin result:', checkinResult);

        if (checkinResult.ok) {
          await updateState({
            device_status: null,
            pairing_status: null,
          });
        }
      } else {
        // Pending approval flow
        await updateState({
          pairing_request_id: result.data.request_id,
          pairing_status: result.data.status,
          device_status: result.data.device_status,
          next_allowed_at: result.data.next_allowed_at,
          cooldown_seconds: result.data.cooldown_seconds,
          lifetime_request_count: result.data.lifetime_request_count,
          pairing_expires_at: result.data.expires_at,
          pairing_error: null,
        });
        // Start polling for approval
        startPairingPoll();
      }
    } else if (result.status === 403) {
      await updateState({ device_status: 'blocked', pairing_error: result.error });
    } else {
      await updateState({ pairing_error: result.error, device_status: null });
    }
    return result;
  } catch (e) {
    console.error('[SW] requestPairing error:', e);
    await updateState({
      device_status: null,
      pairing_error: 'Detection failed: ' + e.message,
    });
    return { ok: false, error: e.message };
  } finally {
    // Always clean up detection window if we opened one
    if (detectionWindow) {
      await closeDetectionWindow(detectionWindow.windowId);
    }
  }
}

/**
 * Poll for pairing approval status
 */
async function pollPairingStatus() {
  const state = await getState();

  // Don't poll if already paired or no pending request
  if (state.agent_id || state.pairing_status !== 'pending') {
    stopPairingPoll();
    return;
  }

  console.log('[SW] Polling pairing status...');
  const result = await apiRequest(`/automation/pairing/status/${state.install_instance_id}`, {
    method: 'GET',
  });

  if (!result.ok) {
    console.warn('[SW] Poll failed:', result.error);
    return;
  }

  const { status, agent_id, install_token, role, label, account_name, rejection_reason, expires_at } = result.data;

  if (status === 'approved' && agent_id && install_token) {
    // Success! Store credentials and stop polling
    await updateState({
      agent_id,
      install_token,
      agent_role: role,
      label,
      account_name,
      pairing_request_id: null,
      pairing_status: null,
      device_status: null,
      next_allowed_at: null,
      cooldown_seconds: 0,
      pairing_error: null,
      pairing_expires_at: null,
    });
    stopPairingPoll();
    console.log('[SW] Pairing approved! Agent:', agent_id);
  } else if (status === 'rejected') {
    await updateState({
      pairing_status: 'rejected',
      pairing_error: rejection_reason || 'Request was rejected',
      pairing_request_id: null,
      pairing_expires_at: null,
    });
    stopPairingPoll();
    console.log('[SW] Pairing rejected:', rejection_reason);
  } else if (status === 'expired') {
    await updateState({
      pairing_status: 'expired',
      pairing_error: 'Request expired. Please try again.',
      pairing_request_id: null,
      pairing_expires_at: null,
    });
    stopPairingPoll();
    console.log('[SW] Pairing request expired');
  }
  // If still pending, keep polling
}

let pairingPollInterval = null;

/**
 * Start polling for pairing approval (every 5 seconds)
 */
function startPairingPoll() {
  if (pairingPollInterval) return; // Already polling

  console.log('[SW] Starting pairing poll');
  pairingPollInterval = setInterval(pollPairingStatus, 5000);

  // Also poll immediately
  pollPairingStatus();
}

/**
 * Stop polling for pairing approval
 */
function stopPairingPoll() {
  if (pairingPollInterval) {
    clearInterval(pairingPollInterval);
    pairingPollInterval = null;
    console.log('[SW] Stopped pairing poll');
  }
}

// =============================================================================
// AGENT API
// =============================================================================

/**
 * Send heartbeat to backend
 */
async function sendHeartbeat() {
  const state = await getState();
  if (!state.install_token) return { ok: false, error: 'Not authenticated' };
  return apiRequest('/automation/agents/me/heartbeat', { method: 'POST' });
}

// =============================================================================
// JOB API
// =============================================================================

/**
 * Claim next available job
 */
async function claimNextJob() {
  const result = await apiRequest('/automation/jobs/claim', { method: 'POST' });
  if (result.ok && result.data.job) {
    // Queue the job as a task
    await queueTask({
      type: 'AMAZON_ORDER',
      locks: ['AMAZON_UI'],
      timeout: 600000,
      stages: ['NAVIGATE', 'CHECKOUT', 'CONFIRM'],
      context: { job: result.data.job },
    });
    console.log('[SW] Claimed job:', result.data.job.id);
  }
  return result;
}

/**
 * Complete a job
 */
async function completeJob(jobId, data) {
  return apiRequest(`/automation/jobs/${jobId}/complete`, { method: 'POST', body: data });
}

/**
 * Fail a job
 */
async function failJob(jobId, reason, details) {
  return apiRequest(`/automation/jobs/${jobId}/fail`, { method: 'POST', body: { reason, details } });
}

// =============================================================================
// SIDE PANEL COMMUNICATION
// =============================================================================

/**
 * Handle messages from side panel port
 */
function handleSidePanelMessage(msg, port) {
  console.log('[SW] Side panel message:', msg);

  switch (msg.action) {
    case 'GET_STATE':
      broadcastState();
      break;

    case 'PAUSE_ALL':
      pauseAll();
      break;

    case 'RESUME_ALL':
      resumeAll();
      break;

    case 'EMERGENCY_STOP':
      emergencyStop();
      break;

    case 'START_SCHEDULER':
      updateState({ scheduler_status: 'running' }).then(tryStartNextTask);
      break;

    case 'FOCUS_TAB':
      if (msg.tabId) focusTab(msg.tabId);
      break;

    case 'QUEUE_FAKE_TASK':
      queueFakeTask();
      break;

    case 'RESOLVE_ATTENTION':
      resolveAttention(msg.itemId);
      break;

    case 'REQUEST_PAIRING':
      requestPairing();
      break;

    case 'REFRESH_STATE':
      broadcastState();
      break;

    case 'GET_DETECTED_ACCOUNTS':
      (async () => {
        const ebay = await detectEbayAccount();
        const amazon = await detectAmazonAccount();
        port.postMessage({
          type: 'DETECTED_ACCOUNTS',
          ebay: ebay?.display || null,
          amazon: amazon?.display || null,
        });
      })();
      break;
  }
}

// =============================================================================
// DEMO / TESTING
// =============================================================================

/**
 * Queue a fake task for testing
 */
async function queueFakeTask() {
  await queueTask({
    type: 'FAKE_TASK',
    locks: ['AMAZON_UI'],
    timeout: 60000,
    stages: ['STAGE_1', 'STAGE_2', 'STAGE_3', 'DONE'],
    context: { demo: true },
  });
}

/**
 * Simulate fake task progress
 */
async function simulateFakeTask(taskId) {
  const stages = ['STAGE_1', 'STAGE_2', 'STAGE_3', 'DONE'];

  for (let i = 0; i < stages.length; i++) {
    await new Promise(r => setTimeout(r, 2000)); // 2 second delay

    const state = await getState();
    const task = state.tasks[taskId];

    if (!task || task.state !== TASK_STATES.RUNNING) {
      console.log('[SW] Fake task interrupted');
      return;
    }

    task.current_stage = stages[i];
    task.last_action = `Completed ${stages[i]}`;
    task.checkpoints.push({ stage: stages[i], timestamp: Date.now() });

    await updateState({ tasks: { ...state.tasks, [taskId]: task } });
  }

  await completeTask(taskId);
}

/**
 * Resolve an attention item
 */
async function resolveAttention(itemId) {
  const state = await getState();
  const attention_items = state.attention_items.filter(i => i.id !== itemId);
  await updateState({ attention_items });
  console.log('[SW] Resolved attention item:', itemId);
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Service worker lifecycle
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

// Port connections from side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    console.log('[SW] Side panel connected');
    sidePanelPorts.add(port);

    port.onMessage.addListener((msg) => handleSidePanelMessage(msg, port));
    port.onDisconnect.addListener(() => {
      sidePanelPorts.delete(port);
      console.log('[SW] Side panel disconnected');
    });

    // Send initial state
    broadcastState();
  }
});

// Keyboard commands
chrome.commands.onCommand.addListener((command) => {
  console.log('[SW] Command:', command);
  if (command === 'pause-all') {
    pauseAll();
  } else if (command === 'emergency-stop') {
    emergencyStop();
  }
});

// Alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('[SW] Alarm:', alarm.name);

  switch (alarm.name) {
    case 'job_poll':
      getState().then(state => {
        if (state.agent_role === 'AMAZON_AGENT' && state.scheduler_status === 'running') {
          claimNextJob();
        }
      });
      break;
    case 'ebay_scan':
      // TODO: Trigger eBay order scan (for EBAY_AGENT)
      break;
    case 'heartbeat':
      getState().then(state => {
        if (state.install_token) {
          sendHeartbeat();
        }
      });
      broadcastState();
      break;
  }
});

// Tab updates - enable side panel on eBay/Amazon tabs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isTargetSite = tab.url.includes('ebay.com') || tab.url.includes('amazon.com');

    try {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: isTargetSite,
      });
    } catch (e) {
      // Side panel API may not be available in all contexts
    }
  }
});

// Tab removed - clean up
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  const active_tabs = { ...state.active_tabs };

  if (active_tabs[tabId]) {
    const taskId = active_tabs[tabId];
    delete active_tabs[tabId];
    await updateState({ active_tabs });

    // Check if task was running
    const task = state.tasks[taskId];
    if (task && task.state === TASK_STATES.RUNNING) {
      await failTask(taskId, 'TAB_CLOSED');
    }
  }
});

// Content script messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CONTENT_READY') {
    console.log('[SW] Content script ready:', sender.tab?.id);
    sendResponse({ ok: true });
  }
  return true;
});

console.log('[SW] Service worker loaded');
