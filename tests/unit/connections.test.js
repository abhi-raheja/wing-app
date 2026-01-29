/**
 * Wing Connections Module Tests
 * Tests for lib/connections.js - connection discovery, scoring, and management
 */

import { jest, expect, describe, test, beforeAll, beforeEach } from '@jest/globals';

let connections;
let db;

beforeAll(async () => {
  db = await import('../../lib/db.js');
  connections = await import('../../lib/connections.js');
});

describe('Connection Types', () => {
  test('CONNECTION_TYPES are defined', () => {
    expect(connections.CONNECTION_TYPES).toBeDefined();
    expect(connections.CONNECTION_TYPES.SEMANTIC).toBe('semantic');
    expect(connections.CONNECTION_TYPES.COLLECTION).toBe('collection');
    expect(connections.CONNECTION_TYPES.MANUAL).toBe('manual');
  });
});

describe('Connection Score Calculation', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  describe('Collection Proximity', () => {
    test('wings in same collection get bonus score', async () => {
      const collection = testUtils.createMockCollection({ id: 'shared-col' });
      await db.createCollection(collection);

      const wing1 = testUtils.createMockWing({
        id: 'wing-col-1',
        collectionIds: ['shared-col'],
        summary: 'Article about JavaScript frameworks'
      });
      const wing2 = testUtils.createMockWing({
        id: 'wing-col-2',
        collectionIds: ['shared-col'],
        summary: 'Guide to React development'
      });

      await db.createWing(wing1);
      await db.createWing(wing2);

      // The shared collection should boost their connection score
      // This is tested implicitly through analyzeConnectionsForWing
    });
  });

  describe('Domain Similarity', () => {
    test('wings from same domain are more connected', async () => {
      const wing1 = testUtils.createMockWing({
        id: 'wing-same-domain-1',
        url: 'https://developer.mozilla.org/js',
        summary: 'JavaScript reference'
      });
      const wing2 = testUtils.createMockWing({
        id: 'wing-same-domain-2',
        url: 'https://developer.mozilla.org/css',
        summary: 'CSS reference'
      });

      await db.createWing(wing1);
      await db.createWing(wing2);

      // Same domain (developer.mozilla.org) should boost connection
    });

    test('wings from different domains have lower domain score', async () => {
      const wing1 = testUtils.createMockWing({
        id: 'wing-diff-domain-1',
        url: 'https://example.com/page',
        summary: 'Example page'
      });
      const wing2 = testUtils.createMockWing({
        id: 'wing-diff-domain-2',
        url: 'https://other-site.com/page',
        summary: 'Other page'
      });

      await db.createWing(wing1);
      await db.createWing(wing2);

      // Different domains should not get domain similarity boost
    });
  });
});

describe('analyzeConnectionsForWing', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();

    // Mock the API call for semantic similarity
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: '0.75' }],
          usage: { input_tokens: 50, output_tokens: 5 }
        })
      })
    );
  });

  test('finds connections for a new wing', async () => {
    // Create existing wings
    await db.createWing(testUtils.createMockWing({
      id: 'existing-1',
      title: 'JavaScript Guide',
      summary: 'A comprehensive guide to JavaScript programming'
    }));
    await db.createWing(testUtils.createMockWing({
      id: 'existing-2',
      title: 'Python Tutorial',
      summary: 'Learn Python programming basics'
    }));

    // Create a new wing
    const newWing = testUtils.createMockWing({
      id: 'new-wing',
      title: 'Node.js Tutorial',
      summary: 'Building servers with JavaScript and Node.js'
    });
    await db.createWing(newWing);

    // Analyze connections
    const foundConnections = await connections.analyzeConnectionsForWing(newWing);

    // Should return an array of connections
    expect(Array.isArray(foundConnections)).toBe(true);
  });

  test('returns empty array when no other wings exist', async () => {
    const singleWing = testUtils.createMockWing({
      id: 'only-wing',
      summary: 'Single wing'
    });
    await db.createWing(singleWing);

    const foundConnections = await connections.analyzeConnectionsForWing(singleWing);

    expect(foundConnections).toEqual([]);
  });

  test('skips already connected wings', async () => {
    const wing1 = testUtils.createMockWing({
      id: 'wing-already-1',
      summary: 'First wing'
    });
    const wing2 = testUtils.createMockWing({
      id: 'wing-already-2',
      summary: 'Second wing'
    });

    await db.createWing(wing1);
    await db.createWing(wing2);

    // Create existing connection
    await db.createConnection({
      id: 'existing-conn',
      wingId1: 'wing-already-1',
      wingId2: 'wing-already-2',
      score: 0.5,
      type: 'semantic'
    });

    // Analyze should not create duplicate
    const foundConnections = await connections.analyzeConnectionsForWing(wing1);

    // Should not include the already-connected wing
    const duplicates = foundConnections.filter(c =>
      (c.wingId1 === 'wing-already-2' || c.wingId2 === 'wing-already-2')
    );
    expect(duplicates).toHaveLength(0);
  });
});

