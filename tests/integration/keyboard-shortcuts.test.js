/**
 * Wing Keyboard Shortcuts Integration Tests (Section 11)
 * Tests for keyboard navigation and shortcuts
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', '..');

jest.setTimeout(60000);

describe('Keyboard Shortcuts (Section 11)', () => {
  let browser;
  let extensionId;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
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
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

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

  describe('11.2 Popup Shortcuts - Escape Key', () => {
    test('Escape closes Wing It modal', async () => {
      if (!extensionId) return;

      // Open Wing It modal
      await page.click('#wingItBtn');
      await page.waitForSelector('#wingItModal:not(.hidden)', { timeout: 2000 });

      // Press Escape
      await page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Modal should be hidden
      const isHidden = await page.$eval('#wingItModal', el =>
        el.classList.contains('hidden')
      );
      expect(isHidden).toBe(true);
    });

    test('Escape closes Collection modal', async () => {
      if (!extensionId) return;

      // Navigate to collections
      await page.click('[data-view="collections"]');
      await page.waitForSelector('#collectionsView.active', { timeout: 2000 });

      // Open collection modal
      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });

      // Press Escape
      await page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Modal should be hidden
      const isHidden = await page.$eval('#collectionModal', el =>
        el.classList.contains('hidden')
      );
      expect(isHidden).toBe(true);
    });

    test('Escape closes sort dropdown', async () => {
      if (!extensionId) return;

      // Make sure we're on wings view
      await page.click('[data-view="wings"]');
      await page.waitForSelector('#wingsView.active', { timeout: 2000 });

      // Open sort dropdown
      await page.click('#sortBtn');
      await page.waitForSelector('#sortMenu:not(.hidden)', { timeout: 2000 });

      // Press Escape
      await page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Dropdown should be hidden
      const isHidden = await page.$eval('#sortMenu', el =>
        el.classList.contains('hidden')
      );
      expect(isHidden).toBe(true);
    });
  });

  describe('11.3 Search Shortcut', () => {
    test('Search input exists in wings view', async () => {
      if (!extensionId) return;

      // Make sure we're on wings view
      await page.click('[data-view="wings"]');
      await page.waitForSelector('#wingsView.active', { timeout: 2000 });

      const searchInput = await page.$('#searchInput');
      expect(searchInput).not.toBeNull();
    });

    test('Search input can be focused', async () => {
      if (!extensionId) return;

      await page.click('[data-view="wings"]');
      await page.waitForSelector('#wingsView.active', { timeout: 2000 });

      await page.click('#searchInput');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Type something to verify it's focused
      await page.type('#searchInput', 'test');
      const value = await page.$eval('#searchInput', el => el.value);
      expect(value).toBe('test');
    });
  });

  describe('11.4 Modal Close Button', () => {
    test('Close button (X) closes Wing It modal', async () => {
      if (!extensionId) return;

      // Open Wing It modal
      await page.click('#wingItBtn');
      await page.waitForSelector('#wingItModal:not(.hidden)', { timeout: 2000 });

      // Click on the close button
      await page.click('#wingItModalClose');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Modal should be hidden
      const isHidden = await page.$eval('#wingItModal', el =>
        el.classList.contains('hidden')
      );
      expect(isHidden).toBe(true);
    });

    test('Close button (X) closes Collection modal', async () => {
      if (!extensionId) return;

      await page.click('[data-view="collections"]');
      await page.waitForSelector('#collectionsView.active', { timeout: 2000 });

      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });

      await page.click('#collectionModalClose');
      await new Promise(resolve => setTimeout(resolve, 300));

      const isHidden = await page.$eval('#collectionModal', el =>
        el.classList.contains('hidden')
      );
      expect(isHidden).toBe(true);
    });
  });

  describe('11.5 Tab Navigation', () => {
    test('Tab key moves focus between interactive elements', async () => {
      if (!extensionId) return;

      // Focus on Wing It button
      await page.focus('#wingItBtn');

      // Press Tab
      await page.keyboard.press('Tab');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Some element should have focus
      const focusedTag = await page.$eval(':focus', el => el.tagName.toLowerCase());
      expect(['button', 'input', 'a', 'select', 'textarea']).toContain(focusedTag);
    });
  });
});
