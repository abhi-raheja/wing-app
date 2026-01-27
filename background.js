/**
 * Wing - Background Service Worker
 * Handles background tasks, messaging, and API calls
 */

import { generateSummary } from './lib/api.js';
import * as db from './lib/db.js';
import * as connections from './lib/connections.js';

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

  // ============================================
  // Connection-related message handlers
  // ============================================

  // Analyze connections for a wing
  if (request.type === 'ANALYZE_CONNECTIONS') {
    handleAnalyzeConnections(request.wingId)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error analyzing connections:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Get related wings for a specific wing
  if (request.type === 'GET_RELATED_WINGS') {
    handleGetRelatedWings(request.wingId)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error getting related wings:', error);
        sendResponse({ relatedWings: [], error: error.message });
      });
    return true;
  }

  // Create a manual connection between two wings
  if (request.type === 'CREATE_CONNECTION') {
    handleCreateConnection(request.wingId1, request.wingId2)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error creating connection:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Remove a connection between two wings
  if (request.type === 'REMOVE_CONNECTION') {
    handleRemoveConnection(request.wingId1, request.wingId2)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error removing connection:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Refresh connections for a wing
  if (request.type === 'REFRESH_CONNECTIONS') {
    handleRefreshConnections(request.wingId)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error refreshing connections:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Get connection statistics
  if (request.type === 'GET_CONNECTION_STATS') {
    connections.getConnectionStats()
      .then(sendResponse)
      .catch((error) => {
        console.error('Error getting connection stats:', error);
        sendResponse({ error: error.message });
      });
    return true;
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

// ============================================
// Connection Handlers
// ============================================

/**
 * Analyze connections for a wing
 */
async function handleAnalyzeConnections(wingId) {
  try {
    const wing = await db.getWing(wingId);
    if (!wing) {
      return { success: false, error: 'Wing not found' };
    }

    const newConnections = await connections.analyzeConnectionsForWing(wing);
    return {
      success: true,
      connectionsFound: newConnections.length,
      connections: newConnections,
    };
  } catch (error) {
    console.error('Error analyzing connections:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get related wings for a specific wing
 */
async function handleGetRelatedWings(wingId) {
  try {
    const relatedWings = await connections.getRelatedWings(wingId);
    return { relatedWings };
  } catch (error) {
    console.error('Error getting related wings:', error);
    return { relatedWings: [], error: error.message };
  }
}

/**
 * Create a manual connection between two wings
 */
async function handleCreateConnection(wingId1, wingId2) {
  try {
    const connection = await connections.createManualConnection(wingId1, wingId2);
    return { success: true, connection };
  } catch (error) {
    console.error('Error creating connection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a connection between two wings
 */
async function handleRemoveConnection(wingId1, wingId2) {
  try {
    const removed = await connections.removeConnection(wingId1, wingId2);
    return { success: removed };
  } catch (error) {
    console.error('Error removing connection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refresh connections for a wing
 */
async function handleRefreshConnections(wingId) {
  try {
    const newConnections = await connections.refreshConnections(wingId);
    return {
      success: true,
      connectionsFound: newConnections.length,
      connections: newConnections,
    };
  } catch (error) {
    console.error('Error refreshing connections:', error);
    return { success: false, error: error.message };
  }
}

// Log when service worker starts
console.log('Wing background service worker started');
