/**
 * Wing - Onboarding Page Logic
 * 3-step onboarding: Welcome → Connect AI → Getting Started
 */

import {
  getProviders,
  getCurrentProvider,
  setCurrentProvider,
  saveApiKey,
  validateApiKey,
  hasApiKey,
} from '../lib/api.js';

// ============================================
// DOM Elements
// ============================================
const steps = {
  step1: document.getElementById('step1'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
};

const elements = {
  getStartedBtn: document.getElementById('getStartedBtn'),
  providerSelect: document.getElementById('providerSelect'),
  providerLink: document.getElementById('providerLink'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleVisibility: document.getElementById('toggleVisibility'),
  apiStatus: document.getElementById('apiStatus'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  skipBtn: document.getElementById('skipBtn'),
  mainButtons: document.getElementById('mainButtons'),
  skipConfirm: document.getElementById('skipConfirm'),
  addKeyBtn: document.getElementById('addKeyBtn'),
  continueWithoutBtn: document.getElementById('continueWithoutBtn'),
  startBtn: document.getElementById('startBtn'),
  readySubtitle: document.getElementById('readySubtitle'),
};

const providerCards = document.querySelectorAll('.provider-card');

// Provider configs
const providers = getProviders();
const providerLinks = {
  anthropic: 'https://console.anthropic.com/',
  openai: 'https://platform.openai.com/api-keys',
};
const providerPlaceholders = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
};

// ============================================
// Step Navigation
// ============================================
function goToStep(stepNumber) {
  Object.values(steps).forEach((el) => el.classList.remove('active'));
  steps[`step${stepNumber}`].classList.add('active');
}

// ============================================
// Provider UI
// ============================================
function updateProviderUI() {
  const provider = elements.providerSelect.value;

  elements.providerLink.href = providerLinks[provider] || providerLinks.anthropic;
  elements.apiKeyInput.placeholder = providerPlaceholders[provider] || 'sk-...';

  // Highlight active provider card in the right panel
  providerCards.forEach((card) => {
    card.classList.toggle('active', card.dataset.provider === provider);
  });
}

// ============================================
// API Key Management
// ============================================
function showStatus(message, type) {
  elements.apiStatus.textContent = message;
  elements.apiStatus.className = `api-status ${type}`;
}

function hideStatus() {
  elements.apiStatus.className = 'api-status hidden';
}

async function handleSaveKey() {
  const provider = elements.providerSelect.value;
  const key = elements.apiKeyInput.value.trim();

  if (!key) {
    showStatus('Please enter an API key.', 'error');
    return;
  }

  // Basic format check
  if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
    showStatus('Anthropic keys start with "sk-ant-"', 'error');
    return;
  }
  if (provider === 'openai' && !key.startsWith('sk-')) {
    showStatus('OpenAI keys start with "sk-"', 'error');
    return;
  }

  elements.saveKeyBtn.disabled = true;
  elements.saveKeyBtn.textContent = 'Validating...';
  showStatus('Checking your API key...', 'info');

  try {
    await validateApiKey(provider, key);
    await saveApiKey(provider, key);
    await setCurrentProvider(provider);

    showStatus('API key saved successfully!', 'success');

    // Brief delay so user sees the success message
    setTimeout(() => {
      elements.readySubtitle.textContent = 'Your AI is connected and Wing is ready to use.';
      goToStep(3);
    }, 800);
  } catch (error) {
    showStatus(`Validation failed: ${error.message}`, 'error');
  } finally {
    elements.saveKeyBtn.disabled = false;
    elements.saveKeyBtn.textContent = 'Save & Continue';
  }
}

function handleSkip() {
  // Show the confirmation instead of immediately skipping
  elements.mainButtons.classList.add('hidden');
  elements.skipConfirm.classList.remove('hidden');
}

function handleAddKey() {
  // User changed their mind — go back to the form
  elements.skipConfirm.classList.add('hidden');
  elements.mainButtons.classList.remove('hidden');
  elements.apiKeyInput.focus();
}

function handleContinueWithout() {
  elements.readySubtitle.textContent =
    'Wing is ready to use. You can add your AI key anytime in Settings.';
  goToStep(3);
}

function toggleVisibility() {
  const isPassword = elements.apiKeyInput.type === 'password';
  elements.apiKeyInput.type = isPassword ? 'text' : 'password';
}

// ============================================
// Finish
// ============================================
function handleStart() {
  // Clear the first-run flag
  chrome.storage.local.remove('wingFirstRun');

  // Close the onboarding tab
  window.close();
}

// ============================================
// Event Listeners
// ============================================
elements.getStartedBtn.addEventListener('click', () => goToStep(2));
elements.providerSelect.addEventListener('change', () => {
  updateProviderUI();
  hideStatus();
});
elements.toggleVisibility.addEventListener('click', toggleVisibility);
elements.saveKeyBtn.addEventListener('click', handleSaveKey);
elements.skipBtn.addEventListener('click', handleSkip);
elements.addKeyBtn.addEventListener('click', handleAddKey);
elements.continueWithoutBtn.addEventListener('click', handleContinueWithout);
elements.startBtn.addEventListener('click', handleStart);

// Save on Enter
elements.apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSaveKey();
});

// ============================================
// Init
// ============================================
async function init() {
  // Set initial provider from saved preference
  const current = await getCurrentProvider();
  elements.providerSelect.value = current;
  updateProviderUI();

  // If user already has an API key (e.g. coming back to onboarding), skip to step 3
  const keyExists = await hasApiKey();
  if (keyExists) {
    elements.readySubtitle.textContent = 'Your AI is connected and Wing is ready to use.';
    goToStep(3);
  }
}

init();
