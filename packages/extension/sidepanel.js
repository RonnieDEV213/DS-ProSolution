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

// Admin sees all extension tabs (feature list)
const ADMIN_TABS = [
  { id: 'order_tracking', name: 'Order Tracking', icon: '📋' },
  { id: 'accounts', name: 'Accounts', icon: '🏪' },
];

// Map role names to icons (for VA tabs)
const ROLE_ICONS = {
  'Order Tracking': '📋',
  'Accounts': '🏪',
  'Bookkeeping': '📊',
  'default': '📁',
};

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

  // Clock In
  clockInSection: document.getElementById('clock-in-section'),
  accessCodeInput: document.getElementById('access-code-input'),
  btnToggleCodeVisibility: document.getElementById('btn-toggle-code-visibility'),
  btnClockIn: document.getElementById('btn-clock-in'),
  clockInError: document.getElementById('clock-in-error'),

  // Clocked Out
  clockedOutSection: document.getElementById('clocked-out-section'),
  clockedOutMessage: document.getElementById('clocked-out-message'),
  btnClockInAgain: document.getElementById('btn-clock-in-again'),

  // Overlay and Warning
  validatingOverlay: document.getElementById('validating-overlay'),
  inactivityWarning: document.getElementById('inactivity-warning'),
  warningMinutes: document.getElementById('warning-minutes'),
  btnDismissWarning: document.getElementById('btn-dismiss-warning'),

  // Hub Clock Out (legacy, kept for backwards compatibility)
  btnClockOut: document.getElementById('btn-clock-out'),

  // Profile Section
  profileName: document.getElementById('profile-name'),
  profileTypeBadge: document.getElementById('profile-type-badge'),
  adminBadge: document.getElementById('admin-badge'),
  btnClockOutHeader: document.getElementById('btn-clock-out-header'),

  // Tab Bar
  tabBar: document.getElementById('tab-bar'),
  tabBarSkeleton: document.getElementById('tab-bar-skeleton'),
  tabContent: document.getElementById('tab-content'),
  emptyState: document.getElementById('empty-state'),
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

    case 'CLOCK_IN_STARTED':
      elements.validatingOverlay?.classList.remove('hidden');
      break;

    case 'CLOCK_IN_SUCCESS':
      elements.validatingOverlay?.classList.add('hidden');
      // State update will trigger render() which shows hub
      break;

    case 'CLOCK_IN_FAILED':
      elements.validatingOverlay?.classList.add('hidden');
      showClockInError(msg.error_code, msg.message, msg.retry_after);
      break;

    case 'INACTIVITY_WARNING':
      showInactivityWarning(msg.minutes_remaining);
      break;

    case 'ROLES_CHANGED':
      // Force re-authentication when roles change
      elements.validatingOverlay?.classList.add('hidden');
      hideAllSections();
      showSection('clockIn');
      renderClockIn();
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

  // State machine priority:
  // 1. If paired AND clocked_in -> show hub
  // 2. If paired AND needs_clock_in -> show clock-in
  // 3. If paired AND clocked_out -> show clocked-out
  // 4. If not paired -> show pairing flow

  if (currentState.paired) {
    if (currentState.auth_state === 'clocked_in') {
      showSection('hub');
      renderHub();
    } else if (currentState.auth_state === 'clocked_out') {
      showSection('clockedOut');
      renderClockedOut();
    } else {
      // needs_clock_in or null (fallback to clock-in)
      showSection('clockIn');
      renderClockIn();
    }
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
  elements.clockInSection?.classList.add('hidden');
  elements.clockedOutSection?.classList.add('hidden');
  elements.validatingOverlay?.classList.add('hidden');
  elements.inactivityWarning?.classList.add('hidden');
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
    clockIn: elements.clockInSection,
    clockedOut: elements.clockedOutSection,
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

// =============================================================================
// PROFILE AND TAB RENDERING
// =============================================================================

function renderProfileSection() {
  if (!currentState?.user_context) return;
  const { name, user_type, is_admin } = currentState.user_context;

  if (elements.profileName) {
    elements.profileName.textContent = name || 'User';
  }
  if (elements.profileTypeBadge) {
    elements.profileTypeBadge.textContent = user_type || 'va';
  }
  if (elements.adminBadge) {
    if (is_admin) {
      elements.adminBadge.classList.remove('hidden');
    } else {
      elements.adminBadge.classList.add('hidden');
    }
  }
}

function renderTabs() {
  if (!currentState) return;
  const { user_context, roles } = currentState;

  // Hide skeleton, show tab bar
  elements.tabBarSkeleton?.classList.add('hidden');
  elements.tabBar?.classList.remove('hidden');

  // Admin bypass - show all tabs
  if (user_context?.is_admin) {
    renderAdminTabs();
    elements.emptyState?.classList.add('hidden');
    elements.tabContent?.classList.remove('hidden');
    return;
  }

  // VA with no roles - show empty state
  if (!roles || roles.length === 0) {
    showEmptyState();
    return;
  }

  // VA with roles - render assigned tabs
  elements.emptyState?.classList.add('hidden');
  elements.tabContent?.classList.remove('hidden');

  // Sort by priority if available, otherwise use array order
  const sortedRoles = [...roles].sort((a, b) => (a.priority || 0) - (b.priority || 0));

  if (elements.tabBar) {
    elements.tabBar.innerHTML = sortedRoles.map((role, index) => `
      <button class="tab ${index === 0 ? 'active' : ''}"
              data-role-id="${escapeHtml(role.id)}"
              data-role-name="${escapeHtml(role.name)}">
        <span class="tab-icon">${getRoleIcon(role.name)}</span>
        <span>${escapeHtml(role.name)}</span>
      </button>
    `).join('');

    // Attach click handlers
    attachTabClickHandlers();
  }

  // Show first tab content
  if (sortedRoles.length > 0) {
    showTabContent(sortedRoles[0].id, sortedRoles[0].name);
  }
}

function renderAdminTabs() {
  if (elements.tabBar) {
    elements.tabBar.innerHTML = ADMIN_TABS.map((tab, index) => `
      <button class="tab ${index === 0 ? 'active' : ''}"
              data-tab-id="${tab.id}">
        <span class="tab-icon">${tab.icon}</span>
        <span>${tab.name}</span>
      </button>
    `).join('');

    attachTabClickHandlers();
  }

  // Show first tab content
  if (ADMIN_TABS.length > 0) {
    showTabContent(ADMIN_TABS[0].id, ADMIN_TABS[0].name);
  }
}

function showEmptyState() {
  elements.tabBar?.classList.add('hidden');
  elements.tabContent?.classList.add('hidden');
  elements.emptyState?.classList.remove('hidden');
}

function showTabContent(tabId, tabName) {
  if (elements.tabContent) {
    // For now, show placeholder with tab name
    // Future phases will populate actual content
    elements.tabContent.innerHTML = `
      <p class="tab-placeholder">${escapeHtml(tabName || tabId)} feature content will appear here</p>
    `;
  }
}

function getRoleIcon(roleName) {
  return ROLE_ICONS[roleName] || ROLE_ICONS.default;
}

function attachTabClickHandlers() {
  elements.tabBar?.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active state
      elements.tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show content
      const tabId = tab.dataset.roleId || tab.dataset.tabId;
      const tabName = tab.dataset.roleName || tab.textContent.trim();
      showTabContent(tabId, tabName);
    });
  });
}

