/**
 * Wing - Content Script
 * Handles text highlighting and annotation on web pages
 */

// State
let isWingedPage = false;
let wingId = null;
let highlights = [];
let currentTooltip = null;
let currentPopup = null;
let currentSelection = null;
let tooltipJustCreated = false; // Flag to prevent immediate removal

// ============================================
// Initialization
// ============================================
async function init() {
  try {
    // Skip certain pages where content script shouldn't run
    if (shouldSkipPage()) {
      console.log('[Wing] Skipping page:', window.location.href);
      return;
    }

    const currentUrl = window.location.href;

    // Check if this page is winged
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'CHECK_WINGED_PAGE',
        url: currentUrl,
      });
    } catch (messageError) {
      // Extension context invalidated (e.g., extension was reloaded)
      if (messageError.message?.includes('Extension context invalidated')) {
        console.log('[Wing] Extension was reloaded, content script inactive');
        return;
      }
      throw messageError;
    }

    if (response && response.isWinged) {
      isWingedPage = true;
      wingId = response.wingId;
      highlights = response.highlights || [];
      console.log('[Wing] Page is winged! wingId:', wingId, 'highlights:', highlights.length);

      // Show the wing badge
      showWingBadge();

      // Restore existing highlights
      restoreHighlights();

      // Listen for text selection
      console.log('[Wing] Adding text selection listeners');
      document.addEventListener('mouseup', handleTextSelection);
      document.addEventListener('keyup', handleTextSelection);
    } else {
      console.log('[Wing] Page is NOT winged');
    }

    // Listen for clicks to close popups
    document.addEventListener('click', handleDocumentClick);

    // Listen for highlight clicks
    document.addEventListener('click', handleHighlightClick);

    console.log('Wing content script initialized:', isWingedPage ? 'Winged page' : 'Not winged');
  } catch (error) {
    // Silently fail for expected errors
    if (error.message?.includes('Cannot access') || error.message?.includes('blocked')) {
      console.log('[Wing] Content script blocked on this page');
      return;
    }
    console.error('Wing content script error:', error);
  }
}

/**
 * Check if the current page should be skipped
 */
function shouldSkipPage() {
  const url = window.location.href;

  // Skip chrome:// pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return true;
  }

  // Skip about: pages
  if (url.startsWith('about:')) {
    return true;
  }

  // Skip browser internal pages
  if (url.startsWith('edge://') || url.startsWith('brave://')) {
    return true;
  }

  // Skip file:// pages (usually)
  if (url.startsWith('file://')) {
    return true;
  }

  // Skip PDF viewer
  if (url.includes('/viewer.html') && url.includes('pdf')) {
    return true;
  }

  return false;
}

// ============================================
// Wing Badge
// ============================================
function showWingBadge() {
  const badge = document.createElement('div');
  badge.className = 'wing-page-badge';
  badge.innerHTML = `
    <span class="wing-page-badge-icon">🪶</span>
    <span class="wing-page-badge-text">Winged</span>
    ${highlights.length > 0 ? `<span class="wing-page-badge-count">${highlights.length}</span>` : ''}
  `;
  badge.addEventListener('click', () => {
    // Open popup to show wing details
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });
  document.body.appendChild(badge);
}

function updateBadgeCount() {
  const badge = document.querySelector('.wing-page-badge');
  if (!badge) return;

  const countEl = badge.querySelector('.wing-page-badge-count');
  if (highlights.length > 0) {
    if (countEl) {
      countEl.textContent = highlights.length;
    } else {
      const count = document.createElement('span');
      count.className = 'wing-page-badge-count';
      count.textContent = highlights.length;
      badge.appendChild(count);
    }
  } else if (countEl) {
    countEl.remove();
  }
}

