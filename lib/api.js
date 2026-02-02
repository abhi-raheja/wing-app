/**
 * Wing - Multi-LLM API Layer
 * Supports multiple LLM providers: Anthropic, OpenAI
 */

// Provider configurations
const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-api03-...',
    storageKey: 'anthropicApiKey',
    website: 'https://console.anthropic.com/',
  },
  openai: {
    name: 'OpenAI (GPT)',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-proj-...',
    storageKey: 'openaiApiKey',
    website: 'https://platform.openai.com/api-keys',
  },
};

/**
 * Get all available providers
 * @returns {Object} Provider configurations
 */
export function getProviders() {
  return PROVIDERS;
}

/**
 * Get the current provider setting
 * @returns {Promise<string>} Provider key (anthropic, openai)
 */
export async function getCurrentProvider() {
  const result = await chrome.storage.local.get('llmProvider');
  const provider = result.llmProvider || 'anthropic';
  return PROVIDERS[provider] ? provider : 'anthropic';
}

/**
 * Set the current provider
 * @param {string} provider - Provider key
 */
export async function setCurrentProvider(provider) {
  if (!PROVIDERS[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  await chrome.storage.local.set({ llmProvider: provider });
}

/**
 * Get the stored API key for a specific provider
 * @param {string} [provider] - Provider key (uses current if not specified)
 * @returns {Promise<string|null>} API key or null
 */
export async function getApiKey(provider) {
  const providerKey = provider || (await getCurrentProvider());
  const config = PROVIDERS[providerKey];
  if (!config) return null;

  const result = await chrome.storage.local.get(config.storageKey);
  return result[config.storageKey] || null;
}

/**
 * Save API key for a specific provider
 * @param {string} provider - Provider key
 * @param {string} apiKey - API key to save
 */
export async function saveApiKey(provider, apiKey) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  await chrome.storage.local.set({ [config.storageKey]: apiKey });
}

/**
 * Remove API key for a specific provider
 * @param {string} provider - Provider key
 */
export async function removeApiKey(provider) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  await chrome.storage.local.remove(config.storageKey);
}

/**
 * Check if API key is configured for current provider
 * @returns {Promise<boolean>}
 */
export async function hasApiKey() {
  const key = await getApiKey();
  return !!key;
}

/**
 * Check if browser is online
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Custom error classes for better error handling
 */
export class ApiError extends Error {
  constructor(message, code, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Make a request to Anthropic API
 */
async function makeAnthropicRequest({ apiKey, prompt, systemPrompt, maxTokens, timeout, controller }) {
  const config = PROVIDERS.anthropic;
  const body = {
    model: config.model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || `API request failed with status ${response.status}`;
    handleHttpError(response.status, message);
  }

  const data = await response.json();
  return {
    text: data.content[0]?.text || '',
    usage: data.usage,
  };
}

/**
 * Make a request to OpenAI API
 */
async function makeOpenAIRequest({ apiKey, prompt, systemPrompt, maxTokens, controller }) {
  const config = PROVIDERS.openai;
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || `API request failed with status ${response.status}`;
    handleHttpError(response.status, message);
  }

  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    usage: data.usage,
  };
}

/**
 * Handle HTTP errors consistently across providers
 */
function handleHttpError(status, message) {
  if (status === 429) {
    throw new ApiError('Rate limit exceeded. Please wait a moment and try again.', 'RATE_LIMIT', true);
  }
  if (status === 401 || status === 403) {
    throw new ApiError('Invalid API key. Please check your API key in settings.', 'INVALID_KEY', false);
  }
  if (status === 500 || status === 502 || status === 503) {
    throw new ApiError('API service temporarily unavailable. Please try again later.', 'SERVICE_ERROR', true);
  }
  throw new ApiError(message, 'API_ERROR', false);
}

/**
 * Make a request to the current LLM provider
 * @param {Object} options - Request options
 * @param {string} options.prompt - The user prompt
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {number} [options.maxTokens=1024] - Max tokens to generate
 * @param {number} [options.timeout=30000] - Request timeout in ms
 * @returns {Promise<Object>} API response
 */
