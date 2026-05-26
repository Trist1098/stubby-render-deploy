const pool = require('../../src/models/db');
const { countIncomingRequests } = require('../../src/models/FriendRequest.model');

jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

describe('FriendRequest.model - countIncomingRequests', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns the pending incoming request count for a user', async () => {
    pool.query.mockResolvedValue({ rows: [{ count: 3 }] });

    const count = await countIncomingRequests(7);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)::int AS count'), [7]);
    expect(count).toBe(3);
  });

  test('returns zero when no requests are waiting', async () => {
    pool.query.mockResolvedValue({ rows: [{ count: 0 }] });

    await expect(countIncomingRequests(7)).resolves.toBe(0);
  });
});
