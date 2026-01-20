/**
 * DS-Pro Automation Hub — Lock Overlay Content Script
 *
 * Blocks user input while automation is running.
 * Programmatic clicks still work (they bypass pointer-events).
 */

(function() {
  'use strict';

  const OVERLAY_ID = 'ds-pro-lock-overlay';

  // Platform-specific hotkey text
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const PAUSE_HOTKEY = isMac ? '⌘+Shift+P' : 'Ctrl+Shift+P';
  const STOP_HOTKEY = isMac ? '⌘+Shift+X' : 'Ctrl+Shift+X';

  /**
   * Inject the lock overlay
   */
  function injectOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return; // Already exists
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    // CSS is inlined to ensure it works regardless of page styles
    const style = `
      #${OVERLAY_ID} {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      #${OVERLAY_ID} .ds-pro-banner {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 36px !important;
        background: linear-gradient(90deg, #3b82f6, #6366f1) !important;
        color: white !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        line-height: 36px !important;
        text-align: center !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 20px !important;
      }

      #${OVERLAY_ID} .ds-pro-banner .icon {
        font-size: 16px !important;
      }

      #${OVERLAY_ID} .ds-pro-banner .hotkeys {
        font-size: 11px !important;
        opacity: 0.9 !important;
      }

      #${OVERLAY_ID} .ds-pro-banner kbd {
        background: rgba(255,255,255,0.2) !important;
        padding: 2px 6px !important;
        border-radius: 3px !important;
        font-family: monospace !important;
        margin: 0 4px !important;
      }

      #${OVERLAY_ID} .ds-pro-blocker {
        position: absolute !important;
        top: 36px !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: transparent !important;
        cursor: not-allowed !important;
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = style;

    overlay.innerHTML = `
      <div class="ds-pro-banner">
        <span class="icon">🔒</span>
        <span>DS-Pro Automation running — Do not interact with this tab</span>
        <span class="hotkeys">
          <kbd>${PAUSE_HOTKEY}</kbd> Pause
          <kbd>${STOP_HOTKEY}</kbd> Stop
        </span>
      </div>
      <div class="ds-pro-blocker"></div>
    `;

    overlay.prepend(styleEl);

    // Block all user input on the blocker element
    const blocker = overlay.querySelector('.ds-pro-blocker');

    const blockedEvents = [
      'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
      'keydown', 'keyup', 'keypress',
      'wheel', 'scroll',
      'touchstart', 'touchmove', 'touchend',
      'contextmenu',
      'drag', 'dragstart', 'dragend', 'drop'
    ];

    blockedEvents.forEach(eventType => {
      blocker.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.warn(`[DS-Pro] User input blocked: ${eventType}`);
      }, { capture: true, passive: false });
    });

    // Append to document
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      // If body doesn't exist yet, wait for it
      const observer = new MutationObserver(() => {
        if (document.body) {
          document.body.appendChild(overlay);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }

    console.log('[DS-Pro] Overlay injected');
  }

  /**
   * Remove the lock overlay
   */
  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
      console.log('[DS-Pro] Overlay removed');
    }
  }

  /**
   * Check if overlay is currently shown
   */
  function isOverlayActive() {
    return !!document.getElementById(OVERLAY_ID);
  }

  // =============================================================================
  // MESSAGE HANDLING
  // =============================================================================

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[DS-Pro] Content script message:', msg.action);

    switch (msg.action) {
      case 'LOCK_TAB':
        injectOverlay();
        sendResponse({ ok: true, active: true });
        break;

      case 'UNLOCK_TAB':
        removeOverlay();
        sendResponse({ ok: true, active: false });
        break;

      case 'IS_LOCKED':
        sendResponse({ ok: true, active: isOverlayActive() });
        break;

      case 'EXTRACT_EBAY':
        // Delegate to extraction script
        import(chrome.runtime.getURL('content/extract-ebay.js'))
          .then(m => m.extractEbayData())
          .then(data => sendResponse({ ok: true, data }))
          .catch(err => sendResponse({ ok: false, error: err.message }));
        return true; // Keep channel open for async response

      case 'EXTRACT_AMAZON':
        // Delegate to extraction script
        import(chrome.runtime.getURL('content/extract-amazon.js'))
          .then(m => m.extractAmazonData())
          .then(data => sendResponse({ ok: true, data }))
          .catch(err => sendResponse({ ok: false, error: err.message }));
        return true; // Keep channel open for async response

      default:
        sendResponse({ ok: false, error: 'Unknown action' });
    }

    return false;
  });

  // Notify service worker that content script is ready
  chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: window.location.href });

  console.log('[DS-Pro] Content script loaded:', window.location.hostname);
})();
