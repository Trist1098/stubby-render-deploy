const DEFAULT_MODERATION_URL = 'http://127.0.0.1:8001/moderate';

const moderationUrl = () => process.env.MODERATION_SERVICE_URL || DEFAULT_MODERATION_URL;

const makeModerationError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

async function moderateDiscussionText(text) {
  try {
    const response = await fetch(moderationUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw makeModerationError(
        503,
        result.detail || result.error || 'Content moderation is unavailable',
      );
    }

    if (result.action === 'block') {
      throw makeModerationError(400, result.reason || 'Please rephrase this before posting.');
    }

    return result;
  } catch (error) {
    if (error.status) throw error;
    throw makeModerationError(503, 'Content moderation is unavailable');
  }
}

module.exports = {
  moderateDiscussionText,
};
