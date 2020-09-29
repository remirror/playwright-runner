const { fakeJestRun } = require('./fakeJestRun');

test('should work', async () => {
  const result = await fakeJestRun([]);
  expect(result.numTotalTests).toBe(0);
  expect(result.wasInterrupted).toBe(false);
});
