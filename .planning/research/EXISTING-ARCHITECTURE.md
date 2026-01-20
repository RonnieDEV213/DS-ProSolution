# eBay & Amazon Scraping/Automation Architecture

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Public vs Private Data](#public-vs-private-data)
4. [Task Requirements](#task-requirements)
5. [Architecture Design](#architecture-design)
6. [Task Routing](#task-routing)
7. [Full System Architecture](#full-system-architecture)
8. [Tech Stack](#tech-stack)
9. [Implementation Examples](#implementation-examples)
10. [Key Constraints & Rules](#key-constraints--rules)

---

## Overview

This document outlines the architecture for a distributed eBay/Amazon scraping and automation system. The system handles both public data (via third-party APIs) and private/authenticated data (via headless browser automation).

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Public = Buy** | Use third-party APIs for public data |
| **Private = Build** | Build custom solutions for authenticated data |
| **1 Account = 1 PC** | No account can exist on multiple PCs |
| **Sequential per Account** | Tasks run sequentially per account |
| **Parallel across Accounts** | Multiple accounts can run simultaneously |

---

## Infrastructure Setup

### PC & Account Mapping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PC A1                      PC A2                      PC A3            │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────┐  │
│  │ A1E  (eBay)         │    │ A2E  (eBay)         │    │ A3E         │  │
│  │ A1A1 (Amazon)       │    │ A2A1 (Amazon)       │    │ A3A1        │  │
│  │ A1A2 (Amazon)       │    │ A2A2 (Amazon)       │    │ A3A2        │  │
│  │ A1A3 (Amazon)       │    │ A2A3 (Amazon)       │    │ ...         │  │
│  │ ...                 │    │ ...                 │    │             │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Constraints

| Constraint | Rule |
|------------|------|
| eBay per PC | 1 account maximum |
| Amazon per PC | 2-5 accounts (no hard limit) |
| Account mobility | Accounts NEVER cross PCs |
| PC limit | No limit on number of PCs |

### Naming Convention

```
PC ID:      A1, A2, A3, ...
eBay:       {PC_ID}E         → A1E, A2E, A3E
Amazon:     {PC_ID}A{N}      → A1A1, A1A2, A2A1, A2A2
```

---

## Public vs Private Data

### The Decision Matrix

|  | **Public Pages** | **Private/Auth Pages** |
|--|------------------|------------------------|
| **Scraping** | Third-party APIs | Build your own (Playwright) |
| **Automation** | Third-party APIs (limited) | Build your own (Playwright) |

### Definitions

| Type | Description | Examples |
|------|-------------|----------|
| **Public** | Anyone can view without logging in | Product pages, search results, reviews, seller profiles |
| **Private** | Requires login to access | Account dashboards, orders, messages, payouts, settings |

### Why Third-Party APIs Don't Cover Private Pages

1. **Security** – They'd need your login credentials
2. **Terms of Service** – Accessing others' accounts is illegal
3. **No universal structure** – Account pages vary by user/seller level
4. **Session management** – Cookies expire, 2FA, CAPTCHA challenges

---

## Task Requirements

### eBay Scraping

| Data | Public/Auth | Solution |
|------|-------------|----------|
| Seller name | Public | Third-party API (ScraperAPI, etc.) |
| PDP | Public | Third-party API |
| Product sold history | Public | Third-party API |
| Feedback | Public | Third-party API |
| **Account Metrics** | Auth | Build your own (Playwright) |
| ↳ Sales | Auth | Playwright |
| ↳ Listing count | Auth | Playwright |
| ↳ Returns | Auth | Playwright |
| ↳ Cases | Auth | Playwright |
| ↳ Orders | Auth | Playwright |
| ↳ Payouts | Auth | Playwright |
| ↳ Views | Auth | Playwright |
| ↳ Traffic | Auth | Playwright |
| ↳ Offers | Auth | Playwright |
| **Listing Metrics** | Auth | Build your own |
| ↳ Views | Auth | Playwright |
| ↳ Sold history | Auth | Playwright |
| ↳ Title | Auth | Playwright |
| ↳ Price | Auth | Playwright |
| ↳ Quantity | Auth | Playwright |
| **Messages** | Auth | Build your own |

### Amazon Scraping

| Data | Public/Auth | Solution |
|------|-------------|----------|
| PDP, title, price, images | Public | Rainforest API, ScraperAPI |
| Reviews/review count | Public | Rainforest API |
| Best sellers | Public | Third-party API |
| Result pages | Public | Third-party API |
| Discounts/coupons | Public | Third-party API |
| Shipping date | Public | Third-party API |
| **Order history** | Auth | Build your own |
| **Ongoing returns** | Auth | Build your own |
| **Tracking** | Auth | Build your own |
| **Save & Subscribe** | Auth | Build your own |
| **Address book** | Auth | Build your own |

### eBay Automation (Seller)

| Action | Solution |
|--------|----------|
| Listing | Seller tools (Linnworks, ChannelAdvisor) or eBay Trading API |
| Fulfilling orders | Seller tools or eBay Fulfillment API |
| Sale events/Coupons | eBay Marketing API or build your own |
| Config listing settings | Build your own |
| Messaging buyers | Build your own (eBay's API is limited) |
| Returns/INR/Disputes | Build your own (Playwright) |
| Sending offers | Build your own |
| Accept/reject offers | Build your own |
| Export CSV | Build your own |
| Searching | Build your own |
| Edit handling time | eBay Inventory API or build your own |
| Deleting listings | eBay Inventory API |
| Blocking buyers | Build your own (no official API) |

### Amazon Automation (Buyer)

| Action | Solution | Risk Level |
|--------|----------|------------|
| Placing orders | Build your own (Playwright) | ⚠️ HIGH |
| Starting returns | Build your own | ⚠️ HIGH |
| Talking to support | Build your own (very difficult) | ⚠️ HIGH |
| Searching | Build your own | Medium |
| Editing addresses | Build your own | Medium |
| Selecting coupons | Build your own | Medium |
| Canceling Save & Subscribe | Build your own | Medium |

> ⚠️ **Warning:** Amazon buyer automation is high-risk for account suspension. They actively detect bot behavior.

### Summary Table

| Category | Buy vs Build |
|----------|--------------|
| Public scraping (PDP, reviews, search) | **Buy** – Rainforest, ScraperAPI |
| Authenticated scraping (account pages) | **Build** – Playwright + session management |
| eBay seller automation | **Hybrid** – Use seller tools where possible, build for gaps |
| Amazon buyer automation | **Build** – No third-party solutions exist (high risk) |

---

## Architecture Design

### Per-PC Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SINGLE PC (e.g., A1)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         LOCAL SERVICES                                │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │  │
│  │  │ Session Manager │     │ Task Queue      │     │ HTTP Client     │  │  │
│  │  │ (Playwright)    │     │ (Redis/SQLite)  │     │ (Public Data)   │  │  │
│  │  │                 │     │                 │     │                 │  │  │
│  │  │ • Login/Auth    │     │ • Per-account   │     │ • Rainforest    │  │  │
│  │  │ • CAPTCHA       │     │   queues        │     │ • ScraperAPI    │  │  │
│  │  │ • Session store │     │ • Priority      │     │ • Direct + Proxy│  │  │
│  │  └────────┬────────┘     └────────┬────────┘     └─────────────────┘  │  │
│  │           │                       │                                   │  │
│  │           ▼                       ▼                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │              BROWSER CONTEXTS (Headless Playwright)            │   │  │
│  │  │                                                                │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │  │
│  │  │  │ A1E      │ │ A1A1     │ │ A1A2     │ │ A1A3     │  ...     │   │  │
│  │  │  │ (eBay)   │ │ (Amazon) │ │ (Amazon) │ │ (Amazon) │          │   │  │
│  │  │  │          │ │          │ │          │ │          │          │   │  │
│  │  │  │ Scrape   │ │ Scrape   │ │ Scrape   │ │ Scrape   │          │   │  │
│  │  │  │ Automate │ │ Automate │ │ Automate │ │ Automate │          │   │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │  │
│  │  │                                                                │   │  │
│  │  │  All running in parallel on LOCAL IP ✓                         │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Session Object Structure

```json
{
  "account_id": "A1E",
  "platform": "ebay",
  "cookies": {
    "session-id": "xxx",
    "ds2": "yyy"
  },
  "user_agent": "Mozilla/5.0 ...",
  "viewport": {
    "width": 1920,
    "height": 1080
  },
  "timezone": "America/New_York",
  "language": "en-US",
  "expires_at": "2025-01-20T12:00:00Z",
  "pc_id": "A1"
}
```

---

## Task Routing

### Routing Rules

| Task Type | Platform | Auth | Solution | Runs On |
|-----------|----------|------|----------|---------|
| **Public Scraping** | eBay | No | Third-party API | Anywhere (centralized) |
| **Public Scraping** | Amazon | No | Rainforest/ScraperAPI | Anywhere (centralized) |
| **Private Scraping** | eBay | Yes | Playwright context | Same PC as account |
| **Private Scraping** | Amazon | Yes | Playwright context | Same PC as account |
| **Automation** | eBay | Yes | Playwright context | Same PC as account |
| **Automation** | Amazon | Yes | Playwright context | Same PC as account |

### Centralized vs Distributed

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   CENTRALIZED (can run anywhere)       DISTRIBUTED (must run on PC)         │
│   ──────────────────────────────       ────────────────────────────         │
│                                                                             │
│   ┌─────────────────────────┐          ┌─────────────────────────┐          │
│   │ Public Data APIs        │          │ PC A1                   │          │
│   │                         │          │ • A1E auth tasks        │          │
│   │ • eBay PDP              │          │ • A1A1-A1A5 auth tasks  │          │
│   │ • eBay seller info      │          └─────────────────────────┘          │
│   │ • eBay sold history     │                                               │
│   │ • Amazon PDP            │          ┌─────────────────────────┐          │
│   │ • Amazon reviews        │          │ PC A2                   │          │
│   │ • Amazon best sellers   │          │ • A2E auth tasks        │          │
│   │ • etc.                  │          │ • A2A1-A2A5 auth tasks  │          │
│   │                         │          └─────────────────────────┘          │
│   │ No account needed       │                                               │
│   │ Can batch/parallelize   │          ┌─────────────────────────┐          │
│   └─────────────────────────┘          │ PC A3                   │          │
│                                        │ • A3E auth tasks        │          │
│                                        │ • A3A1-A3A5 auth tasks  │          │
│                                        └─────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Full System Architecture

### Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CENTRAL SERVER (Optional)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Task Dispatcher │  │ Data Storage    │  │ Public Scraping Service     │  │
│  │                 │  │                 │  │                             │  │
│  │ • Receives jobs │  │ • Results DB    │  │ • Rainforest API            │  │
│  │ • Routes to PC  │  │ • PostgreSQL    │  │ • ScraperAPI                │  │
│  │ • Tracks status │  │ • MongoDB       │  │ • No auth needed            │  │
│  └────────┬────────┘  └─────────────────┘  └─────────────────────────────┘  │
│           │                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │  Routes auth tasks to correct PC
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DISTRIBUTED PCs                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ PC A1               │  │ PC A2               │  │ PC A3               │  │
│  │                     │  │                     │  │                     │  │
│  │ Agent Service       │  │ Agent Service       │  │ Agent Service       │  │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │
│  │ │ • Polls central │ │  │ │ • Polls central │ │  │ │ • Polls central │ │  │
│  │ │ • Runs tasks    │ │  │ │ • Runs tasks    │ │  │ │ • Runs tasks    │ │  │
│  │ │ • Reports back  │ │  │ │ • Reports back  │ │  │ │ • Reports back  │ │  │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │  │
│  │                     │  │                     │  │                     │  │
│  │ Accounts:           │  │ Accounts:           │  │ Accounts:           │  │
│  │ A1E, A1A1-A1A5      │  │ A2E, A2A1-A2A5      │  │ A3E, A3A1-A3A5      │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Task Flow Example

```
User Request: "Get A1E sales metrics and A2E messages"
                    │
                    ▼
            ┌───────────────┐
            │ Central Server│
            │               │
            │ 1. Parse task │
            │ 2. Route:     │
            │    A1E → PC A1│
            │    A2E → PC A2│
            └───────┬───────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   ┌─────────┐             ┌─────────┐
   │ PC A1   │             │ PC A2   │
   │         │             │         │
   │ Run A1E │             │ Run A2E │
   │ metrics │             │ messages│
   │ task    │             │ task    │
   └────┬────┘             └────┬────┘
        │                       │
        └───────────┬───────────┘
                    ▼
            ┌───────────────┐
            │ Central Server│
            │               │
            │ Aggregate     │
            │ results       │
            └───────────────┘
```

---

## Tech Stack

### Recommended Technologies

| Component | Technology | Why |
|-----------|------------|-----|
| **Central Server** | Node.js / Python FastAPI | API + task routing |
| **Task Queue** | Redis / RabbitMQ | Distributed job queue |
| **Database** | PostgreSQL | Structured data storage |
| **PC Agent** | Python + Playwright | Browser automation |
| **Communication** | WebSocket / Polling | PC ↔ Server sync |
| **Public Scraping** | Rainforest + ScraperAPI | Buy, don't build |

### Third-Party Scraping Services

| Service | Amazon | eBay | Best For |
|---------|--------|------|----------|
| **Rainforest API** | ✓ | ✗ | Amazon-specific, structured data |
| **ScraperAPI** | ✓ | ✓ | General purpose, both platforms |
| **Oxylabs** | ✓ | ✓ | Enterprise, high volume |
| **Bright Data** | ✓ | ✓ | Enterprise, datasets |
| **ScrapingBee** | ✓ | ✓ | Good balance of features |

---

## Implementation Examples

### PC Agent Service

```python
# agent.py - runs on each PC

import asyncio
from playwright.async_api import async_playwright

class PCAgent:
    def __init__(self, pc_id: str):
        self.pc_id = pc_id  # e.g., "A1"
        self.accounts = self.load_accounts()  # A1E, A1A1, A1A2...
        self.contexts = {}  # browser contexts per account
        self.browser = None
    
    def load_accounts(self) -> list:
        """Load accounts assigned to this PC from config"""
        # Load from config file or database
        pass
    
    async def initialize(self):
        """Initialize browser and contexts for all accounts"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        
        for account in self.accounts:
            self.contexts[account.id] = await self.create_context(account)
    
    async def create_context(self, account):
        """Create browser context with saved session"""
        context = await self.browser.new_context(
            storage_state=f"sessions/{account.id}_session.json",
            viewport={"width": 1920, "height": 1080},
            user_agent=account.user_agent
        )
        return context
    
    async def start(self):
        """Main loop - poll for tasks and execute"""
        await self.initialize()
        
        while True:
            tasks = await self.fetch_tasks()  # from central server
            
            # Group tasks by account
            tasks_by_account = self.group_by_account(tasks)
            
            # Run accounts in parallel, tasks per account sequential
            await asyncio.gather(*[
                self.run_account_tasks(account_id, account_tasks)
                for account_id, account_tasks in tasks_by_account.items()
            ])
            
            await asyncio.sleep(1)  # Poll interval
    
    async def fetch_tasks(self) -> list:
        """Fetch pending tasks from central server"""
        # HTTP request to central server
        pass
    
    def group_by_account(self, tasks) -> dict:
        """Group tasks by account ID"""
        grouped = {}
        for task in tasks:
            if task.account_id not in grouped:
                grouped[task.account_id] = []
            grouped[task.account_id].append(task)
        return grouped
    
    async def run_account_tasks(self, account_id: str, tasks: list):
        """Run tasks sequentially for a single account"""
        context = self.contexts[account_id]
        
        for task in tasks:
            try:
                result = await self.execute_task(context, task)
                await self.report_result(task.id, result)
            except Exception as e:
                await self.report_error(task.id, str(e))
    
    async def execute_task(self, context, task):
        """Execute a single task"""
        page = await context.new_page()
        
        try:
            if task.type == "scrape_metrics":
                return await self.scrape_metrics(page, task)
            elif task.type == "send_offer":
                return await self.send_offer(page, task)
            elif task.type == "get_messages":
                return await self.get_messages(page, task)
            # ... more task types
        finally:
            await page.close()
    
    async def scrape_metrics(self, page, task):
        """Scrape eBay seller metrics"""
        await page.goto("https://www.ebay.com/sh/ovw")
        # Extract metrics...
        pass
    
    async def send_offer(self, page, task):
        """Send offer to buyer"""
        # Navigate and send offer...
        pass
    
    async def get_messages(self, page, task):
        """Get eBay messages"""
        await page.goto("https://www.ebay.com/mye/myebay/message")
        # Extract messages...
        pass
    
    async def report_result(self, task_id: str, result: dict):
        """Report task result to central server"""
        # HTTP request to central server
        pass
    
    async def report_error(self, task_id: str, error: str):
        """Report task error to central server"""
        # HTTP request to central server
        pass


# Entry point
if __name__ == "__main__":
    import sys
    pc_id = sys.argv[1]  # e.g., "A1"
    
    agent = PCAgent(pc_id)
    asyncio.run(agent.start())
```

### Session Manager

```python
# session_manager.py

import asyncio
from playwright.async_api import async_playwright
from datetime import datetime, timedelta

class SessionManager:
    def __init__(self):
        self.sessions = {}
    
    async def login(self, account) -> dict:
        """Perform login and capture session"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
            
            if account.platform == "ebay":
                await self.login_ebay(page, account)
            elif account.platform == "amazon":
                await self.login_amazon(page, account)
            
            # Save session state
            storage = await context.storage_state()
            await context.storage_state(path=f"sessions/{account.id}_session.json")
            
            await browser.close()
            
            return {
                "account_id": account.id,
                "cookies": storage["cookies"],
                "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
            }
    
    async def login_ebay(self, page, account):
        """eBay login flow"""
        await page.goto("https://signin.ebay.com/signin/")
        await page.fill("#userid", account.username)
        await page.click("#signin-continue-btn")
        await page.fill("#pass", account.password)
        await page.click("#sgnBt")
        
        # Handle 2FA if needed
        # Handle CAPTCHA if needed
        
        await page.wait_for_url("**/ebay.com/**")
    
    async def login_amazon(self, page, account):
        """Amazon login flow"""
        await page.goto("https://www.amazon.com/ap/signin")
        await page.fill("#ap_email", account.email)
        await page.click("#continue")
        await page.fill("#ap_password", account.password)
        await page.click("#signInSubmit")
        
        # Handle 2FA if needed
        # Handle CAPTCHA if needed
        
        await page.wait_for_url("**/amazon.com/**")
    
    async def refresh_session(self, account):
        """Refresh expired session"""
        return await self.login(account)
    
    def is_session_valid(self, account_id: str) -> bool:
        """Check if session is still valid"""
        session = self.sessions.get(account_id)
        if not session:
            return False
        
        expires_at = datetime.fromisoformat(session["expires_at"])
        return datetime.now() < expires_at
```

### Central Server API

```python
# server.py - Central server

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import redis

app = FastAPI()
redis_client = redis.Redis()

class Task(BaseModel):
    id: str
    account_id: str
    pc_id: str
    type: str
    data: Optional[dict] = None
    priority: int = 0

class TaskResult(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None

# Account to PC mapping
ACCOUNT_PC_MAP = {
    "A1E": "A1", "A1A1": "A1", "A1A2": "A1",
    "A2E": "A2", "A2A1": "A2", "A2A2": "A2",
    # ...
}

@app.post("/tasks")
async def create_task(task: Task):
    """Create a new task"""
    # Determine which PC should handle this task
    pc_id = ACCOUNT_PC_MAP.get(task.account_id)
    if not pc_id:
        raise HTTPException(status_code=400, detail="Unknown account")
    
    task.pc_id = pc_id
    
    # Add to queue
    queue_key = f"tasks:{pc_id}:{task.account_id}"
    redis_client.rpush(queue_key, task.json())
    
    return {"status": "queued", "task_id": task.id, "pc_id": pc_id}

@app.get("/tasks/{pc_id}")
async def get_tasks(pc_id: str, limit: int = 10):
    """Get pending tasks for a PC"""
    tasks = []
    
    # Get all account queues for this PC
    pattern = f"tasks:{pc_id}:*"
    for key in redis_client.scan_iter(pattern):
        # Get one task per account (round robin)
        task_json = redis_client.lpop(key)
        if task_json:
            tasks.append(Task.parse_raw(task_json))
        
        if len(tasks) >= limit:
            break
    
    return {"tasks": tasks}

@app.post("/results")
async def submit_result(result: TaskResult):
    """Submit task result"""
    # Store result
    redis_client.hset(f"results:{result.task_id}", mapping={
        "status": result.status,
        "result": str(result.result),
        "error": result.error or ""
    })
    
    return {"status": "received"}

@app.get("/results/{task_id}")
async def get_result(task_id: str):
    """Get task result"""
    result = redis_client.hgetall(f"results:{task_id}")
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    return result
```

---

## Key Constraints & Rules

### Concurrency Rules

| Rule | Description |
|------|-------------|
| **1 session per account** | Never run multiple simultaneous sessions |
| **Sequential per account** | Tasks for same account run one at a time |
| **Parallel across accounts** | Different accounts can run simultaneously |
| **Account-PC binding** | Account never moves between PCs |

### What You CAN'T Do

```
❌ Account A ──► Task 1 (scrape orders)
   Account A ──► Task 2 (send message)    ← Same session, parallel = suspicious
   Account A ──► Task 3 (edit listing)
```

### What You CAN Do

```
✓ Account A ──► Task 1 → Task 2 → Task 3 (sequential)
  Account B ──► Task 4 → Task 5 → Task 6 (sequential)
  Account C ──► Task 7 → Task 8 → Task 9 (sequential)
  
  ▲ All three accounts working simultaneously
```

### Session Management

| Component | Expires? | Action Needed |
|-----------|----------|---------------|
| Cookies | Yes (hours/days) | Re-login, get fresh cookies |
| User agent | No | Keep same |
| Viewport | No | Keep same |
| Timezone | No | Keep same |

### Security Considerations

| Concern | Mitigation |
|---------|------------|
| Session expiry | Auto-refresh before expiry |
| CAPTCHA | Queue for manual solve or use service |
| 2FA | Handle in session manager |
| Rate limiting | Enforce delays between requests |
| Detection | Use real browser, human-like timing |

---

## Appendix

### Useful Resources

- [Playwright Documentation](https://playwright.dev/python/docs/intro)
- [Rainforest API](https://www.rainforestapi.com/)
- [ScraperAPI](https://www.scraperapi.com/)
- [Redis Documentation](https://redis.io/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

### File Structure

```
project/
├── central-server/
│   ├── server.py
│   ├── models.py
│   └── requirements.txt
├── pc-agent/
│   ├── agent.py
│   ├── session_manager.py
│   ├── tasks/
│   │   ├── ebay_scraping.py
│   │   ├── ebay_automation.py
│   │   ├── amazon_scraping.py
│   │   └── amazon_automation.py
│   ├── sessions/
│   │   └── (session files)
│   └── requirements.txt
└── README.md
```
