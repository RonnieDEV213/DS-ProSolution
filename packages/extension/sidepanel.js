/**
 * DS-Pro Automation Hub — Side Panel UI
 *
 * Pure UI logic. All business logic in service worker.
 * Simplified pairing: Request → Poll → Auto-pair (no codes, no role selection)
 */

// =============================================================================
// STATE
// =============================================================================

let port = null;
let currentState = null;
let elapsedTimer = null;
let cooldownTimer = null;
let expirationTimer = null;

// =============================================================================
// ELEMENTS
// =============================================================================

const elements = {
  // Status
  statusBadge: document.getElementById('status-badge'),

  // Request Access
  requestAccessSection: document.getElementById('request-access-section'),
  deviceIdDisplay: document.getElementById('device-id-display'),
  btnRequestAccess: document.getElementById('btn-request-access'),
  requestError: document.getElementById('request-error'),

  // Pending
  pendingSection: document.getElementById('pending-section'),
  pendingDeviceId: document.getElementById('pending-device-id'),
  expirationTimer: document.getElementById('expiration-timer'),

  // Cooldown
  cooldownSection: document.getElementById('cooldown-section'),
  cooldownTimer: document.getElementById('cooldown-timer'),

  // Rejected
  rejectedSection: document.getElementById('rejected-section'),
  rejectedReason: document.getElementById('rejected-reason'),

  // Expired
  expiredSection: document.getElementById('expired-section'),

  // Auto-approved
  autoApprovedSection: document.getElementById('auto-approved-section'),
  autoApprovedAccount: document.getElementById('auto-approved-account'),

  // Detecting
  detectingSection: document.getElementById('detecting-section'),

  // Detected accounts
  detectedAccounts: document.getElementById('detected-accounts'),
  detectedEbay: document.getElementById('detected-ebay'),
  detectedEbayName: document.getElementById('detected-ebay-name'),
  detectedAmazon: document.getElementById('detected-amazon'),
  detectedAmazonName: document.getElementById('detected-amazon-name'),

  // Hub
  hubSection: document.getElementById('hub-section'),
  agentLabel: document.getElementById('agent-label'),
  agentRole: document.getElementById('agent-role'),
  accountName: document.getElementById('account-name'),

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
    // Request detected accounts (for showing in request section)
    port.postMessage({ action: 'GET_DETECTED_ACCOUNTS' });
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

    case 'DETECTED_ACCOUNTS':
      renderDetectedAccounts(msg.ebay, msg.amazon);
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

  // Hide all sections first
  hideAllSections();

  // State machine: pending → cooldown → expired → rejected → request → hub
  if (currentState.paired) {
    showSection('hub');
    renderHub();
  } else {
    renderPairingFlow();
  }
}

function hideAllSections() {
  elements.requestAccessSection?.classList.add('hidden');
  elements.pendingSection?.classList.add('hidden');
  elements.cooldownSection?.classList.add('hidden');
  elements.rejectedSection?.classList.add('hidden');
  elements.expiredSection?.classList.add('hidden');
  elements.autoApprovedSection?.classList.add('hidden');
  elements.detectingSection?.classList.add('hidden');
  elements.hubSection?.classList.add('hidden');
  stopCooldownTimer();
  stopExpirationTimer();
}

function showSection(name) {
  const sectionMap = {
    request: elements.requestAccessSection,
    pending: elements.pendingSection,
    cooldown: elements.cooldownSection,
    rejected: elements.rejectedSection,
    expired: elements.expiredSection,
    autoApproved: elements.autoApprovedSection,
    detecting: elements.detectingSection,
    hub: elements.hubSection,
  };
  sectionMap[name]?.classList.remove('hidden');
}

function renderPairingFlow() {
  const { pairing_status, device_status, next_allowed_at, pairing_error, pairing_expires_at, install_instance_id, account_name } = currentState;

  // Show device ID in request section
  if (elements.deviceIdDisplay && install_instance_id) {
    elements.deviceIdDisplay.textContent = truncateId(install_instance_id);
  }

  // Determine which section to show
  // Check detecting state first (while detection window is open)
  if (device_status === 'detecting') {
    showSection('detecting');
    return;
  }

  if (device_status === 'auto_approved') {
    // Show auto-approved success briefly, then transition to hub
    showSection('autoApproved');
    if (elements.autoApprovedAccount) {
      elements.autoApprovedAccount.textContent = account_name || '';
    }
    // Transition to hub after 2 seconds
    setTimeout(() => {
      if (currentState?.paired) {
        hideAllSections();
        showSection('hub');
        renderHub();
      }
    }, 2000);
  } else if (pairing_status === 'pending') {
    showSection('pending');
    if (elements.pendingDeviceId && install_instance_id) {
      elements.pendingDeviceId.textContent = truncateId(install_instance_id);
    }
    if (pairing_expires_at) {
      startExpirationTimer(new Date(pairing_expires_at));
    }
  } else if (pairing_status === 'expired') {
    showSection('expired');
  } else if (pairing_status === 'rejected') {
    showSection('rejected');
    if (elements.rejectedReason) {
      elements.rejectedReason.textContent = pairing_error || 'Request was rejected';
    }
  } else if (device_status === 'cooldown' && next_allowed_at) {
    showSection('cooldown');
    startCooldownTimer(new Date(next_allowed_at));
  } else {
    showSection('request');
    // Request detected accounts when showing request section
    send('GET_DETECTED_ACCOUNTS');
  }

  // Show errors in request section
  if (pairing_error && elements.requestError) {
    elements.requestError.textContent = pairing_error;
    elements.requestError.classList.remove('hidden');
  } else {
    elements.requestError?.classList.add('hidden');
  }
}

