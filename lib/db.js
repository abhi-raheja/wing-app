/**
 * Wing - IndexedDB Database Layer
 * Handles all local data storage operations
 */

const DB_NAME = 'WingDB';
const DB_VERSION = 2;

let db = null;

/**
 * Initialize the database connection
 * @returns {Promise<IDBDatabase>}
 */
export async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database: ' + request.error));
    };

    request.onsuccess = async () => {
      db = request.result;
      // Run migration for existing data
      try {
        await migrateWingsToArrays();
      } catch (e) {
        console.warn('Migration warning:', e);
      }
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const oldVersion = event.oldVersion;

      // Wings store
      if (!database.objectStoreNames.contains('wings')) {
        const wingsStore = database.createObjectStore('wings', { keyPath: 'id' });
        wingsStore.createIndex('url', 'url', { unique: false });
        wingsStore.createIndex('timestamp', 'timestamp', { unique: false });
        // Use multiEntry indexes for arrays
        wingsStore.createIndex('collectionIds', 'collectionIds', { unique: false, multiEntry: true });
        wingsStore.createIndex('nestIds', 'nestIds', { unique: false, multiEntry: true });
      } else if (oldVersion < 2) {
        // Migration from v1 to v2: update indexes for array support
        const transaction = event.target.transaction;
        const wingsStore = transaction.objectStore('wings');

        // Remove old indexes if they exist
        if (wingsStore.indexNames.contains('collectionId')) {
          wingsStore.deleteIndex('collectionId');
        }
        if (wingsStore.indexNames.contains('nestId')) {
          wingsStore.deleteIndex('nestId');
        }

        // Create new multiEntry indexes
        if (!wingsStore.indexNames.contains('collectionIds')) {
          wingsStore.createIndex('collectionIds', 'collectionIds', { unique: false, multiEntry: true });
        }
        if (!wingsStore.indexNames.contains('nestIds')) {
          wingsStore.createIndex('nestIds', 'nestIds', { unique: false, multiEntry: true });
        }
      }

      // Collections store
      if (!database.objectStoreNames.contains('collections')) {
        const collectionsStore = database.createObjectStore('collections', { keyPath: 'id' });
        collectionsStore.createIndex('name', 'name', { unique: false });
        collectionsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Nests store
      if (!database.objectStoreNames.contains('nests')) {
        const nestsStore = database.createObjectStore('nests', { keyPath: 'id' });
        nestsStore.createIndex('collectionId', 'collectionId', { unique: false });
        nestsStore.createIndex('parentId', 'parentId', { unique: false });
        nestsStore.createIndex('name', 'name', { unique: false });
      }

      // Highlights store
      if (!database.objectStoreNames.contains('highlights')) {
        const highlightsStore = database.createObjectStore('highlights', { keyPath: 'id' });
        highlightsStore.createIndex('wingId', 'wingId', { unique: false });
        highlightsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Migrate wings from old schema (single collectionId/nestId) to new (arrays)
 * Called automatically after DB upgrade
 */
async function migrateWingsToArrays() {
  const store = await getStore('wings', 'readwrite');
  const allWings = await promisifyRequest(store.getAll());

  for (const wing of allWings) {
    let needsUpdate = false;

    // Migrate collectionId to collectionIds
    if (wing.collectionId !== undefined || !wing.collectionIds) {
      wing.collectionIds = wing.collectionId ? [wing.collectionId] : [];
      delete wing.collectionId;
      needsUpdate = true;
    }

    // Migrate nestId to nestIds
    if (wing.nestId !== undefined || !wing.nestIds) {
      wing.nestIds = wing.nestId ? [wing.nestId] : [];
      delete wing.nestId;
      needsUpdate = true;
    }

    if (needsUpdate) {
      const updateStore = await getStore('wings', 'readwrite');
      await promisifyRequest(updateStore.put(wing));
    }
  }
}

/**
 * Generic store operations wrapper
 */
async function getStore(storeName, mode = 'readonly') {
  await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * Wrap IDBRequest in a Promise
 */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// COLLECTIONS CRUD
// ============================================

/**
 * Create a new collection
 * @param {Object} collection - Collection data
 * @returns {Promise<Object>} Created collection
 */
export async function createCollection(collection) {
  const store = await getStore('collections', 'readwrite');
  const data = {
    ...collection,
    createdAt: Date.now(),
  };
  await promisifyRequest(store.add(data));
  return data;
}

/**
 * Get all collections
 * @returns {Promise<Array>} Array of collections
 */
export async function getAllCollections() {
  const store = await getStore('collections');
  return promisifyRequest(store.getAll());
}

/**
 * Get a collection by ID
 * @param {string} id - Collection ID
 * @returns {Promise<Object|undefined>} Collection or undefined
 */
export async function getCollection(id) {
  const store = await getStore('collections');
  return promisifyRequest(store.get(id));
}

/**
 * Update a collection
 * @param {string} id - Collection ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated collection
 */
export async function updateCollection(id, updates) {
  const store = await getStore('collections', 'readwrite');
  const collection = await promisifyRequest(store.get(id));
  if (!collection) throw new Error('Collection not found');

  const updated = { ...collection, ...updates };
  await promisifyRequest(store.put(updated));
  return updated;
}

/**
 * Delete a collection and its associated nests
 * Wings are updated to remove the collection from their collectionIds array
 * @param {string} id - Collection ID
 */
export async function deleteCollection(id) {
  await initDB();
  const transaction = db.transaction(['collections', 'nests', 'wings'], 'readwrite');

  // Delete the collection
  transaction.objectStore('collections').delete(id);

  // Get nests in this collection to also remove from wings
  const nestsStore = transaction.objectStore('nests');
  const nestsIndex = nestsStore.index('collectionId');
  const nestIdsToRemove = [];

  const nestsRequest = nestsIndex.openCursor(IDBKeyRange.only(id));

  nestsRequest.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      nestIdsToRemove.push(cursor.value.id);
      cursor.delete();
      cursor.continue();
    }
  };

  // Update wings - remove collection and its nests from arrays
  const wingsStore = transaction.objectStore('wings');
  const wingsIndex = wingsStore.index('collectionIds');
  const wingsRequest = wingsIndex.openCursor(IDBKeyRange.only(id));

  wingsRequest.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const wing = cursor.value;
      wing.collectionIds = (wing.collectionIds || []).filter((cid) => cid !== id);
      wing.nestIds = (wing.nestIds || []).filter((nid) => !nestIdsToRemove.includes(nid));
      cursor.update(wing);
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================
// NESTS CRUD
// ============================================

/**
 * Create a new nest
 * @param {Object} nest - Nest data
 * @returns {Promise<Object>} Created nest
 */
export async function createNest(nest) {
  const store = await getStore('nests', 'readwrite');
  const data = {
    ...nest,
    createdAt: Date.now(),
  };
  await promisifyRequest(store.add(data));
  return data;
}

/**
 * Get all nests
 * @returns {Promise<Array>} Array of nests
 */
export async function getAllNests() {
  const store = await getStore('nests');
  return promisifyRequest(store.getAll());
}

/**
 * Get nests by collection ID
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Array>} Array of nests
 */
export async function getNestsByCollection(collectionId) {
  const store = await getStore('nests');
  const index = store.index('collectionId');
  return promisifyRequest(index.getAll(collectionId));
}

/**
 * Get nests by parent ID (for nested structure)
 * @param {string|null} parentId - Parent nest ID (null for root level)
 * @returns {Promise<Array>} Array of nests
 */
export async function getNestsByParent(parentId) {
  const store = await getStore('nests');
  const index = store.index('parentId');
  return promisifyRequest(index.getAll(parentId || null));
}

/**
 * Get a nest by ID
 * @param {string} id - Nest ID
 * @returns {Promise<Object|undefined>} Nest or undefined
 */
export async function getNest(id) {
  const store = await getStore('nests');
  return promisifyRequest(store.get(id));
}

/**
 * Update a nest
 * @param {string} id - Nest ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated nest
 */
export async function updateNest(id, updates) {
  const store = await getStore('nests', 'readwrite');
  const nest = await promisifyRequest(store.get(id));
  if (!nest) throw new Error('Nest not found');

  const updated = { ...nest, ...updates };
  await promisifyRequest(store.put(updated));
  return updated;
}

/**
 * Delete a nest and update its children
 * Wings are updated to remove the nest from their nestIds array
 * @param {string} id - Nest ID
 */
export async function deleteNest(id) {
  await initDB();
  const transaction = db.transaction(['nests', 'wings'], 'readwrite');
  const nestsStore = transaction.objectStore('nests');
  const wingsStore = transaction.objectStore('wings');

  // Get the nest to find its parent
  const nestRequest = nestsStore.get(id);

  nestRequest.onsuccess = () => {
    const nest = nestRequest.result;
    if (!nest) return;

    // Move child nests to parent
    const childNestsIndex = nestsStore.index('parentId');
    const childNestsRequest = childNestsIndex.openCursor(IDBKeyRange.only(id));

    childNestsRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const childNest = cursor.value;
        childNest.parentId = nest.parentId;
        cursor.update(childNest);
        cursor.continue();
      }
    };

    // Update wings - remove nest from their nestIds array
    const wingsIndex = wingsStore.index('nestIds');
    const wingsRequest = wingsIndex.openCursor(IDBKeyRange.only(id));

    wingsRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const wing = cursor.value;
        wing.nestIds = (wing.nestIds || []).filter((nid) => nid !== id);
        cursor.update(wing);
        cursor.continue();
      }
    };

    // Delete the nest
    nestsStore.delete(id);
  };

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================
// WINGS CRUD
// ============================================

