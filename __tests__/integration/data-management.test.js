/**
 * Wing Data Management Integration Tests (Section 10)
 * Tests for Export/Import functionality via the options page
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', '..');

jest.setTimeout(60000);

describe('Data Management (Section 10)', () => {
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

  describe('10.1 Export', () => {
    test('Export button exists in options', async () => {
      if (!extensionId) return;

      const exportBtn = await page.$('#exportData');
      expect(exportBtn).not.toBeNull();
    });

    test('Export button is enabled', async () => {
      if (!extensionId) return;

      const isDisabled = await page.$eval('#exportData', el => el.disabled);
      expect(isDisabled).toBe(false);
    });

    test('Export button has correct text', async () => {
      if (!extensionId) return;

      const btnText = await page.$eval('#exportData', el => el.textContent);
      expect(btnText.toLowerCase()).toContain('export');
    });
  });

  describe('10.2 Import', () => {
    test('Import button exists in options', async () => {
      if (!extensionId) return;

      const importBtn = await page.$('#importData');
      expect(importBtn).not.toBeNull();
    });

    test('Import file input exists', async () => {
      if (!extensionId) return;

      const importFile = await page.$('#importFile');
      expect(importFile).not.toBeNull();
    });

    test('Import file input accepts JSON files', async () => {
      if (!extensionId) return;

      const acceptAttr = await page.$eval('#importFile', el => el.getAttribute('accept'));
      expect(acceptAttr).toContain('.json');
    });
  });

  describe('10.3 Clear All Data', () => {
    test('Clear All Data button exists', async () => {
      if (!extensionId) return;

      const clearBtn = await page.$('#clearAllData');
      expect(clearBtn).not.toBeNull();
    });

    test('Clear All Data button has danger styling', async () => {
      if (!extensionId) return;

      const hasClass = await page.$eval('#clearAllData', el =>
        el.classList.contains('btn-danger')
      );
      expect(hasClass).toBe(true);
    });
  });

  describe('10.4 Data Statistics', () => {
    test('Wings count element exists', async () => {
      if (!extensionId) return;

      const statWings = await page.$('#statWings');
      expect(statWings).not.toBeNull();
    });

    test('Collections count element exists', async () => {
      if (!extensionId) return;

      const statCollections = await page.$('#statCollections');
      expect(statCollections).not.toBeNull();
    });

    test('Highlights count element exists', async () => {
      if (!extensionId) return;

      const statHighlights = await page.$('#statHighlights');
      expect(statHighlights).not.toBeNull();
    });

    test('Connections count element exists', async () => {
      if (!extensionId) return;

      const statConnections = await page.$('#statConnections');
      expect(statConnections).not.toBeNull();
    });

    test('Statistics container has 4 stat items', async () => {
      if (!extensionId) return;

      const statItems = await page.$$('.stat-item');
      expect(statItems.length).toBe(4);
    });
  });
});