function renderDetectedAccounts(ebay, amazon) {
  const hasAny = ebay || amazon;

  if (elements.detectedAccounts) {
    if (hasAny) {
      elements.detectedAccounts.classList.remove('hidden');
    } else {
      elements.detectedAccounts.classList.add('hidden');
    }
  }

  if (elements.detectedEbay && elements.detectedEbayName) {
    if (ebay) {
      elements.detectedEbay.classList.remove('hidden');
      elements.detectedEbayName.textContent = ebay;
    } else {
      elements.detectedEbay.classList.add('hidden');
    }
  }

  if (elements.detectedAmazon && elements.detectedAmazonName) {
    if (amazon) {
      elements.detectedAmazon.classList.remove('hidden');
      elements.detectedAmazonName.textContent = amazon;
    } else {
      elements.detectedAmazon.classList.add('hidden');
    }
  }
}

function truncateId(id) {
  if (!id || id.length < 12) return id || '—';
  return `${id.slice(0, 6)}...${id.slice(-6)}`;
}

function updateStatusBadge(status) {
  elements.statusBadge.textContent = status || 'Stopped';
  elements.statusBadge.className = 'status-badge ' + (status || 'stopped');
}

function renderHub() {
  // Agent info
  elements.agentLabel.textContent = currentState.label || 'Unknown';
  elements.agentRole.textContent = currentState.agent_role || '—';
  if (elements.accountName) {
    elements.accountName.textContent = currentState.account_name || '—';
  }

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
// COOLDOWN TIMER
// =============================================================================

function startCooldownTimer(targetTime) {
  stopCooldownTimer();

  function update() {
    const remaining = Math.max(0, targetTime - Date.now());
    if (remaining <= 0) {
      stopCooldownTimer();
      elements.cooldownTimer.textContent = '0:00';
      // Request fresh state from service worker when cooldown ends
      send('REFRESH_STATE');
      return;
    }
    const secs = Math.ceil(remaining / 1000);
    const mins = Math.floor(secs / 60);
    const secsRem = secs % 60;
    elements.cooldownTimer.textContent = `${mins}:${secsRem.toString().padStart(2, '0')}`;
  }

  update();
  cooldownTimer = setInterval(update, 1000);
}

function stopCooldownTimer() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
}

// =============================================================================
// EXPIRATION TIMER
// =============================================================================

function startExpirationTimer(targetTime) {
  stopExpirationTimer();

  function update() {
    const remaining = Math.max(0, targetTime - Date.now());
    if (remaining <= 0) {
      stopExpirationTimer();
      elements.expirationTimer.textContent = 'Expired';
      return;
    }
    const secs = Math.ceil(remaining / 1000);
    const mins = Math.floor(secs / 60);
    const secsRem = secs % 60;
    elements.expirationTimer.textContent = `${mins}:${secsRem.toString().padStart(2, '0')}`;
  }

  update();
  expirationTimer = setInterval(update, 1000);
}

function stopExpirationTimer() {
  if (expirationTimer) {
    clearInterval(expirationTimer);
    expirationTimer = null;
  }
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

// Request Access
elements.btnRequestAccess?.addEventListener('click', () => {
  send('REQUEST_PAIRING');
});

// "Try Again" buttons
document.querySelectorAll('.btn-try-again').forEach(btn => {
  btn.addEventListener('click', () => {
    send('REQUEST_PAIRING');
  });
});

// Actions
elements.btnStart?.addEventListener('click', () => {
  if (currentState?.scheduler_status === 'paused') {
    send('RESUME_ALL');
  } else {
    send('START_SCHEDULER');
  }
});

elements.btnPause?.addEventListener('click', () => {
  send('PAUSE_ALL');
});

elements.btnPauseAll?.addEventListener('click', () => {
  send('PAUSE_ALL');
});

elements.btnEmergencyStop?.addEventListener('click', () => {
  if (confirm('Emergency stop will abort all running tasks. Continue?')) {
    send('EMERGENCY_STOP');
  }
});

elements.btnFocusTab?.addEventListener('click', () => {
  if (currentState?.running_task?.tab_id) {
    send('FOCUS_TAB', { tabId: currentState.running_task.tab_id });
  }
});

elements.btnQueueFake?.addEventListener('click', () => {
  send('QUEUE_FAKE_TASK');
});

// =============================================================================
// INIT
// =============================================================================

console.log('[SP] Side panel loaded');
connect();