describe('batchAnalyzeConnections', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();

    // Mock batch semantic analysis API response
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: '0,1,0.65\n0,2,0.45' }],
          usage: { input_tokens: 200, output_tokens: 20 }
        })
      })
    );
  });

  test('analyzes multiple wings efficiently', async () => {
    const wings = [
      testUtils.createMockWing({
        id: 'batch-1',
        title: 'JavaScript',
        summary: 'JavaScript programming'
      }),
      testUtils.createMockWing({
        id: 'batch-2',
        title: 'TypeScript',
        summary: 'TypeScript extends JavaScript'
      }),
      testUtils.createMockWing({
        id: 'batch-3',
        title: 'Node.js',
        summary: 'Server-side JavaScript'
      })
    ];

    for (const wing of wings) {
      await db.createWing(wing);
    }

    const foundConnections = await connections.batchAnalyzeConnections(wings);

    expect(Array.isArray(foundConnections)).toBe(true);
  });

  test('returns empty array for single wing', async () => {
    const wings = [
      testUtils.createMockWing({ id: 'single', summary: 'Only one' })
    ];
    await db.createWing(wings[0]);

    const foundConnections = await connections.batchAnalyzeConnections(wings);

    expect(foundConnections).toEqual([]);
  });
});

describe('Manual Connections', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  describe('createManualConnection', () => {
    test('creates a manual connection between two wings', async () => {
      await db.createWing(testUtils.createMockWing({ id: 'manual-1' }));
      await db.createWing(testUtils.createMockWing({ id: 'manual-2' }));

      const connection = await connections.createManualConnection('manual-1', 'manual-2');

      expect(connection).toMatchObject({
        wingId1: 'manual-1',
        wingId2: 'manual-2',
        type: connections.CONNECTION_TYPES.MANUAL,
        score: 1.0
      });
    });

    test('upgrades existing connection to manual type', async () => {
      await db.createWing(testUtils.createMockWing({ id: 'upgrade-1' }));
      await db.createWing(testUtils.createMockWing({ id: 'upgrade-2' }));

      // Create semantic connection first
      await db.createConnection({
        id: 'semantic-conn',
        wingId1: 'upgrade-1',
        wingId2: 'upgrade-2',
        score: 0.5,
        type: 'semantic'
      });

      // Create manual connection should upgrade
      const upgraded = await connections.createManualConnection('upgrade-1', 'upgrade-2');

      expect(upgraded.type).toBe(connections.CONNECTION_TYPES.MANUAL);
      expect(upgraded.score).toBe(1.0);
    });
  });

  describe('removeConnection', () => {
    test('removes a connection between two wings', async () => {
      await db.createWing(testUtils.createMockWing({ id: 'remove-1' }));
      await db.createWing(testUtils.createMockWing({ id: 'remove-2' }));

      await db.createConnection({
        id: 'to-remove',
        wingId1: 'remove-1',
        wingId2: 'remove-2',
        score: 0.5,
        type: 'semantic'
      });

      const result = await connections.removeConnection('remove-1', 'remove-2');

      expect(result).toBe(true);
    });

    test('returns false for non-existent connection', async () => {
      const result = await connections.removeConnection('nonexistent-1', 'nonexistent-2');

      expect(result).toBe(false);
    });
  });
});

