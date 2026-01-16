/**
 * DS-Pro Automation Hub — Side Panel UI
 *
 * Pure UI logic. All business logic in service worker.
 */

// =============================================================================
// STATE
// =============================================================================

let port = null;
let currentState = null;
let elapsedTimer = null;

// =============================================================================
// ELEMENTS
// =============================================================================

const elements = {
  // Status
  statusBadge: document.getElementById('status-badge'),

  // Pairing
  pairingSection: document.getElementById('pairing-section'),
  pairingCode: document.getElementById('pairing-code'),
  btnPair: document.getElementById('btn-pair'),
  pairingError: document.getElementById('pairing-error'),

  // Hub
  hubSection: document.getElementById('hub-section'),
  agentLabel: document.getElementById('agent-label'),
  agentRole: document.getElementById('agent-role'),

  // Stats
  statActive: document.getElementById('stat-active'),
  statQueued: document.getElementById('stat-queued'),
  statAttention: document.getElementById('stat-attention'),

  // Current task
  currentTaskSection: document.getElementById('current-task-section'),
  taskType: document.getElementById('task-type'),
  taskElapsed: document.getElementById('task-elapsed'),
  taskStageValue: document.getElementById('task-stage-value'),
  taskLastAction: document.getElementById('task-last-action'),

  // Attention
  attentionSection: document.getElementById('attention-section'),
  attentionCount: document.getElementById('attention-count'),
  attentionList: document.getElementById('attention-list'),

  // Queue
  queueCount: document.getElementById('queue-count'),
  queueList: document.getElementById('queue-list'),

  // Buttons
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnPauseAll: document.getElementById('btn-pause-all'),
  btnEmergencyStop: document.getElementById('btn-emergency-stop'),
  btnFocusTab: document.getElementById('btn-focus-tab'),
  btnQueueFake: document.getElementById('btn-queue-fake'),
};

// =============================================================================
// CONNECTION
// =============================================================================

function connect() {
  try {
    port = chrome.runtime.connect({ name: 'sidepanel' });

    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(() => {
      console.log('[SP] Disconnected, reconnecting...');
      setTimeout(connect, 1000);
    });

    // Request initial state
    port.postMessage({ action: 'GET_STATE' });
    console.log('[SP] Connected to service worker');
  } catch (e) {
    console.error('[SP] Connection error:', e);
    setTimeout(connect, 1000);
  }
}

