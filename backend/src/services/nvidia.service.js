const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Generic NVIDIA Build API caller (OpenAI-compatible).
 * @param {Array} messages - OpenAI-format messages
 * @param {Object} options - { model, maxTokens, temperature, responseFormat }
 * @returns {Promise<string|null>} Assistant message content or null on failure
 */
const callNvidia = async (messages, options = {}) => {
  const {
    model = config.nvidia.defaultModel,
    maxTokens = 500,
    temperature = 0.3,
    responseFormat = { type: 'json_object' },
  } = options;

  if (!config.nvidia.apiKey || config.nvidia.apiKey === 'your-nvidia-api-key') {
    logger.warn('NVIDIA API key not configured – returning null');
    return null;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${config.nvidia.apiUrl}/chat/completions`,
        {
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          response_format: responseFormat,
        },
        {
          headers: {
            Authorization: `Bearer ${config.nvidia.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // NVIDIA-specific: 429 rate limit, 402 quota exceeded
      if (status === 429 || status === 402) {
        logger.warn('NVIDIA API rate limited / quota exceeded: %s', err.message);
      } else {
        logger.warn('NVIDIA API attempt %d failed: %s', attempt + 1, err.message);
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  logger.error('NVIDIA API exhausted retries: %s', lastError?.message);
  return null;
};

/**
 * Safe JSON parsing (reused from deepseek.service)
 */
const safeParseJSON = (str) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    const match = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // fall through
      }
    }
    const braceMatch = str.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }
    return null;
  }
};

module.exports = { callNvidia, safeParseJSON };