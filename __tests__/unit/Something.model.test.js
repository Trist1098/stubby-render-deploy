const pool = require('../../src/models/db');
const {
  createSomething,
  getAllSomethings,
  updateSomething,
  deleteSomething,
} = require('../../src/models/Something.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── createSomething ──────────────────────────────────────
describe('Something.model - createSomething', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: normal string input
  test('should insert a row and return the created something', async () => {
    const fakeSomething = { id: 1, name: 'cheese' };
    pool.query.mockResolvedValue({ rows: [fakeSomething] });

    const result = await createSomething('cheese');

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "Something" ("name") VALUES ($1) RETURNING *',
      ['cheese'],
    );
    expect(result).toEqual(fakeSomething);
  });

  // Error handling: DB constraint violation propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('unique violation'));

    await expect(createSomething('dup')).rejects.toThrow('unique violation');
  });

  // Boundary: empty string is the shortest possible valid input
  test('should pass empty string to the query (boundary – shortest valid input)', async () => {
    const fakeSomething = { id: 2, name: '' };
    pool.query.mockResolvedValue({ rows: [fakeSomething] });

    const result = await createSomething('');

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "Something" ("name") VALUES ($1) RETURNING *',
      [''],
    );
    expect(result).toEqual(fakeSomething);
  });

  // Invalid partition: null is not a valid name – DB rejects with NOT NULL error
  test('should propagate NOT NULL error when name is null (invalid partition)', async () => {
    pool.query.mockRejectedValue(new Error('null value violates not-null constraint'));

    await expect(createSomething(null)).rejects.toThrow('not-null');
  });
});

// ── getAllSomethings ─────────────────────────────────────
describe('Something.model - getAllSomethings', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: multiple rows returned from DB
  test('should return all somethings', async () => {
    const fakeSomethings = [
      { id: 1, name: 'Seed 1' },
      { id: 2, name: 'Seed 2' },
    ];
    pool.query.mockResolvedValue({ rows: fakeSomethings });

    const result = await getAllSomethings();

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Something"');
    expect(result).toEqual(fakeSomethings);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no somethings exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllSomethings();

    expect(result).toEqual([]);
  });

  // Error handling: DB timeout propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('timeout'));

    await expect(getAllSomethings()).rejects.toThrow('timeout');
  });
});

// ── updateSomething ──────────────────────────────────────
describe('Something.model - updateSomething', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: update with a valid field and value
  test('should update name and return the updated row', async () => {
    const updated = { id: 1, name: 'milk' };
    pool.query.mockResolvedValue({ rows: [updated] });

    const result = await updateSomething(1, { name: 'milk' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Something" SET "name" = $1 WHERE "id" = $2 RETURNING *',
      ['milk', 1],
    );
    expect(result).toEqual(updated);
  });

  // Valid partition: verify parameterised SQL structure
  test('should handle multiple fields', async () => {
    const updated = { id: 1, name: 'updated' };
    pool.query.mockResolvedValue({ rows: [updated] });

    await updateSomething(1, { name: 'updated' });

    // Verify query was called with correct parameterised SQL
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE "Something" SET');
    expect(sql).toContain('RETURNING *');
    expect(params).toContain(1); // id is always the last param
  });

  // Boundary: non-existent id returns undefined (no row matched)
  test('should return undefined when id does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateSomething(999, { name: 'ghost' });

    expect(result).toBeUndefined();
  });

  // Error handling: DB syntax error propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('syntax error'));

    await expect(updateSomething(1, { name: 'bad' })).rejects.toThrow('syntax error');
  });

  // Boundary: empty data object – name is undefined, passed directly to query
  test('should pass undefined name to the query when data object is empty', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateSomething(1, {});

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Something" SET "name" = $1 WHERE "id" = $2 RETURNING *',
      [undefined, 1],
    );
    expect(result).toBeUndefined();
  });

  // Boundary: id = 0 is technically valid input – tests edge of numeric range
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateSomething(0, { name: 'test' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Something" SET "name" = $1 WHERE "id" = $2 RETURNING *',
      ['test', 0],
    );
    expect(result).toBeUndefined();
  });
});

// ── deleteSomething ──────────────────────────────────────
describe('Something.model - deleteSomething', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: delete an existing row and return it
  test('should delete a row and return the deleted something', async () => {
    const deleted = { id: 3, name: 'gone' };
    pool.query.mockResolvedValue({ rows: [deleted] });

    const result = await deleteSomething(3);

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Something" WHERE "id" = $1 RETURNING *',
      [3],
    );
    expect(result).toEqual(deleted);
  });

  // Boundary: non-existent id returns undefined (no row matched)
  test('should return undefined when id does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteSomething(999);

    expect(result).toBeUndefined();
  });

  // Error handling: DB connection loss propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteSomething(1)).rejects.toThrow('connection lost');
  });

  // Boundary: id = 0 is below valid range – tests edge of numeric range
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteSomething(0);

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Something" WHERE "id" = $1 RETURNING *',
      [0],
    );
    expect(result).toBeUndefined();
  });

  // Boundary: negative id – well below valid range
  test('should pass negative id to the query (boundary – below valid range)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteSomething(-1);

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Something" WHERE "id" = $1 RETURNING *',
      [-1],
    );
    expect(result).toBeUndefined();
  });
});
