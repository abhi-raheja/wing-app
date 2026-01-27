/**
 * Wing - Background Service Worker
 * Handles background tasks, messaging, and API calls
 */

import { generateSummary } from './lib/api.js';
import * as db from './lib/db.js';

// Initialize database
db.initDB().then(() => {
  console.log('Wing database initialized');
}).catch((error) => {
  console.error('Failed to initialize database:', error);
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Summary generation
  if (request.type === 'GENERATE_SUMMARY') {
    handleGenerateSummary(request.tabId)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error generating summary:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  // Check if a page is winged (for content script)
  if (request.type === 'CHECK_WINGED_PAGE') {
    handleCheckWingedPage(request.url)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error checking winged page:', error);
        sendResponse({ isWinged: false });
      });
    return true;
  }

  // Save a new highlight
  if (request.type === 'SAVE_HIGHLIGHT') {
    handleSaveHighlight(request.highlight)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error saving highlight:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Update a highlight
  if (request.type === 'UPDATE_HIGHLIGHT') {
    handleUpdateHighlight(request.highlightId, request.updates)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error updating highlight:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Delete a highlight
  if (request.type === 'DELETE_HIGHLIGHT') {
    handleDeleteHighlight(request.highlightId)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error deleting highlight:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Open popup (from content script badge click)
  if (request.type === 'OPEN_POPUP') {
    // Can't programmatically open the popup, but we can focus the extension
    // This is a limitation of Chrome extensions
    return false;
  }

  if (request.type === 'GET_PAGE_CONTENT') {
    return false;
  }
});

/**
 * Generate summary for a page using Anthropic API
 */
async function handleGenerateSummary(tabId) {
  try {
    const [{ result: pageContent }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const content = document.body.innerText;
        return content.substring(0, 10000);
      },
    });

    if (!pageContent || pageContent.trim().length < 50) {
      return { error: 'Not enough content to summarize' };
    }

    const summary = await generateSummary(pageContent);

    return {
      summary,
      fullContent: pageContent,
    };
  } catch (error) {
    console.error('Summary generation error:', error);
    return { error: error.message };
  }
}

/**
 * Check if a URL has been winged and return wing data with highlights
 */
async function handleCheckWingedPage(url) {
  try {
    const wing = await db.getWingByUrl(url);

    if (!wing) {
      return { isWinged: false };
    }

    // Get highlights for this wing
    const highlights = await db.getHighlightsByWing(wing.id);

    return {
      isWinged: true,
      wingId: wing.id,
      highlights: highlights,
    };
  } catch (error) {
    console.error('Error checking winged page:', error);
    return { isWinged: false };
  }
}

/**
 * Save a new highlight
 */
async function handleSaveHighlight(highlight) {
  try {
    await db.createHighlight(highlight);
    return { success: true };
  } catch (error) {
    console.error('Error saving highlight:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing highlight
 */
async function handleUpdateHighlight(highlightId, updates) {
  try {
    await db.updateHighlight(highlightId, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating highlight:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a highlight
 */
async function handleDeleteHighlight(highlightId) {
  try {
    await db.deleteHighlight(highlightId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting highlight:', error);
    return { success: false, error: error.message };
  }
}

// Log when service worker starts
console.log('Wing background service worker started');
