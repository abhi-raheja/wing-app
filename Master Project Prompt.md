# Chrome Bookmark Extension - Claude Code Development Prompt

## Role & Context

You are an expert Chrome extension developer tasked with building a comprehensive bookmarking application called **"Wing"**. You will build this extension from scratch, test it thoroughly, and debug until it is fully functional and ready for use.

## Project Overview

Build a Chrome-based browser extension that serves as an intelligent bookmarking system with hierarchical organization, text highlighting, annotations, and AI-powered features using the Anthropic API.

**Terminology:** In Wing, the act of bookmarking a page is called **"wing it"** — users "wing" pages to save them.

## Core Requirements

### 1. Wing It (Bookmark Capture)
- Add a browser action (toolbar icon) to "wing" the current page
- Capture: URL, page title, favicon, timestamp, and full page content (for AI processing)
- Automatically generate a 2-3 line summary of the page content using the Anthropic API (Claude) when winging a page
- Display a confirmation popup showing the summary and allowing the user to select which collection/nest to save to

### 2. Hierarchical Organization System

**Collections (Top-level buckets):**
- Allow users to create, rename, and delete collections
- Each collection has a name, optional description, and color label
- Collections appear in the main extension popup as a navigable list

**Nests (Sub-buckets within collections):**
- Allow unlimited nesting depth within collections
- Nests can contain winged pages and/or other nests
- Support drag-and-drop reorganization of winged pages between nests/collections
- Visual tree structure for navigation

### 3. Text Highlighting & Annotations
- When on a winged page, allow users to highlight text passages
- Highlighted text is saved and associated with that specific winged page
- Each highlight can have an optional user comment/annotation attached
- Highlights should be visually restored when revisiting the bookmarked page
- Support multiple highlights per winged page
- Allow editing and deleting highlights and annotations

### 4. Smart Connections
- Automatically detect and surface related winged pages using the Anthropic API
- Connections are based on:
  - Semantic similarity of page content/summaries
  - Shared collections or nests
  - Overlapping highlighted content themes
- Display connections as a "Related Wings" section when viewing any winged page
- Allow manual linking/unlinking of winged pages as connected

### 5. Local Data Storage
- Store ALL data locally on the user's device using IndexedDB (primary) with Chrome Storage API as fallback for settings
- Data schema should include:
  - Wings (id, url, title, favicon, summary, fullContent, timestamp, collectionId, nestId, highlights[], connections[])
  - Collections (id, name, description, color, createdAt)
  - Nests (id, name, parentId, collectionId, createdAt)
  - Highlights (id, wingId, selectedText, annotation, startOffset, endOffset, timestamp)
- Implement data export/import functionality (JSON format)

### 6. LLM Query Interface
- Provide a search/query interface in the extension popup
- User enters natural language questions about their winged pages
- Send the query + relevant wing context to Anthropic API
- Display AI-generated answers with citations to specific winged pages
- Example queries: "What have I winged about machine learning?", "Summarize my research on climate change", "Find connections between my tech and business wings"

### 7. API Key Management
- On first use, prompt user to enter their Anthropic API key
- Store API key securely in Chrome's encrypted storage
- Allow updating/removing the API key in settings
- Validate API key on entry
- Handle API errors gracefully with user-friendly messages

## Technical Specifications

### Extension Architecture
```
wing/
├── manifest.json (Manifest V3)
├── background.js (Service worker)
├── content.js (Content script for highlighting)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── lib/
│   ├── db.js (IndexedDB operations)
│   ├── api.js (Anthropic API calls)
│   ├── connections.js (Connection detection logic)
│   └── utils.js (Helper functions)
├── styles/
│   └── highlights.css (Injected styles for highlights)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Manifest V3 Requirements
- Use service workers (not background pages)
- Declare appropriate permissions: `storage`, `activeTab`, `scripting`, `tabs`
- Host permissions for Anthropic API: `https://api.anthropic.com/*`
- Content scripts for highlight functionality

### Anthropic API Integration
- Use Claude claude-sonnet-4-20250514 model for all AI features
- Implement proper rate limiting and error handling
- API calls needed:
  1. **Summarization**: When winging a page, send page content → receive 2-3 line summary
  2. **Connection Detection**: Periodically analyze winged pages for semantic relationships
  3. **Query Answering**: Process user questions against winged pages corpus

**Example API call structure:**
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  })
});
```

### UI/UX Requirements
- Clean, modern interface using vanilla CSS (no frameworks required)
- Responsive popup that works at standard Chrome extension dimensions (400px width recommended)
- Visual hierarchy: Collections → Nests → Winged Pages
- Search/filter functionality for winged pages
- Loading states for all async operations
- Toast notifications for success/error states
- Use "Wing it" as the primary action button text for saving pages

## Development & Debugging Instructions

### Phase 1: Foundation
1. Create the manifest.json and basic extension structure
2. Implement IndexedDB schema and CRUD operations
3. Build the basic popup UI with collection/nest management
4. Test that the extension loads without errors

### Phase 2: Core "Wing It" Functionality
1. Implement the "wing it" page capture functionality
2. Add collection/nest selection when winging a page
3. Build the winged pages viewing and management interface
4. Test winging across various websites

### Phase 3: AI Integration
1. Implement API key management and storage
2. Add summarization on "wing it" action
3. Test API calls and error handling
4. Implement the query interface

### Phase 4: Highlighting & Annotations
1. Build the content script for text selection
2. Implement highlight persistence and restoration
3. Add annotation functionality
4. Test across different website structures

### Phase 5: Connections
1. Implement connection detection algorithm
2. Build the connections UI
3. Add manual connection management
4. Test connection accuracy and performance

### Phase 6: Polish & Debug
1. Comprehensive testing across edge cases
2. Performance optimization
3. Error handling improvements
4. UI/UX refinements

## Debugging Protocol

After each phase, perform the following checks:

1. **Load the extension** in Chrome (`chrome://extensions/` → Developer mode → Load unpacked)
2. **Check the console** for errors in:
   - Service worker (click "Inspect views: service worker")
   - Popup (right-click popup → Inspect)
   - Content scripts (page console)
3. **Test core functionality** systematically
4. **Fix any errors** before proceeding to the next phase

If you encounter errors:
1. Read the full error message and stack trace
2. Identify the root cause
3. Implement the fix
4. Re-test to confirm resolution
5. Document what was fixed

## Success Criteria

The extension is complete when:
- [ ] Extension loads without errors in Chrome
- [ ] User can save their Anthropic API key
- [ ] "Wing it" captures URL, title, and generates AI summary
- [ ] Collections and nests can be created, edited, and deleted
- [ ] Winged pages can be organized into collections and nests
- [ ] Text can be highlighted on winged pages
- [ ] Annotations can be added to highlights
- [ ] Highlights persist and restore when revisiting winged pages
- [ ] Related winged pages are automatically detected and displayed
- [ ] Natural language queries return relevant answers from winged pages data
- [ ] All data persists locally across browser sessions
- [ ] Data can be exported and imported as JSON
- [ ] No console errors during normal operation

## Additional Notes

- Prioritize functionality over aesthetics initially; polish UI after core features work
- Use descriptive variable names and add comments for complex logic
- Handle edge cases: empty states, long titles, special characters in URLs, pages that block content scripts
- Implement graceful degradation if AI features fail (extension should still work for basic "wing it" functionality)
- Consider performance with large collections of winged pages (lazy loading, pagination)
- Throughout the UI, use "Wing" branding and "wing it" terminology consistently

Begin by creating the project structure and manifest.json, then proceed through each phase systematically. Test thoroughly at each step and debug until the extension is fully functional.