/**
 * Create a new wing (bookmark)
 * @param {Object} wing - Wing data
 * @returns {Promise<Object>} Created wing
 */
export async function createWing(wing) {
  const store = await getStore('wings', 'readwrite');
  const data = {
    ...wing,
    // Ensure arrays for collections and nests
    collectionIds: wing.collectionIds || [],
    nestIds: wing.nestIds || [],
    timestamp: Date.now(),
    highlights: [],
    connections: [],
  };
  // Remove old single-value fields if present
  delete data.collectionId;
  delete data.nestId;
  await promisifyRequest(store.add(data));
  return data;
}

/**
 * Get all wings
 * @returns {Promise<Array>} Array of wings
 */
export async function getAllWings() {
  const store = await getStore('wings');
  return promisifyRequest(store.getAll());
}

/**
 * Get wings by collection ID
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Array>} Array of wings
 */
export async function getWingsByCollection(collectionId) {
  const store = await getStore('wings');
  const index = store.index('collectionIds');
  return promisifyRequest(index.getAll(collectionId));
}

/**
 * Get wings by nest ID
 * @param {string} nestId - Nest ID
 * @returns {Promise<Array>} Array of wings
 */
export async function getWingsByNest(nestId) {
  const store = await getStore('wings');
  const index = store.index('nestIds');
  return promisifyRequest(index.getAll(nestId));
}

