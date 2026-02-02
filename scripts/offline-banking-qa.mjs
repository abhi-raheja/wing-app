import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import { createReadStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const extensionPath = path.resolve(process.cwd());
const siteDir = path.resolve(process.cwd(), 'site');
const userDataDir = `/tmp/wing-qa-offline-banking-${Date.now()}`;

const ANTHROPIC_KEY = process.env.WING_ANTHROPIC_KEY;

if (!ANTHROPIC_KEY) {
  console.error('Missing WING_ANTHROPIC_KEY');
  process.exit(1);
}

const results = [];
const record = (label, pass, note = '') => {
  results.push({ label, pass, note });
};

async function setWifiPower(state) {
  await execFileAsync('networksetup', ['-setairportpower', 'Wi-Fi', state ? 'on' : 'off']);
}

function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const rawPath = decodeURIComponent(url.pathname);
      const safePath = rawPath === '/' ? '/index.html' : rawPath;
      const filePath = path.join(siteDir, safePath);

      if (!filePath.startsWith(siteDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const finalPath = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const ext = path.extname(finalPath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      createReadStream(finalPath).pipe(res);
    } catch (error) {
      res.statusCode = 500;
      res.end(`Server error: ${error.message}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
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

async function run() {
  await fs.rm(userDataDir, { recursive: true, force: true });

  const server = await startStaticServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const targetUrl = `http://localhost:${port}/offline-banking.html`;

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
    server.close();
    process.exit(1);
  }

  try {
    const optionsPage = await browser.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`, { waitUntil: 'networkidle0' });
    await setProviderAndKey(optionsPage, 'anthropic', ANTHROPIC_KEY);
    record('Set Anthropic key', true);

    const contentPage = await browser.newPage();
    await contentPage.goto(targetUrl, { waitUntil: 'networkidle0' });
    record('Load offline banking page', true, targetUrl);

    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'networkidle0' });

    await contentPage.bringToFront();
    await popup.evaluate(() => {
      document.getElementById('wingItBtn')?.click();
    });
    await popup.waitForSelector('#wingItModal:not(.hidden)', { timeout: 5000 });
    record('Open Wing It modal', true);

    try {
      await setWifiPower(false);
      await new Promise((r) => setTimeout(r, 1500));

      await popup.evaluate(() => {
        document.getElementById('wingItConfirm')?.click();
      });
      await popup.waitForSelector('.toast', { timeout: 5000 });

      const errorToast = await popup.waitForSelector('.toast-error', { timeout: 15000 }).catch(() => null);
      const errorText = errorToast
        ? await popup.$eval('.toast-error', (el) => el.textContent || '')
        : '';
      record('Offline summary shows error', Boolean(errorToast), errorText.trim());

      const wingCount = await popup.evaluate(async () => {
        const db = await import(chrome.runtime.getURL('lib/db.js'));
        await db.initDB();
        const wings = await db.getAllWings();
        return wings.length;
      });
      record('Wing created while offline', wingCount > 0, `count=${wingCount}`);
    } finally {
      try {
        await setWifiPower(true);
      } catch {}
    }
  } catch (error) {
    record('Offline banking QA run', false, error.message);
  } finally {
    await browser.close();
    server.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }

  console.log('Offline banking QA results:');
  for (const result of results) {
    console.log(`- ${result.label}: ${result.pass ? 'PASS' : 'FAIL'}${result.note ? ` (${result.note})` : ''}`);
  }

  if (results.some((r) => !r.pass)) {
    process.exitCode = 1;
  }
}

run();
