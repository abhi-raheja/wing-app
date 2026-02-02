import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const extensionPath = path.resolve(process.cwd());
const userDataDir = `/tmp/wing-qa-offline-winging-${Date.now()}`;

const ANTHROPIC_KEY = process.env.WING_ANTHROPIC_KEY;

if (!ANTHROPIC_KEY) {
  console.error('Missing WING_ANTHROPIC_KEY');
  process.exit(1);
}

async function setWifiPower(state) {
  await execFileAsync('networksetup', ['-setairportpower', 'Wi-Fi', state ? 'on' : 'off']);
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

async function waitForOnline(browser, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      const page = await browser.newPage();
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.close();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
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

  const contentPage = await browser.newPage();
  await contentPage.goto('https://example.com', { waitUntil: 'networkidle0' });

  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'networkidle0' });

  // Ensure the content tab is active when Wing It runs
  await contentPage.bringToFront();

  // Trigger Wing It from the popup without focusing it
  await popup.evaluate(() => {
    document.getElementById('wingItBtn')?.click();
  });
  await popup.waitForSelector('#wingItModal:not(.hidden)', { timeout: 5000 });

  let offlineResult = 'FAIL';
  let offlineNote = 'Unknown error';

  try {
    await setWifiPower(false);
    await new Promise((r) => setTimeout(r, 1500));

    await popup.evaluate(() => {
      document.getElementById('wingItConfirm')?.click();
    });
    await popup.waitForSelector('.toast', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 2000));

    const errorToast = await popup.$('.toast-error');
    if (errorToast) {
      const text = await popup.$eval('.toast-error', (el) => el.textContent || '');
      offlineResult = 'PASS';
      offlineNote = text.trim();
    } else {
      const text = await popup.$eval('.toast', (el) => el.textContent || '');
      offlineResult = 'FAIL';
      offlineNote = `Toast: ${text.trim()}`;
    }
  } catch (error) {
    offlineResult = 'FAIL';
    offlineNote = error.message;
  } finally {
    try {
      await setWifiPower(true);
      await waitForOnline(browser);
    } catch {}
  }

  await browser.close();
  await fs.rm(userDataDir, { recursive: true, force: true });

  console.log(`Offline winging shows error: ${offlineResult}${offlineNote ? ` (${offlineNote})` : ''}`);
  if (offlineResult !== 'PASS') {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Offline winging QA failed:', error);
  process.exit(1);
});
