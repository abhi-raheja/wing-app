/**
 * Wing - Anthropic API Layer
 * Handles all Claude API interactions
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Get the stored API key
 * @returns {Promise<string|null>} API key or null
 */
export async function getApiKey() {
  const result = await chrome.storage.local.get('anthropicApiKey');
  return result.anthropicApiKey || null;
}

/**
 * Check if API key is configured
 * @returns {Promise<boolean>}
 */
export async function hasApiKey() {
  const key = await getApiKey();
  return !!key;
}

/**
 * Make a request to the Claude API
 * @param {Object} options - Request options
 * @param {string} options.prompt - The user prompt
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {number} [options.maxTokens=1024] - Max tokens to generate
 * @returns {Promise<Object>} API response
 */
export async function makeApiRequest({ prompt, systemPrompt, maxTokens = 1024 }) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('No API key configured. Please add your Anthropic API key in the extension settings.');
  }

  const messages = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return {
    text: data.content[0]?.text || '',
    usage: data.usage,
    stopReason: data.stop_reason,
  };
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

  const systemPrompt = `You are Wing AI, a helpful assistant that answers questions about the user's saved web pages (called "wings").

You have access to the user's saved pages with their titles, URLs, and summaries. When answering:
1. Base your answers on the information in the saved pages
2. Cite relevant pages by their number [1], [2], etc.
3. If the saved pages don't contain relevant information, say so clearly
4. Keep answers concise but informative
5. If multiple pages are relevant, synthesize the information`;

  const prompt = `Here are my saved pages:

${wingsContext}

My question: ${query}

Please answer based on my saved pages. Include citations like [1], [2] to reference specific pages.`;

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
 * Validate an API key by making a minimal test request
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} True if valid
 */
export async function validateApiKey(apiKey) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
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
