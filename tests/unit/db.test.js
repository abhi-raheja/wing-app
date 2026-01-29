/**
 * Wing Database Operations Tests
 * Tests for lib/db.js - CRUD operations for wings, collections, nests, highlights, connections
 */

import { jest, expect, describe, test, beforeAll, beforeEach } from '@jest/globals';

// Import db functions after mocks are set up
let db;

beforeAll(async () => {
  // Dynamic import after mocks are initialized
  db = await import('../../lib/db.js');
});

describe('Database Initialization', () => {
  test('initDB creates database successfully', async () => {
    await expect(db.initDB()).resolves.not.toThrow();
  });

  test('initDB can be called multiple times safely', async () => {
    await db.initDB();
    await expect(db.initDB()).resolves.not.toThrow();
  });
});

describe('Wing Operations', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  describe('createWing', () => {
    test('creates a wing with required fields', async () => {
      const wingData = testUtils.createMockWing({
        id: 'wing-test-1',
        url: 'https://example.com/page1',
        title: 'Test Page 1'
      });

      const result = await db.createWing(wingData);

      expect(result).toMatchObject({
        id: 'wing-test-1',
        url: 'https://example.com/page1',
        title: 'Test Page 1'
      });
      expect(result.timestamp).toBeDefined();
    });

    test('creates a wing with collections assigned', async () => {
      const collection = testUtils.createMockCollection({ id: 'col-1' });
      await db.createCollection(collection);

      const wingData = testUtils.createMockWing({
        id: 'wing-with-collection',
        collectionIds: ['col-1']
      });

      const result = await db.createWing(wingData);

      expect(result.collectionIds).toContain('col-1');
    });

    test('creates a wing without summary', async () => {
      const wingData = testUtils.createMockWing({
        id: 'wing-no-summary',
        summary: null
      });

      const result = await db.createWing(wingData);

      expect(result.summary).toBeNull();
    });
  });

  describe('getWing', () => {
    test('retrieves an existing wing by ID', async () => {
      const wingData = testUtils.createMockWing({ id: 'wing-get-test' });
      await db.createWing(wingData);

      const result = await db.getWing('wing-get-test');

      expect(result.id).toBe('wing-get-test');
    });

    test('returns undefined for non-existent wing', async () => {
      const result = await db.getWing('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('getWingByUrl', () => {
    test('retrieves a wing by URL', async () => {
      const wingData = testUtils.createMockWing({
        id: 'wing-url-test',
        url: 'https://unique-test-url.com/page'
      });
      await db.createWing(wingData);

      const result = await db.getWingByUrl('https://unique-test-url.com/page');

      expect(result).toBeDefined();
      expect(result.url).toBe('https://unique-test-url.com/page');
    });

    test('returns undefined for non-existent URL', async () => {
      const result = await db.getWingByUrl('https://non-existent.com');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllWings', () => {
    test('returns all wings', async () => {
      await db.createWing(testUtils.createMockWing({ id: 'wing-1' }));
      await db.createWing(testUtils.createMockWing({ id: 'wing-2' }));
      await db.createWing(testUtils.createMockWing({ id: 'wing-3' }));

      const result = await db.getAllWings();

      expect(result).toHaveLength(3);
    });

    test('returns empty array when no wings exist', async () => {
      const result = await db.getAllWings();

      expect(result).toEqual([]);
    });
  });

  describe('updateWing', () => {
    test('updates wing metadata', async () => {
      const wingData = testUtils.createMockWing({
        id: 'wing-update-test',
        title: 'Original Title'
      });
      await db.createWing(wingData);

      await db.updateWing('wing-update-test', { title: 'Updated Title' });

      const result = await db.getWing('wing-update-test');
      expect(result.title).toBe('Updated Title');
    });

    test('updates wing summary', async () => {
      const wingData = testUtils.createMockWing({
        id: 'wing-summary-update',
        summary: null
      });
      await db.createWing(wingData);

      await db.updateWing('wing-summary-update', {
        summary: 'New AI-generated summary'
      });

      const result = await db.getWing('wing-summary-update');
      expect(result.summary).toBe('New AI-generated summary');
    });

    test('updates wing collection assignments', async () => {
      const wingData = testUtils.createMockWing({
        id: 'wing-collection-update',
        collectionIds: []
      });
      await db.createWing(wingData);

      await db.updateWing('wing-collection-update', {
        collectionIds: ['col-1', 'col-2']
      });

      const result = await db.getWing('wing-collection-update');
      expect(result.collectionIds).toEqual(['col-1', 'col-2']);
    });
  });

  describe('deleteWing', () => {
    test('deletes an existing wing', async () => {
      await db.createWing(testUtils.createMockWing({ id: 'wing-to-delete' }));

      await db.deleteWing('wing-to-delete');

      const result = await db.getWing('wing-to-delete');
      expect(result).toBeUndefined();
    });

    test('handles deletion of non-existent wing gracefully', async () => {
      await expect(db.deleteWing('non-existent')).resolves.not.toThrow();
    });
  });
});

describe('Collection Operations', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  describe('createCollection', () => {
    test('creates a collection (nest) with name and color', async () => {
      const collectionData = testUtils.createMockCollection({
        id: 'col-test-1',
        name: 'Research',
        color: '#e91e63'
      });

      const result = await db.createCollection(collectionData);

      expect(result).toMatchObject({
        id: 'col-test-1',
        name: 'Research',
        color: '#e91e63'
      });
    });

    test('creates a collection with description', async () => {
      const collectionData = testUtils.createMockCollection({
        id: 'col-with-desc',
        description: 'Articles for my thesis'
      });

      const result = await db.createCollection(collectionData);

      expect(result.description).toBe('Articles for my thesis');
    });
  });

  describe('getAllCollections', () => {
    test('returns all collections', async () => {
      await db.createCollection(testUtils.createMockCollection({ id: 'col-1', name: 'Work' }));
      await db.createCollection(testUtils.createMockCollection({ id: 'col-2', name: 'Personal' }));

      const result = await db.getAllCollections();

      expect(result).toHaveLength(2);
    });
  });

  describe('updateCollection', () => {
    test('renames a collection', async () => {
      await db.createCollection(testUtils.createMockCollection({
        id: 'col-rename',
        name: 'Old Name'
      }));

      await db.updateCollection('col-rename', { name: 'New Name' });

      const collections = await db.getAllCollections();
      const updated = collections.find(c => c.id === 'col-rename');
      expect(updated.name).toBe('New Name');
    });

    test('updates collection color', async () => {
      await db.createCollection(testUtils.createMockCollection({
        id: 'col-color',
        color: '#000000'
      }));

      await db.updateCollection('col-color', { color: '#ff0000' });

      const collections = await db.getAllCollections();
      const updated = collections.find(c => c.id === 'col-color');
      expect(updated.color).toBe('#ff0000');
    });
  });

  describe('deleteCollection', () => {
    test('deletes a collection', async () => {
      await db.createCollection(testUtils.createMockCollection({ id: 'col-to-delete' }));

      await db.deleteCollection('col-to-delete');

      const collections = await db.getAllCollections();
      expect(collections.find(c => c.id === 'col-to-delete')).toBeUndefined();
    });

    test('wings remain after collection deletion (just unassigned)', async () => {
      const collection = testUtils.createMockCollection({ id: 'col-with-wings' });
      await db.createCollection(collection);

      const wing = testUtils.createMockWing({
        id: 'wing-in-collection',
        collectionIds: ['col-with-wings']
      });
      await db.createWing(wing);

      await db.deleteCollection('col-with-wings');

      // Wing should still exist
      const wingAfter = await db.getWing('wing-in-collection');
      expect(wingAfter).toBeDefined();
    });
  });
});

describe('Nest Operations', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  describe('createNest', () => {
    test('creates a nest within a collection', async () => {
      const collection = testUtils.createMockCollection({ id: 'parent-col' });
      await db.createCollection(collection);

      const nestData = testUtils.createMockNest({
        id: 'nest-test-1',
        name: 'JavaScript Articles',
        collectionId: 'parent-col'
      });

      const result = await db.createNest(nestData);

      expect(result).toMatchObject({
        id: 'nest-test-1',
        name: 'JavaScript Articles',
        collectionId: 'parent-col'
      });
    });

    test('creates a nested nest (child of another nest)', async () => {
      const collection = testUtils.createMockCollection({ id: 'col-for-nesting' });
      await db.createCollection(collection);

      const parentNest = testUtils.createMockNest({
        id: 'parent-nest',
        collectionId: 'col-for-nesting'
      });
      await db.createNest(parentNest);

      const childNest = testUtils.createMockNest({
        id: 'child-nest',
        name: 'React Hooks',
        collectionId: 'col-for-nesting',
        parentId: 'parent-nest'
      });

      const result = await db.createNest(childNest);

      expect(result.parentId).toBe('parent-nest');
    });
  });

  describe('getAllNests', () => {
    test('returns all nests', async () => {
      await db.createNest(testUtils.createMockNest({ id: 'nest-1' }));
      await db.createNest(testUtils.createMockNest({ id: 'nest-2' }));

      const result = await db.getAllNests();

      expect(result).toHaveLength(2);
    });
  });

  describe('updateNest', () => {
    test('renames a nest', async () => {
      await db.createNest(testUtils.createMockNest({
        id: 'nest-rename',
        name: 'Old Nest Name'
      }));

      await db.updateNest('nest-rename', { name: 'New Nest Name' });

      const nests = await db.getAllNests();
      const updated = nests.find(n => n.id === 'nest-rename');
      expect(updated.name).toBe('New Nest Name');
    });
  });

  describe('deleteNest', () => {
    test('deletes a nest', async () => {
      await db.createNest(testUtils.createMockNest({ id: 'nest-to-delete' }));

      await db.deleteNest('nest-to-delete');

      const nests = await db.getAllNests();
      expect(nests.find(n => n.id === 'nest-to-delete')).toBeUndefined();
    });
  });
});

describe('Highlight Operations', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  describe('createHighlight', () => {
    test('creates a highlight with annotation', async () => {
      const wing = testUtils.createMockWing({ id: 'wing-for-highlight' });
      await db.createWing(wing);

      const highlightData = testUtils.createMockHighlight({
        id: 'highlight-1',
        wingId: 'wing-for-highlight',
        selectedText: 'Important quote from the article',
        annotation: 'Key insight for my research'
      });

      const result = await db.createHighlight(highlightData);

      expect(result).toMatchObject({
        id: 'highlight-1',
        wingId: 'wing-for-highlight',
        selectedText: 'Important quote from the article'
      });
    });

    test('creates a highlight without annotation', async () => {
      const wing = testUtils.createMockWing({ id: 'wing-for-highlight-2' });
      await db.createWing(wing);

      const highlightData = testUtils.createMockHighlight({
        id: 'highlight-no-note',
        wingId: 'wing-for-highlight-2',
        annotation: null
      });

      const result = await db.createHighlight(highlightData);

      expect(result.annotation).toBeNull();
    });
  });

  describe('getHighlightsByWing', () => {
    test('retrieves all highlights for a wing', async () => {
      const wing = testUtils.createMockWing({ id: 'wing-with-highlights' });
      await db.createWing(wing);

      await db.createHighlight(testUtils.createMockHighlight({
        id: 'hl-1',
        wingId: 'wing-with-highlights'
      }));
      await db.createHighlight(testUtils.createMockHighlight({
        id: 'hl-2',
        wingId: 'wing-with-highlights'
      }));
      await db.createHighlight(testUtils.createMockHighlight({
        id: 'hl-3',
        wingId: 'other-wing'
      }));

      const result = await db.getHighlightsByWing('wing-with-highlights');

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteHighlight', () => {
    test('deletes a highlight', async () => {
      const wing = testUtils.createMockWing({ id: 'wing-hl-delete' });
      await db.createWing(wing);

      await db.createHighlight(testUtils.createMockHighlight({
        id: 'highlight-to-delete',
        wingId: 'wing-hl-delete'
      }));

      await db.deleteHighlight('highlight-to-delete');

      const highlights = await db.getHighlightsByWing('wing-hl-delete');
      expect(highlights).toHaveLength(0);
    });
  });
});

describe('Search and Filter', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();

    // Create test data
    await db.createWing(testUtils.createMockWing({
      id: 'wing-js',
      title: 'JavaScript Tutorial',
      url: 'https://js.dev/tutorial',
      summary: 'Learn JavaScript from scratch'
    }));

    await db.createWing(testUtils.createMockWing({
      id: 'wing-react',
      title: 'React Guide',
      url: 'https://react.dev/guide',
      summary: 'Building UIs with React and JavaScript'
    }));

    await db.createWing(testUtils.createMockWing({
      id: 'wing-python',
      title: 'Python Basics',
      url: 'https://python.org/basics',
      summary: 'Introduction to Python programming'
    }));
  });

  test('wings can be filtered by title content', async () => {
    const wings = await db.getAllWings();
    const filtered = wings.filter(w =>
      w.title.toLowerCase().includes('javascript')
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('wing-js');
  });

  test('wings can be filtered by URL content', async () => {
    const wings = await db.getAllWings();
    const filtered = wings.filter(w =>
      w.url.toLowerCase().includes('react')
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('wing-react');
  });

  test('wings can be filtered by summary content', async () => {
    const wings = await db.getAllWings();
    const filtered = wings.filter(w =>
      w.summary?.toLowerCase().includes('javascript')
    );

    expect(filtered).toHaveLength(2); // Both JS and React wings mention JavaScript
  });

  test('wings can be filtered by collection', async () => {
    const collection = testUtils.createMockCollection({ id: 'dev-col' });
    await db.createCollection(collection);

    // Assign wing-js and wing-react to the collection
    await db.updateWing('wing-js', { collectionIds: ['dev-col'] });
    await db.updateWing('wing-react', { collectionIds: ['dev-col'] });

    const wings = await db.getAllWings();
    const filtered = wings.filter(w =>
      w.collectionIds?.includes('dev-col')
    );

    expect(filtered).toHaveLength(2);
  });

  test('wings can be filtered by date', async () => {
    const wings = await db.getAllWings();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const filtered = wings.filter(w => w.timestamp > oneHourAgo);

    expect(filtered.length).toBeGreaterThan(0);
  });
});

describe('Data Export/Import', () => {
  beforeEach(async () => {
    await db.initDB();
    await db.clearAllData();
  });

  test('exportAllData returns complete data structure', async () => {
    // Create test data
    await db.createCollection(testUtils.createMockCollection({ id: 'export-col' }));
    await db.createWing(testUtils.createMockWing({ id: 'export-wing' }));

    const exported = await db.exportAllData();

    expect(exported).toHaveProperty('version');
    expect(exported).toHaveProperty('data');
    expect(exported.data).toHaveProperty('collections');
    expect(exported.data).toHaveProperty('wings');
  });

  test('importData restores data correctly', async () => {
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      data: {
        collections: [testUtils.createMockCollection({ id: 'import-col', name: 'Imported' })],
        nests: [],
        wings: [testUtils.createMockWing({ id: 'import-wing', title: 'Imported Wing' })],
        highlights: [],
        connections: []
      }
    };

    await db.importData(exportData, true);

    const collections = await db.getAllCollections();
    const wings = await db.getAllWings();

    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe('Imported');
    expect(wings).toHaveLength(1);
    expect(wings[0].title).toBe('Imported Wing');
  });

  test('clearAllData removes all data', async () => {
    await db.createCollection(testUtils.createMockCollection({ id: 'clear-col' }));
    await db.createWing(testUtils.createMockWing({ id: 'clear-wing' }));

    await db.clearAllData();

    const collections = await db.getAllCollections();
    const wings = await db.getAllWings();

    expect(collections).toHaveLength(0);
    expect(wings).toHaveLength(0);
  });
});
