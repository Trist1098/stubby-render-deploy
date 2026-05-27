const { moderateDiscussionText } = require('../../src/services/contentModeration.service');

describe('contentModeration.service', () => {
  const originalFetch = global.fetch;
  const originalModerationUrl = process.env.MODERATION_SERVICE_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.MODERATION_SERVICE_URL = originalModerationUrl;
  });

  test('allows safe moderation responses', async () => {
    process.env.MODERATION_SERVICE_URL = 'http://moderation.test/moderate';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ action: 'allow' }),
    });

    await expect(moderateDiscussionText('safe study text')).resolves.toEqual({ action: 'allow' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://moderation.test/moderate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'safe study text' }),
      }),
    );
  });

  test('throws a 400 when moderation blocks content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ action: 'block', reason: 'Please rephrase this before posting.' }),
    });

    await expect(moderateDiscussionText('unsafe text')).rejects.toMatchObject({
      status: 400,
      message: 'Please rephrase this before posting.',
    });
  });

  test('throws a 503 when moderation cannot be reached', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused'));

    await expect(moderateDiscussionText('safe study text')).rejects.toMatchObject({
      status: 503,
      message: 'Content moderation is unavailable',
    });
  });

  test('throws a 503 when moderation returns an error response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Content moderation is unavailable' }),
    });

    await expect(moderateDiscussionText('safe study text')).rejects.toMatchObject({
      status: 503,
      message: 'Content moderation is unavailable',
    });
  });
});
