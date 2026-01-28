/**
 * IndexedDB Mock for Jest Testing
 * Simulates IndexedDB behavior for testing lib/db.js
 */

class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  _resolve(result) {
    this.result = result;
    if (this.onsuccess) {
      this.onsuccess({ target: this });
    }
  }

  _reject(error) {
    this.error = error;
    if (this.onerror) {
      this.onerror({ target: this });
    }
  }
}

class MockIDBCursor {
  constructor(data, index = 0, store) {
    this._data = data;
    this._index = index;
    this._store = store;
    this.value = data[index] || null;
    this.key = this.value?.id || null;
  }

  continue() {
    this._index++;
    if (this._index < this._data.length) {
      this.value = this._data[this._index];
      this.key = this.value?.id || null;
    } else {
      this.value = null;
      this.key = null;
    }
  }

  delete() {
    if (this.value) {
      const id = this.value.id;
      this._store._deleteById(id);
    }
  }

  update(newValue) {
    if (this.value) {
      const id = this.value.id;
      this._store._updateById(id, newValue);
    }
  }
}

class MockIDBIndex {
  constructor(store, keyPath, options = {}) {
    this._store = store;
    this._keyPath = keyPath;
    this._multiEntry = options.multiEntry || false;
  }

  get(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const data = this._store._getData();
      let results;

      if (this._multiEntry && Array.isArray(key)) {
        results = data.filter(item => {
          const value = item[this._keyPath];
          return Array.isArray(value) && value.includes(key);
        });
      } else {
        results = data.filter(item => {
          const value = item[this._keyPath];
          if (Array.isArray(value)) {
            return value.includes(key);
          }
          return value === key;
        });
      }

      request._resolve(results[0]);
    }, 0);
    return request;
  }

  getAll(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      let data = this._store._getData();

      if (key !== undefined) {
        if (this._multiEntry) {
          data = data.filter(item => {
            const value = item[this._keyPath];
            if (Array.isArray(value)) {
              return value.includes(key);
            }
            return value === key;
          });
        } else {
          data = data.filter(item => item[this._keyPath] === key);
        }
      }

      request._resolve(data);
    }, 0);
    return request;
  }

  openCursor(range) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      let data = this._store._getData();

      if (range) {
        const key = range._value;
        if (this._multiEntry) {
          data = data.filter(item => {
            const value = item[this._keyPath];
            if (Array.isArray(value)) {
              return value.includes(key);
            }
            return value === key;
          });
        } else {
          data = data.filter(item => item[this._keyPath] === key);
        }
      }

      if (data.length > 0) {
        request._resolve(new MockIDBCursor(data, 0, this._store));
      } else {
        request._resolve(null);
      }
    }, 0);
    return request;
  }
}

class MockIDBObjectStore {
  constructor(name, keyPath) {
    this._name = name;
    this._keyPath = keyPath;
    this._data = [];
    this._indexes = new Map();
    this.indexNames = {
      contains: (name) => this._indexes.has(name)
    };
  }

  _getData() {
    return [...this._data];
  }

  _setData(data) {
    this._data = [...data];
  }

  _deleteById(id) {
    this._data = this._data.filter(item => item.id !== id);
  }

  _updateById(id, newValue) {
    const index = this._data.findIndex(item => item.id === id);
    if (index !== -1) {
      this._data[index] = { ...newValue };
    }
  }

  createIndex(name, keyPath, options) {
    const index = new MockIDBIndex(this, keyPath, options);
    this._indexes.set(name, index);
    return index;
  }

  deleteIndex(name) {
    this._indexes.delete(name);
  }

  index(name) {
    return this._indexes.get(name);
  }

  add(value) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const exists = this._data.some(item => item[this._keyPath] === value[this._keyPath]);
      if (exists) {
        request._reject(new Error('Key already exists'));
      } else {
        this._data.push({ ...value });
        request._resolve(value[this._keyPath]);
      }
    }, 0);
    return request;
  }

  put(value) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const index = this._data.findIndex(item => item[this._keyPath] === value[this._keyPath]);
      if (index !== -1) {
        this._data[index] = { ...value };
      } else {
        this._data.push({ ...value });
      }
      request._resolve(value[this._keyPath]);
    }, 0);
    return request;
  }

  get(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const item = this._data.find(item => item[this._keyPath] === key);
      request._resolve(item);
    }, 0);
    return request;
  }

  getAll() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request._resolve([...this._data]);
    }, 0);
    return request;
  }

  delete(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this._data = this._data.filter(item => item[this._keyPath] !== key);
      request._resolve();
    }, 0);
    return request;
  }

  clear() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this._data = [];
      request._resolve();
    }, 0);
    return request;
  }

  openCursor() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      if (this._data.length > 0) {
        request._resolve(new MockIDBCursor(this._data, 0, this));
      } else {
        request._resolve(null);
      }
    }, 0);
    return request;
  }
}

class MockIDBTransaction {
  constructor(db, storeNames, mode) {
    this._db = db;
    this._storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    this._mode = mode;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;

    // Auto-complete after event loop
    setTimeout(() => {
      if (this.oncomplete) {
        this.oncomplete({ target: this });
      }
    }, 10);
  }

  objectStore(name) {
    return this._db._stores.get(name);
  }
}

class MockIDBDatabase {
  constructor(name, version) {
    this._name = name;
    this._version = version;
    this._stores = new Map();
    this.objectStoreNames = {
      contains: (name) => this._stores.has(name)
    };
  }

  createObjectStore(name, options = {}) {
    const store = new MockIDBObjectStore(name, options.keyPath || 'id');
    this._stores.set(name, store);
    return store;
  }

  deleteObjectStore(name) {
    this._stores.delete(name);
  }

  transaction(storeNames, mode = 'readonly') {
    return new MockIDBTransaction(this, storeNames, mode);
  }

  close() {
    // No-op for mock
  }
}

class MockIDBKeyRange {
  constructor(value) {
    this._value = value;
  }

  static only(value) {
    return new MockIDBKeyRange(value);
  }

  static bound(lower, upper, lowerOpen, upperOpen) {
    return new MockIDBKeyRange({ lower, upper, lowerOpen, upperOpen });
  }

  static lowerBound(value, open) {
    return new MockIDBKeyRange({ lower: value, open });
  }

  static upperBound(value, open) {
    return new MockIDBKeyRange({ upper: value, open });
  }
}

// Database storage
const databases = new Map();

const mockIndexedDB = {
  open: (name, version) => {
    const request = new MockIDBRequest();

    setTimeout(() => {
      const existingDb = databases.get(name);
      const isUpgrade = !existingDb || (existingDb && existingDb._version < version);

      let db;
      if (existingDb && existingDb._version >= version) {
        db = existingDb;
      } else {
        db = new MockIDBDatabase(name, version);
        databases.set(name, db);
      }

      if (isUpgrade && request.onupgradeneeded) {
        request.onupgradeneeded({
          target: { result: db, transaction: new MockIDBTransaction(db, [], 'versionchange') },
          oldVersion: existingDb?._version || 0,
          newVersion: version
        });
      }

      request._resolve(db);
    }, 0);

    return request;
  },

  deleteDatabase: (name) => {
    const request = new MockIDBRequest();
    setTimeout(() => {
      databases.delete(name);
      request._resolve();
    }, 0);
    return request;
  },

  // Helper for testing
  _clearAll: () => {
    databases.clear();
  },

  _getDatabase: (name) => databases.get(name)
};

export default mockIndexedDB;
export { MockIDBDatabase, MockIDBObjectStore, MockIDBTransaction, MockIDBKeyRange };
