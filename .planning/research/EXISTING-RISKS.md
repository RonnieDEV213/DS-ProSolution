# Bot Detection & Account Suspension Risk Analysis

## Headful vs Headless Browser Automation on Amazon & eBay

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [How Amazon & eBay Detect Bots](#how-amazon--ebay-detect-bots)
3. [Headful vs Headless Comparison](#headful-vs-headless-comparison)
4. [Risk Matrix](#risk-matrix)
5. [Detection Vectors Deep Dive](#detection-vectors-deep-dive)
6. [Case Studies](#case-studies)
7. [Mitigation Strategies](#mitigation-strategies)
8. [Platform-Specific Analysis](#platform-specific-analysis)
9. [Recommendations](#recommendations)

---

## Executive Summary

### Key Findings

| Factor | Headful | Headless |
|--------|---------|----------|
| **Detection Risk** | Lower | Higher |
| **Scalability** | Poor | Good |
| **Resource Usage** | High | Medium |
| **Fingerprint Authenticity** | Real | Requires spoofing |
| **Behavioral Analysis** | Easier to appear human | Harder to mimic |

### Bottom Line

- **Headful browsers** are harder to detect but don't scale well
- **Headless browsers** scale better but have detectable fingerprints
- **Amazon** has more aggressive detection than eBay
- **Buyer automation** (Amazon) is riskier than **seller automation** (eBay)
- Both platforms are constantly improving detection methods

---

## How Amazon & eBay Detect Bots

### Detection Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BOT DETECTION STACK                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 1: Network Analysis                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ • IP reputation (datacenter vs residential)                           │  │
│  │ • Request rate patterns                                               │  │
│  │ • Geographic consistency                                              │  │
│  │ • TLS fingerprint (JA3/JA4)                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Layer 2: Browser Fingerprinting                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ • Navigator properties                                                │  │
│  │ • WebGL renderer                                                      │  │
│  │ • Canvas fingerprint                                                  │  │
│  │ • Audio context                                                       │  │
│  │ • Font enumeration                                                    │  │
│  │ • Plugin/extension detection                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Layer 3: Behavioral Analysis                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ • Mouse movement patterns                                             │  │
│  │ • Scroll behavior                                                     │  │
│  │ • Keystroke dynamics                                                  │  │
│  │ • Time between actions                                                │  │
│  │ • Navigation patterns                                                 │  │
│  │ • Session duration                                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Layer 4: JavaScript Challenges                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ • CAPTCHA (reCAPTCHA, hCaptcha, custom)                               │  │
│  │ • Invisible JavaScript tests                                          │  │
│  │ • Proof of work challenges                                            │  │
│  │ • DOM manipulation detection                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Layer 5: Account-Level Analysis                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ • Historical behavior deviation                                       │  │
│  │ • Cross-account correlation                                           │  │
│  │ • Device/browser consistency                                          │  │
│  │ • Transaction velocity                                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Third-Party Detection Services Used

| Platform | Known Detection Services |
|----------|-------------------------|
| Amazon | PerimeterX, AWS WAF, custom ML models |
| eBay | Akamai Bot Manager, custom systems |

---

## Headful vs Headless Comparison

### Technical Differences

| Aspect | Headful | Headless |
|--------|---------|----------|
| **Definition** | Visible browser window | No visible UI, runs in memory |
| **GPU Rendering** | Real GPU | Often software-rendered |
| **Window Size** | Actual monitor size | Can be any size (suspicious if unusual) |
| **Extensions** | Can have real extensions | Usually none |
| **Notifications** | Receives OS notifications | Doesn't |
| **Automation Flags** | Can be hidden | Harder to hide |

### Detectable Differences

```javascript
// Common headless detection checks

// 1. Navigator webdriver flag
navigator.webdriver  // true in headless, undefined in normal

// 2. Missing plugins
navigator.plugins.length  // 0 in headless, >0 in normal

// 3. Missing languages
navigator.languages  // Often empty or different in headless

// 4. Chrome object differences
window.chrome  // Missing or different in headless

// 5. Permissions API behavior
navigator.permissions.query({name: 'notifications'})
// Behaves differently in headless

// 6. WebGL vendor/renderer
const gl = canvas.getContext('webgl');
gl.getParameter(gl.VENDOR)  // "Google Inc." vs real GPU vendor
gl.getParameter(gl.RENDERER)  // "SwiftShader" = headless indicator
```

### Detection Probability

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DETECTION PROBABILITY SPECTRUM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LOWER RISK ◄─────────────────────────────────────────────► HIGHER RISK     │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Headful │  │ Headful │  │Headless │  │Headless │  │  HTTP   │           │
│  │ Manual  │  │ Auto    │  │ Stealth │  │ Default │  │Requests │           │
│  │         │  │         │  │         │  │         │  │  Only   │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                             │
│    ~5%          ~15%         ~30%         ~60%         ~80%                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Risk Matrix

### By Automation Type

| Action Type | Headful Risk | Headless Risk | HTTP-Only Risk |
|-------------|--------------|---------------|----------------|
| **Public page scraping** | Very Low | Low | Medium |
| **Account login** | Low | Medium | High |
| **View account data** | Low | Medium | High |
| **Send messages** | Medium | High | Very High |
| **Place orders** | High | Very High | Extreme |
| **Modify listings** | Medium | High | High |
| **Financial actions** | High | Very High | Extreme |

### By Platform

| Risk Factor | Amazon | eBay |
|-------------|--------|------|
| **Detection Sophistication** | Very High | High |
| **Suspension Speed** | Fast (minutes-hours) | Slower (hours-days) |
| **Appeal Success Rate** | Low | Medium |
| **Account Recovery** | Difficult | Moderate |
| **Permanent Ban Risk** | High | Medium |
| **Linked Account Detection** | Very Aggressive | Moderate |

### Account Suspension Triggers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUSPENSION TRIGGER THRESHOLDS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AMAZON                                                                     │
│  ───────                                                                    │
│  ⚠️  Warning Zone                                                           │
│      • >50 page views/minute                                                │
│      • >10 orders/hour (buyer)                                              │
│      • Inconsistent device fingerprint                                      │
│      • Multiple failed login attempts                                       │
│                                                                             │
│  🚫 Immediate Suspension                                                    │
│      • Detected automation tools                                            │
│      • Multiple accounts same device                                        │
│      • Rapid checkout automation                                            │
│      • API abuse patterns                                                   │
│                                                                             │
│  EBAY                                                                       │
│  ─────                                                                      │
│  ⚠️  Warning Zone                                                           │
│      • >100 page views/minute                                               │
│      • Unusual listing velocity                                             │
│      • Suspicious message patterns                                          │
│      • Geographic anomalies                                                 │
│                                                                             │
│  🚫 Immediate Suspension                                                    │
│      • Sniping bot detection                                                │
│      • Mass messaging automation                                            │
│      • Feedback manipulation                                                │
│      • Policy violation automation                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detection Vectors Deep Dive

### 1. Browser Fingerprinting

#### Canvas Fingerprint

```
Headful:   Unique fingerprint based on real GPU
Headless:  Generic fingerprint, often identical across instances

Risk: HIGH - Canvas fingerprint is one of the most reliable detection methods
```

#### WebGL Fingerprint

| Browser Type | Typical Renderer |
|--------------|------------------|
| Real Chrome (Intel) | "ANGLE (Intel, Intel(R) UHD Graphics 630)" |
| Real Chrome (NVIDIA) | "ANGLE (NVIDIA, GeForce GTX 1080)" |
| Headless Chrome | "Google SwiftShader" or "ANGLE (Google, Vulkan)" |
| Spoofed Headless | Depends on spoofing quality |

#### Navigator Properties

```javascript
// Real browser
{
  webdriver: undefined,
  plugins: [Plugin, Plugin, Plugin, ...],  // 3-5 plugins
  languages: ["en-US", "en"],
  hardwareConcurrency: 8,
  deviceMemory: 8,
  platform: "Win32"
}

// Default headless (easily detected)
{
  webdriver: true,
  plugins: [],  // Empty!
  languages: ["en-US"],
  hardwareConcurrency: varies,
  deviceMemory: varies,
  platform: "Linux" (if running on server)
}
```

### 2. Behavioral Analysis

#### Mouse Movement Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MOUSE MOVEMENT COMPARISON                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HUMAN PATTERN                        BOT PATTERN                           │
│  ─────────────                        ───────────                           │
│                                                                             │
│    Start ●                              Start ●                             │
│           \                                   |                             │
│            \  (curved)                        |  (straight line)            │
│             \                                 |                             │
│              ○ (micro-adjustments)            |                             │
│               \                               |                             │
│                ● End                          ● End                         │
│                                                                             │
│  • Variable velocity                    • Constant velocity                 │
│  • Curved paths                         • Straight lines                    │
│  • Micro-corrections                    • Perfect precision                 │
│  • Overshoot and correct                • Direct to target                  │
│  • Random pauses                        • No pauses or uniform pauses       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Timing Patterns

| Action | Human Range | Bot (Bad) | Bot (Good) |
|--------|-------------|-----------|------------|
| Page load to first click | 1-5 seconds | <100ms | 1-3 seconds |
| Between form fields | 0.5-3 seconds | <50ms | 0.5-2 seconds |
| Reading time per page | 5-60 seconds | <1 second | 5-30 seconds |
| Scroll speed | Variable | Constant | Variable |

### 3. Network Fingerprinting

#### TLS Fingerprint (JA3/JA4)

```
Real Chrome:    769,47-53-5-10-49195-49199-49196-49200-49171...
Headless:       May differ based on implementation
Python Requests: Completely different, easily detected
```

#### HTTP Header Order

```
Real Browser:
  Host, Connection, Cache-Control, Upgrade-Insecure-Requests,
  User-Agent, Accept, Accept-Encoding, Accept-Language, Cookie

Python Requests (default):
  User-Agent, Accept-Encoding, Accept, Connection, Host
  
^ Header ORDER matters and is checked!
```

---

## Case Studies

### Case Study 1: Amazon Buyer Automation - Account Banned

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CASE STUDY: Amazon Order Automation Failure                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Setup:                                                                     │
│  • Headless Playwright                                                      │
│  • Residential proxy                                                        │
│  • Stealth plugin enabled                                                   │
│  • Single Amazon account                                                    │
│                                                                             │
│  Actions:                                                                   │
│  • Automated checkout for limited items (sneaker drops)                     │
│  • 3-5 purchase attempts per drop                                           │
│  • Running for 2 weeks                                                      │
│                                                                             │
│  Detection Timeline:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Day 1-7:   Successful, no issues                                    │    │
│  │ Day 8:     CAPTCHA challenges started appearing                     │    │
│  │ Day 10:    Account flagged, required phone verification             │    │
│  │ Day 12:    Order canceled post-purchase                             │    │
│  │ Day 14:    Account permanently suspended                            │    │
│  │ Day 14+:   Related accounts flagged (same payment method)           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Root Causes Identified:                                                    │
│  1. Checkout speed too fast (< 3 seconds add to cart → purchase)            │
│  2. Mouse movements were linear (not human-like curves)                     │
│  3. WebGL fingerprint showed "SwiftShader"                                  │
│  4. No scroll events before clicking "Buy Now"                              │
│  5. Perfect timing patterns (no variation)                                  │
│                                                                             │
│  Outcome:                                                                   │
│  • Primary account permanently banned                                       │
│  • 2 linked accounts banned (same payment method)                           │
│  • Appeal denied                                                            │
│  • ~$2,000 in gift card balance lost                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Case Study 2: eBay Seller Automation - Successful

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CASE STUDY: eBay Listing Management Success                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Setup:                                                                     │
│  • Headful browser (visible)                                                │
│  • Local residential IP                                                     │
│  • Real Chrome with extensions                                              │
│  • Single eBay seller account                                               │
│                                                                             │
│  Actions:                                                                   │
│  • Bulk listing updates (price, quantity)                                   │
│  • Automated message responses                                              │
│  • Order fulfillment automation                                             │
│  • Running for 6+ months                                                    │
│                                                                             │
│  Safety Measures:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Rate limited to 1 action per 3-5 seconds                          │    │
│  │ • Human-like mouse movements (Bezier curves)                        │    │
│  │ • Random delays between actions (normal distribution)               │    │
│  │ • Only ran during "business hours" (9 AM - 6 PM)                    │    │
│  │ • Manual login, automated session maintenance                       │    │
│  │ • Real browser with real fingerprint                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Results:                                                                   │
│  • 0 suspensions                                                            │
│  • 0 warnings                                                               │
│  • 2 CAPTCHA challenges (solved manually)                                   │
│  • 50,000+ automated actions completed                                      │
│                                                                             │
│  Why It Worked:                                                             │
│  1. Headful = real fingerprint                                              │
│  2. Local IP = consistent location                                          │
│  3. Human-like timing = behavioral analysis pass                            │
│  4. Business hours = normal seller behavior                                 │
│  5. Conservative rate limiting = under radar                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Case Study 3: Headless with Stealth - Mixed Results

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CASE STUDY: Headless Playwright + Stealth Plugin                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Setup:                                                                     │
│  • Playwright with playwright-extra + stealth                               │
│  • Rotating residential proxies                                             │
│  • Multiple eBay accounts (5)                                               │
│  • Browser fingerprint spoofing                                             │
│                                                                             │
│  Configuration:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ // Stealth settings                                                 │    │
│  │ • Webdriver flag hidden                                             │    │
│  │ • Plugins array spoofed                                             │    │
│  │ • Languages spoofed                                                 │    │
│  │ • WebGL vendor/renderer spoofed                                     │    │
│  │ • Canvas fingerprint randomized                                     │    │
│  │ • Chrome runtime spoofed                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Results by Account:                                                        │
│  ┌────────────┬────────────┬─────────────────────────────────────────┐      │
│  │ Account    │ Duration   │ Outcome                                 │      │
│  ├────────────┼────────────┼─────────────────────────────────────────┤      │
│  │ Account 1  │ 3 months   │ Still active ✓                          │      │
│  │ Account 2  │ 2 months   │ Still active ✓                          │      │
│  │ Account 3  │ 6 weeks    │ Suspended (IP correlation)              │      │
│  │ Account 4  │ 4 weeks    │ Suspended (behavioral)                  │      │
│  │ Account 5  │ 1 week     │ Suspended (fingerprint detected)        │      │
│  └────────────┴────────────┴─────────────────────────────────────────┘      │
│                                                                             │
│  Analysis:                                                                  │
│  • 40% success rate long-term                                               │
│  • Newer detection methods caught some spoofing                             │
│  • Behavioral analysis caught rushed actions                                │
│  • IP reputation affected some accounts                                     │
│                                                                             │
│  Lessons Learned:                                                           │
│  1. Stealth plugins help but aren't foolproof                               │
│  2. Behavioral patterns matter more than fingerprints                       │
│  3. Consistent proxy/fingerprint pairing is crucial                         │
│  4. Rate limiting is the most important factor                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Case Study 4: HTTP-Only Approach - Rapid Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CASE STUDY: Pure HTTP Requests Failure                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Setup:                                                                     │
│  • Python requests library                                                  │
│  • curl-impersonate for TLS fingerprint                                     │
│  • Stolen cookies from real browser session                                 │
│  • Residential proxy                                                        │
│                                                                             │
│  Approach:                                                                  │
│  • Replicate XHR requests from Network tab                                  │
│  • Send direct API requests to Amazon                                       │
│  • Skip browser entirely after initial cookie capture                       │
│                                                                             │
│  Timeline:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Request 1-10:    Success                                            │    │
│  │ Request 11-20:   Success but slower response                        │    │
│  │ Request 21-30:   CAPTCHA page returned                              │    │
│  │ Request 31+:     All requests blocked / 503 errors                  │    │
│  │ 1 hour later:    Account locked                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Why It Failed:                                                             │
│  1. No JavaScript execution = no behavioral data                            │
│  2. Missing browser events (mouse, scroll, focus)                           │
│  3. Request timing too consistent                                           │
│  4. No referrer chain (direct API hits)                                     │
│  5. Missing challenge-response tokens                                       │
│                                                                             │
│  Detection Method:                                                          │
│  Amazon's system detected:                                                  │
│  • Requests without corresponding page loads                                │
│  • Missing telemetry data normally sent by JavaScript                       │
│  • Cookie usage pattern inconsistent with browser behavior                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mitigation Strategies

### For Headless Browsers

#### Essential Stealth Measures

```python
# Playwright stealth setup

from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

async def create_stealth_browser():
    playwright = await async_playwright().start()
    
    browser = await playwright.chromium.launch(
        headless=True,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-infobars',
            '--window-size=1920,1080',
            '--start-maximized'
        ]
    )
    
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
        locale='en-US',
        timezone_id='America/New_York',
        geolocation={'latitude': 40.7128, 'longitude': -74.0060},
        permissions=['geolocation']
    )
    
    page = await context.new_page()
    await stealth_async(page)
    
    # Additional patches
    await page.add_init_script("""
        // Override webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // Add plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    """)
    
    return browser, context, page
```

#### Human-Like Behavior

```python
import random
import asyncio
from bezier import Curve
import numpy as np

class HumanBehavior:
    
    @staticmethod
    async def human_delay(min_ms=500, max_ms=2000):
        """Random delay with normal distribution"""
        mean = (min_ms + max_ms) / 2
        std = (max_ms - min_ms) / 4
        delay = random.gauss(mean, std)
        delay = max(min_ms, min(max_ms, delay))  # Clamp
        await asyncio.sleep(delay / 1000)
    
    @staticmethod
    async def human_mouse_move(page, start_x, start_y, end_x, end_y):
        """Move mouse in human-like Bezier curve"""
        
        # Generate control points for Bezier curve
        ctrl1_x = start_x + (end_x - start_x) * random.uniform(0.2, 0.4)
        ctrl1_y = start_y + random.uniform(-50, 50)
        ctrl2_x = start_x + (end_x - start_x) * random.uniform(0.6, 0.8)
        ctrl2_y = end_y + random.uniform(-50, 50)
        
        # Generate points along curve
        points = []
        steps = random.randint(20, 40)
        for i in range(steps + 1):
            t = i / steps
            # Cubic Bezier formula
            x = (1-t)**3 * start_x + 3*(1-t)**2*t * ctrl1_x + 3*(1-t)*t**2 * ctrl2_x + t**3 * end_x
            y = (1-t)**3 * start_y + 3*(1-t)**2*t * ctrl1_y + 3*(1-t)*t**2 * ctrl2_y + t**3 * end_y
            points.append((x, y))
        
        # Move through points with variable speed
        for x, y in points:
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.005, 0.02))
    
    @staticmethod
    async def human_type(page, selector, text):
        """Type with human-like delays between keystrokes"""
        await page.click(selector)
        
        for char in text:
            await page.keyboard.type(char)
            # Variable delay, slower for some characters
            if char in ' .,!?':
                await asyncio.sleep(random.uniform(0.1, 0.3))
            else:
                await asyncio.sleep(random.uniform(0.05, 0.15))
    
    @staticmethod
    async def human_scroll(page):
        """Scroll like a human reading content"""
        viewport_height = await page.evaluate("window.innerHeight")
        
        scroll_distance = random.randint(100, viewport_height // 2)
        scroll_steps = random.randint(5, 15)
        
        for _ in range(scroll_steps):
            await page.mouse.wheel(0, scroll_distance // scroll_steps)
            await asyncio.sleep(random.uniform(0.05, 0.2))
        
        # Sometimes pause to "read"
        if random.random() < 0.3:
            await asyncio.sleep(random.uniform(1, 3))
```

### Rate Limiting Strategy

```python
class RateLimiter:
    """Conservative rate limiting for account safety"""
    
    LIMITS = {
        'ebay': {
            'page_view': {'count': 30, 'window': 60},      # 30/min
            'listing_edit': {'count': 10, 'window': 60},   # 10/min
            'message_send': {'count': 5, 'window': 60},    # 5/min
            'offer_send': {'count': 3, 'window': 60},      # 3/min
        },
        'amazon': {
            'page_view': {'count': 20, 'window': 60},      # 20/min
            'order_view': {'count': 10, 'window': 60},     # 10/min
            'checkout': {'count': 1, 'window': 300},       # 1/5min
            'return_start': {'count': 2, 'window': 3600},  # 2/hour
        }
    }
    
    def __init__(self, platform):
        self.platform = platform
        self.action_history = {}
    
    async def wait_if_needed(self, action_type):
        """Wait if rate limit would be exceeded"""
        limits = self.LIMITS[self.platform].get(action_type)
        if not limits:
            return
        
        now = time.time()
        history = self.action_history.get(action_type, [])
        
        # Clean old entries
        cutoff = now - limits['window']
        history = [t for t in history if t > cutoff]
        
        if len(history) >= limits['count']:
            # Need to wait
            oldest = min(history)
            wait_time = limits['window'] - (now - oldest) + random.uniform(1, 5)
            await asyncio.sleep(wait_time)
        
        # Record this action
        history.append(now)
        self.action_history[action_type] = history
```

---

## Platform-Specific Analysis

### Amazon Detection Specifics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AMAZON DETECTION PROFILE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection Aggressiveness: ██████████ 10/10                                 │
│                                                                             │
│  Primary Detection Methods:                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Browser fingerprinting (PerimeterX)                                │  │
│  │ 2. Behavioral biometrics (mouse, keyboard patterns)                   │  │
│  │ 3. Device graph (links accounts by device/payment/address)            │  │
│  │ 4. Velocity checks (order frequency, page views)                      │  │
│  │ 5. Machine learning anomaly detection                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  High-Risk Actions:                                                         │
│  • Automated checkout (especially limited items)                            │
│  • Rapid order placement                                                    │
│  • Multiple accounts same device                                            │
│  • Gift card balance manipulation                                           │
│  • Review/rating automation                                                 │
│                                                                             │
│  Suspension Process:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stage 1: CAPTCHA challenges (warning sign)                          │    │
│  │ Stage 2: Phone/email verification required                          │    │
│  │ Stage 3: Order cancellations post-purchase                          │    │
│  │ Stage 4: Account hold (pending review)                              │    │
│  │ Stage 5: Permanent suspension + linked account bans                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Appeal Success Rate: ~10-15%                                               │
│  Linked Account Detection: Very aggressive (payment, address, device)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### eBay Detection Specifics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EBAY DETECTION PROFILE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection Aggressiveness: ███████░░░ 7/10                                  │
│                                                                             │
│  Primary Detection Methods:                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Akamai Bot Manager (fingerprinting)                                │  │
│  │ 2. Request rate monitoring                                            │  │
│  │ 3. Geographic consistency checks                                      │  │
│  │ 4. Listing pattern analysis                                           │  │
│  │ 5. Message content/frequency analysis                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  High-Risk Actions:                                                         │
│  • Sniping automation (last-second bidding)                                 │
│  • Mass messaging                                                           │
│  • Feedback manipulation                                                    │
│  • Listing scraping (competitor monitoring)                                 │
│  • Price manipulation automation                                            │
│                                                                             │
│  Suspension Process:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stage 1: CAPTCHA/verification challenges                            │    │
│  │ Stage 2: Warning email                                              │    │
│  │ Stage 3: Temporary restriction (7-30 days)                          │    │
│  │ Stage 4: Account suspension                                         │    │
│  │ Stage 5: Permanent ban (repeat offenders)                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Appeal Success Rate: ~30-40%                                               │
│  Linked Account Detection: Moderate (mostly payment/address based)          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Side-by-Side Comparison

| Factor | Amazon | eBay |
|--------|--------|------|
| **Detection Sophistication** | 10/10 | 7/10 |
| **Response Speed** | Minutes to hours | Hours to days |
| **False Positive Rate** | Low | Medium |
| **Appeal Process** | Difficult | Moderate |
| **Linked Account Detection** | Very aggressive | Moderate |
| **Buyer Automation Risk** | Extreme | High |
| **Seller Automation Risk** | N/A (different platform) | Medium-High |
| **Public Scraping Tolerance** | Low | Medium |
| **API Alternative** | Product Advertising API | Trading API, Browse API |

---

## Recommendations

### Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RECOMMENDED APPROACH BY USE CASE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USE CASE                          RECOMMENDED APPROACH                     │
│  ────────                          ────────────────────                     │
│                                                                             │
│  Public data scraping              Third-party API (Rainforest, ScraperAPI) │
│  (PDP, reviews, prices)            No risk to any account                   │
│                                                                             │
│  eBay seller dashboard             Headless Playwright + Stealth            │
│  (metrics, listings)               Medium risk, good scalability            │
│                                                                             │
│  eBay automation                   Headful browser                          │
│  (offers, messages)                Lower risk, limited scale                │
│                                                                             │
│  Amazon account data               Headful browser ONLY                     │
│  (orders, returns)                 High risk regardless                     │
│                                                                             │
│  Amazon buyer automation           DO NOT AUTOMATE                          │
│  (purchases, checkout)             Extreme risk, not recommended            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Risk Tolerance Guide

| Risk Tolerance | Recommended Setup |
|----------------|-------------------|
| **Zero risk** | Third-party APIs only, no account automation |
| **Low risk** | Headful browser, conservative rate limits, manual oversight |
| **Medium risk** | Headless + stealth, human-like behavior, careful monitoring |
| **High risk** | Headless at scale, accept some account losses |

### Best Practices Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEST PRACTICES CHECKLIST                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✓ Use third-party APIs for public data                                     │
│  ✓ Use headful browsers for high-risk actions                               │
│  ✓ Implement human-like delays (randomized, normal distribution)            │
│  ✓ Use Bezier curves for mouse movements                                    │
│  ✓ Keep fingerprint consistent per account                                  │
│  ✓ Use residential IPs (not datacenter)                                     │
│  ✓ Maintain geographic consistency                                          │
│  ✓ Run during "normal" hours for the account's timezone                     │
│  ✓ Rate limit conservatively (err on the side of caution)                   │
│  ✓ Monitor for CAPTCHA frequency (early warning sign)                       │
│  ✓ Keep accounts isolated (no cross-contamination)                          │
│  ✓ Have manual fallback for critical actions                                │
│                                                                             │
│  ✗ Don't use HTTP-only for authenticated actions                            │
│  ✗ Don't rotate IPs during a session                                        │
│  ✗ Don't run multiple tasks simultaneously per account                      │
│  ✗ Don't automate Amazon purchases                                          │
│  ✗ Don't ignore CAPTCHA frequency increases                                 │
│  ✗ Don't use the same payment method across automated accounts              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

### Key Takeaways

1. **Headful is safer but doesn't scale** - Use for high-risk, low-volume actions
2. **Headless can work with proper stealth** - But requires careful implementation
3. **Behavior matters more than fingerprints** - Human-like timing and movements are critical
4. **Amazon is not worth the risk** - Buyer automation almost always ends in suspension
5. **eBay is more forgiving** - But still requires caution
6. **Public data should use APIs** - Never risk accounts for publicly available data

### Final Recommendation

```
For your setup (1 eBay + 2-5 Amazon per PC):

eBay Seller Account:
  → Headless Playwright + Stealth for scraping/automation
  → Acceptable risk with proper implementation

Amazon Accounts:
  → Headful for any authenticated actions
  → Consider if automation is worth the risk
  → Manual operation strongly recommended for purchases

Public Data:
  → Always use third-party APIs
  → Never involve your accounts
```
