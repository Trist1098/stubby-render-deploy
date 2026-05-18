const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';
const VALID_STATUSES = new Set(['looks_good', 'needs_more_detail', 'cannot_verify']);

const feedbackSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'summary', 'strengths', 'issues', 'next_step', 'confidence'],
  properties: {
    status: {
      type: 'string',
      enum: ['looks_good', 'needs_more_detail', 'cannot_verify'],
    },
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    issues: {
      type: 'array',
      items: { type: 'string' },
    },
    next_step: { type: 'string' },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
  },
};

const makeError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const trimText = (value) => (typeof value === 'string' ? value.trim() : '');

const asShortList = (items) =>
  (Array.isArray(items) ? items : [])
    .map(trimText)
    .filter(Boolean)
    .slice(0, 3);

const normalizeFeedback = (feedback) => ({
  status: VALID_STATUSES.has(feedback?.status) ? feedback.status : 'cannot_verify',
  summary: trimText(feedback?.summary) || 'I could not verify the workings from the submitted text.',
  strengths: asShortList(feedback?.strengths),
  issues: asShortList(feedback?.issues),
  next_step: trimText(feedback?.next_step) || 'Add clearer working steps and try again.',
  confidence: ['low', 'medium', 'high'].includes(feedback?.confidence)
    ? feedback.confidence
    : 'low',
});

const extractResponseText = (payload) => {
  if (typeof payload?.output_text === 'string') return payload.output_text;

  return (payload?.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('');
};

const parseFeedback = (payload) => {
  const outputText = extractResponseText(payload).trim();
  if (!outputText) throw makeError(502, 'AI work check returned no feedback');

  return parseFeedbackText(outputText);
};

const parseFeedbackText = (outputText) => {
  try {
    return normalizeFeedback(JSON.parse(outputText));
  } catch {
    throw makeError(502, 'AI work check returned invalid feedback');
  }
};

const buildUserPrompt = ({ microGoal, equationText, fileText, fileName }) => {
  return [
    `Micro-goal title: ${microGoal.title || 'Untitled micro-goal'}`,
    `Micro-goal description: ${microGoal.description || 'No description provided.'}`,
    '',
    'Typed workings:',
    equationText || 'None provided.',
    '',
    fileText
      ? `Uploaded .txt file (${fileName || 'workings.txt'}):\n${fileText}`
      : 'Uploaded .txt file: None provided.',
  ].join('\n');
};

const buildRequestBody = ({ model, microGoal, equationText, fileText, fileName }) => ({
  model,
  input: [
    {
      role: 'system',
      content:
        'You are a formative study feedback assistant. Review the learner workings for the current micro-goal. Do not grade harshly, do not mark progress complete, and do not claim the final answer is definitely correct unless the submitted workings clearly justify it. Keep the feedback concise enough for a modal.',
    },
    {
      role: 'user',
      content: buildUserPrompt({ microGoal, equationText, fileText, fileName }),
    },
  ],
  text: {
    format: {
      type: 'json_schema',
      name: 'work_check_feedback',
      strict: true,
      schema: feedbackSchema,
    },
  },
  max_output_tokens: 700,
  store: false,
});

const callOpenAi = async ({ microGoal, equationText, fileText, fileName }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw makeError(503, 'AI work check is not configured yet');

  const model = process.env.OPENAI_WORK_CHECK_MODEL || DEFAULT_OPENAI_MODEL;
  let response;

  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildRequestBody({ model, microGoal, equationText, fileText, fileName }),
      ),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw makeError(502, 'AI work check failed');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw makeError(502, payload.error?.message || 'AI work check failed');
  }

  return parseFeedback(payload);
};

const callOllama = async ({ microGoal, equationText, fileText, fileName }) => {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_WORK_CHECK_MODEL || DEFAULT_OLLAMA_MODEL;
  let response;

  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: feedbackSchema,
        prompt: [
          'You are a formative study feedback assistant.',
          'Return only valid JSON matching the schema.',
          'Do not mark progress complete.',
          'Do not say the answer is definitely correct unless the workings clearly justify it.',
          'Keep the feedback short enough for a modal.',
          '',
          buildUserPrompt({ microGoal, equationText, fileText, fileName }),
        ].join('\n'),
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw makeError(502, 'Ollama work check failed. Make sure Ollama is running.');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw makeError(502, payload.error || 'Ollama work check failed');
  }

  return parseFeedbackText(String(payload.response || '').trim());
};

module.exports.checkWorkWithAi = async function checkWorkWithAi(input) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (provider === 'ollama') return callOllama(input);
  if (provider === 'openai') return callOpenAi(input);

  throw makeError(503, 'AI provider is not configured correctly');
};