// ============================================
// Text Selection & Tooltip
// ============================================
function handleTextSelection(e) {
  console.log('[Wing] handleTextSelection triggered', e.type);

  // Don't show tooltip if clicking on our own UI
  if (e.target.closest('.wing-highlight-tooltip, .wing-annotation-popup, .wing-highlight-view')) {
    console.log('[Wing] Clicked on Wing UI, ignoring');
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  console.log('[Wing] Selected text:', selectedText ? `"${selectedText.substring(0, 50)}..."` : '(empty)');

  // Remove existing tooltip
  removeTooltip();

  if (!selectedText || selectedText.length < 3) {
    console.log('[Wing] Selection too short, not showing tooltip');
    return;
  }

  // Get selection bounds
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  console.log('[Wing] Selection rect:', rect);

  // Store current selection
  currentSelection = {
    text: selectedText,
    range: range.cloneRange(),
  };

  // Show tooltip
  console.log('[Wing] Showing tooltip');
  try {
    showTooltip(rect);
  } catch (error) {
    console.error('[Wing] Error in showTooltip:', error);
  }
}

function showTooltip(rect) {
  console.log('[Wing] showTooltip called with rect:', rect);

  try {
    const tooltip = document.createElement('div');
    console.log('[Wing] Created tooltip div');

    tooltip.className = 'wing-highlight-tooltip';
    tooltip.id = 'wing-tooltip-' + Date.now();

    // Position above selection by default
    let top = rect.top + window.scrollY - 40;
    let isAbove = false;

    // If too close to top, show below
    if (rect.top < 50) {
      top = rect.bottom + window.scrollY + 10;
      isAbove = true;
      tooltip.classList.add('above');
    }

    const left = rect.left + window.scrollX + rect.width / 2;
    console.log('[Wing] Tooltip position - top:', top, 'left:', left);

    // Set all styles inline to ensure visibility
    tooltip.setAttribute('style', `
      position: absolute !important;
      top: ${top}px !important;
      left: ${left}px !important;
      transform: translateX(-50%) !important;
      z-index: 2147483647 !important;
      background: #333 !important;
      color: white !important;
      padding: 6px 10px !important;
      border-radius: 6px !important;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
      font-size: 13px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    `);

    tooltip.innerHTML = `
      <button data-action="highlight" style="
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 4px 8px !important;
        background: #1a73e8 !important;
        color: white !important;
        border: none !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
      ">Highlight</button>
    `;

    console.log('[Wing] Set tooltip innerHTML');

    tooltip.querySelector('[data-action="highlight"]').addEventListener('click', (e) => {
      e.stopPropagation();
      showAnnotationPopup(rect);
    });

    console.log('[Wing] Added click listener');
    console.log('[Wing] document.body exists:', !!document.body);

    document.body.appendChild(tooltip);

    console.log('[Wing] Tooltip appended! ID:', tooltip.id);
    console.log('[Wing] Tooltip in DOM:', !!document.getElementById(tooltip.id));

    currentTooltip = tooltip;

    // Set flag to prevent immediate removal by click handler
    tooltipJustCreated = true;
    setTimeout(() => {
      tooltipJustCreated = false;
    }, 100);
  } catch (error) {
    console.error('[Wing] Error in showTooltip:', error);
  }
}

function removeTooltip() {
  if (currentTooltip) {
    console.log('[Wing] removeTooltip called - removing tooltip');
    console.trace('[Wing] removeTooltip stack trace');
    currentTooltip.remove();
    currentTooltip = null;
  }
}

// ============================================
// Annotation Popup
// ============================================
function showAnnotationPopup(rect, existingHighlight = null) {
  removeTooltip();
  removePopup();

  const popup = document.createElement('div');
  popup.className = 'wing-annotation-popup';

  // Position
  let top = rect.bottom + window.scrollY + 10;
  let left = rect.left + window.scrollX;

  // Keep within viewport
  if (left + 280 > window.innerWidth) {
    left = window.innerWidth - 290;
  }
  if (left < 10) {
    left = 10;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  const text = existingHighlight ? existingHighlight.selectedText : currentSelection?.text || '';
  const annotation = existingHighlight ? existingHighlight.annotation || '' : '';
  const isEditing = !!existingHighlight;

  popup.innerHTML = `
    <div class="wing-annotation-header">
      <span class="wing-annotation-title">${isEditing ? 'Edit Highlight' : 'Add Highlight'}</span>
      <button class="wing-annotation-close">&times;</button>
    </div>
    <div class="wing-annotation-body">
      <div class="wing-annotation-text">${escapeHtml(text)}</div>
      <textarea class="wing-annotation-input" placeholder="Add a note (optional)...">${escapeHtml(annotation)}</textarea>
    </div>
    <div class="wing-annotation-footer">
      ${isEditing ? '<button class="wing-annotation-btn wing-annotation-btn-danger" data-action="delete">Delete</button>' : ''}
      <button class="wing-annotation-btn wing-annotation-btn-secondary" data-action="cancel">Cancel</button>
      <button class="wing-annotation-btn wing-annotation-btn-primary" data-action="save">${isEditing ? 'Update' : 'Save'}</button>
    </div>
  `;

  // Event handlers
  popup.querySelector('.wing-annotation-close').addEventListener('click', removePopup);
  popup.querySelector('[data-action="cancel"]').addEventListener('click', removePopup);

  popup.querySelector('[data-action="save"]').addEventListener('click', () => {
    const noteInput = popup.querySelector('.wing-annotation-input');
    const note = noteInput.value.trim();

    if (isEditing) {
      updateHighlight(existingHighlight.id, note);
    } else {
      saveHighlight(note);
    }
    removePopup();
  });

  if (isEditing) {
    popup.querySelector('[data-action="delete"]').addEventListener('click', () => {
      deleteHighlight(existingHighlight.id);
      removePopup();
    });
  }

  // Focus the textarea
  document.body.appendChild(popup);
  popup.querySelector('.wing-annotation-input').focus();

  currentPopup = popup;
}

function removePopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
}

// ============================================
// Highlight View (on click)
// ============================================
function showHighlightView(highlightEl, highlight) {
  removePopup();

  const rect = highlightEl.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'wing-highlight-view';

  // Position
  let top = rect.bottom + window.scrollY + 10;
  let left = rect.left + window.scrollX;

  if (left + 260 > window.innerWidth) {
    left = window.innerWidth - 270;
  }
  if (left < 10) {
    left = 10;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  const date = new Date(highlight.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  popup.innerHTML = `
    <div class="wing-highlight-view-header">
      <span class="wing-highlight-view-title">Highlight</span>
      <div class="wing-highlight-view-actions">
        <button class="wing-highlight-view-btn" data-action="edit" title="Edit">✏️</button>
        <button class="wing-highlight-view-btn delete" data-action="delete" title="Delete">🗑️</button>
      </div>
    </div>
    <div class="wing-highlight-view-body">
      <div class="wing-highlight-view-text">${escapeHtml(highlight.selectedText)}</div>
      ${
        highlight.annotation
          ? `<div class="wing-highlight-view-annotation">${escapeHtml(highlight.annotation)}</div>`
          : `<div class="wing-highlight-view-no-annotation">No note added</div>`
      }
      <div class="wing-highlight-view-date">${date}</div>
    </div>
  `;

  popup.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    removePopup();
    showAnnotationPopup(rect, highlight);
  });

  popup.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteHighlight(highlight.id);
    removePopup();
  });

  document.body.appendChild(popup);
  currentPopup = popup;
}

