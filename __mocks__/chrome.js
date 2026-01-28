/**
 * Chrome API Mock for Jest Testing
 * Mocks all Chrome APIs used by the Wing extension
 */

// Storage mock with in-memory data store
const createStorageMock = () => {
  let data = {};

  const mock = {
    get: (keys) => {
      return new Promise((resolve) => {
        if (keys === null || keys === undefined) {
          resolve({ ...data });
        } else if (typeof keys === 'string') {
          resolve({ [keys]: data[keys] });
        } else if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            if (data[key] !== undefined) {
              result[key] = data[key];
            }
          });
          resolve(result);
        } else if (typeof keys === 'object') {
          const result = { ...keys };
          Object.keys(keys).forEach(key => {
            if (data[key] !== undefined) {
              result[key] = data[key];
            }
          });
          resolve(result);
        } else {
          resolve({});
        }
      });
    },

    set: (items) => {
      return new Promise((resolve) => {
        Object.assign(data, items);
        resolve();
      });
    },

    remove: (keys) => {
      return new Promise((resolve) => {
        const keysToRemove = Array.isArray(keys) ? keys : [keys];
        keysToRemove.forEach(key => {
          delete data[key];
        });
        resolve();
      });
    },

    clear: () => {
      return new Promise((resolve) => {
        data = {};
        resolve();
      });
    },

    // Helper for testing - access internal data
    _getData: () => ({ ...data }),
    _setData: (newData) => { data = { ...newData }; },
    _clearData: () => { data = {}; }
  };

  return mock;
};

// Runtime mock
const createRuntimeMock = () => {
  const listeners = [];

  return {
    sendMessage: (message) => {
      return new Promise((resolve) => {
        // Simulate message passing - in tests, you can mock specific responses
        resolve({ success: true });
      });
    },

    onMessage: {
      addListener: (callback) => {
        listeners.push(callback);
      },
      removeListener: (callback) => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      },
      hasListener: (callback) => listeners.includes(callback),
      _listeners: listeners,
      _simulateMessage: (message, sender = {}) => {
        const responses = [];
        listeners.forEach(listener => {
          listener(message, sender, (response) => responses.push(response));
        });
        return responses;
      }
    },

    openOptionsPage: () => Promise.resolve(),

    getURL: (path) => `chrome-extension://mock-extension-id/${path}`,

    id: 'mock-extension-id',

    lastError: null
  };
};

// Tabs mock
const createTabsMock = () => {
  let tabs = [
    {
      id: 1,
      url: 'https://example.com',
      title: 'Example Page',
      favIconUrl: 'https://example.com/favicon.ico',
      active: true,
      windowId: 1
    }
  ];

  return {
    query: (queryInfo) => {
      return new Promise((resolve) => {
        let result = [...tabs];

        if (queryInfo.active !== undefined) {
          result = result.filter(t => t.active === queryInfo.active);
        }
        if (queryInfo.currentWindow !== undefined) {
          result = result.filter(t => t.windowId === 1);
        }
        if (queryInfo.url !== undefined) {
          result = result.filter(t => t.url === queryInfo.url);
        }

        resolve(result);
      });
    },

    create: (createProperties) => {
      return new Promise((resolve) => {
        const newTab = {
          id: tabs.length + 1,
          url: createProperties.url,
          title: 'New Tab',
          active: createProperties.active !== false,
          windowId: 1
        };
        tabs.push(newTab);
        resolve(newTab);
      });
    },

    sendMessage: (tabId, message) => {
      return new Promise((resolve) => {
        resolve({ success: true });
      });
    },

    update: (tabId, updateProperties) => {
      return new Promise((resolve) => {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
          Object.assign(tab, updateProperties);
        }
        resolve(tab);
      });
    },

    // Helper for testing
    _setTabs: (newTabs) => { tabs = [...newTabs]; },
    _getTabs: () => [...tabs],
    _clearTabs: () => { tabs = []; }
  };
};

// Scripting mock
const createScriptingMock = () => {
  return {
    executeScript: (injection) => {
      return new Promise((resolve) => {
        // Default: return empty content
        // Tests can mock specific returns
        resolve([{ result: 'Mock page content for testing purposes.' }]);
      });
    },

    insertCSS: () => Promise.resolve(),

    removeCSS: () => Promise.resolve()
  };
};

// Create the complete chrome mock object
const createChromeMock = () => {
  const storageMock = {
    local: createStorageMock(),
    sync: createStorageMock(),
    session: createStorageMock()
  };

  return {
    storage: storageMock,
    runtime: createRuntimeMock(),
    tabs: createTabsMock(),
    scripting: createScriptingMock(),

    // Helper to reset all mocks
    _resetAll: () => {
      storageMock.local._clearData();
      storageMock.sync._clearData();
      storageMock.session._clearData();
    }
  };
};

// Create and export the mock
const chromeMock = createChromeMock();

export default chromeMock;
export { createChromeMock, createStorageMock, createRuntimeMock, createTabsMock, createScriptingMock };
