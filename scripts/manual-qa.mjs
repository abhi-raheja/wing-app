import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

const extensionPath = path.resolve(process.cwd());
const userDataDir = `/tmp/wing-qa-chrome-profile-${Date.now()}`;

const ANTHROPIC_KEY = process.env.WING_ANTHROPIC_KEY;
const OPENAI_KEY = process.env.WING_OPENAI_KEY;

if (!ANTHROPIC_KEY || !OPENAI_KEY) {
  console.error('Missing WING_ANTHROPIC_KEY or WING_OPENAI_KEY');
  process.exit(1);
}

const results = [];
const record = (label, pass, note = '') => {
  results.push({ label, pass, note });
};

async function getExtensionId(browser) {
  await new Promise((r) => setTimeout(r, 3000));
  const targets = await browser.targets();
  let extensionTarget = targets.find(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://')
  );
  if (!extensionTarget) {
    extensionTarget = targets.find((t) => t.url().includes('chrome-extension://'));
  }
  if (extensionTarget) {
    const match = extensionTarget.url().match(/chrome-extension:\/\/([^/]+)/);
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

  record('Extension ID resolved', !!extensionId, extensionId || 'missing');
  if (!extensionId) {
    console.error('Could not resolve extension ID');
    await browser.close();
    process.exit(1);
  }

  const optionsPage = await browser.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`, { waitUntil: 'networkidle0' });

  let anthropicReady = false;
  let openaiReady = false;

  // Validate Anthropic key
  try {
    await setProviderAndKey(optionsPage, 'anthropic', ANTHROPIC_KEY);
    record('Anthropic API key validation', true);
    anthropicReady = true;
  } catch (error) {
    record('Anthropic API key validation', false, error.message);
  }

  // Validate OpenAI key
  try {
    await setProviderAndKey(optionsPage, 'openai', OPENAI_KEY);
    record('OpenAI API key validation', true);
    openaiReady = true;
  } catch (error) {
    record('OpenAI API key validation', false, error.message);
  }

  // Prepare a wing for highlight testing
  const page = await browser.newPage();
  await page.goto('https://example.com', { waitUntil: 'networkidle0' });
  const wingUrl = page.url();
  await createWingFromExtensionPage(optionsPage, {
    url: wingUrl,
    title: 'Example Domain',
    summary: 'Example domain summary for QA testing.',
  });

  // Reload to allow content script to detect winged page
  await page.reload({ waitUntil: 'networkidle0' });
  try {
    await page.waitForSelector('.wing-page-badge', { timeout: 5000 });
    record('Wing badge appears on winged page', true);
  } catch (error) {
    record('Wing badge appears on winged page', false, error.message);
  }

  // Create a highlight
  try {
    await page.evaluate(() => {
      const p = document.querySelector('p');
      if (!p || !p.firstChild) throw new Error('Paragraph not found');
      const range = document.createRange();
      range.setStart(p.firstChild, 0);
      range.setEnd(p.firstChild, Math.min(20, p.firstChild.textContent.length));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const event = new MouseEvent('mouseup', { bubbles: true });
      p.dispatchEvent(event);
    });

    await new Promise((r) => setTimeout(r, 200));
    await page.waitForSelector('.wing-highlight-tooltip', { timeout: 10000 });
    await page.click('.wing-highlight-tooltip [data-action="highlight"]');
    await page.waitForSelector('.wing-annotation-popup', { timeout: 5000 });
    await page.type('.wing-annotation-input', 'QA note');
    await page.click('.wing-annotation-popup [data-action="save"]');
    await page.waitForFunction(() => document.querySelectorAll('.wing-highlight').length > 0, { timeout: 10000 });
    record('Create highlight with annotation', true);
  } catch (error) {
    record('Create highlight with annotation', false, error.message);
  }

  // Highlight restoration on refresh
  try {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.wing-highlight').length > 0, { timeout: 5000 });
    record('Highlight restoration after refresh', true);
  } catch (error) {
    record('Highlight restoration after refresh', false, error.message);
  }

  // Highlight interaction (view/edit/delete)
  try {
    await page.click('.wing-highlight');
    await page.waitForSelector('.wing-highlight-view', { timeout: 5000 });
    await page.click('.wing-highlight-view [data-action="edit"]');
    await page.waitForSelector('.wing-annotation-popup', { timeout: 5000 });
    const input = await page.$('.wing-annotation-input');
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('.wing-annotation-input', 'Updated QA note');
    await page.click('.wing-annotation-popup [data-action="save"]');

    await page.click('.wing-highlight');
    await page.waitForSelector('.wing-highlight-view', { timeout: 5000 });
    const annotationText = await page.$eval('.wing-highlight-view-annotation', (el) => el.textContent);
    const updated = annotationText.includes('Updated QA note');
    record('Edit highlight annotation', updated, updated ? '' : 'Annotation not updated');

    await page.click('.wing-highlight-view [data-action="delete"]');
    await page.waitForFunction(() => document.querySelectorAll('.wing-highlight').length === 0, { timeout: 5000 });
    record('Delete highlight', true);
  } catch (error) {
    record('Edit/delete highlight', false, error.message);
  }

  // Prepare wing data for AI query
  await createWingFromExtensionPage(optionsPage, {
    url: 'https://en.wikipedia.org/wiki/JavaScript',
    title: 'JavaScript - Wikipedia',
    summary: 'JavaScript is a high-level programming language used to build interactive web experiences.',
  });

  const popupPage = await browser.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'networkidle0' });

  // AI query with Anthropic
  try {
    if (!anthropicReady) throw new Error('Anthropic key not validated');
    await setProviderOnly(optionsPage, 'anthropic');
    await popupPage.click('.nav-tab[data-view="query"]');
    await popupPage.type('#queryInput', 'What have I saved about JavaScript?');
    await popupPage.click('#queryBtn');
    await popupPage.waitForSelector('.chat-message-assistant, .chat-message-error', { timeout: 60000 });
    const errorExists = await popupPage.$('.chat-message-error');
    if (errorExists) {
      throw new Error('Chat error shown');
    }
    record('AI query response (Anthropic)', true);
  } catch (error) {
    record('AI query response (Anthropic)', false, error.message);
  }

  // Switch to OpenAI and query again
  try {
    if (!openaiReady) throw new Error('OpenAI key not validated');
    await optionsPage.bringToFront();
    await setProviderOnly(optionsPage, 'openai');
    await popupPage.bringToFront();
    await popupPage.click('.nav-tab[data-view="query"]');
    const input = await popupPage.$('#queryInput');
    await input.click({ clickCount: 3 });
    await popupPage.keyboard.press('Backspace');
    await popupPage.type('#queryInput', 'Summarize my saved JavaScript page.');
    await popupPage.click('#queryBtn');
    await popupPage.waitForSelector('.chat-message-assistant, .chat-message-error', { timeout: 60000 });
    const errorExists = await popupPage.$('.chat-message-error');
    if (errorExists) {
      throw new Error('Chat error shown');
    }
    record('AI query response (OpenAI)', true);
  } catch (error) {
    record('AI query response (OpenAI)', false, error.message);
  }

  // Offline handling for AI query (simulate offline state)
  try {
    const beforeCount = await popupPage.$$eval('.chat-message-assistant, .chat-message-error', (els) => els.length);
    const targets = await browser.targets();
    const sessions = [];
    for (const target of targets) {
      if (target.type() === 'page' || target.type() === 'service_worker' || target.type() === 'background_page') {
        const session = await target.createCDPSession();
        await session.send('Network.enable');
        await session.send('Network.emulateNetworkConditions', {
          offline: true,
          latency: 0,
          downloadThroughput: 0,
          uploadThroughput: 0,
        });
        sessions.push(session);
      }
    }

    const input = await popupPage.$('#queryInput');
    await input.click({ clickCount: 3 });
    await popupPage.keyboard.press('Backspace');
    await popupPage.type('#queryInput', 'Does this work offline?');
    await popupPage.click('#queryBtn');

    await popupPage.waitForFunction(
      (count) => document.querySelectorAll('.chat-message-assistant, .chat-message-error').length > count,
      { timeout: 20000 },
      beforeCount
    );
    const lastMessage = await popupPage.$eval('.chat-message-assistant:last-child, .chat-message-error:last-child', (el) => el.className);
    if (lastMessage.includes('chat-message-error')) {
      record('Offline AI query shows error', true);
    } else {
      record('Offline AI query shows error', false, 'Assistant response shown while network emulated offline');
    }
  } catch (error) {
    record('Offline AI query shows error', false, error.message);
  } finally {
    try {
      const targets = await browser.targets();
      for (const target of targets) {
        if (target.type() === 'page' || target.type() === 'service_worker' || target.type() === 'background_page') {
          const session = await target.createCDPSession();
          await session.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          });
        }
      }
    } catch {}
  }

  // Cross-site badge checks
  const crossSites = [
    'https://en.wikipedia.org/wiki/JavaScript',
    'https://github.com/openai/openai-python',
    'https://news.ycombinator.com',
    'https://react.dev/',
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    'https://www.bbc.com/news',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ];

  for (const site of crossSites) {
    const sitePage = await browser.newPage();
    await sitePage.goto(site, { waitUntil: 'domcontentloaded' });
    const url = sitePage.url();
    await createWingFromExtensionPage(optionsPage, {
      url,
      title: site,
      summary: 'Cross-site QA wing',
    });
    await sitePage.reload({ waitUntil: 'domcontentloaded' });
    try {
      await sitePage.waitForSelector('.wing-page-badge', { timeout: 5000 });
      record(`Cross-site badge (${site})`, true);
    } catch (error) {
      record(`Cross-site badge (${site})`, false, error.message);
    }
    await sitePage.close();
  }

  await browser.close();
  await fs.rm(userDataDir, { recursive: true, force: true });

  // Print results
  const failures = results.filter((r) => !r.pass);
  console.log('\nManual QA Results:');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} - ${r.label}${r.note ? ` (${r.note})` : ''}`);
  }
  if (failures.length > 0) {
    console.log(`\nFailures: ${failures.length}`);
    process.exitCode = 1;
  } else {
    console.log('\nAll manual QA checks passed.');
  }
}

run().catch((error) => {
  console.error('Manual QA script failed:', error);
  process.exit(1);
});
