# Wing Extension - Quick Manual Testing Guide

This guide covers the sections that require manual testing. The automated tests cover Sections 1-7, 10, 11, and 13. This guide focuses on Sections 8, 9, 12, and 14.

## Prerequisites

1. **Import Test Data** (recommended for faster testing):
   ```
   1. Open Wing extension → Options page
   2. Click "Import Data"
   3. Select: __tests__/fixtures/wing-test-data.json
   4. Choose "Replace" to start fresh
   ```

2. **Configure API Key**:
   - Go to Options → AI Provider
   - Select your preferred provider (Anthropic or OpenAI)
   - Enter your API key and save

---

## Section 8: Highlighting & Annotations (~10 min)

### 8.1 Winged Page Detection
1. Wing a page (e.g., https://example.com)
2. Visit that same page
3. **Verify:** Wing badge appears in bottom-right corner
4. **Verify:** Console shows "[Wing] Page is winged!"

### 8.2 Creating Highlights
1. On a winged page, select some text
2. **Verify:** Highlight tooltip appears
3. Click "Highlight" button
4. Add an optional annotation
5. **Verify:** Text becomes highlighted (yellow)
6. **Verify:** Highlight saves successfully

### 8.3 Highlight Restoration
1. Refresh the winged page
2. **Verify:** Previous highlights restore correctly
3. **Verify:** Position is accurate

### 8.4 Highlight Interaction
1. Click on a highlight
2. **Verify:** Popup shows highlighted text, annotation, date
3. Test Edit → modify annotation → Save
4. Test Delete → confirm → highlight removed

### 8.5 Edge Cases
- [ ] Test on text-heavy page (Wikipedia article)
- [ ] Test multiple highlights on same page
- [ ] Test highlight spanning multiple paragraphs

---

## Section 9: AI Query Interface (~5 min)

### 9.1 Query View
1. Open popup → "Ask AI" tab
2. **Verify:** Empty state shows guidance
3. **Verify:** Text area accepts input

### 9.2 Submitting Query
1. Type: "What have I saved about JavaScript?"
2. Click "Ask Wing AI" or press Cmd/Ctrl+Enter
3. **Verify:** Loading state shows ("Thinking...")
4. **Verify:** Response displays after completion

### 9.3 Query Results
- [ ] Answer text formatted correctly
- [ ] Citations section shows (if applicable)
- [ ] Citation links work

### 9.4 Error Handling
- [ ] Remove API key → try query → shows error + redirect
- [ ] Clear all data → try query → shows "no wings" error

### 9.5 Query Types to Test
- [ ] "What themes appear in my saved pages?"
- [ ] "Compare the articles about [topic]"
- [ ] "Which page talks about [specific thing]?"

---

## Section 12: Error Handling & Edge Cases (~10 min)

### 12.1 Offline Handling
1. Disable network (airplane mode or Dev Tools → Network → Offline)
2. Try to wing a page → **Verify:** appropriate error
3. Try AI query → **Verify:** offline message
4. Re-enable network → **Verify:** functionality restored

### 12.2 API Errors
1. Enter invalid API key
2. Try AI feature → **Verify:** clear error message
3. Fix API key → **Verify:** works again

### 12.3 Content Script Restrictions
Navigate to these and verify no errors:
- [ ] chrome://extensions
- [ ] about:blank
- [ ] Any PDF file

### 12.4 Special Characters
- [ ] Wing page with special chars in title (e.g., "Test & Demo <script>")
- [ ] Create collection with emoji (e.g., "🔥 Hot Topics")
- [ ] Search with special characters

### 12.5 Long Content
- [ ] Wing a page with very long title
- [ ] Wing a page with extensive content (long article)
- [ ] **Verify:** Summary generates without issues

---

## Section 14: Cross-Site Testing (~10 min)

Test "Wing It" and highlighting on each:

### 14.1 Simple Sites
- [ ] Wikipedia article (https://en.wikipedia.org/wiki/JavaScript)
- [ ] Example.com
- [ ] Any blog post

### 14.2 Complex Sites
- [ ] GitHub repository page
- [ ] Twitter/X (if logged in)
- [ ] YouTube video page
- [ ] Stack Overflow question

### 14.3 Edge Cases
- [ ] Site with iframes (embedded content)
- [ ] Single Page App (e.g., React docs)

---

## Quick Checklist Summary

| Section | Item | Status |
|---------|------|--------|
| 8.1 | Winged page detection | [ ] |
| 8.2 | Create highlight | [ ] |
| 8.3 | Highlight restoration | [ ] |
| 8.4 | Highlight interaction | [ ] |
| 9.1 | Query view loads | [ ] |
| 9.2 | Query submission works | [ ] |
| 9.3 | Results display correctly | [ ] |
| 12.1 | Offline handling | [ ] |
| 12.2 | API error handling | [ ] |
| 12.3 | Restricted pages | [ ] |
| 12.4 | Special characters | [ ] |
| 14.1 | Simple sites | [ ] |
| 14.2 | Complex sites | [ ] |

---

## Reporting Issues

If you find issues, note:
1. **Steps to reproduce**
2. **Expected vs actual behavior**
3. **Console errors** (if any)
4. **Browser/OS version**

Good luck testing! 🚀
