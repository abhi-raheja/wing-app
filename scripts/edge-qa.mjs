import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
const extensionPath = path.resolve(process.cwd());
const userDataDir = `/tmp/wing-qa-edge-${Date.now()}`;

const ANTHROPIC_KEY = process.env.WING_ANTHROPIC_KEY;

if (!ANTHROPIC_KEY) {
  console.error('Missing WING_ANTHROPIC_KEY');
  process.exit(1);
}

const results = [];
const record = (label, pass, note = '') => {
  results.push({ label, pass, note });
};

async function getExtensionId(browser) {
  await new Promise((r) => setTimeout(r, 5000));
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://')
  );
  if (extensionTarget) {
    const match = extensionTarget.url().match(/chrome-extension:\/\/([^/]+)/);
    return match ? match[1] : null;
  }
  const fallbackTarget = targets.find((t) => t.url().includes('chrome-extension://'));
  if (fallbackTarget) {
    const match = fallbackTarget.url().match(/chrome-extension:\/\/([^/]+)/);
    return match ? match[1] : null;
  }
  return null;
}

async function setProviderAndKey(page, provider, key) {
  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/options/options.html`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#llmProvider');
  await page.select('#llmProvider', provider);

  const apiKeyInput = await page.$('#apiKey');
  await apiKeyInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#apiKey', key, { delay: 10 });

  await page.click('#saveApiKey');
  await page.waitForFunction(() => {
    const el = document.querySelector('#apiKeyStatus');
    return el && (el.classList.contains('success') || el.classList.contains('error'));
  }, { timeout: 40000 });

  const status = await page.$eval('#apiKeyStatus', (el) => ({
    text: el.textContent,
    className: el.className,
  }));

  if (!status.className.includes('success')) {
    throw new Error(status.text || 'API key validation failed');
  }
}

async function setProviderOnly(page, provider) {
  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/options/options.html`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#llmProvider');
  await page.select('#llmProvider', provider);
  await new Promise((r) => setTimeout(r, 500));
}

async function createWingFromExtensionPage(page, wing) {
  await page.evaluate(async (data) => {
    const db = await import(chrome.runtime.getURL('lib/db.js'));
    const utils = await import(chrome.runtime.getURL('lib/utils.js'));
    await db.initDB();
    const id = data.id || utils.generateId();
    const favicon = data.favicon || utils.getFaviconUrl(data.url);
    await db.createWing({
      id,
      url: data.url,
      title: data.title,
      favicon,
      summary: data.summary || null,
      fullContent: data.fullContent || null,
      collectionIds: data.collectionIds || [],
      nestIds: data.nestIds || [],
    });
  }, wing);
}

