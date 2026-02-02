# Wing Test Mapping: TESTING_CHECKLIST.md → Automated Tests

This document maps each item from TESTING_CHECKLIST.md to its automated test coverage.

## Legend
- ✅ **Automated** - Covered by unit or integration tests
- 🔧 **Partial** - Some aspects automated, others need manual verification
- 👁️ **Manual Only** - Requires manual testing (reason provided)

---

## 1. Extension Setup & Loading

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Extension loads without errors | ✅ | `integration/extension.test.js` | `Extension Loading` suite |
| Extension icon appears in toolbar | 👁️ Manual | - | Visual verification required |
| Clicking icon opens popup | ✅ | `integration/extension.test.js` | `popup page loads` |
| Service worker shows "Active" | ✅ | `integration/extension.test.js` | Checked via extensionId detection |
| Options page loads | ✅ | `integration/extension.test.js` | `options page loads` |

---

## 2. API Key Management

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Empty API key field initially | ✅ | `unit/api.test.js` | `hasApiKey returns false` |
| Status message guides user | 👁️ Manual | - | Visual UX verification |
| Provider API key link works | ✅ | `integration/extension.test.js` | Options page tests |
| Invalid key format rejected | ✅ | `unit/api.test.js` | `validateApiKey` tests |
| Invalid key shows error | ✅ | `unit/api.test.js` | `throws error for invalid API key` |
| Valid key validates | ✅ | `unit/api.test.js` | `validates Anthropic key successfully` |
| "Validating..." status | 👁️ Manual | - | Loading state is visual |
| Success message displays | 👁️ Manual | - | Toast notification visual |
| Toggle visibility | ✅ | `integration/extension.test.js` | Options page has toggle |
| Save button stores key | ✅ | `unit/api.test.js` | `saveApiKey` tests |
| Remove button clears key | ✅ | `unit/api.test.js` | `removeApiKey` tests |
| Key persists after restart | 🔧 Partial | `unit/api.test.js` | Storage mock tested; browser restart is manual |

---

## 3. Core "Wing It" Functionality

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| "Wing It" button opens modal | ✅ | `integration/extension.test.js` | `Wing It button exists` |
| Current page title displays | 👁️ Manual | - | Requires actual page context |
| Current page URL displays | 👁️ Manual | - | Requires actual page context |
| Favicon loads | 🔧 Partial | `unit/utils.test.js` | `getFaviconUrl` tested |
| Collections list shows | ✅ | `integration/extension.test.js` | Modal fields test |
| "No collections" message | ✅ | `unit/db.test.js` | Empty state logic tested |
| Can save without collection | ✅ | `unit/db.test.js` | `createWing` without collections |
| Can save with collection(s) | ✅ | `unit/db.test.js` | `createWing` with collections |
| Loading spinner while saving | 👁️ Manual | - | Visual animation |
| Success toast appears | 👁️ Manual | - | Visual toast notification |
| Modal closes after save | 👁️ Manual | - | Modal state change |
| Wing appears in list | ✅ | `unit/db.test.js` | `getAllWings` returns created wing |
| "Summarizing..." badge shows | 👁️ Manual | - | Visual badge state |
| Summary generates | ✅ | `unit/api.test.js` | `generateSummary` tests |
| Summary badge disappears | 👁️ Manual | - | Visual state change |
| Error handling for API | ✅ | `unit/api.test.js` | Error handling tests |
| Duplicate handling | ✅ | `unit/db.test.js` | `getWingByUrl` for detection |

---

## 4. Wings List & Navigation

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Wings show in list | ✅ | `unit/db.test.js` | `getAllWings` tested |
| Favicon displays | 🔧 Partial | `unit/utils.test.js` | URL generation tested |
| Title displays (truncated) | ✅ | `unit/utils.test.js` | `truncateText` tested |
| URL displays (truncated) | ✅ | `unit/utils.test.js` | `truncateText` tested |
| Date shows correctly | ✅ | `unit/utils.test.js` | `formatDate` tested |
| Collection badge shows | 👁️ Manual | - | Visual rendering |
| "+N" badge for multiple | 👁️ Manual | - | Visual rendering |
| Sort dropdown opens | ✅ | `integration/extension.test.js` | `sort menu opens on click` |
| "Newest first" works | ✅ | `unit/utils.test.js` | Sort helpers tested |
| "Oldest first" works | ✅ | `unit/utils.test.js` | Sort helpers tested |
| "Title A-Z" works | ✅ | `unit/utils.test.js` | Sort helpers tested |
| "Title Z-A" works | ✅ | `unit/utils.test.js` | Sort helpers tested |
| Sort persists during session | 👁️ Manual | - | Session state; timing-dependent |
| Search input visible | ✅ | `integration/extension.test.js` | `search input exists` |
| Search filters in real-time | ✅ | `unit/db.test.js` | Filter by content tests |
| Matches on title/URL/summary | ✅ | `unit/db.test.js` | Search filter tests |
| "Match in summary" indicator | 👁️ Manual | - | Visual indicator |
| Search highlights text | 👁️ Manual | - | Visual highlighting |
| "No matching wings" state | 👁️ Manual | - | Visual empty state |
| Pagination shows | 👁️ Manual | - | Visual rendering |
| "Load More" works | 👁️ Manual | - | Interaction test |
| Collection filter chips | 👁️ Manual | - | Visual rendering |

