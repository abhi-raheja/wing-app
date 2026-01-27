/**
 * Wing - Popup JavaScript
 * Main UI logic for the extension popup
 */

import * as db from '../lib/db.js';
import * as api from '../lib/api.js';
import {
  generateId,
  formatDate,
  truncateText,
  escapeHtml,
  debounce,
  getFaviconUrl,
  COLLECTION_COLORS,
  getRandomColor,
} from '../lib/utils.js';

// ============================================
// State
// ============================================
let currentView = 'wings';
let collections = [];
let nests = [];
let wings = [];
let currentWingData = null;
let editingCollectionId = null;
let editingNestId = null;
let currentCollectionId = null;
let selectedWingId = null;
let draggedWingId = null;
let currentSortOption = 'newest';
let activeCollectionFilter = null;
let currentSearchQuery = '';
let isQueryLoading = false;
let currentWingHighlights = [];

// ============================================
// DOM Elements
// ============================================
const elements = {
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),

  // Views
  wingsView: document.getElementById('wingsView'),
  collectionsView: document.getElementById('collectionsView'),
  queryView: document.getElementById('queryView'),
  searchContainer: document.getElementById('searchContainer'),

  // Wings
  wingItBtn: document.getElementById('wingItBtn'),
  wingsList: document.getElementById('wingsList'),
  wingsEmpty: document.getElementById('wingsEmpty'),
  searchInput: document.getElementById('searchInput'),
  sortBtn: document.getElementById('sortBtn'),
  sortLabel: document.getElementById('sortLabel'),
  sortMenu: document.getElementById('sortMenu'),
  filterChips: document.getElementById('filterChips'),

  // Collections
  addCollectionBtn: document.getElementById('addCollectionBtn'),
  collectionsList: document.getElementById('collectionsList'),
  collectionsEmpty: document.getElementById('collectionsEmpty'),

  // Query
  queryInput: document.getElementById('queryInput'),
  queryBtn: document.getElementById('queryBtn'),
  queryResults: document.getElementById('queryResults'),
  queryEmpty: document.getElementById('queryEmpty'),

  // Wing It Modal
  wingItModal: document.getElementById('wingItModal'),
  wingItModalClose: document.getElementById('wingItModalClose'),
  wingFavicon: document.getElementById('wingFavicon'),
  wingTitle: document.getElementById('wingTitle'),
  wingUrl: document.getElementById('wingUrl'),
  wingCollections: document.getElementById('wingCollections'),
  noCollectionsMsg: document.getElementById('noCollectionsMsg'),
  wingNestsContainer: document.getElementById('wingNestsContainer'),
  wingNests: document.getElementById('wingNests'),
  wingItCancel: document.getElementById('wingItCancel'),
  wingItConfirm: document.getElementById('wingItConfirm'),
  // Inline collection creation
  addCollectionInline: document.getElementById('addCollectionInline'),
  inlineCollectionForm: document.getElementById('inlineCollectionForm'),
  inlineCollectionName: document.getElementById('inlineCollectionName'),
  inlineColorPicker: document.getElementById('inlineColorPicker'),
  inlineCollectionCancel: document.getElementById('inlineCollectionCancel'),
  inlineCollectionSave: document.getElementById('inlineCollectionSave'),

  // Collection Modal
  collectionModal: document.getElementById('collectionModal'),
  collectionModalTitle: document.getElementById('collectionModalTitle'),
  collectionModalClose: document.getElementById('collectionModalClose'),
  collectionName: document.getElementById('collectionName'),
  collectionDescription: document.getElementById('collectionDescription'),
  colorPicker: document.getElementById('colorPicker'),
  collectionCancel: document.getElementById('collectionCancel'),
  collectionSave: document.getElementById('collectionSave'),

  // Nest Modal
  nestModal: document.getElementById('nestModal'),
  nestModalTitle: document.getElementById('nestModalTitle'),
  nestModalClose: document.getElementById('nestModalClose'),
  nestName: document.getElementById('nestName'),
  nestParent: document.getElementById('nestParent'),
  nestCancel: document.getElementById('nestCancel'),
  nestSave: document.getElementById('nestSave'),

  // Wing Details Modal
  wingDetailsModal: document.getElementById('wingDetailsModal'),
  wingDetailsTitle: document.getElementById('wingDetailsTitle'),
  wingDetailsModalClose: document.getElementById('wingDetailsModalClose'),
  wingDetailsContent: document.getElementById('wingDetailsContent'),
  wingHighlightsSection: document.getElementById('wingHighlightsSection'),
  highlightsCount: document.getElementById('highlightsCount'),
  wingHighlightsList: document.getElementById('wingHighlightsList'),
  wingEditCollections: document.getElementById('wingEditCollections'),
  wingEditNestsContainer: document.getElementById('wingEditNestsContainer'),
  wingEditNests: document.getElementById('wingEditNests'),
  wingDetailsSave: document.getElementById('wingDetailsSave'),
  wingDetailsDelete: document.getElementById('wingDetailsDelete'),
  wingDetailsOpen: document.getElementById('wingDetailsOpen'),

  // Toast
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
// View Navigation
// ============================================
function switchView(viewName) {
  currentView = viewName;

  elements.navTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  elements.wingsView.classList.toggle('active', viewName === 'wings');
  elements.wingsView.classList.toggle('hidden', viewName !== 'wings');
  elements.collectionsView.classList.toggle('active', viewName === 'collections');
  elements.collectionsView.classList.toggle('hidden', viewName !== 'collections');
  elements.queryView.classList.toggle('active', viewName === 'query');
  elements.queryView.classList.toggle('hidden', viewName !== 'query');

  elements.searchContainer.classList.toggle('hidden', viewName !== 'wings');
}

