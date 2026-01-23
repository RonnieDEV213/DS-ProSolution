/**
 * DS-Pro Automation Hub — Amazon Extraction Content Script
 *
 * Extracts order data from Amazon order detail pages.
 *
 * NOTE: Selectors are PLACEHOLDERS and must be updated based on actual Amazon page structure.
 * Amazon frequently changes their markup, so these will need maintenance.
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
 * Check if current page is Amazon order detail
 */
export function isOrderDetailPage() {
  return (
    window.location.hostname.includes('amazon.com') &&
    (window.location.pathname.includes('/order-details') ||
     window.location.pathname.includes('/your-orders/orders') ||
     window.location.pathname.includes('/gp/your-account/order-details'))
  );
}

/**
 * Check for blockers (CAPTCHA, login, errors)
 */
export function detectBlocker() {
  const blockers = [
    { selector: '#captchacharacters', type: 'CAPTCHA' },
    { selector: 'form[name="signIn"]', type: 'LOGIN_REQUIRED' },
    { selector: '#ap_email', type: 'LOGIN_REQUIRED' },
    { selector: '.a-alert-error', type: 'ERROR_BANNER' },
    { selector: '[data-action="mfa"]', type: '2FA' },
    { selector: '#auth-mfa-form', type: '2FA' },
    { selector: '#auth-captcha-image', type: 'CAPTCHA' },
  ];

  for (const { selector, type } of blockers) {
    if (document.querySelector(selector)) {
      return { blocked: true, type };
    }
  }

  return { blocked: false };
}

/**
 * Extract Amazon order ID from URL
 */
export function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('orderID') || params.get('orderId') || params.get('orderid');
}

/**
 * Extract ASIN from various sources
 */
function extractAsin() {
  // Try data attribute
  const asinEl = document.querySelector('[data-asin]');
  if (asinEl?.dataset?.asin) {
    return asinEl.dataset.asin;
  }

  // Try product link
  const productLinks = document.querySelectorAll('a[href*="/dp/"]');
  for (const link of productLinks) {
    const match = link.href.match(/\/dp\/([A-Z0-9]{10})/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Extract data from Amazon order detail page
 */
export async function extractOrderDetail() {
  console.log('[DS-Pro] Extracting Amazon order detail...');

  // Check for blockers first
  const blocker = detectBlocker();
  if (blocker.blocked) {
    throw new Error(`BLOCKER:${blocker.type}`);
  }

  const orderId = getOrderIdFromUrl();

  // TODO: Update all selectors based on actual Amazon markup
  // These are PLACEHOLDERS

  // Grand total / order total
  // PLACEHOLDER SELECTORS
  const totalEl = document.querySelector(
    '.grand-total-price, ' +
    '[data-testid="order-total"], ' +
    '.order-total, ' +
    '#od-subtotals .a-text-right:last-child, ' +
    '.a-color-price.a-text-bold'
  );
  const amazonPriceCents = parsePriceToCents(totalEl?.textContent);

  // Tax amount
  // PLACEHOLDER SELECTORS
  const taxEl = document.querySelector(
    '.tax-amount, ' +
    '[data-testid="tax-total"], ' +
    '#od-subtotals tr:contains("Tax") .a-text-right, ' +
    'span:contains("Estimated tax")'
  );
  let amazonTaxCents = null;
  if (taxEl) {
    // Try to find the price near the tax label
    const row = taxEl.closest('tr') || taxEl.parentElement;
    const priceInRow = row?.querySelector('.a-text-right, .a-color-price');
    amazonTaxCents = parsePriceToCents(priceInRow?.textContent || taxEl.textContent);
  }

  // Shipping amount
  // PLACEHOLDER SELECTORS
  const shippingEl = document.querySelector(
    '.shipping-amount, ' +
    '[data-testid="shipping-total"], ' +
    '#od-subtotals tr:contains("Shipping") .a-text-right'
  );
  let amazonShippingCents = null;
  if (shippingEl) {
    const row = shippingEl.closest('tr') || shippingEl.parentElement;
    const priceInRow = row?.querySelector('.a-text-right, .a-color-price');
    amazonShippingCents = parsePriceToCents(priceInRow?.textContent || shippingEl.textContent);
  }

  // If shipping is "FREE" or not found, default to 0
  if (amazonShippingCents === null) {
    const freeShippingEl = document.querySelector(
      ':contains("FREE Shipping"), ' +
      ':contains("Free delivery")'
    );
    if (freeShippingEl) {
      amazonShippingCents = 0;
    }
  }

  // Item quantity
  // PLACEHOLDER SELECTORS
  const qtyEl = document.querySelector(
    '.item-quantity, ' +
    '[data-testid="item-quantity"], ' +
    '.quantity'
  );
  const itemQty = qtyEl ? parseInt(qtyEl.textContent.replace(/\D/g, ''), 10) || 1 : 1;

  // ASIN
  const itemAsin = extractAsin();

  const data = {
    amazon_order_id: orderId,
    amazon_price_cents: amazonPriceCents,
    amazon_tax_cents: amazonTaxCents,
    amazon_shipping_cents: amazonShippingCents || 0,
    item_asin: itemAsin,
    item_qty: itemQty,
    extracted_at: Date.now(),
    page_url: window.location.href,
  };

  console.log('[DS-Pro] Extracted Amazon data:', data);
  return data;
}

/**
 * Wait for order detail page to be fully loaded
 */
export async function waitForOrderPage(timeout = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    // Check for blockers
    const blocker = detectBlocker();
    if (blocker.blocked) {
      throw new Error(`BLOCKER:${blocker.type}`);
    }

    // Check if we're on order detail page
    if (isOrderDetailPage()) {
      // Wait for key elements
      // PLACEHOLDER SELECTORS
      const hasOrderId = document.querySelector(
        '[data-testid="order-id"], ' +
        '.order-id, ' +
        '#orderDetails'
      );

      if (hasOrderId) {
        return true;
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error('Timed out waiting for Amazon order page');
}

/**
 * Main extraction function called by overlay.js
 */
export async function extractAmazonData() {
  // First wait for the page to be ready
  await waitForOrderPage();

  // Then extract
  return extractOrderDetail();
}
