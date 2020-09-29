beforeEach((state) => {
  state.before = true;
});

test('is one test', (state) => {
  expect(state.before).toEqual(true);
});
