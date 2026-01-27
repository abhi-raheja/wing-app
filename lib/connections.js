/**
 * Wing - Smart Connections Module
 * Detects and manages connections between wings
 */

import { makeApiRequest } from './api.js';
import * as db from './db.js';

// Connection score thresholds
const SCORE_THRESHOLD = 0.3; // Minimum score to create a connection
const HIGH_SCORE_THRESHOLD = 0.7; // High relevance threshold

// Connection types
export const CONNECTION_TYPES = {
  SEMANTIC: 'semantic', // AI-detected semantic similarity
  COLLECTION: 'collection', // Same collection
  MANUAL: 'manual', // User-created connection
};

/**
 * Generate a unique ID for connections
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Analyze connections for a newly created wing
 * @param {Object} newWing - The newly created wing
 * @returns {Promise<Array>} Array of created connections
 */
export async function analyzeConnectionsForWing(newWing) {
  try {
    // Get all existing wings
    const allWings = await db.getAllWings();
    const otherWings = allWings.filter((w) => w.id !== newWing.id);

    if (otherWings.length === 0) {
      return [];
    }

    // Calculate scores for each potential connection
    const connections = [];

    for (const otherWing of otherWings) {
      // Check if connection already exists
      const existing = await db.getConnectionBetween(newWing.id, otherWing.id);
      if (existing) continue;

      // Calculate combined score
      const score = await calculateConnectionScore(newWing, otherWing);

      if (score >= SCORE_THRESHOLD) {
        const connection = {
          id: generateId(),
          wingId1: newWing.id,
          wingId2: otherWing.id,
          score: score,
          type: CONNECTION_TYPES.SEMANTIC,
        };

        await db.createConnection(connection);
        connections.push(connection);
      }
    }

    return connections;
  } catch (error) {
    console.error('Error analyzing connections:', error);
    return [];
  }
}

/**
 * Calculate connection score between two wings
 * Combines multiple signals: semantic, collection, and highlight overlap
 * @param {Object} wing1 - First wing
 * @param {Object} wing2 - Second wing
 * @returns {Promise<number>} Score between 0 and 1
 */
async function calculateConnectionScore(wing1, wing2) {
  const scores = [];
  const weights = [];

  // 1. Collection proximity (same collection = bonus)
  const collectionScore = calculateCollectionProximity(wing1, wing2);
  if (collectionScore > 0) {
    scores.push(collectionScore);
    weights.push(0.2);
  }

  // 2. Domain similarity (same domain = bonus)
  const domainScore = calculateDomainSimilarity(wing1, wing2);
  if (domainScore > 0) {
    scores.push(domainScore);
    weights.push(0.15);
  }

  // 3. Semantic similarity (if both have summaries)
  if (wing1.summary && wing2.summary) {
    const semanticScore = await calculateSemanticSimilarity(wing1, wing2);
    scores.push(semanticScore);
    weights.push(0.65);
  } else {
    // If no summaries, rely more on other signals
    weights[0] = weights[0] ? weights[0] * 2 : 0;
    weights[1] = weights[1] ? weights[1] * 2 : 0;
  }

  // Calculate weighted average
  if (scores.length === 0) return 0;

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);

  return Math.min(1, weightedSum / totalWeight);
}

/**
 * Calculate collection proximity score
 * @param {Object} wing1 - First wing
 * @param {Object} wing2 - Second wing
 * @returns {number} Score between 0 and 1
 */
function calculateCollectionProximity(wing1, wing2) {
  const collections1 = wing1.collectionIds || [];
  const collections2 = wing2.collectionIds || [];

  if (collections1.length === 0 || collections2.length === 0) {
    return 0;
  }

  // Find shared collections
  const shared = collections1.filter((c) => collections2.includes(c));

  if (shared.length === 0) return 0;

  // Score based on proportion of shared collections
  const maxCollections = Math.max(collections1.length, collections2.length);
  return shared.length / maxCollections;
}

/**
 * Calculate domain similarity score
 * @param {Object} wing1 - First wing
 * @param {Object} wing2 - Second wing
 * @returns {number} Score between 0 and 1
 */
