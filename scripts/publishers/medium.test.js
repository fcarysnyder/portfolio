import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { publish } from './medium.js';

// Shared fetch mock state
let calls;
let originalFetch;

function mockFetch(handler) {
  originalFetch = globalThis.fetch;
  calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

describe('Medium publisher', () => {
  afterEach(() => restoreFetch());

  it('calls the correct API endpoints with correct payload', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/me')) {
        return { ok: true, json: async () => ({ data: { id: 'user-123' } }) };
      }
      if (url.includes('/posts')) {
        return {
          ok: true,
          json: async () => ({
            data: { id: 'post-abc', url: 'https://medium.com/@user/post-abc' }
          })
        };
      }
    });

    const result = await publish({
      title: 'Test Post',
      content: '# Hello\n\nWorld',
      canonicalUrl: 'https://www.fcarysnyder.com/writing/test-post',
      tags: ['AI', 'design'],
    });

    // Verify /me call
    assert.equal(calls[0].url, 'https://api.medium.com/v1/me');
    assert.equal(calls[0].opts.headers['Authorization'], `Bearer ${process.env.MEDIUM_API_TOKEN}`);

    // Verify /posts call
    assert.ok(calls[1].url.includes('/users/user-123/posts'));
    const body = JSON.parse(calls[1].opts.body);
    assert.equal(body.title, 'Test Post');
    assert.equal(body.contentFormat, 'markdown');
    assert.equal(body.content, '# Hello\n\nWorld');
    assert.equal(body.canonicalUrl, 'https://www.fcarysnyder.com/writing/test-post');
    assert.deepEqual(body.tags, ['AI', 'design']);
    assert.equal(body.publishStatus, 'draft');

    // Verify return value
    assert.equal(result.id, 'post-abc');
    assert.equal(result.url, 'https://medium.com/@user/post-abc');
  });

  it('truncates tags to 5', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/me')) {
        return { ok: true, json: async () => ({ data: { id: 'user-123' } }) };
      }
      if (url.includes('/posts')) {
        return {
          ok: true,
          json: async () => ({ data: { id: 'x', url: 'https://medium.com/@u/x' } })
        };
      }
    });

    await publish({
      title: 'T',
      content: 'C',
      canonicalUrl: 'https://example.com',
      tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });

    const body = JSON.parse(calls[1].opts.body);
    assert.equal(body.tags.length, 5);
  });

  it('throws on API error', async () => {
    mockFetch(() => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    await assert.rejects(() => publish({
      title: 'T', content: 'C', canonicalUrl: 'u', tags: [],
    }), /Medium API error: 401/);
  });
});
