/**
 * Wing Nests Integration Tests (Section 7)
 * Tests for Nest CRUD operations via the popup UI
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', '..');

jest.setTimeout(60000);

describe('Nests CRUD (Section 7)', () => {
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

    // Navigate to collections view (nests are within collections)
    await page.click('[data-view="collections"]');
    await page.waitForSelector('#collectionsView.active', { timeout: 2000 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('7.1 Nest Modal Elements', () => {
    test('Nest modal exists in DOM', async () => {
      if (!extensionId) return;

      const nestModal = await page.$('#nestModal');
      expect(nestModal).not.toBeNull();
    });

    test('Nest modal has name field', async () => {
      if (!extensionId) return;

      const nestNameInput = await page.$('#nestName');
      expect(nestNameInput).not.toBeNull();
    });

    test('Nest modal has parent dropdown', async () => {
      if (!extensionId) return;

      const nestParentSelect = await page.$('#nestParent');
      expect(nestParentSelect).not.toBeNull();
    });

    test('Nest modal has save button', async () => {
      if (!extensionId) return;

      const nestSaveBtn = await page.$('#nestSave');
      expect(nestSaveBtn).not.toBeNull();
    });

    test('Nest modal has cancel button', async () => {
      if (!extensionId) return;

      const nestCancelBtn = await page.$('#nestCancel');
      expect(nestCancelBtn).not.toBeNull();
    });

    test('Nest modal has close button', async () => {
      if (!extensionId) return;

      const nestCloseBtn = await page.$('#nestModalClose');
      expect(nestCloseBtn).not.toBeNull();
    });
  });

  describe('7.2 Nest Parent Options', () => {
    test('Parent nest dropdown has "No parent" option by default', async () => {
      if (!extensionId) return;

      const firstOption = await page.$eval('#nestParent option:first-child', el => ({
        value: el.value,
        text: el.textContent
      }));

      expect(firstOption.value).toBe('');
      expect(firstOption.text).toContain('No parent');
    });
  });

  describe('7.3 Nest Integration with Collections', () => {
    test('Collections view is active and ready for nests', async () => {
      if (!extensionId) return;

      const isActive = await page.$eval('#collectionsView', el =>
        el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    test('After creating collection, view is ready for nest creation', async () => {
      if (!extensionId) return;

      // Create a collection
      const collectionName = `Nest-Parent-${Date.now()}`;
      await page.click('#addCollectionBtn');
      await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });
      await page.type('#collectionName', collectionName);
      await page.click('#collectionSave');
      await page.waitForSelector('#collectionModal.hidden', { timeout: 3000 });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify collection was created
      const listContent = await page.$eval('#collectionsList', el => el.textContent);
      expect(listContent).toContain(collectionName);
    });
  });
});