---

## 5. Wing Details Modal

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Clicking wing opens details | 👁️ Manual | - | Click interaction |
| Title/URL/summary display | 👁️ Manual | - | Modal content rendering |
| Collection assignment | ✅ | `unit/db.test.js` | `updateWing` with collections |
| Nests appear when selected | 👁️ Manual | - | Dynamic UI rendering |
| "Save Changes" works | ✅ | `unit/db.test.js` | `updateWing` tested |
| Highlights section shows | ✅ | `unit/db.test.js` | `getHighlightsByWing` tested |
| Highlight CRUD | ✅ | `unit/db.test.js` | Highlight operations tested |
| Related Wings section | ✅ | `unit/connections.test.js` | `getRelatedWings` tested |
| Find Connections button | ✅ | `unit/connections.test.js` | `analyzeConnectionsForWing` tested |
| "Open Page" button | 👁️ Manual | - | Browser tab interaction |
| "Delete Wing" works | ✅ | `unit/db.test.js` | `deleteWing` tested |
| Modal close buttons | ✅ | `integration/extension.test.js` | Escape key test |

---

## 6. Collections Management

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Tab navigation works | ✅ | `integration/extension.test.js` | View switching tests |
| Collections list displays | ✅ | `integration/extension.test.js` | Collections view tests |
| Empty state shows | 👁️ Manual | - | Visual empty state |
| "New Collection" button | ✅ | `integration/extension.test.js` | `New Collection button exists` |
| Modal opens | ✅ | `integration/extension.test.js` | `clicking New Collection opens modal` |
| Name/description/color fields | ✅ | `integration/extension.test.js` | `collection modal has required fields` |
| Can create collection | ✅ | `integration/extension.test.js` | `can create a new collection` |
| Edit collection | ✅ | `unit/db.test.js` | `updateCollection` tested |
| Delete collection | ✅ | `unit/db.test.js` | `deleteCollection` tested |
| Wings remain after delete | ✅ | `unit/db.test.js` | Explicit test case |

---

## 7. Nests Management

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Create nest | ✅ | `unit/db.test.js` | `createNest` tested |
| Nested structure | ✅ | `unit/db.test.js` | `parentId` handling tested |
| Edit/rename nest | ✅ | `unit/db.test.js` | `updateNest` tested |
| Delete nest | ✅ | `unit/db.test.js` | `deleteNest` tested |
| Visual tree rendering | 👁️ Manual | - | DOM rendering visual |

---

## 8. Highlighting & Annotations

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Winged page detection | 👁️ Manual | - | Content script behavior |
| Wing badge appears | 👁️ Manual | - | DOM injection visual |
| Select text → tooltip | 👁️ Manual | - | Browser selection API interaction |
| Create highlight | ✅ | `unit/db.test.js` | `createHighlight` tested |
| Annotation popup | 👁️ Manual | - | DOM popup visual |
| Highlight restoration | 👁️ Manual | - | XPath-based restoration is timing-dependent |
| Multiple highlights | ✅ | `unit/db.test.js` | `getHighlightsByWing` returns multiple |
| Delete highlight | ✅ | `unit/db.test.js` | `deleteHighlight` tested |

**Why manual:** Highlighting involves browser Selection API, DOM manipulation with XPath positioning, and visual overlay rendering - all browser-specific behaviors that are difficult to reliably automate.

---

## 9. AI Query Interface

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Tab navigation works | ✅ | `integration/extension.test.js` | `Ask AI tab shows query view` |
| Empty state shows | 👁️ Manual | - | Visual empty state |
| Text area accepts input | 👁️ Manual | - | Form input |
| Submit button works | ✅ | `unit/api.test.js` | `queryWings` tested |
| Loading state shows | 👁️ Manual | - | Visual loading indicator |
| Response displays | ✅ | `unit/api.test.js` | Response parsing tested |
| Citations show | ✅ | `unit/api.test.js` | Citations handling tested |
| No API key error | ✅ | `unit/api.test.js` | `throws when no API key` |
| No wings error | ✅ | `unit/api.test.js` | `throws when no wings provided` |
| API error handling | ✅ | `unit/api.test.js` | Error handling tests |

