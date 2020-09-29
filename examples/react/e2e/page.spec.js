test('is a basic test with the page', async ({ page }) => {
  expect(await page.evaluate(() => 1 + 2)).toBe(3);
});

test('is not firefox', async ({ page }) => {
  expect(await page.evaluate(() => navigator.userAgent)).toContain('WebKit');
});