/**
 * Get a wing by URL
 * @param {string} url - Page URL
 * @returns {Promise<Object|undefined>} Wing or undefined
 */
export async function getWingByUrl(url) {
  const store = await getStore('wings');
  const index = store.index('url');
  const results = await promisifyRequest(index.getAll(url));
  return results[0];
}

/**
 * Get a wing by ID
 * @param {string} id - Wing ID
 * @returns {Promise<Object|undefined>} Wing or undefined
 */
export async function getWing(id) {
  const store = await getStore('wings');
  return promisifyRequest(store.get(id));
}

/**
 * Update a wing
 * @param {string} id - Wing ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated wing
 */
export async function updateWing(id, updates) {
  const store = await getStore('wings', 'readwrite');
  const wing = await promisifyRequest(store.get(id));
  if (!wing) throw new Error('Wing not found');

  const updated = { ...wing, ...updates };
  await promisifyRequest(store.put(updated));
  return updated;
}

/**
 * Delete a wing and its highlights
 * @param {string} id - Wing ID
 */
export async function deleteWing(id) {
  await initDB();
  const transaction = db.transaction(['wings', 'highlights'], 'readwrite');

  // Delete the wing
  transaction.objectStore('wings').delete(id);

  // Delete associated highlights
  const highlightsStore = transaction.objectStore('highlights');
  const index = highlightsStore.index('wingId');
  const request = index.openCursor(IDBKeyRange.only(id));

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================
// HIGHLIGHTS CRUD
// ============================================

/**
 * Create a new highlight
 * @param {Object} highlight - Highlight data
 * @returns {Promise<Object>} Created highlight
 */
export async function createHighlight(highlight) {
  const store = await getStore('highlights', 'readwrite');
  const data = {
    ...highlight,
    timestamp: Date.now(),
  };
  await promisifyRequest(store.add(data));
  return data;
}

/**
 * Get highlights by wing ID
 * @param {string} wingId - Wing ID
 * @returns {Promise<Array>} Array of highlights
 */
export async function getHighlightsByWing(wingId) {
  const store = await getStore('highlights');
  const index = store.index('wingId');
  return promisifyRequest(index.getAll(wingId));
}

/**
 * Get a highlight by ID
 * @param {string} id - Highlight ID
 * @returns {Promise<Object|undefined>} Highlight or undefined
 */
export async function getHighlight(id) {
  const store = await getStore('highlights');
  return promisifyRequest(store.get(id));
}

/**
 * Update a highlight
 * @param {string} id - Highlight ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated highlight
 */
export async function updateHighlight(id, updates) {
  const store = await getStore('highlights', 'readwrite');
  const highlight = await promisifyRequest(store.get(id));
  if (!highlight) throw new Error('Highlight not found');

  const updated = { ...highlight, ...updates };
  await promisifyRequest(store.put(updated));
  return updated;
}

/**
 * Delete a highlight
 * @param {string} id - Highlight ID
 */
export async function deleteHighlight(id) {
  const store = await getStore('highlights', 'readwrite');
  await promisifyRequest(store.delete(id));
}

// ============================================
// EXPORT / IMPORT
// ============================================

/**
 * Export all data as JSON
 * @returns {Promise<Object>} All data
 */
export async function exportAllData() {
  const [collections, nests, wings, highlights] = await Promise.all([
    getAllCollections(),
    getAllNests(),
    getAllWings(),
    (async () => {
      const store = await getStore('highlights');
      return promisifyRequest(store.getAll());
    })(),
  ]);

  return {
    version: DB_VERSION,
    exportedAt: Date.now(),
    data: {
      collections,
      nests,
      wings,
      highlights,
    },
  };
}

/**
 * Import data from JSON
 * @param {Object} importData - Data to import
 * @param {boolean} replace - Whether to replace existing data
 */
export async function importData(importData, replace = false) {
  if (!importData.data) {
    throw new Error('Invalid import data format');
  }

  await initDB();
  const { collections, nests, wings, highlights } = importData.data;

  const transaction = db.transaction(
    ['collections', 'nests', 'wings', 'highlights'],
    'readwrite'
  );

  if (replace) {
    // Clear all stores
    transaction.objectStore('collections').clear();
    transaction.objectStore('nests').clear();
    transaction.objectStore('wings').clear();
    transaction.objectStore('highlights').clear();
  }

  // Import data
  const collectionsStore = transaction.objectStore('collections');
  const nestsStore = transaction.objectStore('nests');
  const wingsStore = transaction.objectStore('wings');
  const highlightsStore = transaction.objectStore('highlights');

  collections?.forEach((item) => collectionsStore.put(item));
  nests?.forEach((item) => nestsStore.put(item));
  wings?.forEach((item) => wingsStore.put(item));
  highlights?.forEach((item) => highlightsStore.put(item));

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Clear all data from the database
 */
export async function clearAllData() {
  await initDB();
  const transaction = db.transaction(
    ['collections', 'nests', 'wings', 'highlights'],
    'readwrite'
  );

  transaction.objectStore('collections').clear();
  transaction.objectStore('nests').clear();
  transaction.objectStore('wings').clear();
  transaction.objectStore('highlights').clear();

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================
// SEARCH
// ============================================

/**
 * Search wings by title or URL
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching wings
 */
export async function searchWings(query) {
  const wings = await getAllWings();
  const lowerQuery = query.toLowerCase();

  return wings.filter((wing) =>
    wing.title?.toLowerCase().includes(lowerQuery) ||
    wing.url?.toLowerCase().includes(lowerQuery) ||
    wing.summary?.toLowerCase().includes(lowerQuery)
  );
}
