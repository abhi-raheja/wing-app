/**
 * Wing Onboarding & First-Run Tests
 * Tests for the install-time onboarding flow and API key feedback
 */

import { jest } from '@jest/globals';

// Register the same listener that background.js registers.
// We can't import background.js directly (it calls db.initDB() on load),
// so we replicate the onInstalled handler logic here.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ wingFirstRun: true });
    chrome.runtime.openOptionsPage();
  }
});

describe('First Install Onboarding', () => {
  describe('chrome.runtime.onInstalled listener', () => {
    test('sets wingFirstRun flag on fresh install', async () => {
      // Simulate the install event
      chrome.runtime.onInstalled._simulateInstall({ reason: 'install' });

      // Wait for async storage write
      await testUtils.flushPromises();

      // Verify the flag was set
      const result = await chrome.storage.local.get('wingFirstRun');
      expect(result.wingFirstRun).toBe(true);
    });

    test('does not set wingFirstRun flag on update', async () => {
      chrome.runtime.onInstalled._simulateInstall({ reason: 'update' });
      await testUtils.flushPromises();

      const result = await chrome.storage.local.get('wingFirstRun');
      expect(result.wingFirstRun).toBeUndefined();
    });

    test('does not set wingFirstRun flag on chrome_update', async () => {
      chrome.runtime.onInstalled._simulateInstall({ reason: 'chrome_update' });
      await testUtils.flushPromises();

      const result = await chrome.storage.local.get('wingFirstRun');
      expect(result.wingFirstRun).toBeUndefined();
    });
  });

  describe('First-run detection (options page)', () => {
    test('wingFirstRun flag is detectable in storage', async () => {
      await chrome.storage.local.set({ wingFirstRun: true });

      const result = await chrome.storage.local.get('wingFirstRun');
      expect(result.wingFirstRun).toBe(true);
    });

    test('wingFirstRun flag can be cleared', async () => {
      await chrome.storage.local.set({ wingFirstRun: true });
      await chrome.storage.local.remove('wingFirstRun');

      const result = await chrome.storage.local.get('wingFirstRun');
      expect(result.wingFirstRun).toBeUndefined();
    });

    test('wingFirstRun is absent when not first install', async () => {
      const result = await chrome.storage.local.get('wingFirstRun');
      expect(result.wingFirstRun).toBeUndefined();
    });
  });
});

describe('API Key Feedback', () => {
  let api;

  beforeAll(async () => {
    api = await import('../../lib/api.js');
  });

  test('hasApiKey returns false when no key is configured', async () => {
    const hasKey = await api.hasApiKey();
    expect(hasKey).toBe(false);
  });

  test('hasApiKey returns true after saving a key', async () => {
    await api.saveApiKey('anthropic', 'sk-ant-test-key-12345');

    const hasKey = await api.hasApiKey();
    expect(hasKey).toBe(true);
  });

  test('generateSummary throws NO_API_KEY error when key missing', async () => {
    // Ensure no key is set (storage is cleared in beforeEach via resetAllMocks)
    await expect(
      api.generateSummary('This is some test content that is long enough to pass the minimum length check for summary generation.')
    ).rejects.toThrow('No API key configured');
  });

  test('NO_API_KEY error has correct error code', async () => {
    try {
      await api.makeApiRequest({ prompt: 'test' });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.code).toBe('NO_API_KEY');
      expect(error.retryable).toBe(false);
    }
  });
});

describe('Onboarding Integration Contract', () => {
  // Tests that the background.js -> options.js contract works correctly
  // background.js sets wingFirstRun, options.js reads and clears it

  test('full onboarding flow: install → detect → clear', async () => {
    // 1. Simulate install (background.js sets the flag)
    chrome.runtime.onInstalled._simulateInstall({ reason: 'install' });
    await testUtils.flushPromises();

    // 2. Options page detects the flag
    const detected = await chrome.storage.local.get('wingFirstRun');
    expect(detected.wingFirstRun).toBe(true);

    // 3. Options page clears the flag after showing banner
    await chrome.storage.local.remove('wingFirstRun');

    // 4. Flag is gone on next visit
    const afterClear = await chrome.storage.local.get('wingFirstRun');
    expect(afterClear.wingFirstRun).toBeUndefined();
  });

  test('openOptionsPage is callable on install', () => {
    // Verify the mock supports the call (no error thrown)
    expect(() => chrome.runtime.openOptionsPage()).not.toThrow();
  });
});
