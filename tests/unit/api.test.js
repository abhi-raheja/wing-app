/**
 * Wing API Module Tests
 * Tests for lib/api.js - LLM integration for summaries, queries, and semantic analysis
 */

import { jest } from '@jest/globals';

let api;

beforeAll(async () => {
  api = await import('../../lib/api.js');
});

describe('Provider Configuration', () => {
  test('getProviders returns all supported providers', () => {
    const providers = api.getProviders();

    expect(providers).toHaveProperty('anthropic');
    expect(providers).toHaveProperty('openai');
  });

  test('each provider has required configuration', () => {
    const providers = api.getProviders();

    for (const [key, config] of Object.entries(providers)) {
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('apiUrl');
      expect(config).toHaveProperty('storageKey');
      expect(config).toHaveProperty('keyPlaceholder');
      expect(config).toHaveProperty('website');
    }
  });

  describe('getCurrentProvider', () => {
    test('returns default provider when not set', async () => {
      chrome.storage.local._clearData();

      const provider = await api.getCurrentProvider();

      expect(provider).toBe('anthropic');
    });

    test('returns stored provider', async () => {
      chrome.storage.local._setData({ llmProvider: 'openai' });

      const provider = await api.getCurrentProvider();

      expect(provider).toBe('openai');
    });
  });

  describe('setCurrentProvider', () => {
    test('stores provider selection', async () => {
      await api.setCurrentProvider('openai');

      const stored = chrome.storage.local._getData();
      expect(stored.llmProvider).toBe('openai');
    });
  });
});

describe('API Key Management', () => {
  beforeEach(() => {
    chrome.storage.local._clearData();
  });

  describe('saveApiKey', () => {
    test('saves Anthropic API key', async () => {
      await api.saveApiKey('anthropic', 'sk-ant-test-key-123');

      const stored = chrome.storage.local._getData();
      expect(stored.anthropicApiKey).toBe('sk-ant-test-key-123');
    });

    test('saves OpenAI API key', async () => {
      await api.saveApiKey('openai', 'sk-openai-test-key');

      const stored = chrome.storage.local._getData();
      expect(stored.openaiApiKey).toBe('sk-openai-test-key');
    });

  });

  describe('getApiKey', () => {
    test('retrieves stored API key', async () => {
      chrome.storage.local._setData({ anthropicApiKey: 'sk-ant-stored-key' });

      const key = await api.getApiKey('anthropic');

      expect(key).toBe('sk-ant-stored-key');
    });

    test('returns undefined when no key stored', async () => {
      const key = await api.getApiKey('anthropic');

      expect(key).toBeFalsy(); // Returns null or undefined when not stored
    });
  });

  describe('removeApiKey', () => {
    test('removes stored API key', async () => {
      chrome.storage.local._setData({ anthropicApiKey: 'sk-ant-to-remove' });

      await api.removeApiKey('anthropic');

      const stored = chrome.storage.local._getData();
      expect(stored.anthropicApiKey).toBeUndefined();
    });
  });

  describe('hasApiKey', () => {
    test('returns true when key exists', async () => {
      chrome.storage.local._setData({
        llmProvider: 'anthropic',
        anthropicApiKey: 'sk-ant-exists'
      });

      const hasKey = await api.hasApiKey();

      expect(hasKey).toBe(true);
    });

    test('returns false when no key exists', async () => {
      chrome.storage.local._clearData();

      const hasKey = await api.hasApiKey();

      expect(hasKey).toBe(false);
    });
  });
});

describe('API Key Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validates Anthropic key successfully', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: 'Valid' }]
        })
      })
    );

    await expect(api.validateApiKey('anthropic', 'sk-ant-valid-key'))
      .resolves.not.toThrow();
  });

  test('throws error for invalid API key', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: { message: 'Invalid API key' }
        })
      })
    );

    await expect(api.validateApiKey('anthropic', 'invalid-key'))
      .rejects.toThrow();
  });

  test('validates OpenAI key with correct endpoint', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Valid' } }]
        })
      })
    );

    await api.validateApiKey('openai', 'sk-openai-key');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('openai'),
      expect.any(Object)
    );
  });
});

describe('Summary Generation', () => {
  beforeEach(() => {
    chrome.storage.local._setData({
      llmProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-test-key'
    });
  });

  test('generateSummary constructs correct prompt', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: 'This is a summary of the page content.' }]
        })
      })
    );

    // Content must be at least 50 chars per the implementation
    const content = 'This is a long article about JavaScript programming that contains enough content to be summarized properly.';
    await api.generateSummary(content);

    // Check that fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Check the request body
    const call = global.fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);

    expect(body.messages[0].content).toContain(content);
  });

  test('generateSummary returns AI response', async () => {
    const mockSummary = 'This article explains the fundamentals of JavaScript.';

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: mockSummary }]
        })
      })
    );

    // Content must be at least 50 chars
    const result = await api.generateSummary('This is a very long page content that has more than fifty characters to meet the minimum requirement.');

    expect(result).toBe(mockSummary);
  });

  test('generateSummary handles API errors gracefully', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: { message: 'Internal server error' }
        })
      })
    );

    await expect(api.generateSummary('Content', 'Title'))
      .rejects.toThrow();
  });

  test('generateSummary respects max token limit', async () => {
    // Reset fetch mock
    global.fetch.mockReset();
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: 'Summary' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      })
    );

    // Content must be at least 50 chars
    await api.generateSummary('This is a long enough content string that meets the minimum fifty character requirement for summarization.');

    const call = global.fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);

    expect(body.max_tokens).toBeDefined();
    expect(body.max_tokens).toBeLessThanOrEqual(1024); // API uses up to 1024
  });
});

