/**
 * Wing - Options Page JavaScript
 * Handles settings, API key management, and data import/export
 */

import * as db from '../lib/db.js';
import {
  getProviders,
  getCurrentProvider,
  setCurrentProvider,
  getApiKey,
  saveApiKey as saveProviderApiKey,
  removeApiKey as removeProviderApiKey,
  validateApiKey,
} from '../lib/api.js';

// ============================================
// DOM Elements
// ============================================
const elements = {
  themeOptions: document.querySelectorAll('input[name="theme"]'),
  llmProvider: document.getElementById('llmProvider'),
  apiKey: document.getElementById('apiKey'),
  toggleVisibility: document.getElementById('toggleVisibility'),
  saveApiKey: document.getElementById('saveApiKey'),
  removeApiKey: document.getElementById('removeApiKey'),
  apiKeyStatus: document.getElementById('apiKeyStatus'),
  providerLink: document.getElementById('providerLink'),
  providerList: document.getElementById('providerList'),
  exportData: document.getElementById('exportData'),
  importData: document.getElementById('importData'),
  importFile: document.getElementById('importFile'),
  importStatus: document.getElementById('importStatus'),
  clearAllData: document.getElementById('clearAllData'),
  toastContainer: document.getElementById('toastContainer'),
  // Stats
  statWings: document.getElementById('statWings'),
  statCollections: document.getElementById('statCollections'),
  statHighlights: document.getElementById('statHighlights'),
  statConnections: document.getElementById('statConnections'),
};

// Provider configurations (loaded from api.js)
let providers = {};
let currentProvider = 'anthropic';

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.2s ease-out reverse';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ============================================
// Provider Management
// ============================================
async function loadProviders() {
  providers = getProviders();
  currentProvider = await getCurrentProvider();

  // Set the select value
  elements.llmProvider.value = currentProvider;

  // Update UI for current provider
  updateProviderUI();

  // Load the API key for current provider
  await loadApiKey();

  // Show status of all providers
  await renderProviderStatus();
}

function updateProviderUI() {
  const config = providers[currentProvider];
  if (!config) return;

  // Update placeholder
  elements.apiKey.placeholder = config.keyPlaceholder;

  // Update "Get API Key" link
  elements.providerLink.href = config.website;
  elements.providerLink.textContent = 'Get API Key';
}

async function renderProviderStatus() {
  const providerKeys = Object.keys(providers);
  const statusHtml = [];

  for (const key of providerKeys) {
    const config = providers[key];
    const apiKey = await getApiKey(key);
    const isConfigured = !!apiKey;
    const isActive = key === currentProvider;

    statusHtml.push(`
      <div class="provider-item ${isActive ? 'active' : ''}">
        <span class="provider-item-name">
          ${config.name}
          ${isActive ? '<span style="color: var(--color-primary); font-size: 10px;">(Active)</span>' : ''}
        </span>
        <span class="provider-item-status ${isConfigured ? 'configured' : 'not-configured'}">
          ${isConfigured ? 'Configured' : 'Not configured'}
        </span>
      </div>
    `);
  }

  elements.providerList.innerHTML = statusHtml.join('');
}

async function handleProviderChange() {
  const newProvider = elements.llmProvider.value;

  // Save the provider selection
  await setCurrentProvider(newProvider);
  currentProvider = newProvider;

  // Update UI
  updateProviderUI();

  // Load API key for new provider
  await loadApiKey();

  // Update provider status
  await renderProviderStatus();

  showToast(`Switched to ${providers[newProvider].name}`, 'info');
}

