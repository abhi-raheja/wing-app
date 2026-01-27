/**
 * Wing - Options Page JavaScript
 * Handles settings, API key management, and data import/export
 */

import * as db from '../lib/db.js';
import { validateApiKey as validateKey } from '../lib/api.js';

// ============================================
// DOM Elements
// ============================================
const elements = {
  apiKey: document.getElementById('apiKey'),
  toggleVisibility: document.getElementById('toggleVisibility'),
  saveApiKey: document.getElementById('saveApiKey'),
  removeApiKey: document.getElementById('removeApiKey'),
  apiKeyStatus: document.getElementById('apiKeyStatus'),
  exportData: document.getElementById('exportData'),
  importData: document.getElementById('importData'),
  importFile: document.getElementById('importFile'),
  clearAllData: document.getElementById('clearAllData'),
  toastContainer: document.getElementById('toastContainer'),
};

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
// API Key Management
// ============================================
async function loadApiKey() {
  try {
    const result = await chrome.storage.local.get('anthropicApiKey');
    if (result.anthropicApiKey) {
      elements.apiKey.value = result.anthropicApiKey;
      showStatus('API key is configured', 'success');
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

async function saveApiKey() {
  const apiKey = elements.apiKey.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  if (!apiKey.startsWith('sk-ant-')) {
    showStatus('Invalid API key format. Should start with "sk-ant-"', 'error');
    return;
  }

  try {
    // Validate API key by making a test request
    showStatus('Validating API key...', 'info');

    await validateKey(apiKey);

    // Save the key
    await chrome.storage.local.set({ anthropicApiKey: apiKey });
    showStatus('API key saved and validated successfully!', 'success');
    showToast('API key saved', 'success');
  } catch (error) {
    console.error('API key validation error:', error);
    showStatus(`Validation failed: ${error.message}`, 'error');
  }
}

async function removeApiKey() {
  if (!confirm('Remove your API key? AI features will be disabled.')) {
    return;
  }

  try {
    await chrome.storage.local.remove('anthropicApiKey');
    elements.apiKey.value = '';
    showStatus('API key removed', 'success');
    showToast('API key removed', 'info');
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
// Data Management
// ============================================
async function exportData() {
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
  }
}

function triggerImport() {
  elements.importFile.click();
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.data || !data.version) {
      throw new Error('Invalid backup file format');
    }

    const replace = confirm(
      'Replace existing data with imported data? Click Cancel to merge instead.'
    );

    await db.importData(data, replace);
    showToast('Data imported successfully', 'success');

    // Reset file input
    elements.importFile.value = '';
  } catch (error) {
    console.error('Import error:', error);
    showToast(`Import failed: ${error.message}`, 'error');
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
  } catch (error) {
    console.error('Clear data error:', error);
    showToast('Failed to clear data', 'error');
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
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
    await loadApiKey();
    setupEventListeners();
    console.log('Wing options page initialized');
  } catch (error) {
    console.error('Failed to initialize options page:', error);
  }
}

init();