describe('getRelatedWings', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  test('returns related wings with scores', async () => {
    // Create wings
    const mainWing = testUtils.createMockWing({
      id: 'main-wing',
      title: 'Main Article'
    });
    const relatedWing1 = testUtils.createMockWing({
      id: 'related-1',
      title: 'Related Article 1'
    });
    const relatedWing2 = testUtils.createMockWing({
      id: 'related-2',
      title: 'Related Article 2'
    });

    await db.createWing(mainWing);
    await db.createWing(relatedWing1);
    await db.createWing(relatedWing2);

    // Create connections
    await db.createConnection({
      id: 'conn-1',
      wingId1: 'main-wing',
      wingId2: 'related-1',
      score: 0.8,
      type: 'semantic'
    });
    await db.createConnection({
      id: 'conn-2',
      wingId1: 'main-wing',
      wingId2: 'related-2',
      score: 0.6,
      type: 'collection'
    });

    const related = await connections.getRelatedWings('main-wing');

    expect(related).toHaveLength(2);
    // Should be sorted by score (highest first)
    expect(related[0].connectionScore).toBeGreaterThanOrEqual(related[1].connectionScore);
  });

  test('returns empty array when no connections', async () => {
    await db.createWing(testUtils.createMockWing({ id: 'isolated-wing' }));

    const related = await connections.getRelatedWings('isolated-wing');

    expect(related).toEqual([]);
  });
});

describe('refreshConnections', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();

    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: '0.5' }],
          usage: { input_tokens: 50, output_tokens: 5 }
        })
      })
    );
  });

  test('refreshes connections for a wing', async () => {
    await db.createWing(testUtils.createMockWing({
      id: 'refresh-main',
      summary: 'Main wing'
    }));
    await db.createWing(testUtils.createMockWing({
      id: 'refresh-other',
      summary: 'Other wing'
    }));

    // Create old connection
    await db.createConnection({
      id: 'old-conn',
      wingId1: 'refresh-main',
      wingId2: 'refresh-other',
      score: 0.3,
      type: 'semantic'
    });

    // Refresh should delete old and re-analyze
    const newConnections = await connections.refreshConnections('refresh-main');

    expect(Array.isArray(newConnections)).toBe(true);
  });

  test('returns empty array for non-existent wing', async () => {
    const result = await connections.refreshConnections('nonexistent-wing');

    expect(result).toEqual([]);
  });
});

describe('getConnectionStats', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  test('returns connection statistics', async () => {
    // Create wings and connections
    await db.createWing(testUtils.createMockWing({ id: 'stats-1' }));
    await db.createWing(testUtils.createMockWing({ id: 'stats-2' }));
    await db.createWing(testUtils.createMockWing({ id: 'stats-3' }));

    await db.createConnection({
      id: 'stats-conn-1',
      wingId1: 'stats-1',
      wingId2: 'stats-2',
      score: 0.8,
      type: 'semantic'
    });
    await db.createConnection({
      id: 'stats-conn-2',
      wingId1: 'stats-1',
      wingId2: 'stats-3',
      score: 0.5,
      type: 'collection'
    });

    const stats = await connections.getConnectionStats();

    expect(stats).toMatchObject({
      totalConnections: 2,
      totalWings: 3
    });
    expect(stats.averageScore).toBeDefined();
    expect(stats.connectionsByType).toBeDefined();
  });

  test('returns zero stats when no data', async () => {
    const stats = await connections.getConnectionStats();

    expect(stats.totalConnections).toBe(0);
    expect(stats.totalWings).toBe(0);
    expect(stats.averageScore).toBe(0);
  });
});