// =============================================================================
// HUB RENDERING
// =============================================================================

function renderHub() {
  // Render profile section first
  renderProfileSection();

  // Render tabs
  renderTabs();

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

function renderClockIn() {
  // Clear any previous input and errors
  if (elements.accessCodeInput) {
    elements.accessCodeInput.value = '';
  }
  if (elements.clockInError) {
    elements.clockInError.textContent = '';
    elements.clockInError.classList.add('hidden');
  }
}

function renderClockedOut() {
  const messages = {
    'manual': 'You have clocked out.',
    'inactivity': 'Clocked out due to inactivity.',
    'code_rotated': 'Your access code was changed. Please clock in again.',
    'token_expired': 'Your session has expired. Please clock in again.',
    'roles_changed': 'Your permissions have changed. Please clock in again.',
    'permission_fetch_failed': 'Could not verify permissions. Please clock in again.',
  };

  const reason = currentState.clock_out_reason || 'manual';
  if (elements.clockedOutMessage) {
    elements.clockedOutMessage.textContent = messages[reason] || messages.manual;
  }
}

function showClockInError(errorCode, message, retryAfter) {
  const errorMessages = {
    INVALID_CODE: 'Invalid access code',
    CODE_EXPIRED: 'Access code has expired. Generate a new one from your profile.',
    RATE_LIMITED: retryAfter ? `Too many attempts. Please wait ${retryAfter} seconds.` : 'Too many attempts. Please try again later.',
    ACCOUNT_DISABLED: 'Account is suspended. Contact an administrator.',
    NETWORK_ERROR: 'Connection error. Check your internet and try again.',
  };

  const displayMessage = errorMessages[errorCode] || message || 'Validation failed';

  if (elements.clockInError) {
    elements.clockInError.textContent = displayMessage;
    elements.clockInError.classList.remove('hidden');
  }

  // Clear input on error (user starts fresh)
  if (elements.accessCodeInput) {
    elements.accessCodeInput.value = '';
    elements.accessCodeInput.focus();
  }
}

function showInactivityWarning(minutes) {
  if (elements.warningMinutes) {
    elements.warningMinutes.textContent = minutes;
  }
  elements.inactivityWarning?.classList.remove('hidden');
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

// Clock In form submit
elements.btnClockIn?.addEventListener('click', () => {
  const code = elements.accessCodeInput?.value?.trim();
  if (!code) {
    showClockInError('INVALID_CODE', 'Please enter your access code');
    return;
  }
  // Clear any previous errors
  elements.clockInError?.classList.add('hidden');
  // Send to service worker
  send('CLOCK_IN', { code });
});

// Enter key submits clock-in form
elements.accessCodeInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    elements.btnClockIn?.click();
  }
});

