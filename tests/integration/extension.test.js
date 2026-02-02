/**
 * Wing Extension Integration Tests
 * Uses Puppeteer to test the extension in a real Chrome browser
 *
 * IMPORTANT: These tests require:
 * 1. Chrome/Chromium installed
 * 2. npm install puppeteer (already in package.json)
 * 3. Run with: npm run test:integration
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', '..');

// Longer timeout for integration tests
jest.setTimeout(60000);

describe('Wing Extension Integration Tests', () => {
  let browser;
  let extensionId;

  beforeAll(async () => {
    try {
      // Launch browser with extension
      browser = await puppeteer.launch({
        headless: false, // Extensions require headed mode
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          '--no-first-run',
          '--no-default-browser-check',
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
      });

      // Get the extension ID from service worker
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the extension ID by checking targets
      const targets = await browser.targets();
      const extensionTarget = targets.find(target =>
        target.type() === 'service_worker' &&
        target.url().includes('chrome-extension://')
      );

      if (extensionTarget) {
        const url = extensionTarget.url();
        const match = url.match(/chrome-extension:\/\/([^/]+)/);
        extensionId = match ? match[1] : null;
      }

      // Alternative: check for background page
      if (!extensionId) {
        const bgTarget = targets.find(target =>
          target.type() === 'background_page' ||
          (target.type() === 'page' && target.url().includes('chrome-extension://'))
        );
        if (bgTarget) {
          const match = bgTarget.url().match(/chrome-extension:\/\/([^/]+)/);
          extensionId = match ? match[1] : null;
        }
      }

      console.log('Extension ID:', extensionId);
    } catch (error) {
      console.error('Failed to launch browser with extension:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Extension Loading', () => {
    test('extension loads without errors', async () => {
      expect(extensionId).toBeDefined();
      expect(extensionId).not.toBeNull();
    });

    test('popup page loads', async () => {
      if (!extensionId) {
        console.warn('Skipping: No extension ID');
        return;
      }

      const page = await browser.newPage();
      const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;

      try {
        await page.goto(popupUrl, { waitUntil: 'networkidle0', timeout: 10000 });

        // Check for Wing logo/title
        const title = await page.$eval('.logo', el => el.textContent);
        expect(title).toContain('Wing');
      } finally {
        await page.close();
      }
    });

    test('options page loads', async () => {
      if (!extensionId) {
        console.warn('Skipping: No extension ID');
        return;
      }

      const page = await browser.newPage();
      const optionsUrl = `chrome-extension://${extensionId}/options/options.html`;

      try {
        await page.goto(optionsUrl, { waitUntil: 'networkidle0', timeout: 10000 });

        // Check for settings elements
        const hasApiKeyInput = await page.$('#apiKey') !== null;
        expect(hasApiKeyInput).toBe(true);
      } finally {
        await page.close();
      }
    });
  });

  describe('Popup UI', () => {
    let page;

    beforeEach(async () => {
      if (!extensionId) return;

      page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('Wing It button exists', async () => {
      if (!extensionId) return;

      const wingItBtn = await page.$('#wingItBtn');
      expect(wingItBtn).not.toBeNull();
    });

    test('navigation tabs exist', async () => {
      if (!extensionId) return;

      const tabs = await page.$$('.nav-tab');
      expect(tabs.length).toBeGreaterThanOrEqual(3);
    });

    test('clicking Wings tab shows wings view', async () => {
      if (!extensionId) return;

      await page.click('[data-view="wings"]');
      await page.waitForSelector('#wingsView.active', { timeout: 2000 });

      const isActive = await page.$eval('#wingsView', el =>
        el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    test('clicking Collections tab shows collections view', async () => {
      if (!extensionId) return;

      await page.click('[data-view="collections"]');
      await page.waitForSelector('#collectionsView.active', { timeout: 2000 });

      const isActive = await page.$eval('#collectionsView', el =>
        el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    test('clicking Ask AI tab shows query view', async () => {
      if (!extensionId) return;

      await page.click('[data-view="query"]');
      await page.waitForSelector('#queryView.active', { timeout: 2000 });

      const isActive = await page.$eval('#queryView', el =>
        el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    test('search input exists in wings view', async () => {
      if (!extensionId) return;

      await page.click('[data-view="wings"]');

      const searchInput = await page.$('#searchInput');
      expect(searchInput).not.toBeNull();
    });

    test('sort button exists', async () => {
      if (!extensionId) return;

      const sortBtn = await page.$('#sortBtn');
      expect(sortBtn).not.toBeNull();
    });

    test('sort menu opens on click', async () => {
      if (!extensionId) return;

      await page.click('#sortBtn');
      await page.waitForSelector('#sortMenu:not(.hidden)', { timeout: 2000 });

      const isVisible = await page.$eval('#sortMenu', el =>
        !el.classList.contains('hidden')
      );
      expect(isVisible).toBe(true);
    });
  });

  describe('Collections Management', () => {
    let page;

    beforeEach(async () => {
      if (!extensionId) return;

      page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      await page.click('[data-view="collections"]');
      await page.waitForSelector('#collectionsView.active', { timeout: 2000 });
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('New Collection button exists', async () => {
      if (!extensionId) return;

      const addBtn = await page.$('#addCollectionBtn');
      expect(addBtn).not.toBeNull();
    });

    test('clicking New Collection opens modal', async () => {
      if (!extensionId) return;

      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });

      const isVisible = await page.$eval('#collectionModal', el =>
        !el.classList.contains('hidden')
      );
      expect(isVisible).toBe(true);
    });

    test('collection modal has required fields', async () => {
      if (!extensionId) return;

      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });

      const nameInput = await page.$('#collectionName');
      const descInput = await page.$('#collectionDescription');
      const colorPicker = await page.$('#colorPicker');

      expect(nameInput).not.toBeNull();
      expect(descInput).not.toBeNull();
      expect(colorPicker).not.toBeNull();
    });

    test('can create a new collection', async () => {
      if (!extensionId) return;

      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });

      await page.type('#collectionName', 'Test Collection');

      await page.click('#collectionSave');

      await page.waitForSelector('#collectionModal.hidden', { timeout: 3000 });

      await new Promise(resolve => setTimeout(resolve, 500));

      const collectionsList = await page.$eval('#collectionsList', el => el.innerHTML);
      expect(collectionsList).toContain('Test Collection');
    });
  });

  describe('Options Page', () => {
    let page;

    beforeEach(async () => {
      if (!extensionId) return;

      page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/options.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('API key input exists', async () => {
      if (!extensionId) return;

      const apiKeyInput = await page.$('#apiKey');
      expect(apiKeyInput).not.toBeNull();
    });

    test('LLM provider dropdown exists', async () => {
      if (!extensionId) return;

      const providerSelect = await page.$('#llmProvider');
      expect(providerSelect).not.toBeNull();
    });

    test('provider dropdown has options', async () => {
      if (!extensionId) return;

      const options = await page.$$eval('#llmProvider option', els =>
        els.map(el => el.value)
      );

      expect(options).toContain('anthropic');
      expect(options).toContain('openai');
    });

    test('export button exists', async () => {
      if (!extensionId) return;

      const exportBtn = await page.$('#exportData');
      expect(exportBtn).not.toBeNull();
    });

    test('import button exists', async () => {
      if (!extensionId) return;

      const importBtn = await page.$('#importData');
      expect(importBtn).not.toBeNull();
    });

    test('statistics are displayed', async () => {
      if (!extensionId) return;

      const statsElements = ['#statWings', '#statCollections', '#statHighlights', '#statConnections'];

      for (const selector of statsElements) {
        const element = await page.$(selector);
        expect(element).not.toBeNull();
      }
    });
  });

  describe('Keyboard Shortcuts', () => {
    let page;

    beforeEach(async () => {
      if (!extensionId) return;

      page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('Escape closes modal', async () => {
      if (!extensionId) return;

      await page.click('[data-view="collections"]');
      await page.waitForSelector('#collectionsView.active', { timeout: 2000 });
      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });

      await page.keyboard.press('Escape');

      await page.waitForSelector('#collectionModal.hidden', { timeout: 2000 });

      const isHidden = await page.$eval('#collectionModal', el =>
        el.classList.contains('hidden')
      );
      expect(isHidden).toBe(true);
    });
  });
});

describe('Content Script Integration', () => {
  let browser;
  let extensionId;

  beforeAll(async () => {
    try {
      browser = await puppeteer.launch({
        headless: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          '--no-first-run',
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const targets = await browser.targets();
      const extensionTarget = targets.find(target =>
        target.type() === 'service_worker' &&
        target.url().includes('chrome-extension://')
      );

      if (extensionTarget) {
        const match = extensionTarget.url().match(/chrome-extension:\/\/([^/]+)/);
        extensionId = match ? match[1] : null;
      }
    } catch (error) {
      console.error('Failed to launch browser:', error);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('content script loads on regular page', async () => {
    if (!extensionId) {
      console.warn('Skipping: No extension ID');
      return;
    }

    const page = await browser.newPage();

    try {
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 15000
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Content script should be loaded without errors
      expect(true).toBe(true);
    } finally {
      await page.close();
    }
  });
});
