/**
 * DS-Pro Automation Hub — eBay Extraction Content Script
 *
 * Extracts order data from eBay seller hub pages.
 *
 * NOTE: Selectors are PLACEHOLDERS and must be updated based on actual eBay page structure.
 * eBay frequently changes their markup, so these will need maintenance.
 */

/**
 * Wait for an element to appear in the DOM
 */
async function waitForElement(selector, timeout = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 200));
  }

  throw new Error(`Element not found: ${selector}`);
}

/**
 * Parse price string to cents
 * Examples: "$49.99" -> 4999, "49.99" -> 4999, "$1,234.56" -> 123456
 */
function parsePriceToCents(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

/**
 * Check if current page is eBay order list
 */
export function isOrderListPage() {
  return (
    window.location.hostname.includes('ebay.com') &&
    window.location.pathname.includes('/sh/ord')
  );
}

/**
 * Check if current page is eBay order detail
 */
export function isOrderDetailPage() {
  return (
    window.location.hostname.includes('ebay.com') &&
    window.location.pathname.includes('/sh/ord/details')
  );
}

/**
 * Extract order ID from URL
 */
export function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('orderid') || params.get('orderId');
}

/**
 * Extract data from eBay order list page
 *
 * Returns array of order summaries for processing
 */
export async function extractOrderList() {
  console.log('[DS-Pro] Extracting eBay order list...');

  // TODO: Update selectors based on actual eBay markup
  // These are PLACEHOLDERS

  const orders = [];

  // Wait for order table to load
  // Selector placeholder - update based on eBay's actual structure
  const orderRows = document.querySelectorAll('[data-testid="order-row"], .orders-list .order-row, tr.order');

  if (orderRows.length === 0) {
    console.warn('[DS-Pro] No order rows found. Selectors may need updating.');
  }

  for (const row of orderRows) {
    try {
      // Extract order ID - look for various possible locations
      // PLACEHOLDER SELECTORS - need real ones
      const orderIdEl = row.querySelector(
        '[data-testid="order-id"], ' +
        '.order-id, ' +
        'a[href*="orderid="]'
      );

      let orderId = null;
      if (orderIdEl) {
        // Try href first
        if (orderIdEl.href) {
          const url = new URL(orderIdEl.href);
          orderId = url.searchParams.get('orderid');
        }
        // Then text content
        if (!orderId) {
          orderId = orderIdEl.textContent.trim();
        }
      }

      if (!orderId) continue;

      // Extract status
      // PLACEHOLDER SELECTORS
      const statusEl = row.querySelector(
        '[data-testid="order-status"], ' +
        '.order-status, ' +
        '.status-badge'
      );
      const status = statusEl?.textContent?.trim();

      // Skip completed/cancelled orders
      const skipStatuses = ['delivered', 'completed', 'cancelled', 'refunded'];
      if (status && skipStatuses.some(s => status.toLowerCase().includes(s))) {
        continue;
      }

      orders.push({
        ebay_order_id: orderId,
        status,
        detail_url: `https://www.ebay.com/sh/ord/details?orderid=${orderId}`,
      });

    } catch (e) {
      console.warn('[DS-Pro] Error extracting order row:', e);
    }
  }

  console.log(`[DS-Pro] Found ${orders.length} orders to process`);
  return orders;
}

/**
 * Extract data from eBay order detail page
 */
export async function extractOrderDetail() {
  console.log('[DS-Pro] Extracting eBay order detail...');

  const orderId = getOrderIdFromUrl();

  // TODO: Update all selectors based on actual eBay markup
  // These are PLACEHOLDERS

  // Item name
  // PLACEHOLDER SELECTOR
  const itemNameEl = document.querySelector(
    '[data-testid="item-title"], ' +
    '.item-title, ' +
    '.order-item-name'
  );
  const itemName = itemNameEl?.textContent?.trim() || null;

  // Quantity
  // PLACEHOLDER SELECTOR
  const qtyEl = document.querySelector(
    '[data-testid="item-quantity"], ' +
    '.item-quantity, ' +
    '.qty-value'
  );
  const qty = qtyEl ? parseInt(qtyEl.textContent.replace(/\D/g, ''), 10) || 1 : 1;

  // Sale price (total)
  // PLACEHOLDER SELECTOR
  const priceEl = document.querySelector(
    '[data-testid="order-total"], ' +
    '.order-total, ' +
    '.total-amount'
  );
  const salePriceCents = parsePriceToCents(priceEl?.textContent);

  // eBay fees
  // PLACEHOLDER SELECTOR
  const feesEl = document.querySelector(
    '[data-testid="ebay-fees"], ' +
    '.ebay-fees, ' +
    '.fee-amount'
  );
  const ebayFeesCents = parsePriceToCents(feesEl?.textContent);

  // Sale date
  // PLACEHOLDER SELECTOR
  const dateEl = document.querySelector(
    '[data-testid="order-date"], ' +
    '.order-date, ' +
    '.sale-date'
  );
  let saleDate = null;
  if (dateEl) {
    try {
      const d = new Date(dateEl.textContent.trim());
      if (!isNaN(d.getTime())) {
        saleDate = d.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('[DS-Pro] Error parsing date:', e);
    }
  }

  // Auto-order URL (ecomsniper)
  // PLACEHOLDER SELECTORS - this is the key integration point
  let autoOrderUrl = null;

  // Strategy 1: Look for explicit auto-order button/link
  const autoOrderEl = document.querySelector(
    '[data-action="copy-auto-order"], ' +
    '[data-testid="auto-order-btn"], ' +
    'button:contains("Auto Order"), ' +
    'a[href*="ecomsniper"]'
  );

  if (autoOrderEl) {
    autoOrderUrl = autoOrderEl.dataset?.url || autoOrderEl.href || null;
  }

  // Strategy 2: Look for any link containing ecomsniper
  if (!autoOrderUrl) {
    const ecomsniperLinks = document.querySelectorAll('a[href*="ecomsniper"]');
    if (ecomsniperLinks.length > 0) {
      autoOrderUrl = ecomsniperLinks[0].href;
    }
  }

  // Strategy 3: Check for data attributes
  if (!autoOrderUrl) {
    const dataEl = document.querySelector('[data-auto-order-url]');
    autoOrderUrl = dataEl?.dataset?.autoOrderUrl || null;
  }

  const data = {
    ebay_order_id: orderId,
    item_name: itemName,
    qty,
    sale_price_cents: salePriceCents,
    ebay_fees_cents: ebayFeesCents,
    sale_date: saleDate,
    auto_order_url: autoOrderUrl,
    extracted_at: Date.now(),
    page_url: window.location.href,
  };

  console.log('[DS-Pro] Extracted eBay data:', data);
  return data;
}

/**
 * Main extraction function called by overlay.js
 */
export async function extractEbayData() {
  if (isOrderDetailPage()) {
    return extractOrderDetail();
  } else if (isOrderListPage()) {
    return extractOrderList();
  } else {
    throw new Error('Not on a recognized eBay order page');
  }
}
