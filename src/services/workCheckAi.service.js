const GEMINI_GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
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
const genericTaskText = new Set([
  'current task for this study session.',
  'complete the active fop2 revision target.',
  'no description provided.',
  'queued micro-goal',
]);

const genericTaskPatterns = [
  /^complete the active .+ revision target\.?$/,
  /^queue the next .+ practice block\.?$/,
];

const isGenericTaskText = (value) => {
  const normalized = trimText(value).toLowerCase().replace(/\s+/g, ' ');
  return (
    !normalized ||
    genericTaskText.has(normalized) ||
    genericTaskPatterns.some((pattern) => pattern.test(normalized))
  );
};

const taskContext = (microGoal) => {
  const hasDedicatedTaskText = !isGenericTaskText(microGoal.description);
  const taskText = hasDedicatedTaskText
    ? trimText(microGoal.description)
    : trimText(microGoal.title);

  return {
    hasDedicatedTaskText,
    taskText,
  };
};

const normalizeArithmeticExpression = (value) => {
  const expression = trimText(value)
    .replace(/[×✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−]/g, '-')
    .replace(/(\d)\s*[xX]\s*(\d)/g, '$1*$2');

  return /^[\d+\-*/().\s]+$/.test(expression) ? expression : '';
};

const evaluateArithmeticExpression = (value) => {
  const expression = normalizeArithmeticExpression(value);
  if (!expression) return null;

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

const formatNumber = (value) => Number(value.toFixed(8)).toString();

const submittedTextIncludesResult = (submittedText, result) => {
  const expected = formatNumber(result);
  const matches = String(submittedText).match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.some((item) => formatNumber(Number(item)) === expected);
};

const arithmeticFeedback = ({ microGoal, equationText, fileText }) => {
  const { taskText } = taskContext(microGoal);
  const expectedResult = evaluateArithmeticExpression(taskText);
  if (expectedResult === null) return null;

  const submittedText = [equationText, fileText].map(trimText).filter(Boolean).join('\n');
  const expectedText = formatNumber(expectedResult);

  if (submittedTextIncludesResult(submittedText, expectedResult)) {
    return {
      status: 'looks_good',
      summary: `The submitted work reaches the correct result: ${expectedText}.`,
      strengths: ['The final answer matches the question/task.', 'The working shows useful steps.'],
      issues: [],
      next_step: 'Submit the evidence when you are ready.',
      confidence: 'high',
    };
  }

  return {
    status: 'needs_more_detail',
    summary: `The question/task evaluates to ${expectedText}, but I could not find that result in the submitted work.`,
    strengths: [],
    issues: [`Expected final result: ${expectedText}`],
    next_step: 'Check the arithmetic and include the final answer clearly.',
    confidence: 'high',
  };
};

const feedbackClaimsMissingTask = (feedback) => {
  const text = [
    feedback?.summary,
    feedback?.next_step,
    ...(Array.isArray(feedback?.issues) ? feedback.issues : []),
  ]
    .map(trimText)
    .join(' ')
    .toLowerCase();

  return /question\/task.*(missing|not found)|missing.*question|no question|original question/.test(
    text,
  );
};

const guardAgainstMissingTaskFeedback = (feedback, input) => {
  const { taskText } = taskContext(input.microGoal);
  if (!taskText || !feedbackClaimsMissingTask(feedback)) return feedback;

  return {
    status: 'needs_more_detail',
    summary: `The question/task is available: ${taskText}. I could not verify the submitted work from the AI feedback, so review the arithmetic steps directly.`,
    strengths: [],
    issues: ['AI feedback incorrectly treated the available question/task as missing.'],
    next_step: 'Try AI Review again, or submit if your working is ready.',
    confidence: 'low',
  };
};

const asShortList = (items) =>
  (Array.isArray(items) ? items : []).map(trimText).filter(Boolean).slice(0, 3);

const normalizeFeedback = (feedback) => ({
  status: VALID_STATUSES.has(feedback?.status) ? feedback.status : 'cannot_verify',
  summary:
    trimText(feedback?.summary) || 'I could not verify the workings from the submitted text.',
  strengths: asShortList(feedback?.strengths),
  issues: asShortList(feedback?.issues),
  next_step: trimText(feedback?.next_step) || 'Add clearer working steps and try again.',
  confidence: ['low', 'medium', 'high'].includes(feedback?.confidence)
    ? feedback.confidence
    : 'low',
});

const parseFeedbackText = (outputText) => {
  const jsonText = outputText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return normalizeFeedback(JSON.parse(jsonText));
  } catch {
    throw makeError(502, 'AI work check returned invalid feedback');
  }
};