// ============================================
// API Key Management
// ============================================
async function loadApiKey() {
  try {
    const apiKey = await getApiKey(currentProvider);
    elements.apiKey.value = apiKey || '';

    if (apiKey) {
      showStatus(`${providers[currentProvider].name} API key is configured`, 'success');
    } else {
      showStatus(`No API key configured for ${providers[currentProvider].name}`, 'info');
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

async function saveApiKey() {
  const apiKey = elements.apiKey.value.trim();
  const config = providers[currentProvider];

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  // Basic format validation
  if (currentProvider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    showStatus('Invalid API key format. Anthropic keys start with "sk-ant-"', 'error');
    return;
  }

  if (currentProvider === 'openai' && !apiKey.startsWith('sk-')) {
    showStatus('Invalid API key format. OpenAI keys start with "sk-"', 'error');
    return;
  }

  if (currentProvider === 'google' && !apiKey.startsWith('AI')) {
    showStatus('Invalid API key format. Google API keys start with "AI"', 'error');
    return;
  }

  try {
    // Validate API key by making a test request
    showStatus('Validating API key...', 'info');

    await validateApiKey(currentProvider, apiKey);

    // Save the key
    await saveProviderApiKey(currentProvider, apiKey);
    showStatus(`${config.name} API key saved and validated successfully!`, 'success');
    showToast('API key saved', 'success');

    // Update provider status
    await renderProviderStatus();
  } catch (error) {
    console.error('API key validation error:', error);
    showStatus(`Validation failed: ${error.message}`, 'error');
  }
}

async function removeApiKey() {
  const config = providers[currentProvider];

  if (!confirm(`Remove your ${config.name} API key? AI features using this provider will be disabled.`)) {
    return;
  }

  try {
    await removeProviderApiKey(currentProvider);
    elements.apiKey.value = '';
    showStatus(`${config.name} API key removed`, 'success');
    showToast('API key removed', 'info');

    // Update provider status
    await renderProviderStatus();
  } catch (error) {
    console.error('Error removing API key:', error);
    showToast('Failed to remove API key', 'error');
  }
}

function toggleApiKeyVisibility() {
  const isPassword = elements.apiKey.type === 'password';
  elements.apiKey.type = isPassword ? 'text' : 'password';
  elements.toggleVisibility.textContent = isPassword ? '🙈' : '👁️';
}

function showStatus(message, type) {
  elements.apiKeyStatus.textContent = message;
  elements.apiKeyStatus.className = `status ${type}`;
  elements.apiKeyStatus.classList.remove('hidden');
}

// ============================================
// Data Statistics
// ============================================
async function loadStats() {
  try {
    const data = await db.exportAllData();
    const { collections, nests, wings, highlights, connections } = data.data;

    elements.statWings.textContent = wings?.length || 0;
    elements.statCollections.textContent = collections?.length || 0;
    elements.statHighlights.textContent = highlights?.length || 0;
    elements.statConnections.textContent = connections?.length || 0;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ============================================
// Data Management
// ============================================
async function exportData() {
  const btn = elements.exportData;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const data = await db.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `wing-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Data exported successfully', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Failed to export data', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function triggerImport() {
  elements.importFile.click();
}

function showImportStatus(message, type) {
  elements.importStatus.textContent = message;
  elements.importStatus.className = `import-status ${type}`;
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const btn = elements.importData;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    showImportStatus('Reading file...', 'validating');

    const text = await file.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON format');
    }

    // Validate structure
    if (!data.data) {
      throw new Error('Invalid backup file: missing data object');
    }

    if (!data.version) {
      throw new Error('Invalid backup file: missing version');
    }

    // Show what will be imported
    const { collections, nests, wings, highlights, connections } = data.data;
    const summary = [
      wings?.length ? `${wings.length} wings` : null,
      collections?.length ? `${collections.length} collections` : null,
      highlights?.length ? `${highlights.length} highlights` : null,
      connections?.length ? `${connections.length} connections` : null,
    ].filter(Boolean).join(', ');

    showImportStatus(`Found: ${summary || 'empty backup'}`, 'validating');

    // Confirm import
    const replace = confirm(
      `Import ${summary || 'data'}?\n\nClick OK to replace all existing data.\nClick Cancel to merge with existing data.`
    );

    showImportStatus('Importing...', 'validating');
    await db.importData(data, replace);

    showImportStatus(`Successfully imported: ${summary}`, 'success');
    showToast('Data imported successfully', 'success');

    // Refresh stats
    await loadStats();

    // Reset file input
    elements.importFile.value = '';
  } catch (error) {
    console.error('Import error:', error);
    showImportStatus(`Import failed: ${error.message}`, 'error');
    showToast(`Import failed: ${error.message}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

async function clearAllData() {
  if (
    !confirm(
      'Are you sure you want to delete ALL your Wing data? This cannot be undone!'
    )
  ) {
    return;
  }

  if (!confirm('This is your last chance. Delete everything?')) {
    return;
  }

  try {
    await db.clearAllData();
    showToast('All data cleared', 'success');
    await loadStats();
  } catch (error) {
    console.error('Clear data error:', error);
    showToast('Failed to clear data', 'error');
  }
}

// ============================================
// Theme Management
// ============================================
async function loadTheme() {
  try {
    const result = await chrome.storage.local.get('theme');
    const theme = result.theme || 'orange';

    // Set the radio button
    elements.themeOptions.forEach((radio) => {
      radio.checked = radio.value === theme;
    });
  } catch (error) {
    console.error('Error loading theme:', error);
  }
}

async function handleThemeChange(event) {
  const theme = event.target.value;

  try {
    // Save to storage
    await chrome.storage.local.set({ theme });

    // Update the extension icon via background script
    chrome.runtime.sendMessage({ action: 'setTheme', theme });

    showToast(`Theme changed to ${theme === 'orange' ? 'Deep Orange' : 'Golden Amber'}`, 'success');
  } catch (error) {
    console.error('Error saving theme:', error);
    showToast('Failed to save theme', 'error');
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Theme selection
  elements.themeOptions.forEach((radio) => {
    radio.addEventListener('change', handleThemeChange);
  });

  elements.llmProvider.addEventListener('change', handleProviderChange);
  elements.toggleVisibility.addEventListener('click', toggleApiKeyVisibility);
  elements.saveApiKey.addEventListener('click', saveApiKey);
  elements.removeApiKey.addEventListener('click', removeApiKey);
  elements.exportData.addEventListener('click', exportData);
  elements.importData.addEventListener('click', triggerImport);
  elements.importFile.addEventListener('change', handleImport);
  elements.clearAllData.addEventListener('click', clearAllData);

  // Save API key on Enter
  elements.apiKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveApiKey();
  });
}

// ============================================
// Initialization
// ============================================
async function init() {
  try {
    await db.initDB();
    await loadTheme();
    await loadProviders();
    await loadStats();
    setupEventListeners();
    console.log('Wing options page initialized');
  } catch (error) {
    console.error('Failed to initialize options page:', error);
  }
}

init();