// Toggle code visibility
elements.btnToggleCodeVisibility?.addEventListener('click', () => {
  if (elements.accessCodeInput) {
    const isPassword = elements.accessCodeInput.type === 'password';
    elements.accessCodeInput.type = isPassword ? 'text' : 'password';
  }
});

// Clock In Again button (from clocked out state)
elements.btnClockInAgain?.addEventListener('click', () => {
  // Transition to clock-in section
  hideAllSections();
  showSection('clockIn');
  renderClockIn();
});

// Clock Out button in hub (legacy, may be removed)
elements.btnClockOut?.addEventListener('click', () => {
  send('CLOCK_OUT');
});

// Clock Out button in profile header
elements.btnClockOutHeader?.addEventListener('click', () => {
  send('CLOCK_OUT');
});

// Dismiss inactivity warning
elements.btnDismissWarning?.addEventListener('click', () => {
  elements.inactivityWarning?.classList.add('hidden');
  // Reset activity timer when user acknowledges warning
  send('RESET_ACTIVITY');
});

// Track user activity to reset inactivity timer
document.addEventListener('click', () => {
  if (currentState?.auth_state === 'clocked_in') {
    send('RESET_ACTIVITY');
  }
});

document.addEventListener('keydown', () => {
  if (currentState?.auth_state === 'clocked_in') {
    send('RESET_ACTIVITY');
  }
});

// =============================================================================
// INIT
// =============================================================================

console.log('[SP] Side panel loaded');
connect();
