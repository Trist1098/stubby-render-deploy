const pool = require('../../src/models/db');
const { getAllPersons } = require('../../src/models/Person.model');

// ── Mocking ──────────────────────────────────────────────
// Mock the db module so no real DB connection is needed.
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────
describe('Person.model - getAllPersons', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all persons from the database', async () => {
    const fakePersons = [
      { id: 1, email: 'alice@example.com', name: 'Alice', avatar: null },
      { id: 2, email: 'bob@example.com', name: 'Bob', avatar: null },
    ];
    pool.query.mockResolvedValue({ rows: fakePersons });

    const result = await getAllPersons();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Person"');
    expect(result).toEqual(fakePersons);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no persons exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllPersons();

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(getAllPersons()).rejects.toThrow('connection refused');
  });
});
