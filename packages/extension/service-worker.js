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
    'tasks',
    'locks',
    'attention_items',
    'active_tabs',
    'scheduler_status',
  ]);
  return {
    install_instance_id: data.install_instance_id || null,
    agent_id: data.agent_id || null,
    install_token: data.install_token || null,
    agent_role: data.agent_role || null,
    label: data.label || null,
    tasks: data.tasks || {},
    locks: data.locks || {},
    attention_items: data.attention_items || [],
    active_tabs: data.active_tabs || {},
    scheduler_status: data.scheduler_status || 'stopped',
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
 */
function buildStateSummary(state) {
  const tasks = Object.values(state.tasks);
  const runningTask = tasks.find(t => t.state === TASK_STATES.RUNNING);
  const pendingTasks = tasks.filter(t => t.state === TASK_STATES.PENDING);

  return {
    paired: !!state.agent_id,
    agent_role: state.agent_role,
    label: state.label,
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

    case 'REDEEM_CODE':
      redeemPairingCode(msg.code);
      break;

    case 'RESOLVE_ATTENTION':
      resolveAttention(msg.itemId);
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
 * Mock pairing code redemption
 */
async function redeemPairingCode(code) {
  console.log('[SW] Redeeming code:', code);

  // TODO: Actually call backend API
  // For now, mock success
  if (code && code.length === 6) {
    await updateState({
      agent_id: crypto.randomUUID(),
      install_token: 'mock_token_' + Date.now(),
      agent_role: 'AMAZON_AGENT', // or EBAY_AGENT based on code
      label: 'Demo Agent',
    });
    console.log('[SW] Pairing successful (mock)');
  }
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
      // TODO: Poll backend for new jobs
      break;
    case 'ebay_scan':
      // TODO: Trigger eBay order scan
      break;
    case 'heartbeat':
      // TODO: Send heartbeat to backend
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