async function run() {
  await fs.rm(userDataDir, { recursive: true, force: true });

  let browser;
  let usingGoogleChrome = true;
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      protocolTimeout: 120000,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
    });
  } catch (error) {
    console.warn('Failed to launch Google Chrome directly, falling back to bundled Chromium.');
    usingGoogleChrome = false;
    browser = await puppeteer.launch({
      headless: false,
      protocolTimeout: 120000,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
    });
  }

  let extensionId = await getExtensionId(browser);
  if (!extensionId && usingGoogleChrome) {
    console.warn('Extension ID not found in Google Chrome, retrying with bundled Chromium.');
    await browser.close();
    usingGoogleChrome = false;
    browser = await puppeteer.launch({
      headless: false,
      protocolTimeout: 120000,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
    });
    extensionId = await getExtensionId(browser);
  }

  if (!extensionId) {
    console.error('Could not resolve extension ID');
    await browser.close();
    process.exit(1);
  }

  const optionsPage = await browser.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`, { waitUntil: 'networkidle0' });

  // Ensure Anthropic is set for edge cases
  try {
    await setProviderAndKey(optionsPage, 'anthropic', ANTHROPIC_KEY);
    record('Anthropic API key validation (edge QA)', true);
  } catch (error) {
    record('Anthropic API key validation (edge QA)', false, error.message);
  }

  // Invalid key messaging
  try {
    await setProviderOnly(optionsPage, 'anthropic');
    const apiKeyInput = await optionsPage.$('#apiKey');
    await apiKeyInput.click({ clickCount: 3 });
    await optionsPage.keyboard.press('Backspace');
    await optionsPage.type('#apiKey', 'sk-ant-invalid-key');
    await optionsPage.click('#saveApiKey');
    await optionsPage.waitForFunction(() => {
      const el = document.querySelector('#apiKeyStatus');
      return el && el.classList.contains('error');
    }, { timeout: 15000 });
    record('Invalid Anthropic key shows error', true);
    await setProviderAndKey(optionsPage, 'anthropic', ANTHROPIC_KEY);
  } catch (error) {
    record('Invalid Anthropic key shows error', false, error.message);
  }

  // Restricted pages and PDF viewer
  try {
    const restrictedPage = await browser.newPage();
    let restrictedLoaded = false;
    try {
      await restrictedPage.goto('chrome://extensions', { waitUntil: 'domcontentloaded', timeout: 5000 });
      restrictedLoaded = true;
    } catch {
      restrictedLoaded = false;
    }
    if (restrictedLoaded) {
      const badge = await restrictedPage.$('.wing-page-badge');
      record('No badge on chrome:// pages', !badge, badge ? 'Badge present' : '');
    } else {
      record('No badge on chrome:// pages', true, 'Navigation blocked (expected)');
    }
    await restrictedPage.close();
  } catch (error) {
    record('No badge on chrome:// pages', false, error.message);
  }

  try {
    const aboutPage = await browser.newPage();
    await aboutPage.goto('about:blank', { waitUntil: 'domcontentloaded' });
    const badge = await aboutPage.$('.wing-page-badge');
    record('No badge on about: pages', !badge, badge ? 'Badge present' : '');
    await aboutPage.close();
  } catch (error) {
    record('No badge on about: pages', false, error.message);
  }

  try {
    const pdfPage = await browser.newPage();
    await pdfPage.goto('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', { waitUntil: 'domcontentloaded' });
    const badge = await pdfPage.$('.wing-page-badge');
    record('No badge on PDF viewer', !badge, badge ? 'Badge present' : '');
    await pdfPage.close();
  } catch (error) {
    record('No badge on PDF viewer', false, error.message);
  }

  // Strict CSP and iframe-heavy pages
  const edgeSites = [
    { label: 'Strict CSP badge', url: 'https://csp.withgoogle.com/docs/index.html' },
    { label: 'Iframe-heavy badge', url: 'https://www.w3schools.com/tags/tag_iframe.asp' },
  ];

  for (const site of edgeSites) {
    try {
      const sitePage = await browser.newPage();
      await sitePage.goto(site.url, { waitUntil: 'domcontentloaded' });
      await createWingFromExtensionPage(optionsPage, {
        url: sitePage.url(),
        title: site.label,
        summary: 'Edge QA wing',
      });
      await sitePage.reload({ waitUntil: 'domcontentloaded' });
      let badgeFound = false;
      try {
        await sitePage.waitForSelector('.wing-page-badge', { timeout: 5000 });
        badgeFound = true;
      } catch {
        badgeFound = false;
      }
      record(site.label, badgeFound, badgeFound ? '' : 'Badge not found');
      await sitePage.close();
    } catch (error) {
      record(site.label, false, error.message);
    }
  }

  await browser.close();
  await fs.rm(userDataDir, { recursive: true, force: true });

  console.log('\nEdge QA Results:');
  const failures = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} - ${r.label}${r.note ? ` (${r.note})` : ''}`);
  }
  if (failures.length > 0) {
    console.log(`\nFailures: ${failures.length}`);
    process.exitCode = 1;
  } else {
    console.log('\nAll edge QA checks passed.');
  }
}

run().catch((error) => {
  console.error('Edge QA failed:', error);
  process.exit(1);
});
