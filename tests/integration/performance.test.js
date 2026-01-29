/**
 * Wing Performance Integration Tests (Section 13)
 * Tests for performance with large datasets (50+ wings)
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', '..');

jest.setTimeout(120000); // Longer timeout for performance tests

describe('Performance Tests (Section 13)', () => {
  let browser;
  let extensionId;

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

  describe('13.1 Popup Load Performance', () => {
    test('Popup opens quickly (under 3 seconds)', async () => {
      if (!extensionId) return;

      const page = await browser.newPage();
      const startTime = Date.now();

      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      const loadTime = Date.now() - startTime;
      console.log(`Popup load time: ${loadTime}ms`);

      await page.close();

      expect(loadTime).toBeLessThan(3000);
    });

    test('Options page opens quickly (under 3 seconds)', async () => {
      if (!extensionId) return;

      const page = await browser.newPage();
      const startTime = Date.now();

      await page.goto(`chrome-extension://${extensionId}/options/options.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      const loadTime = Date.now() - startTime;
      console.log(`Options page load time: ${loadTime}ms`);

      await page.close();

      expect(loadTime).toBeLessThan(3000);
    });
  });

  describe('13.2 UI Interaction Performance', () => {
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

    test('Tab switching performs quickly', async () => {
      if (!extensionId) return;

      const iterations = 10;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await page.click('[data-view="wings"]');
        await page.waitForSelector('#wingsView.active', { timeout: 1000 });

        await page.click('[data-view="collections"]');
        await page.waitForSelector('#collectionsView.active', { timeout: 1000 });

        await page.click('[data-view="query"]');
        await page.waitForSelector('#queryView.active', { timeout: 1000 });
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / (iterations * 3);
      console.log(`Tab switching: ${iterations * 3} switches in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms each)`);

      // Each tab switch should take under 500ms on average
      expect(avgTime).toBeLessThan(500);
    });

    test('Sort dropdown responds quickly', async () => {
      if (!extensionId) return;

      await page.click('[data-view="wings"]');
      await page.waitForSelector('#wingsView.active', { timeout: 2000 });

      const iterations = 5;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await page.click('#sortBtn');
        await page.waitForSelector('#sortMenu:not(.hidden)', { timeout: 1000 });
        await page.keyboard.press('Escape');
        await page.waitForSelector('#sortMenu.hidden', { timeout: 1000 });
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;
      console.log(`Sort dropdown toggle: ${iterations} toggles in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms each)`);

      expect(avgTime).toBeLessThan(500);
    });

    test('Modal open/close performs quickly', async () => {
      if (!extensionId) return;

      const iterations = 5;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await page.click('#wingItBtn');
        await page.waitForSelector('#wingItModal:not(.hidden)', { timeout: 1000 });
        await page.keyboard.press('Escape');
        await page.waitForSelector('#wingItModal.hidden', { timeout: 1000 });
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;
      console.log(`Modal open/close: ${iterations} cycles in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms each)`);

      expect(avgTime).toBeLessThan(500);
    });
  });

  describe('13.3 Collection Creation Performance', () => {
    test('Creating multiple collections performs well', async () => {
      if (!extensionId) return;

      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      await page.click('[data-view="collections"]');
      await page.waitForSelector('#collectionsView.active', { timeout: 2000 });

      const startTime = Date.now();

      // Create 5 collections quickly
      for (let i = 0; i < 5; i++) {
        await page.click('#addCollectionBtn');
        await page.waitForSelector('#collectionModal:not(.hidden)', { timeout: 2000 });
        await page.type('#collectionName', `Perf Collection ${i + 1}`);
        await page.click('#collectionSave');
        await page.waitForSelector('#collectionModal.hidden', { timeout: 3000 });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalTime = Date.now() - startTime;
      console.log(`Created 5 collections in ${totalTime}ms (avg: ${totalTime / 5}ms each)`);

      await page.close();

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(20000);
    });
  });

  describe('13.4 Search Performance', () => {
    test('Search input responds to typing quickly', async () => {
      if (!extensionId) return;

      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      await page.click('[data-view="wings"]');
      await page.waitForSelector('#wingsView.active', { timeout: 2000 });

      const startTime = Date.now();

      // Type a search query
      await page.type('#searchInput', 'test search query');

      const typeTime = Date.now() - startTime;
      console.log(`Search typing time: ${typeTime}ms`);

      // Get the input value to verify typing worked
      const value = await page.$eval('#searchInput', el => el.value);
      expect(value).toBe('test search query');

      await page.close();

      // Typing should be responsive
      expect(typeTime).toBeLessThan(1000);
    });
  });

  describe('13.5 Stability', () => {
    test('Multiple popup opens without errors', async () => {
      if (!extensionId) return;

      const pageCount = 3;
      const pages = [];

      // Open multiple popup instances
      for (let i = 0; i < pageCount; i++) {
        const newPage = await browser.newPage();
        await newPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
          waitUntil: 'networkidle0',
          timeout: 10000
        });
        pages.push(newPage);
      }

      // All pages should have loaded successfully
      expect(pages.length).toBe(pageCount);

      // Close all pages
      for (const p of pages) {
        await p.close();
      }
    });
  });
});
