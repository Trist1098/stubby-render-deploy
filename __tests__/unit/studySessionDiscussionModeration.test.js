jest.mock('../../src/models/StudySession.model', () => ({
  ensureSessionAccessForUser: jest.fn(),
  insertDiscussionPost: jest.fn(),
}));

jest.mock('../../src/services/contentModeration.service', () => ({
  moderateDiscussionText: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

jest.mock('../../src/realtime/studySessionRealtime', () => ({
  emitSessionEvent: jest.fn(),
}));

const fs = require('fs/promises');
const mammoth = require('mammoth');
const model = require('../../src/models/StudySession.model');
const { moderateDiscussionText } = require('../../src/services/contentModeration.service');
const controller = require('../../src/controllers/StudySession.controller');

const response = () => {
  const res = {
    locals: { userId: 2 },
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('study session discussion moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    model.ensureSessionAccessForUser.mockResolvedValue({ session_id: 6 });
  });

  test('does not insert discussion posts blocked by moderation', async () => {
    const error = new Error('Please rephrase this before posting.');
    error.status = 400;
    moderateDiscussionText.mockRejectedValue(error);

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Blocked title', content: 'Blocked content', post_type: 'question' },
    };
    const res = response();
    const next = jest.fn();

    await controller.createDiscussionPost(req, res, next);

    expect(model.insertDiscussionPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  test('does not insert discussion posts when moderation is unavailable', async () => {
    const error = new Error('Content moderation is unavailable');
    error.status = 503;
    moderateDiscussionText.mockRejectedValue(error);

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Safe title', content: 'Safe content', post_type: 'question' },
    };
    const res = response();
    const next = jest.fn();

    await controller.createDiscussionPost(req, res, next);

    expect(model.insertDiscussionPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  test('inserts discussion posts allowed by moderation', async () => {
    moderateDiscussionText.mockResolvedValue({ action: 'allow' });
    model.insertDiscussionPost.mockResolvedValue({
      post_id: 10,
      title: 'Safe title',
      content: 'Safe content',
    });

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Safe title', content: 'Safe content', post_type: 'question' },
    };
    const res = response();

    await controller.createDiscussionPost(req, res, jest.fn());

    expect(moderateDiscussionText).toHaveBeenCalledWith('Safe title\nSafe content');
    expect(model.insertDiscussionPost).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('moderates title even when post only has an attachment', async () => {
    moderateDiscussionText.mockResolvedValue({ action: 'allow' });
    model.insertDiscussionPost.mockResolvedValue({
      post_id: 11,
      title: 'Attachment context',
      content: '',
    });

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Attachment context', content: '', post_type: 'resource' },
      file: {
        filename: 'safe-notes.pdf',
        originalname: 'Safe notes.pdf',
        mimetype: 'application/pdf',
        size: 1200,
      },
    };
    const res = response();

    await controller.createDiscussionPost(req, res, jest.fn());

    expect(moderateDiscussionText).toHaveBeenCalledWith('Attachment context');
    expect(model.insertDiscussionPost).toHaveBeenCalledWith(
      expect.objectContaining({
        post_type: 'resource',
        attachment_url: '/uploads/safe-notes.pdf',
        attachment_name: 'Safe notes.pdf',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('adds txt attachment contents to the moderation text', async () => {
    moderateDiscussionText.mockResolvedValue({ action: 'allow' });
    fs.readFile.mockResolvedValue('Notes from the uploaded text file');
    model.insertDiscussionPost.mockResolvedValue({
      post_id: 12,
      title: 'Text notes',
      content: 'Please review this',
    });

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Text notes', content: 'Please review this', post_type: 'note' },
      file: {
        path: 'src/public/uploads/chat-notes.txt',
        filename: 'chat-notes.txt',
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 120,
      },
    };
    const res = response();

    await controller.createDiscussionPost(req, res, jest.fn());

    expect(fs.readFile).toHaveBeenCalledWith('src/public/uploads/chat-notes.txt', 'utf8');
    expect(moderateDiscussionText).toHaveBeenCalledWith(
      'Text notes\nPlease review this\nNotes from the uploaded text file',
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('adds docx attachment contents to the moderation text', async () => {
    moderateDiscussionText.mockResolvedValue({ action: 'allow' });
    mammoth.extractRawText.mockResolvedValue({ value: 'Extracted Word document text' });
    model.insertDiscussionPost.mockResolvedValue({
      post_id: 13,
      title: 'Word notes',
      content: '',
    });

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Word notes', content: '', post_type: 'resource' },
      file: {
        path: 'src/public/uploads/chat-notes.docx',
        filename: 'chat-notes.docx',
        originalname: 'notes.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1200,
      },
    };
    const res = response();

    await controller.createDiscussionPost(req, res, jest.fn());

    expect(mammoth.extractRawText).toHaveBeenCalledWith({
      path: 'src/public/uploads/chat-notes.docx',
    });
    expect(moderateDiscussionText).toHaveBeenCalledWith('Word notes\nExtracted Word document text');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('does not read non-text attachments for moderation', async () => {
    moderateDiscussionText.mockResolvedValue({ action: 'allow' });
    model.insertDiscussionPost.mockResolvedValue({
      post_id: 14,
      title: 'Screenshot',
      content: '',
    });

    const req = {
      params: { sessionId: '6' },
      body: { title: 'Screenshot', content: '', post_type: 'resource' },
      file: {
        path: 'src/public/uploads/chat-image.png',
        filename: 'chat-image.png',
        originalname: 'screenshot.png',
        mimetype: 'image/png',
        size: 2200,
      },
    };
    const res = response();

    await controller.createDiscussionPost(req, res, jest.fn());

    expect(fs.readFile).not.toHaveBeenCalled();
    expect(mammoth.extractRawText).not.toHaveBeenCalled();
    expect(moderateDiscussionText).toHaveBeenCalledWith('Screenshot');
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
