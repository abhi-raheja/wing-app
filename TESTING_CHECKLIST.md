# Wing Extension - Comprehensive Testing Checklist

## How to Use This Document
1. Go through each section systematically
2. Mark items as PASS, FAIL, or PARTIAL
3. For any issues, use the Feedback Framework at the bottom
4. Test on multiple websites (simple blogs, complex SPAs, news sites, etc.)

---

## 1. Extension Setup & Loading

### 1.1 Installation
- [PASS] Extension loads in chrome://extensions without errors
- [PASS] Extension icon appears in toolbar
- [PASS] Clicking icon opens popup
- [PASS] Service worker shows "Active" status (no errors in console)

### 1.2 Options Page
- [PASS] Right-click extension icon → "Options" opens settings page
- [PASS] Page loads without console errors

---

## 2. API Key Management

### 2.1 Initial Setup
- [PASS] First-time user sees empty API key field
- [PASS] Status message guides user to get API key
- [PASS] Link to console.anthropic.com works

### 2.2 API Key Validation
- [PASS] Invalid key format rejected (doesn't start with "sk-ant-")
- [PASS] Invalid key shows error message after validation attempt
- [PASS] Valid key validates successfully
- [PASS] "Validating..." status shows during check
- [PASS] Success message displays after validation

### 2.3 API Key Operations
- [PASS] Toggle visibility (eye icon) shows/hides key
- [PASS] Save button stores key
- [PASS] Remove button clears key (with confirmation)
- [PASS] Key persists after closing/reopening browser

---

## 3. Core "Wing It" Functionality

### 3.1 Wing It Modal
- [PASS] "Wing It" button opens modal
- [PASS] Current page title displays correctly
- [PASS] Current page URL displays correctly
- [PASS] Favicon loads (or fallback shows)
- [PASS] Collections list shows (if any exist)
- [PASS] "No collections yet" message shows (if none exist)

### 3.2 Saving a Wing
- [PASS] Can save without selecting collection
- [PASS] Can save with one collection selected
- [PASS] Can save with multiple collections selected
- [PASS] Loading spinner shows while saving
- [PASS] Success toast appears
- [PASS] Modal closes after save
- [PASS] Wing appears in wings list
- [PASS] "Summarizing..." badge shows (if API key configured)

### 3.3 Summary Generation
- [PASS] Summary generates in background (watch console)
- [PASS] "Summarizing..." badge disappears after completion
- [PASS] Summary visible in wing details
- [PASS] Graceful handling when no API key (no summary, no error)
- [PASS] Error handling for API failures

### 3.4 Duplicate Handling
- [ ] Can wing the same page again (creates new wing)
- [PASS] Or: Shows "already winged" indicator (design decision)

---

## 4. Wings List & Navigation

### 4.1 Wings Display
- [PASS] Wings show in list view
- [PASS] Favicon displays for each wing
- [PASS] Title displays (truncated if long)
- [PASS] URL displays (truncated)
- [PASS] Date shows correctly
- [PASS] Collection badge shows (if assigned)
- [PASS] Multiple collections show as "+N" badge

### 4.2 Sorting
- [PASS] Sort dropdown opens on click
- [PASS] "Newest first" works correctly
- [PASS] "Oldest first" works correctly
- [PASS] "Title A-Z" works correctly
- [PASS] "Title Z-A" works correctly
- [PASS] Selected sort option highlighted
- [FAIL] Sort persists during session

### 4.3 Search
- [PASS] Search input visible
- [PASS] Typing filters wings in real-time
- [PASS] Matches on title
- [PASS] Matches on URL
- [PASS] Matches on summary
- [PASS] "Match in summary" indicator shows
- [PASS] Search highlights matched text
- [PASS] "No matching wings" empty state shows
- [PASS] Clearing search shows all wings

### 4.4 Pagination
- [PASS] Only 20 wings show initially (if >20 exist)
- [PASS] "Showing X of Y wings" count displays
- [PASS] "Load More" button appears when more exist
- [PASS] Clicking "Load More" loads additional wings
- [PASS] Pagination works with search filter
- [PASS] Pagination works with collection filter

### 4.5 Collection Filter
- [ ] Filter chips show when collections exist
- [ ] Clicking chip filters to that collection
- [ ] Active chip highlighted
- [ ] "Clear" chip removes filter
- [ ] Filter works with search simultaneously

---

## 5. Wing Details Modal

### 5.1 Opening Details
- [PASS] Clicking wing card opens details modal
- [PASS] Title displays correctly
- [PASS] URL displays correctly
- [PASS] Full summary displays (if exists)
- [PASS] Date displays correctly

### 5.2 Collection Assignment
- [PASS] Current collections pre-selected
- [PASS] Can check/uncheck collections
- [PASS] Nests appear when collection selected
- [PASS] Can assign to nests
- [PASS] "Save Changes" button works
- [PASS] Loading spinner during save
- [PASS] Changes persist after save

### 5.3 Highlights Section
- [PASS] Section shows when highlights exist
- [PASS] Highlight count displays
- [PASS] Highlighted text shows
- [[ASS] Annotation shows (if exists)
- [PASS] Date shows for each highlight
- [PASS] "Go to highlight" button works
- [PASS] "Delete" button removes highlight (with confirmation)

### 5.4 Related Wings (Connections)
- [PASS] Section displays in modal
- [PASS] "Find Connections" button works (if no connections)
- [ ] Loading state shows during analysis
- [ ] Related wings display with:
  - [ ] Favicon
  - [ ] Title
  - [ ] Connection score bar
  - [ ] Connection type label
- [ ] Click opens related wing in new tab
- [ ] "Remove" button disconnects wings
- [ ] Refresh button re-analyzes connections

### 5.5 Actions
- [ ] "Open Page" button opens URL in new tab
- [ ] "Delete Wing" button works (with confirmation)
- [ ] Wing removed from list after delete
- [ ] Close button (X) closes modal
- [ ] Clicking backdrop closes modal
- [ ] Escape key closes modal

---

## 6. Collections Management

### 6.1 Collections View
- [ ] Tab navigation to Collections view works
- [ ] Collections list displays
- [ ] Empty state shows when no collections
- [ ] "New Collection" button visible

### 6.2 Creating Collection
- [ ] Modal opens on "New Collection" click
- [ ] Name field accepts input
- [ ] Description field accepts input (optional)
- [ ] Color picker displays colors
- [ ] Can select color
- [ ] Selected color highlighted
- [ ] Save creates collection
- [ ] Collection appears in list
- [ ] Error if name empty

### 6.3 Collection Display
- [ ] Collection card shows:
  - [ ] Color indicator
  - [ ] Name
  - [ ] Description (if exists)
  - [ ] Wing count
  - [ ] Edit button
  - [ ] Delete button

### 6.4 Editing Collection
- [ ] Edit button opens modal with existing data
- [ ] Can modify name
- [ ] Can modify description
- [ ] Can change color
- [ ] Save updates collection
- [ ] Changes reflect in list

### 6.5 Deleting Collection
- [ ] Delete button shows confirmation
- [ ] Confirming deletes collection
- [ ] Associated nests deleted
- [ ] Wings NOT deleted (just unassigned)

### 6.6 Collection Expansion
- [ ] Clicking collection header expands/collapses
- [ ] Wings in collection display when expanded
- [ ] Nests display when expanded
- [ ] Nested structure visible

---

## 7. Nests Management

### 7.1 Creating Nests
- [ ] "Add Nest" button in collection
- [ ] Modal opens with collection pre-selected
- [ ] Name field works
- [ ] Parent nest dropdown works
- [ ] Can create root-level nest
- [ ] Can create nested nest
- [ ] Save creates nest
- [ ] Nest appears in collection

### 7.2 Nest Display
- [ ] Nest shows in collection
- [ ] Nested indentation correct
- [ ] Wing count in nest
- [ ] Edit/Delete buttons

### 7.3 Editing/Deleting Nests
- [ ] Edit opens modal with existing data
- [ ] Can rename
- [ ] Can change parent
- [ ] Delete removes nest
- [ ] Child nests move to parent
- [ ] Wings unassigned from nest (not deleted)

---

## 8. Highlighting & Annotations

### 8.1 Winged Page Detection
- [ ] Visit a winged page
- [ ] Wing badge appears (bottom-right)
- [ ] Badge shows highlight count (if any)
- [ ] Console shows "[Wing] Page is winged!"

### 8.2 Creating Highlights
- [ ] Select text on winged page
- [ ] Highlight tooltip appears above selection
- [ ] "Highlight" button visible
- [ ] Clicking button opens annotation popup
- [ ] Can add note (optional)
- [ ] Save creates highlight
- [ ] Text becomes highlighted (yellow background)

### 8.3 Highlight Restoration
- [ ] Refresh page
- [ ] Existing highlights restore
- [ ] Position is correct
- [ ] Multiple highlights restore

### 8.4 Highlight Interaction
- [ ] Clicking highlight shows popup
- [ ] Popup shows:
  - [ ] Highlighted text
  - [ ] Annotation (if exists)
  - [ ] Date
  - [ ] Edit button
  - [ ] Delete button
- [ ] Edit allows changing annotation
- [ ] Delete removes highlight
- [ ] Clicking outside closes popup

### 8.5 Edge Cases
- [ ] Works on text-heavy pages
- [ ] Works on pages with dynamic content
- [ ] Handles page refresh correctly
- [ ] Multiple highlights don't interfere

---

## 9. AI Query Interface

### 9.1 Query View
- [ ] Tab navigation to "Ask AI" works
- [ ] Empty state shows guidance
- [ ] Text area accepts input
- [ ] Placeholder text visible

### 9.2 Submitting Query
- [ ] "Ask Wing AI" button works
- [ ] Ctrl/Cmd+Enter submits query
- [ ] Loading state shows ("Thinking...")
- [ ] Button disabled during loading
- [ ] Response displays after completion

### 9.3 Query Results
- [ ] Answer text formatted correctly
- [ ] Line breaks preserved
- [ ] Citations section shows (if applicable)
- [ ] Citation links work (open in new tab)
- [ ] Citation favicons load

### 9.4 Error Handling
- [ ] No API key → error message + redirect to settings
- [ ] No wings → error message
- [ ] No wings with summaries → error message
- [ ] API error → user-friendly message
- [ ] "Try again" button works

### 9.5 Query Types to Test
- [ ] Factual: "What did I save about [topic]?"
- [ ] Comparative: "Compare the articles about [topic]"
- [ ] Exploratory: "What themes appear in my saved pages?"
- [ ] Specific: "Which page talks about [specific thing]?"

---

## 10. Data Management

### 10.1 Export
- [ ] Export button in options works
- [ ] Loading state during export
- [ ] JSON file downloads
- [ ] Filename includes date
- [ ] File contains all data (open and verify)

### 10.2 Import
- [ ] Import button opens file picker
- [ ] Only accepts .json files
- [ ] Invalid JSON shows error
- [ ] Invalid format shows error
- [ ] Valid file shows summary of contents
- [ ] "Replace" option clears existing data
- [ ] "Merge" option keeps existing data
- [ ] Success message after import
- [ ] Data appears in extension

### 10.3 Clear All Data
- [ ] Button in Danger Zone
- [ ] Double confirmation required
- [ ] All data cleared after confirm
- [ ] Statistics show 0 after clear

### 10.4 Data Statistics
- [ ] Wings count accurate
- [ ] Collections count accurate
- [ ] Highlights count accurate
- [ ] Connections count accurate
- [ ] Updates after import/clear

---

## 11. Keyboard Shortcuts

### 11.1 Global Shortcuts
- [ ] Cmd/Ctrl+Shift+W opens popup

### 11.2 Popup Shortcuts
- [ ] Escape closes any open modal
- [ ] Escape closes sort dropdown
- [ ] Enter confirms Wing It modal
- [ ] Enter confirms Collection modal
- [ ] Enter confirms Nest modal
- [ ] Cmd/Ctrl+F focuses search (wings view)

---

## 12. Error Handling & Edge Cases

### 12.1 Offline Handling
- [ ] Disable network
- [ ] Try to wing a page → appropriate error
- [ ] Try AI query → offline message
- [ ] Re-enable network → functionality restored

### 12.2 API Errors
- [ ] Invalid API key → clear error message
- [ ] Rate limit (if testable) → retry message
- [ ] Timeout → timeout message

### 12.3 Content Script Restrictions
- [ ] chrome:// pages → no errors, script skipped
- [ ] about: pages → no errors, script skipped
- [ ] Extension pages → no errors, script skipped
- [ ] PDF viewer → graceful handling

### 12.4 Special Characters
- [ ] Wing page with special chars in title
- [ ] Wing page with unicode in title
- [ ] Create collection with special chars
- [ ] Search with special characters

### 12.5 Long Content
- [ ] Wing page with very long title
- [ ] Wing page with very long content
- [ ] Summary handles long content gracefully

---

## 13. Performance

### 13.1 With Many Wings (50+)
- [ ] Popup opens quickly
- [ ] List renders without lag
- [ ] Search responds quickly
- [ ] Pagination works smoothly

### 13.2 Memory
- [ ] No console errors after extended use
- [ ] Extension doesn't slow down browser

---

## 14. Cross-Site Testing

Test the extension on various website types:

### 14.1 Simple Sites
- [ ] Static HTML blog
- [ ] Wikipedia article
- [ ] News article

### 14.2 Complex Sites
- [ ] Single Page App (React/Vue site)
- [ ] Twitter/X
- [ ] YouTube (video page)
- [ ] GitHub repository page

### 14.3 Edge Cases
- [ ] Site with strict CSP
- [ ] Site with heavy JavaScript
- [ ] Site with iframes

---

# Feedback Framework

## Issue Report Template

Copy this template for each issue you find:

```
### Issue ID: [AREA]-[NUMBER]
**Area:** [Extension Setup | API Key | Wing It | Wings List | Wing Details | Collections | Nests | Highlighting | AI Query | Data Management | Keyboard | Error Handling | Performance | Other]

**Severity:** [Critical | Major | Minor | Enhancement]
- Critical: Blocks core functionality, crashes
- Major: Feature doesn't work as expected
- Minor: Works but has issues (visual, UX)
- Enhancement: Suggestion for improvement

**Type:** [Bug | UI/Design | UX | Feature Request]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**


**Actual Behavior:**


**Screenshots:** [If applicable, describe or attach]

**Browser/OS:** [e.g., Chrome 120 / macOS 14]

**Console Errors:** [If any]

**Additional Notes:**

```

---

## Design & UI Feedback Template

```
### Design Feedback: [AREA]-[NUMBER]
**Area:** [Header | Navigation | Wings List | Wing Card | Modals | Forms | Buttons | Colors | Typography | Spacing | Icons | Empty States | Loading States | Toasts | Other]

**Current State:**
[Describe what it looks like/behaves now]

**Recommendation:**
[Describe your suggestion]

**Rationale:**
[Why this would improve the product]

**Priority:** [High | Medium | Low]

**Reference:** [Any design inspiration or examples]

```

---

## Summary Section

After testing, fill out this summary:

```
## Testing Summary

**Date:**
**Tester:**
**Browser/Version:**
**OS:**

### Overall Status
- [ ] Ready for release
- [ ] Needs minor fixes
- [ ] Needs major fixes
- [ ] Needs significant work

### Section Status
| Section | Status | Critical Issues | Notes |
|---------|--------|-----------------|-------|
| Extension Setup | | | |
| API Key | | | |
| Wing It | | | |
| Wings List | | | |
| Wing Details | | | |
| Collections | | | |
| Nests | | | |
| Highlighting | | | |
| AI Query | | | |
| Data Management | | | |
| Keyboard | | | |
| Error Handling | | | |
| Performance | | | |

### Top Issues (Priority Order)
1. Is the api key setup currently designed to only accept anthropic keys? Can we allow the user to connect any LLM? 
2. Why do I have to refresh the page after winging it for it to be tagged as winged in the bottom right corner of the screen. Why do I also have to refresh the page to start highlighting text on a winged page? Can that be automatically done without having to refresh it? 
3. Instead of showing +N next to the collection, can we show the first 2-3 collections that a wing is in? I don't like the +1 style. 
4. Can you create an uncategorized collection automatically in Wings, so that the wings that are not in any collection are put in uncategorized. 
5. How does this find connection thing work? If it's only semantic connections right now, can we make that relation or connection more vibrant or more deep? 

### Top Design Recommendations
1.
2.
3.
4.
5.

```

---

## Quick Reference: Test Data Setup

To efficiently test, create this baseline data:

1. **Collections:** Create 3-4 collections with different colors
2. **Nests:** Create 2-3 nests in one collection (including nested)
3. **Wings:** Save 25+ pages across different collections
   - Some with summaries
   - Some without API key (no summary)
   - Some in multiple collections
4. **Highlights:** Create 5+ highlights on 2-3 different pages
5. **Connections:** Let the system analyze connections, or manually test

This gives you a realistic dataset to test all features.