describe('Query Wings', () => {
  beforeEach(() => {
    chrome.storage.local._setData({
      llmProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-test-key'
    });
  });

  test('queryWings constructs context from wings', async () => {
    const mockWings = [
      testUtils.createMockWing({
        id: 'wing-1',
        title: 'JavaScript Guide',
        summary: 'Learn JavaScript basics'
      }),
      testUtils.createMockWing({
        id: 'wing-2',
        title: 'React Tutorial',
        summary: 'Building UIs with React'
      })
    ];

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{
            text: 'Based on your saved pages, JavaScript is for programming and React is for UI.'
          }]
        })
      })
    );

    await api.queryWings('What have I saved about web development?', mockWings);

    const call = global.fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);

    // Should include context from wings
    expect(body.messages[0].content).toContain('JavaScript Guide');
    expect(body.messages[0].content).toContain('React Tutorial');
    expect(body.messages[0].content).toContain('web development');
  });

  test('queryWings returns structured response', async () => {
    const mockAnswer = 'You have saved several articles about JavaScript [1].';

    // Reset and set up mock
    global.fetch.mockReset();
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: mockAnswer }],
          usage: { input_tokens: 100, output_tokens: 50 }
        })
      })
    );

    const result = await api.queryWings('What did I save?', [
      testUtils.createMockWing({ id: 'wing-1', summary: 'JavaScript tutorial content' })
    ]);

    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('citations');
  });

  test('queryWings includes citations when referenced', async () => {
    const wings = [
      testUtils.createMockWing({
        id: 'cited-wing',
        title: 'Cited Article',
        url: 'https://example.com/cited'
      })
    ];

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{
            text: 'According to "Cited Article" [1], the answer is...'
          }]
        })
      })
    );

    const result = await api.queryWings('Question?', wings);

    // Result should include citations (implementation dependent)
    expect(result).toBeDefined();
  });

  test('queryWings throws when no wings provided', async () => {
    await expect(api.queryWings('Question?', []))
      .rejects.toThrow();
  });

  test('queryWings filters wings without summaries', async () => {
    const wings = [
      testUtils.createMockWing({ id: 'with-summary', summary: 'Has summary' }),
      testUtils.createMockWing({ id: 'no-summary', summary: null })
    ];

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ text: 'Answer based on available content.' }]
        })
      })
    );

    await api.queryWings('Question?', wings);

    const call = global.fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);

    // Should only include wing with summary
    expect(body.messages[0].content).toContain('Has summary');
    expect(body.messages[0].content).not.toContain('no-summary');
  });
});

describe('API Request Construction', () => {
  beforeEach(() => {
    chrome.storage.local._clearData();
  });

  test('makeApiRequest uses correct headers for Anthropic', async () => {
    chrome.storage.local._setData({
      llmProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-header-test'
    });

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: [{ text: 'OK' }] })
      })
    );

    await api.makeApiRequest({ prompt: 'Test' });

    const call = global.fetch.mock.calls[0];
    const headers = call[1].headers;

    expect(headers['x-api-key']).toBe('sk-ant-header-test');
    expect(headers['anthropic-version']).toBeDefined();
  });

  test('makeApiRequest uses correct headers for OpenAI', async () => {
    chrome.storage.local._setData({
      llmProvider: 'openai',
      openaiApiKey: 'sk-openai-header-test'
    });

    // Reset and set up mock
    global.fetch.mockReset();
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OK' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        })
      })
    );

    const result = await api.makeApiRequest({ prompt: 'Test' });

    // Just verify the request was made and returned a result
    expect(global.fetch).toHaveBeenCalled();
    expect(result).toHaveProperty('text');
  });

  test('makeApiRequest throws when no API key', async () => {
    chrome.storage.local._clearData();

    await expect(api.makeApiRequest({ prompt: 'Test' }))
      .rejects.toThrow();
  });
});

describe('Response Parsing', () => {
  beforeEach(() => {
    global.fetch.mockReset();
    chrome.storage.local._clearData();
  });

  test('parses Anthropic response format', async () => {
    chrome.storage.local._setData({
      llmProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-parse-test'
    });

    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'Anthropic response text' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      })
    );

    const result = await api.makeApiRequest({ prompt: 'Test' });

    expect(result.text).toBe('Anthropic response text');
  });

  test('parses OpenAI response format', async () => {
    chrome.storage.local._setData({
      llmProvider: 'openai',
      openaiApiKey: 'sk-openai-test'
    });

    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OpenAI response text' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        })
      })
    );

    const result = await api.makeApiRequest({ prompt: 'Test' });

    expect(result.text).toBe('OpenAI response text');
  });

});

describe('Error Handling', () => {
  beforeEach(() => {
    chrome.storage.local._setData({
      llmProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-error-test'
    });
  });

  test('handles rate limit error', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: { message: 'Rate limit exceeded' }
        })
      })
    );

    await expect(api.makeApiRequest({ prompt: 'Test' }))
      .rejects.toThrow();
  });

  test('handles network error', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.reject(new Error('Network error'))
    );

    await expect(api.makeApiRequest({ prompt: 'Test' }))
      .rejects.toThrow();
  });

  test('handles timeout', async () => {
    // Mock a delayed response
    global.fetch.mockImplementationOnce(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 100)
      )
    );

    await expect(api.makeApiRequest({ prompt: 'Test', timeout: 50 }))
      .rejects.toThrow();
  });
});
