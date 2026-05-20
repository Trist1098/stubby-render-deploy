const { checkWorkWithAi } = require('../../src/services/workCheckAi.service');

const arithmeticGoal = {
  id: 1,
  title: 'Complete the Mathematics Textbook Q1',
  description: '12 x 96 / 12',
};

describe('workCheckAi.service arithmetic feedback', () => {
  test('marks arithmetic work good when the final answer is correct', async () => {
    const feedback = await checkWorkWithAi({
      microGoal: arithmeticGoal,
      equationText: '12 x 96 / 12 = 96',
      fileText: '',
      fileName: '',
    });

    expect(feedback.status).toBe('looks_good');
    expect(feedback.summary).toContain('96');
    expect(feedback.confidence).toBe('high');
  });

  test('does not accept copied task numbers when the final answer is wrong', async () => {
    const feedback = await checkWorkWithAi({
      microGoal: arithmeticGoal,
      equationText: '12 x 96 / 12 = 48',
      fileText: '',
      fileName: '',
    });

    expect(feedback.status).toBe('needs_more_detail');
    expect(feedback.issues).toContain('Expected final result: 96');
  });

  test('uses explicit answer cues instead of later working numbers', async () => {
    const feedback = await checkWorkWithAi({
      microGoal: arithmeticGoal,
      equationText: 'Answer is 96 because the 12 in the numerator and denominator cancels.',
      fileText: '',
      fileName: '',
    });

    expect(feedback.status).toBe('looks_good');
  });
});