// ============================================
// Highlight CRUD
// ============================================
async function saveHighlight(annotation) {
  if (!currentSelection || !wingId) return;

  try {
    // Get position info for restoration
    const positionInfo = getSelectionPosition(currentSelection.range);
    if (!positionInfo) {
      console.error('Could not get selection position');
      return;
    }

    const highlight = {
      id: generateId(),
      wingId: wingId,
      selectedText: currentSelection.text,
      annotation: annotation,
      ...positionInfo,
      timestamp: Date.now(),
    };

    // Save via background script
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      highlight: highlight,
    });

    if (response && response.success) {
      highlights.push(highlight);
      applyHighlight(highlight);
      updateBadgeCount();
    }
  } catch (error) {
    console.error('Error saving highlight:', error);
  }

  // Clear selection
  window.getSelection().removeAllRanges();
  currentSelection = null;
}

async function updateHighlight(highlightId, annotation) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'UPDATE_HIGHLIGHT',
      highlightId: highlightId,
      updates: { annotation: annotation },
    });

    if (response && response.success) {
      // Update local state
      const index = highlights.findIndex((h) => h.id === highlightId);
      if (index !== -1) {
        highlights[index].annotation = annotation;

        // Update DOM
        const el = document.querySelector(`[data-wing-highlight-id="${highlightId}"]`);
        if (el) {
          el.setAttribute('data-has-annotation', annotation ? 'true' : 'false');
        }
      }
    }
  } catch (error) {
    console.error('Error updating highlight:', error);
  }
}

async function deleteHighlight(highlightId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_HIGHLIGHT',
      highlightId: highlightId,
    });

    if (response && response.success) {
      // Remove from local state
      highlights = highlights.filter((h) => h.id !== highlightId);

      // Remove from DOM
      const el = document.querySelector(`[data-wing-highlight-id="${highlightId}"]`);
      if (el) {
        // Unwrap the highlight
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        el.remove();
      }

      updateBadgeCount();
    }
  } catch (error) {
    console.error('Error deleting highlight:', error);
  }
}