function calculateDomainSimilarity(wing1, wing2) {
  try {
    const url1 = new URL(wing1.url);
    const url2 = new URL(wing2.url);

    // Same domain = high score
    if (url1.hostname === url2.hostname) {
      return 0.8;
    }

    // Same root domain (e.g., blog.example.com and docs.example.com)
    const root1 = getRootDomain(url1.hostname);
    const root2 = getRootDomain(url2.hostname);

    if (root1 === root2) {
      return 0.5;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Extract root domain from hostname
 */
function getRootDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

/**
 * Calculate semantic similarity using AI
 * @param {Object} wing1 - First wing
 * @param {Object} wing2 - Second wing
 * @returns {Promise<number>} Score between 0 and 1
 */
async function calculateSemanticSimilarity(wing1, wing2) {
  try {
    const prompt = `Compare these two web page summaries and rate their topical/semantic similarity on a scale of 0.0 to 1.0.
Only respond with a single decimal number between 0.0 and 1.0, nothing else.

Page 1: "${wing1.title}"
Summary: ${wing1.summary}

Page 2: "${wing2.title}"
Summary: ${wing2.summary}

Similarity score (0.0 to 1.0):`;

    const result = await makeApiRequest({
      prompt,
      maxTokens: 10,
    });

    const score = parseFloat(result.text.trim());
    if (isNaN(score) || score < 0 || score > 1) {
      return 0;
    }

    return score;
  } catch (error) {
    console.error('Error calculating semantic similarity:', error);
    return 0;
  }
}

/**
 * Batch analyze connections for multiple wings
 * More efficient than analyzing one at a time
 * @param {Array} wings - Array of wings to analyze
 * @returns {Promise<Array>} Array of created connections
 */
export async function batchAnalyzeConnections(wings) {
  if (wings.length < 2) return [];

  const connections = [];
  const wingsWithSummaries = wings.filter((w) => w.summary);

  // If we have enough wings with summaries, use batch API analysis
  if (wingsWithSummaries.length >= 2) {
    try {
      const batchConnections = await batchSemanticAnalysis(wingsWithSummaries);
      connections.push(...batchConnections);
    } catch (error) {
      console.error('Batch analysis failed, falling back to individual:', error);
    }
  }

  // Analyze collection and domain connections for all wings
  for (let i = 0; i < wings.length; i++) {
    for (let j = i + 1; j < wings.length; j++) {
      const wing1 = wings[i];
      const wing2 = wings[j];

      // Check if already connected
      const existing = await db.getConnectionBetween(wing1.id, wing2.id);
      if (existing) continue;

      // Check if already in our batch results
      const inBatch = connections.find(
        (c) =>
          (c.wingId1 === wing1.id && c.wingId2 === wing2.id) ||
          (c.wingId1 === wing2.id && c.wingId2 === wing1.id)
      );
      if (inBatch) continue;

      // Calculate non-semantic scores
      const collectionScore = calculateCollectionProximity(wing1, wing2);
      const domainScore = calculateDomainSimilarity(wing1, wing2);
      const combinedScore = collectionScore * 0.6 + domainScore * 0.4;

      if (combinedScore >= SCORE_THRESHOLD) {
        const connection = {
          id: generateId(),
          wingId1: wing1.id,
          wingId2: wing2.id,
          score: combinedScore,
          type: CONNECTION_TYPES.COLLECTION,
        };
        connections.push(connection);
      }
    }
  }

  // Save all connections to database
  if (connections.length > 0) {
    await db.batchUpsertConnections(connections);
  }

  return connections;
}

/**
 * Batch semantic analysis using a single API call
 * @param {Array} wings - Wings with summaries
 * @returns {Promise<Array>} Array of connections
 */
async function batchSemanticAnalysis(wings) {
  if (wings.length < 2) return [];

  // Build compact representation for API
  const wingsList = wings
    .map((w, i) => `[${i}] "${w.title}": ${w.summary?.substring(0, 200)}`)
    .join('\n');

  const prompt = `Analyze these web pages and identify which pairs are semantically related (same topic, complementary information, etc.).

${wingsList}

List only the pairs with similarity >= 0.4. Format each line as: index1,index2,score
Example: 0,2,0.75

Only output the pairs, one per line, nothing else. If no pairs meet the threshold, output "none".`;

  try {
    const result = await makeApiRequest({
      prompt,
      maxTokens: 500,
    });

    const connections = [];
    const lines = result.text.trim().split('\n');

    for (const line of lines) {
      if (line.toLowerCase() === 'none') break;

      const parts = line.split(',').map((p) => p.trim());
      if (parts.length !== 3) continue;

      const idx1 = parseInt(parts[0]);
      const idx2 = parseInt(parts[1]);
      const score = parseFloat(parts[2]);

      if (
        isNaN(idx1) ||
        isNaN(idx2) ||
        isNaN(score) ||
        idx1 < 0 ||
        idx2 < 0 ||
        idx1 >= wings.length ||
        idx2 >= wings.length ||
        score < SCORE_THRESHOLD
      ) {
        continue;
      }

      connections.push({
        id: generateId(),
        wingId1: wings[idx1].id,
        wingId2: wings[idx2].id,
        score: Math.min(1, score),
        type: CONNECTION_TYPES.SEMANTIC,
      });
    }

    return connections;
  } catch (error) {
    console.error('Batch semantic analysis error:', error);
    return [];
  }
}

/**
 * Create a manual connection between two wings
 * @param {string} wingId1 - First wing ID
 * @param {string} wingId2 - Second wing ID
 * @returns {Promise<Object>} Created connection
 */
export async function createManualConnection(wingId1, wingId2) {
  // Check if already connected
  const existing = await db.getConnectionBetween(wingId1, wingId2);
  if (existing) {
    // Update to manual type with max score
    return await db.updateConnection(existing.id, {
      type: CONNECTION_TYPES.MANUAL,
      score: 1.0,
    });
  }

  const connection = {
    id: generateId(),
    wingId1,
    wingId2,
    score: 1.0,
    type: CONNECTION_TYPES.MANUAL,
  };

  return await db.createConnection(connection);
}

/**
 * Remove a connection between two wings
 * @param {string} wingId1 - First wing ID
 * @param {string} wingId2 - Second wing ID
 * @returns {Promise<boolean>} True if removed
 */
export async function removeConnection(wingId1, wingId2) {
  const existing = await db.getConnectionBetween(wingId1, wingId2);
  if (existing) {
    await db.deleteConnection(existing.id);
    return true;
  }
  return false;
}

/**
 * Get related wings for a specific wing
 * @param {string} wingId - Wing ID
 * @returns {Promise<Array>} Array of related wings with scores
 */
export async function getRelatedWings(wingId) {
  const connections = await db.getConnectionsForWing(wingId);

  if (connections.length === 0) {
    return [];
  }

  // Get the other wing IDs
  const relatedWingIds = connections.map((conn) =>
    conn.wingId1 === wingId ? conn.wingId2 : conn.wingId1
  );

  // Fetch wing details
  const relatedWings = [];
  for (const id of relatedWingIds) {
    const wing = await db.getWing(id);
    if (wing) {
      const conn = connections.find(
        (c) => c.wingId1 === id || c.wingId2 === id
      );
      relatedWings.push({
        ...wing,
        connectionScore: conn?.score || 0,
        connectionType: conn?.type || CONNECTION_TYPES.SEMANTIC,
        connectionId: conn?.id,
      });
    }
  }

  // Sort by score descending
  return relatedWings.sort((a, b) => b.connectionScore - a.connectionScore);
}

/**
 * Refresh connections for a wing (re-analyze)
 * @param {string} wingId - Wing ID
 * @returns {Promise<Array>} Updated connections
 */
export async function refreshConnections(wingId) {
  // Delete existing connections
  await db.deleteConnectionsForWing(wingId);

  // Get the wing
  const wing = await db.getWing(wingId);
  if (!wing) return [];

  // Re-analyze
  return await analyzeConnectionsForWing(wing);
}

/**
 * Get connection statistics
 * @returns {Promise<Object>} Stats object
 */
export async function getConnectionStats() {
  const connections = await db.getAllConnections();
  const wings = await db.getAllWings();

  const avgScore =
    connections.length > 0
      ? connections.reduce((sum, c) => sum + c.score, 0) / connections.length
      : 0;

  const typeCount = connections.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  const highScoreCount = connections.filter(
    (c) => c.score >= HIGH_SCORE_THRESHOLD
  ).length;

  return {
    totalConnections: connections.length,
    totalWings: wings.length,
    averageScore: avgScore,
    highScoreConnections: highScoreCount,
    connectionsByType: typeCount,
  };
}