export async function makeApiRequest({ prompt, systemPrompt, maxTokens = 1024, timeout = 30000 }) {
  // Check online status first
  if (!isOnline()) {
    throw new ApiError('You appear to be offline. Please check your internet connection.', 'OFFLINE', true);
  }

  const provider = await getCurrentProvider();
  const apiKey = await getApiKey(provider);
  const config = PROVIDERS[provider];

  if (!apiKey) {
    throw new ApiError(
      `No API key configured. Please add your ${config.name} API key in the extension settings.`,
      'NO_API_KEY',
      false
    );
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let result;
    const requestArgs = { apiKey, prompt, systemPrompt, maxTokens, timeout, controller };

    switch (provider) {
      case 'anthropic':
        result = await makeAnthropicRequest(requestArgs);
        break;
      case 'openai':
        result = await makeOpenAIRequest(requestArgs);
        break;
      default:
        throw new ApiError(`Unknown provider: ${provider}`, 'UNKNOWN_PROVIDER', false);
    }

    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 'TIMEOUT', true);
    }

    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new ApiError('Network error. Please check your connection.', 'NETWORK_ERROR', true);
    }

    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Wrap other errors
    throw new ApiError(error.message || 'An unexpected error occurred', 'UNKNOWN', false);
  }
}

/**
 * Generate a summary for page content
 * @param {string} content - Page content to summarize
 * @returns {Promise<string>} Summary text
 */
export async function generateSummary(content) {
  if (!content || content.trim().length < 50) {
    throw new Error('Not enough content to summarize');
  }

  // Truncate content to avoid token limits
  const truncatedContent = content.substring(0, 10000);

  const result = await makeApiRequest({
    prompt: `Please provide a brief 2-3 sentence summary of the following web page content. Focus on the main topic and key points:\n\n${truncatedContent}`,
    maxTokens: 256,
  });

  return result.text;
}

/**
 * Query the AI about saved wings
 * @param {string} query - User's question
 * @param {Array} wings - Array of wing objects to search
 * @returns {Promise<Object>} Response with answer and citations
 */
export async function queryWings(query, wings) {
  if (!query || !query.trim()) {
    throw new Error('Please enter a question');
  }

  if (!wings || wings.length === 0) {
    throw new Error('No saved pages to search. Wing some pages first!');
  }

  // Build context from wings (title, URL, summary)
  const wingsContext = wings
    .filter((w) => w.summary) // Only include wings with summaries
    .map((w, index) => {
      return `[${index + 1}] "${w.title || 'Untitled'}"
URL: ${w.url}
Summary: ${w.summary}`;
    })
    .join('\n\n');

  if (!wingsContext) {
    throw new Error('No summarized pages available yet. Please wait for summaries to generate.');
  }

  const systemPrompt = `You are Wing AI, an expert research librarian who helps users find and synthesize information from their saved web pages (called "wings").

Your communication style:
- **Precise and authoritative**: Speak like an expert who knows the collection intimately
- **Succinct**: Every sentence should earn its place. No filler, no over-explanation
- **Well-structured**: Use markdown formatting - bold for emphasis, bullet points for lists, clear paragraph breaks
- **High-value**: Assume intelligence. Don't explain obvious concepts or add unnecessary caveats

When answering:
1. Base answers strictly on the saved pages - never invent or assume information
2. Cite sources using superscript numbers [1], [2], etc. at the end of relevant statements
3. If the collection lacks relevant information, state this directly and briefly
4. When synthesizing from multiple sources, organize logically (chronologically, by theme, or by importance)
5. Lead with the answer, then support with evidence - don't bury the key insight`;

  const prompt = `Here are my saved pages:

${wingsContext}

Question: ${query}

Answer based on my saved pages. Use markdown formatting (bold, bullets) for clarity. Cite sources as [1], [2] etc.`;

  const result = await makeApiRequest({
    prompt,
    systemPrompt,
    maxTokens: 1024,
  });

  // Extract citation numbers from the response
  const citationMatches = result.text.match(/\[(\d+)\]/g) || [];
  const citedIndices = [...new Set(citationMatches.map((m) => parseInt(m.slice(1, -1)) - 1))];

  const citations = citedIndices
    .filter((i) => i >= 0 && i < wings.length)
    .map((i) => wings.filter((w) => w.summary)[i])
    .filter(Boolean);

  return {
    answer: result.text,
    citations,
    usage: result.usage,
  };
}

/**
 * Validate an API key for a specific provider
 * @param {string} provider - Provider key
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} True if valid
 */
export async function validateApiKey(provider, apiKey) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  switch (provider) {
    case 'anthropic':
      return validateAnthropicKey(apiKey);
    case 'openai':
      return validateOpenAIKey(apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function validateAnthropicKey(apiKey) {
  const config = PROVIDERS.anthropic;
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Invalid API key');
  }

  return true;
}

async function validateOpenAIKey(apiKey) {
  const config = PROVIDERS.openai;
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Invalid API key');
  }

  return true;
}