// ============================================
// Highlight Restoration
// ============================================
function restoreHighlights() {
  highlights.forEach((highlight) => {
    try {
      applyHighlightFromPosition(highlight);
    } catch (error) {
      console.warn('Could not restore highlight:', highlight.id, error);
    }
  });
}

function applyHighlight(highlight) {
  if (!currentSelection || !currentSelection.range) return;

  const range = currentSelection.range;
  const span = document.createElement('span');
  span.className = 'wing-highlight';
  span.setAttribute('data-wing-highlight-id', highlight.id);
  span.setAttribute('data-has-annotation', highlight.annotation ? 'true' : 'false');

  try {
    range.surroundContents(span);
  } catch (e) {
    // Handle complex selections that span multiple elements
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }
}

function applyHighlightFromPosition(highlight) {
  // Try to find the text and highlight it
  const { xpath, startOffset, endOffset, selectedText } = highlight;

  // First, try XPath-based restoration
  if (xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const node = result.singleNodeValue;

      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.substring(startOffset, endOffset) === selectedText) {
          const range = document.createRange();
          range.setStart(node, startOffset);
          range.setEnd(node, endOffset);

          const span = document.createElement('span');
          span.className = 'wing-highlight';
          span.setAttribute('data-wing-highlight-id', highlight.id);
          span.setAttribute('data-has-annotation', highlight.annotation ? 'true' : 'false');
          range.surroundContents(span);
          return;
        }
      }
    } catch (e) {
      console.warn('XPath restoration failed:', e);
    }
  }

  // Fallback: search for the text in the document
  findAndHighlightText(highlight);
}

function findAndHighlightText(highlight) {
  const { selectedText, id, annotation } = highlight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

  let node;
  while ((node = walker.nextNode())) {
    const index = node.textContent.indexOf(selectedText);
    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + selectedText.length);

      const span = document.createElement('span');
      span.className = 'wing-highlight';
      span.setAttribute('data-wing-highlight-id', id);
      span.setAttribute('data-has-annotation', annotation ? 'true' : 'false');

      try {
        range.surroundContents(span);
        return; // Found and highlighted
      } catch (e) {
        // Selection spans multiple elements
        continue;
      }
    }
  }
}

// ============================================
// Position Helpers
// ============================================
function getSelectionPosition(range) {
  try {
    const startContainer = range.startContainer;

    // Get XPath to the text node
    const xpath = getXPathForNode(startContainer);

    return {
      xpath: xpath,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    };
  } catch (error) {
    console.error('Error getting selection position:', error);
    return null;
  }
}

function getXPathForNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const siblings = Array.from(node.parentNode.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE
    );
    const index = siblings.indexOf(node) + 1;
    return getXPathForNode(node.parentNode) + `/text()[${index}]`;
  }

  if (node === document.body) {
    return '/html/body';
  }

  const siblings = Array.from(node.parentNode.children).filter(
    (n) => n.tagName === node.tagName
  );
  const index = siblings.indexOf(node) + 1;
  const tagName = node.tagName.toLowerCase();

  return getXPathForNode(node.parentNode) + `/${tagName}[${index}]`;
}

// ============================================
// Event Handlers
// ============================================
function handleDocumentClick(e) {
  console.log('[Wing] handleDocumentClick fired, target:', e.target.tagName, 'tooltipJustCreated:', tooltipJustCreated);

  // Don't remove tooltip if it was just created (prevents mouseup->click race condition)
  if (tooltipJustCreated) {
    console.log('[Wing] Tooltip was just created, not removing');
    return;
  }

  // Close tooltip and popup when clicking outside
  if (!e.target.closest('.wing-highlight-tooltip, .wing-annotation-popup, .wing-highlight-view, .wing-highlight')) {
    console.log('[Wing] Click was outside Wing UI, removing tooltip');
    removeTooltip();
    removePopup();
  }
}

function handleHighlightClick(e) {
  const highlightEl = e.target.closest('.wing-highlight');
  if (!highlightEl) return;

  e.stopPropagation();

  const highlightId = highlightEl.getAttribute('data-wing-highlight-id');
  const highlight = highlights.find((h) => h.id === highlightId);

  if (highlight) {
    showHighlightView(highlightEl, highlight);
  }
}

// ============================================
// Utility Functions
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Initialize
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
