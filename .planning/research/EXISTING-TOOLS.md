# Headless Scraping & Automation Tools Reference

## Complete Guide to Tools, Services, and Methods

---

## Table of Contents

1. [Browser Automation Frameworks](#browser-automation-frameworks)
2. [Stealth & Anti-Detection](#stealth--anti-detection)
3. [Proxy Services](#proxy-services)
4. [CAPTCHA Solving](#captcha-solving)
5. [Fingerprint Management](#fingerprint-management)
6. [Session Management](#session-management)
7. [HTTP Clients & Request Libraries](#http-clients--request-libraries)
8. [Queue & Orchestration](#queue--orchestration)
9. [Data Extraction & Parsing](#data-extraction--parsing)
10. [Monitoring & Debugging](#monitoring--debugging)
11. [Cloud Infrastructure](#cloud-infrastructure)
12. [All-in-One Platforms](#all-in-one-platforms)
13. [Methods & Techniques](#methods--techniques)

---

## Browser Automation Frameworks

### Primary Frameworks

| Tool | Language | Headless | Stealth Support | Best For |
|------|----------|----------|-----------------|----------|
| **Playwright** | Python, JS, .NET, Java | ✓ | Via plugins | Modern, fast, multi-browser |
| **Puppeteer** | JavaScript/Node.js | ✓ | Via plugins | Chrome-focused, mature |
| **Selenium** | Multi-language | ✓ | Limited | Legacy, wide browser support |
| **Cypress** | JavaScript | ✓ | Limited | Testing-focused |

### Playwright

```
Website:    https://playwright.dev
Languages:  Python, JavaScript, .NET, Java
Browsers:   Chromium, Firefox, WebKit
License:    Apache 2.0

Pros:
  ✓ Auto-wait for elements
  ✓ Multi-browser support
  ✓ Built-in parallelization
  ✓ Network interception
  ✓ Mobile emulation
  ✓ Active development

Cons:
  ✗ Larger resource footprint
  ✗ Stealth requires plugins

Installation:
  pip install playwright
  playwright install
```

### Puppeteer

```
Website:    https://pptr.dev
Languages:  JavaScript/Node.js
Browsers:   Chrome/Chromium (Firefox experimental)
License:    Apache 2.0

Pros:
  ✓ Chrome DevTools Protocol direct access
  ✓ Large ecosystem
  ✓ Mature and stable
  ✓ Good documentation

Cons:
  ✗ Chrome-only (primarily)
  ✗ Node.js only

Installation:
  npm install puppeteer
```

### Selenium

```
Website:    https://www.selenium.dev
Languages:  Python, Java, C#, Ruby, JavaScript
Browsers:   All major browsers
License:    Apache 2.0

Pros:
  ✓ Most language support
  ✓ Widest browser support
  ✓ Large community
  ✓ Grid for distributed testing

Cons:
  ✗ Slower than modern alternatives
  ✗ More detectable
  ✗ Verbose API

Installation:
  pip install selenium
```

### Alternative Frameworks

| Tool | Description | Use Case |
|------|-------------|----------|
| **Pyppeteer** | Python port of Puppeteer | Python + Puppeteer API |
| **Splash** | Lightweight scriptable browser | API-based rendering |
| **Rod** | Go-based Chromium driver | Go projects, performance |
| **Chromedp** | Go Chrome DevTools Protocol | Go projects |
| **Ferrum** | Ruby Chrome driver | Ruby projects |

---

## Stealth & Anti-Detection

### Stealth Plugins

| Tool | Framework | Features |
|------|-----------|----------|
| **playwright-stealth** | Playwright | Webdriver hide, plugin spoof, etc. |
| **puppeteer-extra-plugin-stealth** | Puppeteer | Comprehensive evasion |
| **undetected-chromedriver** | Selenium | Patches Chrome to avoid detection |
| **selenium-stealth** | Selenium | Basic stealth patches |

### playwright-stealth

```python
# Installation
pip install playwright-stealth

# Usage
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await stealth_async(page)
        await page.goto("https://example.com")
```

### puppeteer-extra-plugin-stealth

```javascript
// Installation
npm install puppeteer-extra puppeteer-extra-plugin-stealth

// Usage
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://example.com');
```

### undetected-chromedriver

```python
# Installation
pip install undetected-chromedriver

# Usage
import undetected_chromedriver as uc

driver = uc.Chrome(headless=True)
driver.get("https://example.com")
```

### Stealth Evasion Techniques

| Technique | What It Does |
|-----------|--------------|
| **Webdriver flag removal** | Removes `navigator.webdriver = true` |
| **Plugin array spoofing** | Adds fake plugins to empty array |
| **Language spoofing** | Sets realistic language arrays |
| **WebGL vendor override** | Changes SwiftShader to real GPU |
| **Chrome runtime mock** | Adds missing `window.chrome` object |
| **Permissions API patch** | Fixes headless permission behavior |
| **iframe contentWindow fix** | Patches iframe detection |
| **Media codecs spoof** | Adds realistic media codec support |

---

## Proxy Services

### Residential Proxy Providers

| Service | Type | Sticky Sessions | Pricing Model |
|---------|------|-----------------|---------------|
| **Bright Data** | Residential, DC, Mobile | ✓ (up to 24h) | Per GB |
| **Oxylabs** | Residential, DC | ✓ (up to 30min) | Per GB |
| **Smartproxy** | Residential, DC | ✓ (up to 30min) | Per GB |
| **IPRoyal** | Residential, DC | ✓ | Per GB |
| **SOAX** | Residential, Mobile | ✓ | Per GB |
| **GeoSurf** | Residential | ✓ | Per request |
| **NetNut** | Residential, ISP | ✓ | Per GB |
| **PacketStream** | Residential (P2P) | Limited | Per GB |
| **Shifter** | Residential | ✓ | Per port |

### Proxy Types Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROXY TYPE COMPARISON                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATACENTER PROXIES                                                         │
│  ──────────────────                                                         │
│  • Fast and cheap                                                           │
│  • Easily detected (known IP ranges)                                        │
│  • Good for: Public data, high-volume, non-sensitive                        │
│  • Bad for: Authenticated sessions, major platforms                         │
│  • Price: $0.50-2/GB                                                        │
│                                                                             │
│  RESIDENTIAL PROXIES                                                        │
│  ───────────────────                                                        │
│  • Real ISP IPs                                                             │
│  • Harder to detect                                                         │
│  • Good for: Authenticated sessions, major platforms                        │
│  • Bad for: High-volume (expensive)                                         │
│  • Price: $5-15/GB                                                          │
│                                                                             │
│  ISP PROXIES                                                                │
│  ───────────                                                                │
│  • Static residential IPs                                                   │
│  • Best of both worlds                                                      │
│  • Good for: Long sessions, consistent identity                             │
│  • Bad for: Budget projects                                                 │
│  • Price: $10-25/GB                                                         │
│                                                                             │
│  MOBILE PROXIES                                                             │
│  ─────────────                                                              │
│  • 4G/5G carrier IPs                                                        │
│  • Highest trust level                                                      │
│  • Good for: Most aggressive anti-bot systems                               │
│  • Bad for: Speed-sensitive tasks                                           │
│  • Price: $20-50/GB                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proxy Integration Example

```python
# Playwright with proxy
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            proxy={
                "server": "http://proxy.example.com:8080",
                "username": "user",
                "password": "pass"
            }
        )
        page = await browser.new_page()
        await page.goto("https://example.com")
```

### Free/Self-Hosted Options

| Tool | Description |
|------|-------------|
| **Squid** | Open-source proxy server |
| **mitmproxy** | Interactive HTTPS proxy |
| **Tor** | Anonymous network (slow, often blocked) |
| **FoxyProxy** | Browser proxy manager |

---

## CAPTCHA Solving

### CAPTCHA Solving Services

| Service | reCAPTCHA | hCaptcha | Image | Price |
|---------|-----------|----------|-------|-------|
| **2Captcha** | ✓ | ✓ | ✓ | $2.99/1000 |
| **Anti-Captcha** | ✓ | ✓ | ✓ | $2.00/1000 |
| **CapMonster** | ✓ | ✓ | ✓ | Self-hosted option |
| **DeathByCaptcha** | ✓ | ✓ | ✓ | $1.39/1000 |
| **CapSolver** | ✓ | ✓ | ✓ | $0.80/1000 |
| **AZCaptcha** | ✓ | ✓ | ✓ | $1.00/1000 |
| **Capsolver.com** | ✓ | ✓ | ✓ | Token-based |

### 2Captcha Integration Example

```python
import requests
import time

class CaptchaSolver:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "http://2captcha.com"
    
    def solve_recaptcha(self, site_key, page_url):
        # Submit task
        submit_url = f"{self.base_url}/in.php"
        payload = {
            "key": self.api_key,
            "method": "userrecaptcha",
            "googlekey": site_key,
            "pageurl": page_url,
            "json": 1
        }
        response = requests.post(submit_url, data=payload).json()
        task_id = response["request"]
        
        # Poll for result
        result_url = f"{self.base_url}/res.php"
        for _ in range(60):  # Max 60 attempts
            time.sleep(5)
            result = requests.get(result_url, params={
                "key": self.api_key,
                "action": "get",
                "id": task_id,
                "json": 1
            }).json()
            
            if result["status"] == 1:
                return result["request"]  # Token
        
        raise Exception("CAPTCHA solve timeout")
```

### CAPTCHA Avoidance Strategies

| Strategy | Description |
|----------|-------------|
| **Human-like behavior** | Reduces CAPTCHA frequency |
| **Session persistence** | Reuse solved sessions |
| **Cookie management** | Maintain trust cookies |
| **Rate limiting** | Stay under detection thresholds |
| **Residential IPs** | Higher trust scores |
| **Browser fingerprint** | Consistent, realistic fingerprint |

---

## Fingerprint Management

### Browser Fingerprint Tools

| Tool | Type | Features |
|------|------|----------|
| **FingerprintJS** | Detection | Identify fingerprint components |
| **CreepJS** | Detection | Advanced fingerprint analysis |
| **BrowserLeaks** | Testing | Test your fingerprint |
| **Multilogin** | Management | Multiple browser profiles |
| **GoLogin** | Management | Anti-detect browser |
| **Incogniton** | Management | Browser profile manager |
| **Kameleo** | Management | Fingerprint spoofing |

### Fingerprint Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BROWSER FINGERPRINT COMPONENTS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NAVIGATOR PROPERTIES                                                       │
│  ────────────────────                                                       │
│  • userAgent           • platform           • language                      │
│  • languages           • hardwareConcurrency • deviceMemory                 │
│  • plugins             • mimeTypes          • cookieEnabled                 │
│  • doNotTrack          • maxTouchPoints     • webdriver                     │
│                                                                             │
│  SCREEN PROPERTIES                                                          │
│  ─────────────────                                                          │
│  • width/height        • availWidth/Height  • colorDepth                    │
│  • pixelDepth          • orientation                                        │
│                                                                             │
│  WEBGL FINGERPRINT                                                          │
│  ─────────────────                                                          │
│  • vendor              • renderer           • extensions                    │
│  • shading language    • max parameters                                     │
│                                                                             │
│  CANVAS FINGERPRINT                                                         │
│  ──────────────────                                                         │
│  • 2D rendering output • Text rendering     • Color handling               │
│                                                                             │
│  AUDIO FINGERPRINT                                                          │
│  ─────────────────                                                          │
│  • AudioContext        • Oscillator output  • Analyser data                │
│                                                                             │
│  FONT FINGERPRINT                                                           │
│  ────────────────                                                           │
│  • Installed fonts     • Font rendering     • Font metrics                 │
│                                                                             │
│  OTHER                                                                      │
│  ─────                                                                      │
│  • Timezone            • WebRTC IPs         • Battery status               │
│  • Storage quota       • IndexedDB          • CSS features                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fingerprint Spoofing Example

```python
# Playwright fingerprint override
async def create_fingerprinted_context(browser, fingerprint):
    context = await browser.new_context(
        viewport=fingerprint['viewport'],
        user_agent=fingerprint['user_agent'],
        locale=fingerprint['locale'],
        timezone_id=fingerprint['timezone'],
        geolocation=fingerprint['geolocation'],
        permissions=['geolocation'],
        color_scheme='light',
        device_scale_factor=fingerprint.get('device_scale_factor', 1),
    )
    
    page = await context.new_page()
    
    # Inject fingerprint overrides
    await page.add_init_script(f"""
        // WebGL override
        const getParameterProxyHandler = {{
            apply: function(target, thisArg, args) {{
                const param = args[0];
                if (param === 37445) return '{fingerprint["webgl_vendor"]}';
                if (param === 37446) return '{fingerprint["webgl_renderer"]}';
                return Reflect.apply(target, thisArg, args);
            }}
        }};
        
        WebGLRenderingContext.prototype.getParameter = new Proxy(
            WebGLRenderingContext.prototype.getParameter,
            getParameterProxyHandler
        );
        
        // Navigator overrides
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {fingerprint['hardware_concurrency']}
        }});
        
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {fingerprint['device_memory']}
        }});
        
        Object.defineProperty(navigator, 'platform', {{
            get: () => '{fingerprint["platform"]}'
        }});
    """)
    
    return context, page

# Example fingerprint profile
fingerprint = {
    'viewport': {'width': 1920, 'height': 1080},
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'locale': 'en-US',
    'timezone': 'America/New_York',
    'geolocation': {'latitude': 40.7128, 'longitude': -74.0060},
    'webgl_vendor': 'Google Inc. (NVIDIA)',
    'webgl_renderer': 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
    'hardware_concurrency': 8,
    'device_memory': 8,
    'platform': 'Win32'
}
```

### Anti-Detect Browsers

| Browser | Features | Pricing |
|---------|----------|---------|
| **Multilogin** | Full fingerprint control, team sharing | $99+/mo |
| **GoLogin** | 100+ fingerprint params, free tier | $49+/mo |
| **Incogniton** | Selenium integration, API | $29+/mo |
| **Kameleo** | Mobile fingerprints, automation API | $59+/mo |
| **Dolphin Anty** | Free tier, team features | Free/$89+/mo |
| **VMLogin** | Virtual browser profiles | $99+/mo |
| **AdsPower** | Facebook/social focus | $9+/mo |
| **Lalicat** | Budget option | $59+/mo |

---

## Session Management

### Session Storage Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| **Playwright storage_state** | Built-in session export/import | Playwright projects |
| **Puppeteer cookies** | Cookie management | Puppeteer projects |
| **Redis** | In-memory session store | Distributed systems |
| **SQLite** | Local session database | Single-machine |
| **PostgreSQL** | Relational session store | Production systems |

### Session Management Example

```python
import json
import asyncio
from datetime import datetime, timedelta
from playwright.async_api import async_playwright

class SessionManager:
    def __init__(self, storage_path="sessions"):
        self.storage_path = storage_path
        self.sessions = {}
    
    async def get_session(self, account_id):
        """Load or create session for account"""
        session_file = f"{self.storage_path}/{account_id}.json"
        
        try:
            with open(session_file, 'r') as f:
                session = json.load(f)
                
            # Check expiry
            expires = datetime.fromisoformat(session['expires_at'])
            if datetime.now() > expires:
                return await self.refresh_session(account_id)
            
            return session
        except FileNotFoundError:
            return await self.create_session(account_id)
    
    async def save_session(self, account_id, context):
        """Save browser session state"""
        session_file = f"{self.storage_path}/{account_id}.json"
        
        storage_state = await context.storage_state()
        
        session = {
            'account_id': account_id,
            'storage_state': storage_state,
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(hours=24)).isoformat()
        }
        
        with open(session_file, 'w') as f:
            json.dump(session, f)
        
        # Also save Playwright-compatible state file
        state_file = f"{self.storage_path}/{account_id}_state.json"
        with open(state_file, 'w') as f:
            json.dump(storage_state, f)
        
        return session
    
    async def load_context(self, browser, account_id):
        """Load browser context with saved session"""
        session = await self.get_session(account_id)
        state_file = f"{self.storage_path}/{account_id}_state.json"
        
        context = await browser.new_context(
            storage_state=state_file
        )
        
        return context
    
    async def refresh_session(self, account_id):
        """Re-authenticate and refresh session"""
        # Implement login logic here
        pass
```

### Cookie Management

```python
# Extract cookies from browser
async def extract_cookies(page):
    cookies = await page.context.cookies()
    return {c['name']: c['value'] for c in cookies}

# Inject cookies
async def inject_cookies(context, cookies):
    cookie_list = [
        {
            'name': name,
            'value': value,
            'domain': '.example.com',
            'path': '/'
        }
        for name, value in cookies.items()
    ]
    await context.add_cookies(cookie_list)
```

---

## HTTP Clients & Request Libraries

### For Direct Requests (Non-Browser)

| Library | Language | TLS Fingerprint | Features |
|---------|----------|-----------------|----------|
| **httpx** | Python | Default | Async, HTTP/2 |
| **aiohttp** | Python | Default | Async-first |
| **requests** | Python | Default | Simple, sync |
| **curl-impersonate** | CLI/Library | Chrome/Firefox | Mimics browser TLS |
| **tls-client** | Python/Go | Customizable | TLS fingerprint control |
| **got** | Node.js | Default | Feature-rich |
| **axios** | Node.js | Default | Popular, simple |
| **pycurl** | Python | Via libcurl | Low-level control |

### curl-impersonate

```bash
# Installation
# Download from: https://github.com/lwthiker/curl-impersonate

# Usage - Mimics Chrome
curl_chrome116 https://example.com

# Usage - Mimics Firefox
curl_ff117 https://example.com
```

### tls-client (Python)

```python
# Installation
pip install tls-client

# Usage
import tls_client

session = tls_client.Session(
    client_identifier="chrome_120",
    random_tls_extension_order=True
)

response = session.get(
    "https://example.com",
    headers={
        "User-Agent": "Mozilla/5.0 ...",
    }
)
```

### httpx with Proxy

```python
import httpx

async def fetch_with_proxy(url, proxy, cookies):
    async with httpx.AsyncClient(
        proxies={"all://": proxy},
        cookies=cookies,
        timeout=30.0,
        follow_redirects=True
    ) as client:
        response = await client.get(url)
        return response.text
```

---

## Queue & Orchestration

### Task Queue Systems

| Tool | Type | Language | Features |
|------|------|----------|----------|
| **Redis + RQ** | Queue | Python | Simple, Redis-based |
| **Celery** | Queue | Python | Full-featured, multiple backends |
| **RabbitMQ** | Message Broker | Any | Enterprise, reliable |
| **Bull** | Queue | Node.js | Redis-based, feature-rich |
| **Dramatiq** | Queue | Python | Simple, RabbitMQ/Redis |
| **Apache Kafka** | Streaming | Any | High-throughput |
| **AWS SQS** | Queue | Any | Managed, serverless |

### Redis Queue Example

```python
# Using RQ (Redis Queue)
from redis import Redis
from rq import Queue

redis_conn = Redis()
queue = Queue(connection=redis_conn)

# Define task
def scrape_task(account_id, url):
    # Scraping logic here
    pass

# Enqueue task
job = queue.enqueue(scrape_task, 'A1E', 'https://ebay.com/sh/ovw')
```

### Celery Example

```python
# celery_app.py
from celery import Celery

app = Celery('tasks', broker='redis://localhost:6379/0')

@app.task
def scrape_task(account_id, url):
    # Scraping logic
    pass

# Usage
scrape_task.delay('A1E', 'https://ebay.com/sh/ovw')
```

### Custom Account-Based Queue

```python
import asyncio
from collections import defaultdict

class AccountQueue:
    """Queue that ensures sequential execution per account"""
    
    def __init__(self):
        self.queues = defaultdict(asyncio.Queue)
        self.workers = {}
    
    async def add_task(self, account_id, task_func, *args, **kwargs):
        """Add task to account's queue"""
        await self.queues[account_id].put((task_func, args, kwargs))
        
        # Start worker if not running
        if account_id not in self.workers:
            self.workers[account_id] = asyncio.create_task(
                self._worker(account_id)
            )
    
    async def _worker(self, account_id):
        """Process tasks sequentially for account"""
        queue = self.queues[account_id]
        
        while True:
            task_func, args, kwargs = await queue.get()
            try:
                await task_func(*args, **kwargs)
            except Exception as e:
                print(f"Task error for {account_id}: {e}")
            finally:
                queue.task_done()
```

---

## Data Extraction & Parsing

### HTML Parsing Libraries

| Library | Language | Features |
|---------|----------|----------|
| **BeautifulSoup** | Python | Easy, forgiving parser |
| **lxml** | Python | Fast, XPath support |
| **Parsel** | Python | Scrapy's selector library |
| **Cheerio** | Node.js | jQuery-like syntax |
| **jsdom** | Node.js | Full DOM implementation |
| **selectolax** | Python | Very fast, limited features |

### Playwright Selectors

```python
# CSS Selectors
await page.click("button.submit")
await page.fill("input[name='email']", "test@example.com")

# Text selectors
await page.click("text=Sign In")
await page.click("button:has-text('Submit')")

# XPath
await page.click("//button[@class='submit']")

# Playwright-specific
await page.click("[data-testid='login-button']")

# Combining selectors
await page.click("article >> text=Read more")
```

### Data Extraction Example

```python
from bs4 import BeautifulSoup

async def extract_product_data(page):
    html = await page.content()
    soup = BeautifulSoup(html, 'lxml')
    
    return {
        'title': soup.select_one('h1.product-title').text.strip(),
        'price': soup.select_one('.price-current').text.strip(),
        'description': soup.select_one('.product-description').text.strip(),
        'images': [img['src'] for img in soup.select('.product-image img')],
        'reviews': int(soup.select_one('.review-count').text.split()[0])
    }
```

### Structured Data Extraction

| Tool | Description |
|------|-------------|
| **extruct** | Extract embedded metadata (JSON-LD, etc.) |
| **scrapy-splash** | JavaScript rendering for Scrapy |
| **newspaper3k** | Article extraction |
| **trafilatura** | Web text extraction |

---

## Monitoring & Debugging

### Debugging Tools

| Tool | Purpose |
|------|---------|
| **Playwright Inspector** | Visual debugging |
| **Puppeteer Recorder** | Record actions |
| **Chrome DevTools** | Network/console inspection |
| **mitmproxy** | HTTP traffic inspection |
| **Fiddler** | HTTP debugging proxy |

### Playwright Debug Mode

```bash
# Enable headed mode with slow-mo
PWDEBUG=1 python script.py

# Playwright Inspector
PWDEBUG=console python script.py
```

### Logging Setup

```python
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'logs/scraper_{datetime.now():%Y%m%d}.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('scraper')

# Usage
logger.info(f"Starting scrape for account {account_id}")
logger.error(f"Failed to load page: {url}", exc_info=True)
```

### Screenshot on Error

```python
async def safe_navigate(page, url, account_id):
    try:
        await page.goto(url, wait_until='networkidle')
    except Exception as e:
        # Capture screenshot for debugging
        await page.screenshot(
            path=f"errors/{account_id}_{datetime.now():%Y%m%d_%H%M%S}.png"
        )
        raise
```

### Monitoring Services

| Service | Features |
|---------|----------|
| **Sentry** | Error tracking, alerting |
| **Datadog** | Metrics, logs, APM |
| **Grafana + Prometheus** | Metrics visualization |
| **PagerDuty** | Incident management |
| **Uptime Robot** | Availability monitoring |

---

## Cloud Infrastructure

### Compute Options

| Service | Type | Best For |
|---------|------|----------|
| **AWS EC2** | VMs | Persistent instances |
| **AWS Lambda** | Serverless | Short tasks |
| **Google Cloud Run** | Containers | Scalable containers |
| **DigitalOcean Droplets** | VMs | Budget-friendly |
| **Vultr** | VMs | Global locations |
| **Hetzner** | VMs | EU, very affordable |
| **Railway** | PaaS | Easy deployment |
| **Render** | PaaS | Simple scaling |

### Browser-as-a-Service

| Service | Features | Pricing |
|---------|----------|---------|
| **Browserless** | Chrome API, stealth mode | $10+/mo |
| **Browserbase** | Managed browsers | Usage-based |
| **Apify** | Full scraping platform | $49+/mo |
| **ScrapingBee** | Renders JS, handles proxies | $49+/mo |
| **Zyte (Splash)** | Scriptable browser | Usage-based |

### Browserless Example

```python
# Using Browserless.io with Playwright
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(
            "wss://chrome.browserless.io?token=YOUR_TOKEN"
        )
        page = await browser.new_page()
        await page.goto("https://example.com")
```

### Docker Setup

```dockerfile
# Dockerfile for Playwright
FROM mcr.microsoft.com/playwright/python:v1.40.0-focal

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  scraper:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    deploy:
      replicas: 3

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

---

## All-in-One Platforms

### Scraping Platforms

| Platform | Features | Pricing |
|----------|----------|---------|
| **Apify** | Full platform, actors, storage | $49+/mo |
| **ScrapingBee** | API, JS rendering, proxies | $49+/mo |
| **Scrapy Cloud** | Hosted Scrapy | Free tier + paid |
| **ParseHub** | Visual scraper builder | Free tier + $189+/mo |
| **Octoparse** | No-code scraper | $75+/mo |
| **Diffbot** | AI-powered extraction | $299+/mo |

### When to Use Platforms

| Scenario | Recommendation |
|----------|----------------|
| Simple public scraping | All-in-one platform |
| Complex workflows | Custom build |
| Authenticated scraping | Custom build |
| Team collaboration | Platform + custom hybrid |
| Budget constraints | Open-source + cloud |

---

## Methods & Techniques

### Rate Limiting Strategies

```python
import asyncio
import random
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, requests_per_minute=30):
        self.requests_per_minute = requests_per_minute
        self.request_times = []
    
    async def wait(self):
        """Wait if rate limit would be exceeded"""
        now = datetime.now()
        
        # Clean old entries
        cutoff = now - timedelta(minutes=1)
        self.request_times = [t for t in self.request_times if t > cutoff]
        
        if len(self.request_times) >= self.requests_per_minute:
            # Need to wait
            oldest = min(self.request_times)
            wait_time = 60 - (now - oldest).total_seconds()
            wait_time += random.uniform(1, 5)  # Add jitter
            await asyncio.sleep(wait_time)
        
        self.request_times.append(now)
        
        # Add human-like delay
        await asyncio.sleep(random.uniform(0.5, 2.0))
```

### Human-Like Behavior

```python
import random
import asyncio
import math

class HumanBehavior:
    @staticmethod
    async def random_delay(min_s=0.5, max_s=2.0):
        """Random delay with normal distribution"""
        delay = random.gauss((min_s + max_s) / 2, (max_s - min_s) / 4)
        delay = max(min_s, min(max_s, delay))
        await asyncio.sleep(delay)
    
    @staticmethod
    async def bezier_mouse_move(page, start, end, steps=25):
        """Move mouse along Bezier curve"""
        # Generate control points
        ctrl1 = (
            start[0] + (end[0] - start[0]) * random.uniform(0.2, 0.4),
            start[1] + random.uniform(-100, 100)
        )
        ctrl2 = (
            start[0] + (end[0] - start[0]) * random.uniform(0.6, 0.8),
            end[1] + random.uniform(-100, 100)
        )
        
        for i in range(steps + 1):
            t = i / steps
            # Cubic Bezier
            x = (1-t)**3 * start[0] + 3*(1-t)**2*t * ctrl1[0] + \
                3*(1-t)*t**2 * ctrl2[0] + t**3 * end[0]
            y = (1-t)**3 * start[1] + 3*(1-t)**2*t * ctrl1[1] + \
                3*(1-t)*t**2 * ctrl2[1] + t**3 * end[1]
            
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.005, 0.025))
    
    @staticmethod
    async def human_type(page, selector, text):
        """Type with variable speed"""
        await page.click(selector)
        
        for char in text:
            await page.keyboard.type(char)
            
            # Variable delay
            if char in ' .,!?':
                await asyncio.sleep(random.uniform(0.15, 0.35))
            elif char.isupper():
                await asyncio.sleep(random.uniform(0.08, 0.2))
            else:
                await asyncio.sleep(random.uniform(0.03, 0.12))
    
    @staticmethod
    async def scroll_naturally(page):
        """Scroll like human reading"""
        for _ in range(random.randint(2, 5)):
            await page.mouse.wheel(0, random.randint(100, 400))
            await asyncio.sleep(random.uniform(0.5, 2.0))
```

### Error Handling & Retry

```python
import asyncio
from functools import wraps

def retry_on_failure(max_retries=3, delay=5, backoff=2):
    """Decorator for retry logic with exponential backoff"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
            
            raise last_exception
        return wrapper
    return decorator

# Usage
@retry_on_failure(max_retries=3, delay=5)
async def scrape_page(page, url):
    await page.goto(url)
    return await page.content()
```

### Parallel Execution Pattern

```python
import asyncio
from playwright.async_api import async_playwright

async def run_parallel_accounts(accounts, task_func):
    """Run tasks in parallel across accounts"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        async def process_account(account):
            context = await browser.new_context(
                storage_state=f"sessions/{account['id']}_state.json"
            )
            page = await context.new_page()
            
            try:
                return await task_func(page, account)
            finally:
                await context.close()
        
        # Run all accounts in parallel
        results = await asyncio.gather(
            *[process_account(acc) for acc in accounts],
            return_exceptions=True
        )
        
        await browser.close()
        return results

# Usage
accounts = [
    {'id': 'A1E', 'platform': 'ebay'},
    {'id': 'A1A1', 'platform': 'amazon'},
    {'id': 'A1A2', 'platform': 'amazon'},
]

async def scrape_metrics(page, account):
    # Scraping logic
    pass

results = await run_parallel_accounts(accounts, scrape_metrics)
```

---

## Quick Reference

### Tool Selection Cheatsheet

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TOOL SELECTION GUIDE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  QUESTION: What are you building?                                           │
│                                                                             │
│  Public data scraping (no login)                                            │
│  └─► Use third-party API (Rainforest, ScraperAPI)                          │
│                                                                             │
│  Authenticated scraping (need login)                                        │
│  └─► Playwright + stealth plugin + session management                      │
│                                                                             │
│  High-risk automation (Amazon purchases)                                    │
│  └─► Headful browser + extreme caution (or don't do it)                    │
│                                                                             │
│  Scaling to 100+ accounts                                                   │
│  └─► Playwright + Redis queue + multiple PCs                               │
│                                                                             │
│  Need lowest detection risk                                                 │
│  └─► Headful browser + residential IP + human-like behavior                │
│                                                                             │
│  Budget-conscious                                                           │
│  └─► Playwright (free) + PacketStream proxies + self-hosted               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Essential Stack

```
Recommended Default Stack:
─────────────────────────

Browser Automation:  Playwright (Python)
Stealth:             playwright-stealth
Proxies:             Bright Data or Smartproxy (residential)
CAPTCHA:             2Captcha or CapSolver
Queue:               Redis + custom account-based queue
Database:            PostgreSQL
Monitoring:          Sentry + custom logging
Deployment:          Docker + DigitalOcean/Hetzner
```

### Cost Estimates

| Component | Monthly Cost (Small Scale) | Monthly Cost (Large Scale) |
|-----------|---------------------------|---------------------------|
| Residential Proxies | $50-100 | $500-2000 |
| CAPTCHA Solving | $10-30 | $100-500 |
| Cloud Compute | $20-50 | $200-1000 |
| Browser Service | $0 (self-hosted) | $100-500 |
| **Total** | **$80-180** | **$900-4000** |
