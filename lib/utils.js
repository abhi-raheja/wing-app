/**
 * Wing - Utility Functions
 * Helper functions used throughout the extension
 */

/**
 * Generate a unique ID using timestamp and random string
 * @returns {string} Unique identifier
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Format a timestamp into a readable date string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {boolean} includeTime - Whether to include time in output
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp, includeTime = false) {
  const date = new Date(timestamp);
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', options);
}

/**
 * Truncate text to a specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Debounce function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Get favicon URL for a given page URL
 * @param {string} url - Page URL
 * @returns {string} Favicon URL
 */
export function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return '';
  }
}

/**
 * Toast notification system
 */
class ToastManager {
  constructor() {
    this.container = null;
  }

  init() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'wing-toast-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 3000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `wing-toast wing-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      animation: wing-toast-in 0.2s ease-out;
      max-width: 300px;
      word-wrap: break-word;
      ${type === 'success' ? 'background: #1e8e3e; color: white;' : ''}
      ${type === 'error' ? 'background: #d93025; color: white;' : ''}
      ${type === 'info' ? 'background: #1a73e8; color: white;' : ''}
      ${type === 'warning' ? 'background: #f9ab00; color: #202124;' : ''}
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'wing-toast-out 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }
}

export const toast = new ToastManager();

/**
 * Loading state manager for UI elements
 */
export class LoadingState {
  constructor(element) {
    this.element = element;
    this.originalContent = '';
    this.isLoading = false;
  }

  start(loadingText = 'Loading...') {
    if (this.isLoading) return;
    this.isLoading = true;
    this.originalContent = this.element.innerHTML;
    this.element.disabled = true;
    this.element.innerHTML = `
      <span class="wing-spinner"></span>
      <span>${escapeHtml(loadingText)}</span>
    `;
    this.element.classList.add('wing-loading');
  }

  stop() {
    if (!this.isLoading) return;
    this.isLoading = false;
    this.element.innerHTML = this.originalContent;
    this.element.disabled = false;
    this.element.classList.remove('wing-loading');
  }
}

/**
 * Color palette for collections
 */
export const COLLECTION_COLORS = [
  { name: 'Blue', value: '#1a73e8' },
  { name: 'Red', value: '#d93025' },
  { name: 'Green', value: '#1e8e3e' },
  { name: 'Yellow', value: '#f9ab00' },
  { name: 'Purple', value: '#9334e6' },
  { name: 'Teal', value: '#009688' },
  { name: 'Orange', value: '#e8710a' },
  { name: 'Pink', value: '#d01884' },
  { name: 'Gray', value: '#5f6368' },
];

/**
 * Get a random color from the palette
 * @returns {string} Hex color value
 */
export function getRandomColor() {
  return COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)].value;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
export function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
