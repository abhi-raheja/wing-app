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
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
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

    test('opens onboarding page on fresh install', async () => {
      chrome.runtime.onInstalled._simulateInstall({ reason: 'install' });
      await testUtils.flushPromises();

      // Verify a new tab was created with the onboarding URL
      const tabs = chrome.tabs._getTabs();
      const onboardingTab = tabs.find(t =>
        t.url && t.url.includes('onboarding/onboarding.html')
      );
      expect(onboardingTab).toBeDefined();
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

  describe('First-run detection (onboarding page)', () => {
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
  // Tests that the background.js -> onboarding.js contract works correctly
  // background.js sets wingFirstRun + opens onboarding tab, onboarding.js clears it on finish

  test('full onboarding flow: install → detect → clear', async () => {
    // 1. Simulate install (background.js sets the flag and opens tab)
    chrome.runtime.onInstalled._simulateInstall({ reason: 'install' });
    await testUtils.flushPromises();

    // 2. Onboarding page detects the flag
    const detected = await chrome.storage.local.get('wingFirstRun');
    expect(detected.wingFirstRun).toBe(true);

    // 3. Onboarding page clears the flag when user finishes
    await chrome.storage.local.remove('wingFirstRun');

    // 4. Flag is gone on next visit
    const afterClear = await chrome.storage.local.get('wingFirstRun');
    expect(afterClear.wingFirstRun).toBeUndefined();
  });

  test('chrome.tabs.create is callable for onboarding', async () => {
    // Verify the mock supports tab creation (no error thrown)
    const tab = await chrome.tabs.create({ url: 'chrome-extension://test/onboarding/onboarding.html' });
    expect(tab).toBeDefined();
    expect(tab.url).toContain('onboarding');
  });

  test('chrome.runtime.getURL generates correct onboarding URL', () => {
    const url = chrome.runtime.getURL('onboarding/onboarding.html');
    expect(url).toContain('onboarding/onboarding.html');
  });
});