// ============================================
// Checkbox Rendering Helpers
// ============================================
function renderCollectionCheckboxes(container, selectedIds = [], prefix = 'wing') {
  if (collections.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = collections
    .map(
      (c) => `
      <div class="checkbox-item">
        <input type="checkbox" id="${prefix}-col-${c.id}" value="${c.id}"
               ${selectedIds.includes(c.id) ? 'checked' : ''}>
        <label for="${prefix}-col-${c.id}">
          <span class="checkbox-color-dot" style="background: ${c.color}"></span>
          ${escapeHtml(c.name)}
        </label>
      </div>
    `
    )
    .join('');
}

function renderNestCheckboxes(container, collectionIds, selectedNestIds = [], prefix = 'wing') {
  // Get nests from selected collections
  const availableNests = nests.filter((n) => collectionIds.includes(n.collectionId));

  if (availableNests.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Build hierarchical nest list
  const nestHtml = buildNestCheckboxes(availableNests, null, selectedNestIds, prefix, 0);
  container.innerHTML = nestHtml;
}

function buildNestCheckboxes(allNests, parentId, selectedIds, prefix, level) {
  const filteredNests = allNests.filter((n) => n.parentId === parentId);
  let html = '';

  filteredNests.forEach((nest) => {
    const collection = collections.find((c) => c.id === nest.collectionId);
    const levelClass = level > 0 ? `nested${level > 1 ? '-' + level : ''}` : '';

    html += `
      <div class="checkbox-item ${levelClass}">
        <input type="checkbox" id="${prefix}-nest-${nest.id}" value="${nest.id}"
               data-collection-id="${nest.collectionId}"
               ${selectedIds.includes(nest.id) ? 'checked' : ''}>
        <label for="${prefix}-nest-${nest.id}">
          <span class="checkbox-color-dot" style="background: ${collection?.color || '#999'}"></span>
          ${escapeHtml(nest.name)}
        </label>
      </div>
    `;

    // Recursively add children
    html += buildNestCheckboxes(allNests, nest.id, selectedIds, prefix, level + 1);
  });

  return html;
}

function getSelectedCheckboxValues(container) {
  const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map((cb) => cb.value);
}

// ============================================
// Sorting
// ============================================
function sortWings(wingsArray, sortOption) {
  switch (sortOption) {
    case 'newest':
      return wingsArray.sort((a, b) => b.timestamp - a.timestamp);
    case 'oldest':
      return wingsArray.sort((a, b) => a.timestamp - b.timestamp);
    case 'title-asc':
      return wingsArray.sort((a, b) =>
        (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase())
      );
    case 'title-desc':
      return wingsArray.sort((a, b) =>
        (b.title || '').toLowerCase().localeCompare((a.title || '').toLowerCase())
      );
    default:
      return wingsArray;
  }
}

const sortLabels = {
  newest: 'Newest',
  oldest: 'Oldest',
  'title-asc': 'A-Z',
  'title-desc': 'Z-A',
};

function updateSortUI() {
  // Update button label
  elements.sortLabel.textContent = sortLabels[currentSortOption] || 'Sort';

  // Update active state in menu
  elements.sortMenu.querySelectorAll('.sort-option').forEach((option) => {
    option.classList.toggle('active', option.dataset.sort === currentSortOption);
  });
}

function toggleSortMenu() {
  elements.sortMenu.classList.toggle('hidden');
}

function closeSortMenu() {
  elements.sortMenu.classList.add('hidden');
}

function handleSortChange(sortOption) {
  currentSortOption = sortOption;
  updateSortUI();
  closeSortMenu();
  renderFilteredWings();
}

// ============================================
// Filter Chips
// ============================================
function renderFilterChips() {
  if (collections.length === 0) {
    elements.filterChips.classList.add('hidden');
    return;
  }

  elements.filterChips.classList.remove('hidden');

  const chipsHtml = collections.map((c) => `
    <button class="filter-chip ${activeCollectionFilter === c.id ? 'active' : ''}" data-collection-id="${c.id}">
      <span class="filter-chip-dot" style="background: ${c.color}"></span>
      ${escapeHtml(c.name)}
    </button>
  `).join('');

  const clearChip = activeCollectionFilter
    ? '<button class="filter-chip filter-chip-clear" data-action="clear">Clear filter</button>'
    : '';

  elements.filterChips.innerHTML = chipsHtml + clearChip;
}

function handleFilterChipClick(collectionId) {
  if (activeCollectionFilter === collectionId) {
    activeCollectionFilter = null;
  } else {
    activeCollectionFilter = collectionId;
  }
  renderFilterChips();
  renderFilteredWings();
}

function clearCollectionFilter() {
  activeCollectionFilter = null;
  renderFilterChips();
  renderFilteredWings();
}

// ============================================
// Search Highlighting
// ============================================
function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text || '');

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const escaped = escapeHtml(text);
  return escaped.replace(regex, '<span class="search-match">$1</span>');
}

function getMatchedFields(wing, query) {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const matches = [];

  if (wing.title?.toLowerCase().includes(lowerQuery)) matches.push('title');
  if (wing.url?.toLowerCase().includes(lowerQuery)) matches.push('url');
  if (wing.summary?.toLowerCase().includes(lowerQuery)) matches.push('summary');

  return matches;
}

// ============================================
// Filtered Rendering
// ============================================
function renderFilteredWings() {
  let filtered = [...wings];

  // Apply collection filter
  if (activeCollectionFilter) {
    filtered = filtered.filter((w) =>
      (w.collectionIds || []).includes(activeCollectionFilter)
    );
  }

  // Apply search filter
  if (currentSearchQuery.trim()) {
    const lowerQuery = currentSearchQuery.toLowerCase();
    filtered = filtered.filter((w) =>
      w.title?.toLowerCase().includes(lowerQuery) ||
      w.url?.toLowerCase().includes(lowerQuery) ||
      w.summary?.toLowerCase().includes(lowerQuery)
    );
  }

  renderWingsWithHighlighting(filtered, currentSearchQuery);
}

