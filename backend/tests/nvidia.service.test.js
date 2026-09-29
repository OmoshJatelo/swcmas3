const nvidiaService = require('../src/services/nvidia.service');

jest.mock('../src/config', () => ({
  nvidia: { 
    apiKey: 'nvapi-test-key', 
    apiUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'gpt-oss-20b',
    modelClassify: 'gpt-oss-20b',
    modelReport: 'gpt-oss-20b',
    modelPlaybook: 'gpt-oss-20b',
    modelCompliance: 'gpt-oss-20b',
  }
}), { virtual: true });

jest.mock('axios');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const axios = require('axios');

describe('NVIDIA Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('callNvidia', () => {
    it('returns null when API key not configured', async () => {
      jest.resetModules();
      jest.doMock('../src/config', () => ({
        nvidia: { apiKey: '', apiUrl: 'test', defaultModel: 'test' }
      }), { virtual: true });
      const { callNvidia } = require('../src/services/nvidia.service');
      const result = await callNvidia([{ role: 'user', content: 'hi' }]);
      expect(result).toBeNull();
    });

    it('returns assistant content on success', async () => {
      axios.post.mockResolvedValue({
        data: { choices: [{ message: { content: '{"result": "ok"}' } }] }
      });

      const result = await nvidiaService.callNvidia([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' }
      ], { maxTokens: 100 });

      expect(result).toBe('{"result": "ok"}');
      expect(axios.post).toHaveBeenCalledWith(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        expect.objectContaining({
          model: 'gpt-oss-20b',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ]),
          max_tokens: 100,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer nvapi-test-key' })
        })
      );
    });

    it('retries on failure and eventually returns null', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const result = await nvidiaService.callNvidia([{ role: 'user', content: 'hi' }]);

      expect(result).toBeNull();
      expect(axios.post).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('handles 429 rate limit with specific log', async () => {
      const rateLimitError = new Error('Rate limited');
      rateLimitError.response = { status: 429 };
      axios.post.mockRejectedValue(rateLimitError);

      const result = await nvidiaService.callNvidia([{ role: 'user', content: 'hi' }]);

      expect(result).toBeNull();
    });

    it('handles 402 quota exceeded with specific log', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.response = { status: 402 };
      axios.post.mockRejectedValue(quotaError);

      const result = await nvidiaService.callNvidia([{ role: 'user', content: 'hi' }]);

      expect(result).toBeNull();
    });

    it('uses custom model and parameters when provided', async () => {
      axios.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'ok' } }] }
      });

      await nvidiaService.callNvidia(
        [{ role: 'user', content: 'hi' }],
        { model: 'custom-model', maxTokens: 200, temperature: 0.7, responseFormat: { type: 'text' } }
      );

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'custom-model',
          max_tokens: 200,
          temperature: 0.7,
          response_format: { type: 'text' }
        }),
        expect.any(Object)
      );
    });
  });

  describe('safeParseJSON', () => {
    it('parses valid JSON', () => {
      expect(nvidiaService.safeParseJSON('{"a":1}')).toEqual({ a: 1 });
    });

    it('extracts JSON from markdown code fences', () => {
      expect(nvidiaService.safeParseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
      expect(nvidiaService.safeParseJSON('```\n{"b":2}\n```')).toEqual({ b: 2 });
    });

    it('extracts first JSON object from text', () => {
      expect(nvidiaService.safeParseJSON('text {"c":3} more')).toEqual({ c: 3 });
    });

    it('returns null for invalid input', () => {
      expect(nvidiaService.safeParseJSON(null)).toBeNull();
      expect(nvidiaService.safeParseJSON('')).toBeNull();
      expect(nvidiaService.safeParseJSON('not json')).toBeNull();
    });
  });
});