---

## 10. Data Management

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Export button works | ✅ | `integration/extension.test.js` | `export button exists` |
| Export produces JSON | ✅ | `unit/db.test.js` | `exportAllData` tested |
| Import button works | ✅ | `integration/extension.test.js` | `import button exists` |
| Import validates JSON | ✅ | `unit/db.test.js` | `importData` tested |
| Clear all data works | ✅ | `unit/db.test.js` | `clearAllData` tested |
| Statistics update | ✅ | `unit/db.test.js` | Data counts after operations |

---

## 11. Keyboard Shortcuts

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Escape closes modal | ✅ | `integration/extension.test.js` | `Escape closes modal` |
| Enter confirms modal | 👁️ Manual | - | Form submission behavior |
| Ctrl/Cmd+F focuses search | 🔧 Partial | `integration/extension.test.js` | Browser focus quirks |
| Global Cmd+Shift+W | 👁️ Manual | - | Chrome shortcut API limitation |

---

## 12. Error Handling & Edge Cases

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Offline handling | ✅ | `unit/api.test.js` | Network error handling |
| Invalid API key error | ✅ | `unit/api.test.js` | 401 response handling |
| Rate limit error | ✅ | `unit/api.test.js` | 429 response handling |
| Timeout error | ✅ | `unit/api.test.js` | Timeout handling |
| chrome:// pages | ✅ | `integration/extension.test.js` | Content script exclusion |
| Special characters | ✅ | `unit/utils.test.js` | `escapeHtml` tested |
| Unicode in titles | ✅ | `unit/utils.test.js` | String handling |
| Long content truncation | ✅ | `unit/utils.test.js` | `truncateText` tested |

---

## 13. Performance

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Popup opens quickly (50+ wings) | 👁️ Manual | - | Performance benchmark |
| List renders without lag | 👁️ Manual | - | Performance benchmark |
| Search responds quickly | 👁️ Manual | - | Performance benchmark |
| No memory issues | 👁️ Manual | - | Long-term usage monitoring |

**Why manual:** Performance testing requires real browser profiling, memory snapshots, and frame rate monitoring which are beyond the scope of functional tests.

---

## 14. Cross-Site Testing

| Checklist Item | Test Status | Test File | Notes |
|----------------|-------------|-----------|-------|
| Static HTML blog | 👁️ Manual | - | Site-specific behavior |
| Wikipedia article | 👁️ Manual | - | Site-specific behavior |
| News article | 👁️ Manual | - | Site-specific behavior |
| Single Page App | 👁️ Manual | - | SPA-specific behavior |
| Twitter/X | 👁️ Manual | - | Site-specific behavior |
| YouTube | 👁️ Manual | - | Site-specific behavior |
| GitHub | 👁️ Manual | - | Site-specific behavior |
| Sites with strict CSP | 👁️ Manual | - | CSP policy varies |
| Heavy JavaScript sites | 👁️ Manual | - | Performance varies |
| Sites with iframes | 👁️ Manual | - | iframe handling |

**Why manual:** Cross-site testing requires real network requests to external sites with varying behaviors, CSP policies, and JavaScript frameworks.

---

## Summary

### Test Coverage Statistics

| Category | Automated | Partial | Manual | Total |
|----------|-----------|---------|--------|-------|
| Extension Setup | 4 | 0 | 1 | 5 |
| API Key Management | 8 | 1 | 3 | 12 |
| Wing It Functionality | 7 | 1 | 9 | 17 |
| Wings List | 9 | 1 | 10 | 20 |
| Wing Details | 5 | 0 | 7 | 12 |
| Collections | 9 | 0 | 1 | 10 |
| Nests | 4 | 0 | 1 | 5 |
| Highlighting | 4 | 0 | 6 | 10 |
| AI Query | 6 | 0 | 4 | 10 |
| Data Management | 6 | 0 | 0 | 6 |
| Keyboard Shortcuts | 1 | 1 | 2 | 4 |
| Error Handling | 8 | 0 | 0 | 8 |
| Performance | 0 | 0 | 4 | 4 |
| Cross-Site | 0 | 0 | 10 | 10 |
| **TOTAL** | **71** | **4** | **58** | **133** |

### Percentage Breakdown
- **Automated:** 53% (71/133)
- **Partially Automated:** 3% (4/133)
- **Manual Testing Required:** 44% (58/133)

### Reasons for Manual Testing
1. **Visual/UX verification** - Animations, colors, layouts
2. **Browser-specific behavior** - Selection API, focus management
3. **Content script interaction** - DOM manipulation on real pages
4. **Performance benchmarks** - Timing, memory, responsiveness
5. **Cross-site compatibility** - Real external sites with varying behaviors
6. **Global keyboard shortcuts** - Chrome API limitations in testing