const feedbackSystemInstruction =
  'You are a formative study feedback assistant. Review the learner answer/workings against the provided question or task. The question/task field is authoritative; a short arithmetic expression such as "12 x 96 / 12" is a valid task to evaluate, even if it is not written as a sentence. Only say the question/task is missing when the prompt explicitly says "Question/task is present: no". If the question/task is generic or too vague to know what is being answered, return cannot_verify and ask for the original question. Do not infer the original question from the answer alone. Do not grade harshly, do not mark progress complete, and do not claim the final answer is definitely correct unless the submitted workings clearly justify it. Keep the feedback concise enough for a modal.';

const buildUserPrompt = ({ microGoal, equationText, fileText, fileName }) => {
  const { hasDedicatedTaskText, taskText } = taskContext(microGoal);
  const expectedResult = evaluateArithmeticExpression(taskText);

  return [
    `Micro-goal label: ${microGoal.title || 'Untitled micro-goal'}`,
    '',
    `Question/task source: ${hasDedicatedTaskText ? 'question/task field' : 'micro-goal label fallback'}`,
    `Question/task is present: ${taskText ? 'yes' : 'no'}`,
    'Question/task to check against:',
    taskText || 'No question or task provided.',
    expectedResult === null ? '' : `Expected arithmetic result: ${formatNumber(expectedResult)}`,
    '',
    'Student typed answer/workings:',
    equationText || 'None provided.',
    '',
    fileText
      ? `Student uploaded document (${fileName || 'workings.txt'}):\n${fileText}`
      : 'Student uploaded document: None provided.',
  ].join('\n');
};

const buildGeminiRequestBody = ({ microGoal, equationText, fileText, fileName }) => ({
  systemInstruction: {
    parts: [{ text: feedbackSystemInstruction }],
  },
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: [
            buildUserPrompt({ microGoal, equationText, fileText, fileName }),
            '',
            'Return only JSON matching this schema:',
            JSON.stringify(feedbackSchema),
          ].join('\n'),
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 700,
    responseMimeType: 'application/json',
  },
});

const extractGeminiResponseText = (payload) => {
  return (payload?.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .filter((part) => typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
};

const callGemini = async ({ microGoal, equationText, fileText, fileName }) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw makeError(503, 'Gemini work check is not configured yet');

  const model = (process.env.GEMINI_WORK_CHECK_MODEL || DEFAULT_GEMINI_MODEL).replace(
    /^models\//,
    '',
  );
  let response;

  try {
    response = await fetch(`${GEMINI_GENERATE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(
        buildGeminiRequestBody({
          microGoal,
          equationText,
          fileText,
          fileName,
        }),
      ),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw makeError(502, 'Gemini work check failed');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw makeError(502, payload.error?.message || 'Gemini work check failed');
  }

  const outputText = extractGeminiResponseText(payload).trim();
  if (!outputText) throw makeError(502, 'Gemini work check returned no feedback');

  return guardAgainstMissingTaskFeedback(parseFeedbackText(outputText), {
    microGoal,
    equationText,
    fileText,
  });
};

module.exports.checkWorkWithAi = async function checkWorkWithAi(input) {
  const deterministicFeedback = arithmeticFeedback(input);
  if (deterministicFeedback) return deterministicFeedback;

  return callGemini(input);
};