function send(action, data = {}) {
  if (port) {
    port.postMessage({ action, ...data });
  }
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

function handleMessage(msg) {
  console.log('[SP] Message:', msg.type);

  switch (msg.type) {
    case 'STATE_UPDATE':
      currentState = msg.state;
      render();
      break;
  }
}

// =============================================================================
// RENDERING
// =============================================================================

function render() {
  if (!currentState) return;

  // Status badge
  updateStatusBadge(currentState.scheduler_status);

  // Show pairing or hub
  if (currentState.paired) {
    elements.pairingSection.classList.add('hidden');
    elements.hubSection.classList.remove('hidden');
    renderHub();
  } else {
    elements.pairingSection.classList.remove('hidden');
    elements.hubSection.classList.add('hidden');
  }
}

function updateStatusBadge(status) {
  elements.statusBadge.textContent = status || 'Stopped';
  elements.statusBadge.className = 'status-badge ' + (status || 'stopped');
}

function renderHub() {
  // Agent info
  elements.agentLabel.textContent = currentState.label || 'Unknown';
  elements.agentRole.textContent = currentState.agent_role || '—';

  // Stats
  elements.statActive.textContent = currentState.running_task ? '1' : '0';
  elements.statQueued.textContent = currentState.pending_count || '0';
  elements.statAttention.textContent = currentState.attention_count || '0';

  // Current task
  if (currentState.running_task) {
    elements.currentTaskSection.classList.remove('hidden');
    renderCurrentTask(currentState.running_task);
  } else {
    elements.currentTaskSection.classList.add('hidden');
    stopElapsedTimer();
  }

  // Attention items
  elements.attentionCount.textContent = currentState.attention_count || '0';
  renderAttentionList(currentState.attention_items || []);

  // Queue
  elements.queueCount.textContent = currentState.pending_count || '0';

  // Buttons
  updateButtons();
}

function renderCurrentTask(task) {
  elements.taskType.textContent = task.type || 'Task';
  elements.taskStageValue.textContent = task.stage || '—';
  elements.taskLastAction.textContent = task.last_action || '—';

  // Start elapsed timer if not running
  if (task.started_at && !elapsedTimer) {
    startElapsedTimer(task.started_at);
  }
}

function renderAttentionList(items) {
  if (items.length === 0) {
    elements.attentionList.innerHTML = '<div class="empty-state">No items need attention</div>';
    return;
  }

  elements.attentionList.innerHTML = items.map(item => `
    <div class="attention-item" data-id="${item.id}">
      <div class="info">
        <div class="reason">${escapeHtml(item.reason)}</div>
        <div class="time">${formatTime(item.created_at)}</div>
      </div>
      <button class="btn btn-small btn-secondary btn-resolve" data-id="${item.id}">Resolve</button>
    </div>
  `).join('');

  // Add event listeners
  elements.attentionList.querySelectorAll('.btn-resolve').forEach(btn => {
    btn.addEventListener('click', () => {
      send('RESOLVE_ATTENTION', { itemId: btn.dataset.id });
    });
  });
}

function updateButtons() {
  const status = currentState?.scheduler_status || 'stopped';

  // Start/Resume button
  if (status === 'stopped' || status === 'paused') {
    elements.btnStart.textContent = status === 'paused' ? 'Resume' : 'Start';
    elements.btnStart.classList.remove('hidden');
  } else {
    elements.btnStart.classList.add('hidden');
  }

  // Pause button visibility
  elements.btnPauseAll.disabled = status !== 'running';
}

// =============================================================================
// ELAPSED TIMER
// =============================================================================

function startElapsedTimer(startedAt) {
  stopElapsedTimer();

  function update() {
    const elapsed = Date.now() - startedAt;
    elements.taskElapsed.textContent = formatElapsed(elapsed);
  }

  update();
  elapsedTimer = setInterval(update, 1000);
}

function stopElapsedTimer() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  elements.taskElapsed.textContent = '0:00';
}

// =============================================================================
// UTILITIES
// =============================================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Pairing
elements.btnPair.addEventListener('click', () => {
  const code = elements.pairingCode.value.trim();
  if (code.length !== 6) {
    elements.pairingError.textContent = 'Code must be 6 digits';
    elements.pairingError.classList.remove('hidden');
    return;
  }
  elements.pairingError.classList.add('hidden');
  send('REDEEM_CODE', { code });
});

elements.pairingCode.addEventListener('input', (e) => {
  // Only allow digits
  e.target.value = e.target.value.replace(/\D/g, '');
});

elements.pairingCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.btnPair.click();
  }
});

// Actions
elements.btnStart.addEventListener('click', () => {
  if (currentState?.scheduler_status === 'paused') {
    send('RESUME_ALL');
  } else {
    send('START_SCHEDULER');
  }
});

elements.btnPause.addEventListener('click', () => {
  send('PAUSE_ALL');
});

elements.btnPauseAll.addEventListener('click', () => {
  send('PAUSE_ALL');
});

elements.btnEmergencyStop.addEventListener('click', () => {
  if (confirm('Emergency stop will abort all running tasks. Continue?')) {
    send('EMERGENCY_STOP');
  }
});

elements.btnFocusTab.addEventListener('click', () => {
  if (currentState?.running_task?.tab_id) {
    send('FOCUS_TAB', { tabId: currentState.running_task.tab_id });
  }
});

elements.btnQueueFake.addEventListener('click', () => {
  send('QUEUE_FAKE_TASK');
});

// =============================================================================
// INIT
// =============================================================================

console.log('[SP] Side panel loaded');
connect();
