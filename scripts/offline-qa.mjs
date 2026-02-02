import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const extensionPath = path.resolve(process.cwd());
const userDataDir = `/tmp/wing-qa-offline-${Date.now()}`;

const ANTHROPIC_KEY = process.env.WING_ANTHROPIC_KEY;

if (!ANTHROPIC_KEY) {
  console.error('Missing WING_ANTHROPIC_KEY');
  process.exit(1);
}

async function setWifiPower(state) {
  try {
    await execFileAsync('networksetup', ['-setairportpower', 'Wi-Fi', state ? 'on' : 'off']);
  } catch (error) {
    throw new Error(`Failed to set Wi-Fi ${state ? 'on' : 'off'}: ${error.message}`);
  }
}

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
  await setProviderAndKey(optionsPage, 'anthropic', ANTHROPIC_KEY);

  await createWingFromExtensionPage(optionsPage, {
    url: 'https://example.com',
    title: 'Example Domain',
    summary: 'Example summary for offline QA.',
  });

  const popupPage = await browser.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'networkidle0' });
  await popupPage.click('.nav-tab[data-view="query"]');

  let offlineResult = 'FAIL';
  let offlineNote = 'Unknown error';

  try {
    await setWifiPower(false);
    await new Promise((r) => setTimeout(r, 1500));

    const beforeCount = await popupPage.$$eval('.chat-message-assistant, .chat-message-error', (els) => els.length);
    await popupPage.type('#queryInput', 'Does this work offline?');
    await popupPage.click('#queryBtn');

    await popupPage.waitForFunction(
      (count) => document.querySelectorAll('.chat-message-assistant, .chat-message-error').length > count,
      { timeout: 20000 },
      beforeCount
    );

    const lastMessage = await popupPage.$eval(
      '.chat-message-assistant:last-child, .chat-message-error:last-child',
      (el) => el.className
    );

    if (lastMessage.includes('chat-message-error')) {
      offlineResult = 'PASS';
      offlineNote = '';
    } else {
      offlineResult = 'FAIL';
      offlineNote = 'Assistant response shown while Wi-Fi off';
    }
  } catch (error) {
    offlineResult = 'FAIL';
    offlineNote = error.message;
  } finally {
    try {
      await setWifiPower(true);
    } catch (error) {
      console.error('Failed to restore Wi-Fi:', error.message);
    }
  }

  await browser.close();
  await fs.rm(userDataDir, { recursive: true, force: true });

  console.log(`Offline AI query shows error: ${offlineResult}${offlineNote ? ` (${offlineNote})` : ''}`);
  if (offlineResult !== 'PASS') {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Offline QA failed:', error);
  process.exit(1);
});