function renderWingsWithHighlighting(wingsToRender, searchQuery) {
  if (wingsToRender.length === 0) {
    elements.wingsList.innerHTML = '';
    elements.wingsEmpty.classList.remove('hidden');
    if (searchQuery || activeCollectionFilter) {
      elements.wingsEmpty.querySelector('.empty-text').textContent = 'No matching wings';
      elements.wingsEmpty.querySelector('.empty-subtext').textContent = 'Try a different search or filter';
    } else {
      elements.wingsEmpty.querySelector('.empty-text').textContent = 'No wings yet';
      elements.wingsEmpty.querySelector('.empty-subtext').textContent = 'Click "Wing It" to save your first page';
    }
    return;
  }

  elements.wingsEmpty.classList.add('hidden');

  const sortedWings = sortWings([...wingsToRender], currentSortOption);

  elements.wingsList.innerHTML = sortedWings
    .map((wing) => {
      const wingCollections = (wing.collectionIds || [])
        .map((id) => collections.find((c) => c.id === id))
        .filter(Boolean);

      const firstCollection = wingCollections[0];
      const moreCount = wingCollections.length - 1;

      const matchedFields = getMatchedFields(wing, searchQuery);
      const showMatchInfo = searchQuery && matchedFields.length > 0;

      const title = searchQuery
        ? highlightText(wing.title || 'Untitled', searchQuery)
        : escapeHtml(wing.title || 'Untitled');

      const url = searchQuery
        ? highlightText(truncateText(wing.url, 50), searchQuery)
        : escapeHtml(truncateText(wing.url, 50));

      return `
      <div class="wing-card" data-wing-id="${wing.id}" draggable="true">
        <img class="wing-card-favicon" src="${getFaviconUrl(wing.url)}" alt=""
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>'">
        <div class="wing-card-content">
          <div class="wing-card-title">${title}</div>
          <div class="wing-card-url">${url}</div>
          ${showMatchInfo && matchedFields.includes('summary') ? `
            <div class="wing-card-match-info">
              <span>Match in summary</span>
            </div>
          ` : ''}
          <div class="wing-card-meta">
            <span>${formatDate(wing.timestamp)}</span>
            ${
              firstCollection
                ? `<span class="wing-card-collection">
                     <span class="wing-card-collection-dot" style="background: ${firstCollection.color}"></span>
                     ${escapeHtml(firstCollection.name)}${moreCount > 0 ? ` +${moreCount}` : ''}
                   </span>`
                : ''
            }
            ${!wing.summary ? '<span class="wing-card-collection" style="background: #fff3e0; color: #e65100;">Summarizing...</span>' : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// ============================================
// Wings Rendering
// ============================================
function renderWings(wingsToRender = wings) {
  if (wingsToRender.length === 0) {
    elements.wingsList.innerHTML = '';
    elements.wingsEmpty.classList.remove('hidden');
    return;
  }

  elements.wingsEmpty.classList.add('hidden');

  const sortedWings = sortWings([...wingsToRender], currentSortOption);

  elements.wingsList.innerHTML = sortedWings
    .map((wing) => {
      // Get first collection for display (show badge for multiple)
      const wingCollections = (wing.collectionIds || [])
        .map((id) => collections.find((c) => c.id === id))
        .filter(Boolean);

      const firstCollection = wingCollections[0];
      const moreCount = wingCollections.length - 1;

      return `
      <div class="wing-card" data-wing-id="${wing.id}" draggable="true">
        <img class="wing-card-favicon" src="${getFaviconUrl(wing.url)}" alt=""
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>'">
        <div class="wing-card-content">
          <div class="wing-card-title">${escapeHtml(wing.title || 'Untitled')}</div>
          <div class="wing-card-url">${escapeHtml(truncateText(wing.url, 50))}</div>
          <div class="wing-card-meta">
            <span>${formatDate(wing.timestamp)}</span>
            ${
              firstCollection
                ? `<span class="wing-card-collection">
                     <span class="wing-card-collection-dot" style="background: ${firstCollection.color}"></span>
                     ${escapeHtml(firstCollection.name)}${moreCount > 0 ? ` +${moreCount}` : ''}
                   </span>`
                : ''
            }
            ${!wing.summary ? '<span class="wing-card-collection" style="background: #fff3e0; color: #e65100;">Summarizing...</span>' : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// ============================================
// Collections Rendering
// ============================================
function renderCollections() {
  if (collections.length === 0) {
    elements.collectionsList.innerHTML = '';
    elements.collectionsEmpty.classList.remove('hidden');
    return;
  }

  elements.collectionsEmpty.classList.add('hidden');

  elements.collectionsList.innerHTML = collections
    .map((collection) => {
      const collectionWings = wings.filter((w) =>
        (w.collectionIds || []).includes(collection.id)
      );
      const collectionNests = nests.filter(
        (n) => n.collectionId === collection.id && !n.parentId
      );

      // Wings not in any nest (directly in collection)
      const wingsNotInNest = collectionWings.filter(
        (w) => !(w.nestIds || []).some((nid) => nests.some((n) => n.id === nid && n.collectionId === collection.id))
      );

      return `
      <div class="collection-card" data-collection-id="${collection.id}">
        <div class="collection-header drop-target" data-collection-id="${collection.id}">
          <div class="collection-color" style="background: ${collection.color}"></div>
          <div class="collection-info">
            <div class="collection-name">${escapeHtml(collection.name)}</div>
            ${
              collection.description
                ? `<div class="collection-description">${escapeHtml(collection.description)}</div>`
                : ''
            }
          </div>
          <div class="collection-count">${collectionWings.length} wings</div>
          <div class="collection-actions">
            <button class="collection-action-btn edit-collection-btn" title="Edit">✏️</button>
            <button class="collection-action-btn delete-collection-btn" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="collection-content hidden">
          <div class="nests-tree">
            ${renderNestsTree(collectionNests, collection.id)}
          </div>
          <button class="add-nest-btn" data-collection-id="${collection.id}">
            + Add Nest
          </button>

          ${collectionWings.length > 0 ? `
            <div class="collection-wings">
              <div class="collection-wings-title">Wings in this collection</div>
              ${collectionWings.map((w) => `
                <div class="collection-wing-item" data-wing-id="${w.id}" draggable="true">
                  <img class="collection-wing-favicon" src="${getFaviconUrl(w.url)}" alt=""
                       onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>'">
                  <span class="collection-wing-title">${escapeHtml(truncateText(w.title || 'Untitled', 40))}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    })
    .join('');
}

function renderNestsTree(nestsList, collectionId, parentId = null) {
  const filteredNests = nestsList.filter((n) => n.parentId === parentId);

  if (filteredNests.length === 0 && parentId === null) {
    return '<div class="empty-nests">No nests yet</div>';
  }

  return filteredNests
    .map((nest) => {
      const childNests = nests.filter((n) => n.parentId === nest.id);
      const nestWings = wings.filter((w) => (w.nestIds || []).includes(nest.id));

      return `
      <div class="nest-item drop-target" data-nest-id="${nest.id}" data-collection-id="${nest.collectionId}">
        <span class="nest-icon">📁</span>
        <span class="nest-name">${escapeHtml(nest.name)}</span>
        <span class="nest-count">(${nestWings.length})</span>
        <div class="nest-actions">
          <button class="collection-action-btn edit-nest-btn" title="Edit">✏️</button>
          <button class="collection-action-btn delete-nest-btn" title="Delete">🗑️</button>
        </div>
      </div>
      ${nestWings.length > 0 ? `
        <div class="nest-wings">
          ${nestWings.map((w) => `
            <div class="collection-wing-item" data-wing-id="${w.id}" draggable="true">
              <img class="collection-wing-favicon" src="${getFaviconUrl(w.url)}" alt=""
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>'">
              <span class="collection-wing-title">${escapeHtml(truncateText(w.title || 'Untitled', 35))}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${childNests.length > 0 ? `<div class="nests-tree">${renderNestsTree(nests, collectionId, nest.id)}</div>` : ''}
    `;
    })
    .join('');
}

// ============================================
// Color Picker
// ============================================
let selectedColor = COLLECTION_COLORS[0].value;

function renderColorPicker() {
  elements.colorPicker.innerHTML = COLLECTION_COLORS.map(
    (color) => `
    <div class="color-option ${color.value === selectedColor ? 'selected' : ''}"
         data-color="${color.value}"
         style="background: ${color.value}"
         title="${color.name}">
    </div>
  `
  ).join('');
}

// ============================================
// Modal Helpers
// ============================================
function openModal(modal) {
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.classList.add('hidden');
  });
}

// ============================================
// Wing It Flow (Quick Wing)
// ============================================
async function openWingItModal() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showToast('Could not get current tab', 'error');
      return;
    }

    // Check if already winged
    const existingWing = await db.getWingByUrl(tab.url);
    if (existingWing) {
      showToast('This page is already winged!', 'warning');
      // Open details modal instead
      selectedWingId = existingWing.id;
      openWingDetails(existingWing.id);
      return;
    }

    currentWingData = {
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl || getFaviconUrl(tab.url),
      tabId: tab.id,
    };

    // Update modal preview
    elements.wingFavicon.src = currentWingData.favicon;
    elements.wingFavicon.onerror = () => {
      elements.wingFavicon.src =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔗</text></svg>';
    };
    elements.wingTitle.textContent = currentWingData.title || 'Untitled';
    elements.wingUrl.textContent = currentWingData.url;

    // Render collection checkboxes
    if (collections.length === 0) {
      elements.wingCollections.classList.add('hidden');
      elements.noCollectionsMsg.classList.remove('hidden');
    } else {
      elements.wingCollections.classList.remove('hidden');
      elements.noCollectionsMsg.classList.add('hidden');
      renderCollectionCheckboxes(elements.wingCollections, [], 'new');
    }

    // Hide nests initially
    elements.wingNestsContainer.classList.add('hidden');
    elements.wingNests.innerHTML = '';

    openModal(elements.wingItModal);
  } catch (error) {
    console.error('Error opening Wing It modal:', error);
    showToast('Failed to get page info', 'error');
  }
}

function updateNestsForSelectedCollections() {
  const selectedCollectionIds = getSelectedCheckboxValues(elements.wingCollections);

  if (selectedCollectionIds.length === 0) {
    elements.wingNestsContainer.classList.add('hidden');
    return;
  }

  const availableNests = nests.filter((n) => selectedCollectionIds.includes(n.collectionId));

  if (availableNests.length === 0) {
    elements.wingNestsContainer.classList.add('hidden');
    return;
  }

  elements.wingNestsContainer.classList.remove('hidden');
  renderNestCheckboxes(elements.wingNests, selectedCollectionIds, [], 'new');
}

async function saveWing() {
  if (!currentWingData) return;

  try {
    const collectionIds = getSelectedCheckboxValues(elements.wingCollections);
    const nestIds = getSelectedCheckboxValues(elements.wingNests);

    const wing = {
      id: generateId(),
      url: currentWingData.url,
      title: currentWingData.title,
      favicon: currentWingData.favicon,
      summary: null, // Will be generated in background
      fullContent: null,
      collectionIds,
      nestIds,
    };

    const savedWing = await db.createWing(wing);
    wings.push(savedWing);

    closeModal(elements.wingItModal);
    renderWings();
    showToast('Page winged!', 'success');

    // Trigger background summary generation
    generateSummaryInBackground(savedWing.id, currentWingData.tabId);

    currentWingData = null;
  } catch (error) {
    console.error('Error saving wing:', error);
    showToast('Failed to save wing', 'error');
  }
}

async function generateSummaryInBackground(wingId, tabId) {
  try {
    // Check if API key is set
    const result = await chrome.storage.local.get('anthropicApiKey');
    if (!result.anthropicApiKey) {
      return; // No API key, skip summary
    }

    // Send message to background to generate summary
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_SUMMARY',
      tabId: tabId,
    });

    if (response && response.summary) {
      // Update the wing with the summary
      await db.updateWing(wingId, {
        summary: response.summary,
        fullContent: response.fullContent,
      });

      // Update local state
      const wingIndex = wings.findIndex((w) => w.id === wingId);
      if (wingIndex !== -1) {
        wings[wingIndex].summary = response.summary;
        wings[wingIndex].fullContent = response.fullContent;
      }

      // Re-render to remove "Summarizing..." badge
      renderWings();
    }
  } catch (error) {
    console.error('Error generating summary:', error);
  }
}

// ============================================
// Inline Collection Creation (in Wing It flow)
// ============================================
let inlineSelectedColor = COLLECTION_COLORS[0].value;

function renderInlineColorPicker() {
  elements.inlineColorPicker.innerHTML = COLLECTION_COLORS.map(
    (color) => `
    <div class="color-option ${color.value === inlineSelectedColor ? 'selected' : ''}"
         data-color="${color.value}"
         style="background: ${color.value}"
         title="${color.name}">
    </div>
  `
  ).join('');
}

function showInlineCollectionForm() {
  inlineSelectedColor = getRandomColor();
  elements.inlineCollectionName.value = '';
  renderInlineColorPicker();
  elements.inlineCollectionForm.classList.remove('hidden');
  elements.inlineCollectionName.focus();
}

function hideInlineCollectionForm() {
  elements.inlineCollectionForm.classList.add('hidden');
  elements.inlineCollectionName.value = '';
}

async function saveInlineCollection() {
  const name = elements.inlineCollectionName.value.trim();

  if (!name) {
    showToast('Please enter a collection name', 'error');
    return;
  }

  try {
    const collection = await db.createCollection({
      id: generateId(),
      name,
      description: '',
      color: inlineSelectedColor,
    });

    collections.push(collection);

    // Hide the inline form
    hideInlineCollectionForm();

    // Refresh the collections checkboxes and auto-select the new one
    elements.wingCollections.classList.remove('hidden');
    elements.noCollectionsMsg.classList.add('hidden');
    renderCollectionCheckboxes(elements.wingCollections, [collection.id], 'new');

    // Update nests in case user had selected collections before
    updateNestsForSelectedCollections();

    // Also update filter chips in the background
    renderFilterChips();

    showToast('Collection created!', 'success');
  } catch (error) {
    console.error('Error creating collection:', error);
    showToast('Failed to create collection', 'error');
  }
}

// ============================================
// Collection Management
// ============================================
function openCollectionModal(collection = null) {
  editingCollectionId = collection?.id || null;

  elements.collectionModalTitle.textContent = collection
    ? 'Edit Collection'
    : 'New Collection';
  elements.collectionName.value = collection?.name || '';
  elements.collectionDescription.value = collection?.description || '';
  selectedColor = collection?.color || getRandomColor();

  renderColorPicker();
  openModal(elements.collectionModal);
  elements.collectionName.focus();
}

async function saveCollection() {
  const name = elements.collectionName.value.trim();

  if (!name) {
    showToast('Please enter a collection name', 'error');
    return;
  }

  try {
    if (editingCollectionId) {
      await db.updateCollection(editingCollectionId, {
        name,
        description: elements.collectionDescription.value.trim(),
        color: selectedColor,
      });

      const index = collections.findIndex((c) => c.id === editingCollectionId);
      if (index !== -1) {
        collections[index] = {
          ...collections[index],
          name,
          description: elements.collectionDescription.value.trim(),
          color: selectedColor,
        };
      }

      showToast('Collection updated', 'success');
    } else {
      const collection = await db.createCollection({
        id: generateId(),
        name,
        description: elements.collectionDescription.value.trim(),
        color: selectedColor,
      });

      collections.push(collection);
      showToast('Collection created', 'success');
    }

    closeModal(elements.collectionModal);
    renderCollections();
    renderFilterChips();
  } catch (error) {
    console.error('Error saving collection:', error);
    showToast('Failed to save collection', 'error');
  }
}

async function deleteCollection(id) {
  if (!confirm('Delete this collection? Wings will remain but lose this collection tag.')) {
    return;
  }

  try {
    await db.deleteCollection(id);

    collections = collections.filter((c) => c.id !== id);
    nests = nests.filter((n) => n.collectionId !== id);

    // Update local wings state
    wings = wings.map((w) => ({
      ...w,
      collectionIds: (w.collectionIds || []).filter((cid) => cid !== id),
      nestIds: (w.nestIds || []).filter((nid) => !nests.some((n) => n.id === nid && n.collectionId === id)),
    }));

    // Clear filter if deleted collection was active
    if (activeCollectionFilter === id) {
      activeCollectionFilter = null;
    }

    renderCollections();
    renderFilterChips();
    renderFilteredWings();
    showToast('Collection deleted', 'success');
  } catch (error) {
    console.error('Error deleting collection:', error);
    showToast('Failed to delete collection', 'error');
  }
}

// ============================================
// Nest Management
// ============================================
function openNestModal(collectionId, nest = null) {
  currentCollectionId = collectionId;
  editingNestId = nest?.id || null;

  elements.nestModalTitle.textContent = nest ? 'Edit Nest' : 'New Nest';
  elements.nestName.value = nest?.name || '';

  const collectionNests = nests.filter(
    (n) => n.collectionId === collectionId && n.id !== nest?.id
  );
  elements.nestParent.innerHTML =
    '<option value="">No parent (root level)</option>' +
    buildNestOptions(collectionNests);

  if (nest?.parentId) {
    elements.nestParent.value = nest.parentId;
  }

  openModal(elements.nestModal);
  elements.nestName.focus();
}

function buildNestOptions(allNests, parentId = null, level = 0) {
  const filteredNests = allNests.filter((n) => n.parentId === parentId);
  let html = '';

  filteredNests.forEach((nest) => {
    const indent = '  '.repeat(level);
    html += `<option value="${nest.id}">${indent}${escapeHtml(nest.name)}</option>`;
    html += buildNestOptions(allNests, nest.id, level + 1);
  });

  return html;
}

async function saveNest() {
  const name = elements.nestName.value.trim();

  if (!name) {
    showToast('Please enter a nest name', 'error');
    return;
  }

  try {
    if (editingNestId) {
      await db.updateNest(editingNestId, {
        name,
        parentId: elements.nestParent.value || null,
      });

      const index = nests.findIndex((n) => n.id === editingNestId);
      if (index !== -1) {
        nests[index] = {
          ...nests[index],
          name,
          parentId: elements.nestParent.value || null,
        };
      }

      showToast('Nest updated', 'success');
    } else {
      const nest = await db.createNest({
        id: generateId(),
        name,
        collectionId: currentCollectionId,
        parentId: elements.nestParent.value || null,
      });

      nests.push(nest);
      showToast('Nest created', 'success');
    }

    closeModal(elements.nestModal);
    renderCollections();
  } catch (error) {
    console.error('Error saving nest:', error);
    showToast('Failed to save nest', 'error');
  }
}

async function deleteNest(id) {
  if (!confirm('Delete this nest? Child nests will be moved up.')) {
    return;
  }

  try {
    const nest = nests.find((n) => n.id === id);
    await db.deleteNest(id);

    nests = nests
      .filter((n) => n.id !== id)
      .map((n) => (n.parentId === id ? { ...n, parentId: nest?.parentId || null } : n));

    // Update local wings state
    wings = wings.map((w) => ({
      ...w,
      nestIds: (w.nestIds || []).filter((nid) => nid !== id),
    }));

    renderCollections();
    showToast('Nest deleted', 'success');
  } catch (error) {
    console.error('Error deleting nest:', error);
    showToast('Failed to delete nest', 'error');
  }
}

// ============================================
// Wing Details (with Edit)
// ============================================
async function openWingDetails(wingId) {
  const wing = wings.find((w) => w.id === wingId);
  if (!wing) return;

  selectedWingId = wingId;

  // Load highlights for this wing
  try {
    currentWingHighlights = await db.getHighlightsByWing(wingId);
  } catch (error) {
    console.error('Error loading highlights:', error);
    currentWingHighlights = [];
  }

  const wingCollections = (wing.collectionIds || [])
    .map((id) => collections.find((c) => c.id === id))
    .filter(Boolean);

  const wingNests = (wing.nestIds || [])
    .map((id) => nests.find((n) => n.id === id))
    .filter(Boolean);

  elements.wingDetailsTitle.textContent = truncateText(wing.title || 'Untitled', 30);

  elements.wingDetailsContent.innerHTML = `
    <div class="wing-preview">
      <img class="wing-favicon" src="${getFaviconUrl(wing.url)}" alt=""
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>'">
      <div class="wing-info">
        <div class="wing-title">${escapeHtml(wing.title || 'Untitled')}</div>
        <a class="wing-details-url" href="${wing.url}" target="_blank">${escapeHtml(truncateText(wing.url, 40))}</a>
      </div>
    </div>

    ${
      wing.summary
        ? `
      <div class="wing-details-section">
        <div class="wing-details-label">Summary</div>
        <div class="wing-summary">${escapeHtml(wing.summary)}</div>
      </div>
    `
        : `
      <div class="summary-status">
        <div class="spinner"></div>
        <span>AI summary generating...</span>
      </div>
    `
    }

    <div class="wing-details-section">
      <div class="wing-details-label">Saved</div>
      <div class="wing-details-value">${formatDate(wing.timestamp, true)}</div>
    </div>

    ${
      wingCollections.length > 0
        ? `
      <div class="wing-details-section">
        <div class="wing-details-label">Collections</div>
        <div class="wing-details-value">
          ${wingCollections
            .map(
              (c) => `
            <span class="wing-card-collection" style="margin-right: 4px; margin-bottom: 4px;">
              <span class="wing-card-collection-dot" style="background: ${c.color}"></span>
              ${escapeHtml(c.name)}
            </span>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : ''
    }

    ${
      wingNests.length > 0
        ? `
      <div class="wing-details-section">
        <div class="wing-details-label">Nests</div>
        <div class="wing-details-value">
          ${wingNests.map((n) => escapeHtml(n.name)).join(', ')}
        </div>
      </div>
    `
        : ''
    }
  `;

  // Render highlights
  renderWingHighlights();

  // Render edit checkboxes
  renderCollectionCheckboxes(elements.wingEditCollections, wing.collectionIds || [], 'edit');

  // Update nests based on selected collections
  const selectedCollectionIds = wing.collectionIds || [];
  if (selectedCollectionIds.length > 0) {
    const availableNests = nests.filter((n) => selectedCollectionIds.includes(n.collectionId));
    if (availableNests.length > 0) {
      elements.wingEditNestsContainer.classList.remove('hidden');
      renderNestCheckboxes(elements.wingEditNests, selectedCollectionIds, wing.nestIds || [], 'edit');
    } else {
      elements.wingEditNestsContainer.classList.add('hidden');
    }
  } else {
    elements.wingEditNestsContainer.classList.add('hidden');
  }

  openModal(elements.wingDetailsModal);
}

function updateEditNestsForSelectedCollections() {
  const selectedCollectionIds = getSelectedCheckboxValues(elements.wingEditCollections);
  const wing = wings.find((w) => w.id === selectedWingId);

  if (selectedCollectionIds.length === 0) {
    elements.wingEditNestsContainer.classList.add('hidden');
    return;
  }

  const availableNests = nests.filter((n) => selectedCollectionIds.includes(n.collectionId));

  if (availableNests.length === 0) {
    elements.wingEditNestsContainer.classList.add('hidden');
    return;
  }

  elements.wingEditNestsContainer.classList.remove('hidden');
  // Keep currently selected nests that are still valid
  const currentNestIds = (wing?.nestIds || []).filter((nid) =>
    availableNests.some((n) => n.id === nid)
  );
  renderNestCheckboxes(elements.wingEditNests, selectedCollectionIds, currentNestIds, 'edit');
}

// ============================================
// Highlights Management
// ============================================
function renderWingHighlights() {
  if (currentWingHighlights.length === 0) {
    elements.wingHighlightsSection.classList.add('hidden');
    return;
  }

  elements.wingHighlightsSection.classList.remove('hidden');
  elements.highlightsCount.textContent = `${currentWingHighlights.length} highlight${currentWingHighlights.length !== 1 ? 's' : ''}`;

  elements.wingHighlightsList.innerHTML = currentWingHighlights
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((highlight) => {
      const date = formatDate(highlight.timestamp);
      return `
        <div class="highlight-item" data-highlight-id="${highlight.id}">
          <div class="highlight-item-text">"${escapeHtml(highlight.selectedText)}"</div>
          ${highlight.annotation ? `<div class="highlight-item-annotation">${escapeHtml(highlight.annotation)}</div>` : ''}
          <div class="highlight-item-footer">
            <span class="highlight-item-date">${date}</span>
            <div class="highlight-item-actions">
              <button class="highlight-action-btn" data-action="goto" title="Go to highlight">📍</button>
              <button class="highlight-action-btn delete" data-action="delete" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

async function deleteHighlightFromPopup(highlightId) {
  if (!confirm('Delete this highlight?')) return;

  try {
    await db.deleteHighlight(highlightId);
    currentWingHighlights = currentWingHighlights.filter((h) => h.id !== highlightId);
    renderWingHighlights();
    showToast('Highlight deleted', 'success');
  } catch (error) {
    console.error('Error deleting highlight:', error);
    showToast('Failed to delete highlight', 'error');
  }
}

async function goToHighlight(highlightId) {
  const wing = wings.find((w) => w.id === selectedWingId);
  if (!wing) return;

  // Open the page in a new tab
  const tab = await chrome.tabs.create({ url: wing.url, active: true });

  // Close the popup (it will close automatically when opening a new tab)
  showToast('Opening page...', 'info');
}

async function saveWingChanges() {
  if (!selectedWingId) return;

  try {
    const collectionIds = getSelectedCheckboxValues(elements.wingEditCollections);
    const nestIds = getSelectedCheckboxValues(elements.wingEditNests);

    await db.updateWing(selectedWingId, { collectionIds, nestIds });

    const wingIndex = wings.findIndex((w) => w.id === selectedWingId);
    if (wingIndex !== -1) {
      wings[wingIndex].collectionIds = collectionIds;
      wings[wingIndex].nestIds = nestIds;
    }

    closeModal(elements.wingDetailsModal);
    renderWings();
    renderCollections();
    showToast('Wing updated', 'success');
  } catch (error) {
    console.error('Error saving wing changes:', error);
    showToast('Failed to update wing', 'error');
  }
}

async function deleteWing() {
  if (!selectedWingId) return;

  if (!confirm('Delete this wing?')) return;

  try {
    await db.deleteWing(selectedWingId);
    wings = wings.filter((w) => w.id !== selectedWingId);

    closeModal(elements.wingDetailsModal);
    renderWings();
    renderCollections();
    showToast('Wing deleted', 'success');
  } catch (error) {
    console.error('Error deleting wing:', error);
    showToast('Failed to delete wing', 'error');
  }
}

function openWingPage() {
  const wing = wings.find((w) => w.id === selectedWingId);
  if (wing) {
    chrome.tabs.create({ url: wing.url });
  }
}

// ============================================
// Search
// ============================================
const handleSearch = debounce((query) => {
  currentSearchQuery = query;
  renderFilteredWings();
}, 300);

// ============================================
// AI Query
// ============================================
async function handleQuery() {
  const query = elements.queryInput.value.trim();

  if (!query) {
    showToast('Please enter a question', 'error');
    return;
  }

  // Check for API key
  const hasKey = await api.hasApiKey();
  if (!hasKey) {
    showToast('Please add your API key in Settings', 'error');
    // Open options page
    chrome.runtime.openOptionsPage();
    return;
  }

  if (wings.length === 0) {
    showToast('No wings saved yet. Wing some pages first!', 'error');
    return;
  }

  setQueryLoading(true);

  try {
    const result = await api.queryWings(query, wings);
    renderQueryResults(result);
  } catch (error) {
    console.error('Query error:', error);
    showQueryError(error.message);
  } finally {
    setQueryLoading(false);
  }
}

function setQueryLoading(loading) {
  isQueryLoading = loading;
  elements.queryBtn.disabled = loading;
  elements.queryBtn.innerHTML = loading
    ? '<span class="spinner"></span> Thinking...'
    : 'Ask Wing AI';
  elements.queryInput.disabled = loading;
}

function renderQueryResults(result) {
  elements.queryEmpty.classList.add('hidden');
  elements.queryResults.classList.remove('hidden');

  // Format the answer with proper line breaks
  const formattedAnswer = escapeHtml(result.answer)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  let html = `
    <div class="query-answer">
      <p>${formattedAnswer}</p>
    </div>
  `;

  // Add citations if available
  if (result.citations && result.citations.length > 0) {
    html += `
      <div class="query-citations">
        <div class="query-citations-title">Sources</div>
        ${result.citations.map((wing) => `
          <a href="${wing.url}" target="_blank" class="query-citation" title="${escapeHtml(wing.title || 'Untitled')}">
            <img src="${getFaviconUrl(wing.url)}" alt="" class="query-citation-favicon"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>'">
            <span class="query-citation-title">${escapeHtml(truncateText(wing.title || 'Untitled', 40))}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  elements.queryResults.innerHTML = html;
}

function showQueryError(message) {
  elements.queryEmpty.classList.add('hidden');
  elements.queryResults.classList.remove('hidden');
  elements.queryResults.innerHTML = `
    <div class="query-error">
      <div class="query-error-icon">⚠️</div>
      <div class="query-error-message">${escapeHtml(message)}</div>
      <button class="btn btn-secondary" onclick="document.getElementById('queryResults').classList.add('hidden'); document.getElementById('queryEmpty').classList.remove('hidden');">
        Try again
      </button>
    </div>
  `;
}

function clearQueryResults() {
  elements.queryResults.classList.add('hidden');
  elements.queryResults.innerHTML = '';
  elements.queryEmpty.classList.remove('hidden');
}

// ============================================
// Drag and Drop
// ============================================
function handleDragStart(e) {
  const wingElement = e.target.closest('[data-wing-id]');
  if (!wingElement) return;

  draggedWingId = wingElement.dataset.wingId;
  wingElement.classList.add('dragging');

  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedWingId);
}

function handleDragEnd(e) {
  const wingElement = e.target.closest('[data-wing-id]');
  if (wingElement) {
    wingElement.classList.remove('dragging');
  }
  draggedWingId = null;

  // Remove all drag-over states
  document.querySelectorAll('.drag-over').forEach((el) => {
    el.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  const dropTarget = e.target.closest('.drop-target');
  if (!dropTarget || !draggedWingId) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  dropTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  const dropTarget = e.target.closest('.drop-target');
  if (!dropTarget) return;

  // Only remove drag-over if we're actually leaving the element
  const relatedTarget = e.relatedTarget;
  if (!dropTarget.contains(relatedTarget)) {
    dropTarget.classList.remove('drag-over');
  }
}

async function handleDrop(e) {
  e.preventDefault();

  const dropTarget = e.target.closest('.drop-target');
  if (!dropTarget || !draggedWingId) return;

  dropTarget.classList.remove('drag-over');

  const wing = wings.find((w) => w.id === draggedWingId);
  if (!wing) return;

  // Determine if dropping on a collection or nest
  const collectionHeader = dropTarget.closest('.collection-header');
  const nestItem = dropTarget.closest('.nest-item');

  try {
    if (nestItem) {
      // Dropping on a nest
      const nestId = nestItem.dataset.nestId;
      const collectionId = nestItem.dataset.collectionId;

      // Add nest to wing's nestIds (if not already there)
      const newNestIds = wing.nestIds || [];
      if (!newNestIds.includes(nestId)) {
        newNestIds.push(nestId);
      }

      // Also add the collection if not already there
      const newCollectionIds = wing.collectionIds || [];
      if (!newCollectionIds.includes(collectionId)) {
        newCollectionIds.push(collectionId);
      }

      await db.updateWing(draggedWingId, {
        collectionIds: newCollectionIds,
        nestIds: newNestIds,
      });

      // Update local state
      const wingIndex = wings.findIndex((w) => w.id === draggedWingId);
      if (wingIndex !== -1) {
        wings[wingIndex].collectionIds = newCollectionIds;
        wings[wingIndex].nestIds = newNestIds;
      }

      const nest = nests.find((n) => n.id === nestId);
      showToast(`Added to ${nest?.name || 'nest'}`, 'success');
    } else if (collectionHeader) {
      // Dropping on a collection
      const collectionId = collectionHeader.dataset.collectionId;

      // Add collection to wing's collectionIds (if not already there)
      const newCollectionIds = wing.collectionIds || [];
      if (!newCollectionIds.includes(collectionId)) {
        newCollectionIds.push(collectionId);
      }

      await db.updateWing(draggedWingId, {
        collectionIds: newCollectionIds,
      });

      // Update local state
      const wingIndex = wings.findIndex((w) => w.id === draggedWingId);
      if (wingIndex !== -1) {
        wings[wingIndex].collectionIds = newCollectionIds;
      }

      const collection = collections.find((c) => c.id === collectionId);
      showToast(`Added to ${collection?.name || 'collection'}`, 'success');
    }

    // Re-render both views
    renderWings();
    renderCollections();
  } catch (error) {
    console.error('Error updating wing:', error);
    showToast('Failed to move wing', 'error');
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Navigation
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  // Wing It
  elements.wingItBtn.addEventListener('click', openWingItModal);
  elements.wingItModalClose.addEventListener('click', () => closeModal(elements.wingItModal));
  elements.wingItCancel.addEventListener('click', () => closeModal(elements.wingItModal));
  elements.wingItConfirm.addEventListener('click', saveWing);

  // Collection checkbox changes -> update available nests
  elements.wingCollections.addEventListener('change', updateNestsForSelectedCollections);

  // Inline Collection Creation (in Wing It modal)
  elements.addCollectionInline.addEventListener('click', showInlineCollectionForm);
  elements.inlineCollectionCancel.addEventListener('click', hideInlineCollectionForm);
  elements.inlineCollectionSave.addEventListener('click', saveInlineCollection);
  elements.inlineColorPicker.addEventListener('click', (e) => {
    const colorOption = e.target.closest('.color-option');
    if (colorOption) {
      inlineSelectedColor = colorOption.dataset.color;
      renderInlineColorPicker();
    }
  });

  // Collection Modal
  elements.addCollectionBtn.addEventListener('click', () => openCollectionModal());
  elements.collectionModalClose.addEventListener('click', () => closeModal(elements.collectionModal));
  elements.collectionCancel.addEventListener('click', () => closeModal(elements.collectionModal));
  elements.collectionSave.addEventListener('click', saveCollection);

  elements.colorPicker.addEventListener('click', (e) => {
    const colorOption = e.target.closest('.color-option');
    if (colorOption) {
      selectedColor = colorOption.dataset.color;
      renderColorPicker();
    }
  });

  // Nest Modal
  elements.nestModalClose.addEventListener('click', () => closeModal(elements.nestModal));
  elements.nestCancel.addEventListener('click', () => closeModal(elements.nestModal));
  elements.nestSave.addEventListener('click', saveNest);

  // Wing Details Modal
  elements.wingDetailsModalClose.addEventListener('click', () => closeModal(elements.wingDetailsModal));
  elements.wingDetailsSave.addEventListener('click', saveWingChanges);
  elements.wingDetailsDelete.addEventListener('click', deleteWing);
  elements.wingDetailsOpen.addEventListener('click', openWingPage);

  // Edit collection checkbox changes -> update available nests
  elements.wingEditCollections.addEventListener('change', updateEditNestsForSelectedCollections);

  // Highlights list events (delegation)
  elements.wingHighlightsList.addEventListener('click', (e) => {
    const highlightItem = e.target.closest('.highlight-item');
    if (!highlightItem) return;

    const highlightId = highlightItem.dataset.highlightId;
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'delete') {
      deleteHighlightFromPopup(highlightId);
    } else if (action === 'goto') {
      goToHighlight(highlightId);
    }
  });

  // Collections list events (delegation)
  elements.collectionsList.addEventListener('click', (e) => {
    // Check for wing click first (can be inside collection or nest)
    const wingItem = e.target.closest('.collection-wing-item');
    if (wingItem) {
      openWingDetails(wingItem.dataset.wingId);
      return;
    }

    const collectionCard = e.target.closest('.collection-card');
    if (!collectionCard) return;

    const collectionId = collectionCard.dataset.collectionId;

    if (e.target.closest('.edit-collection-btn')) {
      const collection = collections.find((c) => c.id === collectionId);
      openCollectionModal(collection);
      return;
    }

    if (e.target.closest('.delete-collection-btn')) {
      deleteCollection(collectionId);
      return;
    }

    if (e.target.closest('.add-nest-btn')) {
      openNestModal(e.target.closest('.add-nest-btn').dataset.collectionId);
      return;
    }

    if (e.target.closest('.edit-nest-btn')) {
      const nestId = e.target.closest('.nest-item').dataset.nestId;
      const nest = nests.find((n) => n.id === nestId);
      if (nest) openNestModal(nest.collectionId, nest);
      return;
    }

    if (e.target.closest('.delete-nest-btn')) {
      const nestId = e.target.closest('.nest-item').dataset.nestId;
      deleteNest(nestId);
      return;
    }

    if (e.target.closest('.collection-header')) {
      const content = collectionCard.querySelector('.collection-content');
      content.classList.toggle('hidden');
    }
  });

  // Wings list events (delegation)
  elements.wingsList.addEventListener('click', (e) => {
    const wingCard = e.target.closest('.wing-card');
    if (wingCard) {
      openWingDetails(wingCard.dataset.wingId);
    }
  });

  // Drag and Drop - Wings list
  elements.wingsList.addEventListener('dragstart', handleDragStart);
  elements.wingsList.addEventListener('dragend', handleDragEnd);

  // Drag and Drop - Collections list (both source and drop target)
  elements.collectionsList.addEventListener('dragstart', handleDragStart);
  elements.collectionsList.addEventListener('dragend', handleDragEnd);
  elements.collectionsList.addEventListener('dragover', handleDragOver);
  elements.collectionsList.addEventListener('dragleave', handleDragLeave);
  elements.collectionsList.addEventListener('drop', handleDrop);

  // Search
  elements.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  // Sort dropdown
  elements.sortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSortMenu();
  });

  elements.sortMenu.addEventListener('click', (e) => {
    const option = e.target.closest('.sort-option');
    if (option) {
      handleSortChange(option.dataset.sort);
    }
  });

  // Close sort menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-dropdown')) {
      closeSortMenu();
    }
  });

  // Filter chips
  elements.filterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    if (chip.dataset.action === 'clear') {
      clearCollectionFilter();
    } else if (chip.dataset.collectionId) {
      handleFilterChipClick(chip.dataset.collectionId);
    }
  });

  // Query
  elements.queryBtn.addEventListener('click', handleQuery);

  // Allow Enter to submit query (with Ctrl/Cmd for multiline textarea)
  elements.queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleQuery();
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', closeAllModals);
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

// ============================================
// Initialization
// ============================================
async function init() {
  try {
    await db.initDB();

    [collections, nests, wings] = await Promise.all([
      db.getAllCollections(),
      db.getAllNests(),
      db.getAllWings(),
    ]);

    renderWings();
    renderCollections();
    renderFilterChips();
    setupEventListeners();

    console.log('Wing popup initialized');
  } catch (error) {
    console.error('Failed to initialize Wing:', error);
    showToast('Failed to load data', 'error');
  }
}

init();
