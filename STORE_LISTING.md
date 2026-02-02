# Chrome Web Store Listing Draft — Wing

## Basic Info
- **Name:** Wing — AI Bookmarking & Highlights
- **Category:** Productivity
- **Pricing:** Free
- **Language:** English

## Short Description (<= 132 chars)
Option A: Save pages, highlight text, and ask AI about your saved research — all stored locally in your browser.  
Option B: AI‑powered bookmarking with highlights, smart connections, and natural‑language search — local‑first.  
Option C: Bookmark smarter: summaries, highlights, and AI search across your saved pages, all on‑device.

## Detailed Description
Wing is an AI‑powered Chrome extension for intelligent bookmarking. Save any page in one click, organize it into collections and nests, highlight key passages, and ask natural‑language questions across your saved research.

**Key features**
- **Wing It:** Save pages instantly with title, URL, and favicon
- **AI Summaries:** Automatically generate concise summaries
- **Highlights & Notes:** Highlight text and attach annotations
- **Smart Connections:** Discover related pages based on content and context
- **Ask AI:** Query your saved pages with natural‑language questions
- **Local‑First:** All data stored locally using IndexedDB
- **Export/Import:** Full data portability

**Privacy**
Wing stores your data locally on your device. The only external requests are to your chosen AI provider (Anthropic or OpenAI) using your own API key. Wing does not run a backend service and does not collect user data.

## Permission Justifications
- **storage:** Save wings, collections, highlights, and settings locally.
- **activeTab:** Capture metadata and content from the current page when winging.
- **scripting:** Inject highlight functionality into winged pages.
- **tabs:** Open and detect pages for summaries and navigation.
- **Host permissions:** `https://api.anthropic.com/*`, `https://api.openai.com/*` for AI summaries and queries.

## Assets Needed (Chrome Web Store)
- **Icon:** 128x128 (already in `icons/`)
- **Screenshots:** 1–5 images (1280x800 or 640x400)
  - Suggested shots:
    1. Wings list + collections
    2. Wing details modal (summary + related wings)
    3. Highlight + annotation UI on a page
    4. Ask AI chat interface with citations
    5. Options/settings page (provider selection)
- **Promotional tile (optional):** 440x280
- **Marquee promo (optional):** 1400x560

## Links
- **Website:** https://abhi-raheja.github.io/wing-app/
- **Privacy policy:** https://abhi-raheja.github.io/wing-app/privacy.html

## Release Notes (v1.0.0)
- Initial public release
- AI summaries, highlights, and smart connections
- Natural‑language search across saved pages
- Local‑first storage and export/import
