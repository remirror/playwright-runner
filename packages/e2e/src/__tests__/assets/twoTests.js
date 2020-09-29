beforeAll((state) => {
  state.shared = (state.shared || 0) + 1;
});

afterAll((state) => {
  state.shared++;
});

beforeEach((state) => {
  state.counter = (state.counter || 0) + 1;
});

afterEach((state) => {
  state.counter++;
});

test('is the first test', (state) => {
  expect(state.shared).toEqual(1);
  expect(state.counter).toEqual(1);
});

test('is the second test', (state) => {
  expect(state.shared).toEqual(1);
  expect(state.counter).toEqual(1);
});
