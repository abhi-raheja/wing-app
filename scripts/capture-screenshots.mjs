import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

const extensionPath = path.resolve(process.cwd());
const outDir = path.resolve(process.cwd(), 'store-assets', 'screenshots');
const userDataDir = `/tmp/wing-qa-screens-${Date.now()}`;

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

async function seedData(optionsPage) {
  await optionsPage.evaluate(async () => {
    const db = await import(chrome.runtime.getURL('lib/db.js'));
    const utils = await import(chrome.runtime.getURL('lib/utils.js'));
    await db.initDB();
    await db.clearAllData();

    const collections = [
      { id: utils.generateId(), name: 'AI Research', description: 'Models, benchmarks, papers', color: '#ff7a18' },
      { id: utils.generateId(), name: 'Product Strategy', description: 'Launch notes, positioning', color: '#ffd166' },
      { id: utils.generateId(), name: 'Design Systems', description: 'Typography, UI, patterns', color: '#3dd6a2' },
    ];

    for (const c of collections) {
      await db.createCollection(c);
    }

    const nests = [
      { id: utils.generateId(), name: 'Foundations', collectionId: collections[0].id, parentId: null },
      { id: utils.generateId(), name: 'UX Notes', collectionId: collections[2].id, parentId: null },
    ];

    for (const n of nests) {
      await db.createNest(n);
    }

    const wings = [
      {
        id: utils.generateId(),
        url: 'https://example.com',
        title: 'Example Domain',
        summary: 'A simple example page used to illustrate domain structure and sample content.',
        collectionIds: [collections[0].id],
        nestIds: [nests[0].id],
      },
      {
        id: utils.generateId(),
        url: 'https://react.dev/',
        title: 'React — The Library for Web and Native User Interfaces',
        summary: 'React is a declarative JavaScript library for building user interfaces with components.',
        collectionIds: [collections[2].id],
        nestIds: [nests[1].id],
      },
      {
        id: utils.generateId(),
        url: 'https://openai.com',
        title: 'OpenAI',
        summary: 'OpenAI builds AI systems that can solve complex problems and accelerate human capabilities.',
        collectionIds: [collections[0].id, collections[1].id],
        nestIds: [],
      },
      {
        id: utils.generateId(),
        url: 'https://www.bbc.com/news',
        title: 'BBC News',
        summary: 'Global news coverage and reporting on politics, technology, and business.',
        collectionIds: [collections[1].id],
        nestIds: [],
      },
    ];

    for (const w of wings) {
      await db.createWing({
        id: w.id,
        url: w.url,
        title: w.title,
        favicon: utils.getFaviconUrl(w.url),
        summary: w.summary,
        fullContent: null,
        collectionIds: w.collectionIds,
        nestIds: w.nestIds,
      });
    }

    await db.createHighlight({
      id: utils.generateId(),
      wingId: wings[0].id,
      selectedText: 'This domain is for use in illustrative examples in documents.',
      annotation: 'Great for quick demos.',
      startOffset: 0,
      endOffset: 64,
      timestamp: Date.now(),
    });

    await db.createConnection({
      id: utils.generateId(),
      wingId1: wings[0].id,
      wingId2: wings[2].id,
      score: 0.72,
      type: 'semantic',
    });
  });
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });
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
  await seedData(optionsPage);
  await optionsPage.close();

  const popup = await browser.newPage();
  await popup.setViewport({ width: 1280, height: 800 });
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'networkidle0' });

  // Screenshot 1: Wings list
  await popup.screenshot({ path: path.join(outDir, '01-wings-list.png') });

  // Screenshot 2: Wing details modal
  await popup.click('.wing-card');
  await popup.waitForSelector('#wingDetailsModal:not(.hidden)', { timeout: 5000 });
  await popup.screenshot({ path: path.join(outDir, '02-wing-details.png') });
  await popup.evaluate(() => document.getElementById('wingDetailsModalClose')?.click());

  // Screenshot 3: Collections view
  await popup.click('.nav-tab[data-view="collections"]');
  await popup.waitForSelector('#collectionsView.active', { timeout: 5000 });
  await popup.screenshot({ path: path.join(outDir, '03-collections.png') });

  // Screenshot 4: Ask AI view (mocked messages)
  await popup.click('.nav-tab[data-view="query"]');
  await popup.waitForSelector('#queryView.active', { timeout: 5000 });
  await popup.evaluate(() => {
    const messages = document.getElementById('chatMessages');
    const empty = document.getElementById('chatEmpty');
    if (empty) empty.classList.add('hidden');
    if (messages) {
      messages.innerHTML = `
        <div class="chat-message chat-message-user">
          <div class="chat-message-content">What did I save about design systems?</div>
        </div>
        <div class="chat-message chat-message-assistant">
          <div class="chat-message-content"><strong>Key theme:</strong> You’ve saved a page focused on design systems and UI patterns. It emphasizes reusable components and typography consistency. [1]</div>
          <div class="chat-sources">
            <button class="chat-sources-toggle">Sources (1)</button>
            <div class="chat-sources-list">
              <a class="chat-source-item" href="#">
                <img class="chat-source-favicon" src="https://www.google.com/s2/favicons?domain=react.dev&sz=32" alt="" />
                <span class="chat-source-title">React — The Library for Web and Native User Interfaces</span>
              </a>
            </div>
          </div>
        </div>
      `;
    }
  });
  await popup.screenshot({ path: path.join(outDir, '04-ask-ai.png') });

  // Screenshot 5: Options/settings page
  const optionsShot = await browser.newPage();
  await optionsShot.setViewport({ width: 1280, height: 800 });
  await optionsShot.goto(`chrome-extension://${extensionId}/options/options.html`, { waitUntil: 'networkidle0' });
  await optionsShot.screenshot({ path: path.join(outDir, '05-settings.png') });
  await optionsShot.close();

  await browser.close();
  await fs.rm(userDataDir, { recursive: true, force: true });

  console.log('Screenshots captured in store-assets/screenshots');
}

run().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
