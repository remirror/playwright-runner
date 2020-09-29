import babel from '@babel/core';

async function transform(code: string): Promise<string | undefined> {
  const output = await babel.transformAsync(code, {
    cwd: __dirname,
    filename: '/fakepath',
    plugins: [
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      babel.createConfigItem(require('../..')),
    ],
  });
  return output?.code ?? undefined;
}

test('should not mess up simple code', async () => {
  const out = await transform('const x = 5;');
  expect(out).toBe('const x = 5;');
});

test('should work leave no extension alone', async () => {
  const out = await transform(`import "./something";`);
  expect(out).toBe('import "./something";');
});

test('should leave a .ts extension alone', async () => {
  const out = await transform(`import "./something.ts";`);
  expect(out).toBe('import "./something.ts";');
});

test('should leave a .js extension alone', async () => {
  const out = await transform(`import "./something.js";`);
  expect(out).toBe('import "./something.js";');
});

test('should transform third party files', async () => {
  const out = await transform(`import "something";`);
  expect(out).toBe(
    'import "https://third_party/?name=something&from=/fakepath";',
  );
});

test('should transform third party files with a folder', async () => {
  const out = await transform(`import "@something/types";`);
  expect(out).toBe(
    'import "https://third_party/?name=@something/types&from=/fakepath";',
  );
});

test('should transform import from', async () => {
  const out = await transform(`import { something } from "something";`);
  expect(out).toBe(
    'import { something } from "https://third_party/?name=something&from=/fakepath";',
  );
});

test('should transform export', async () => {
  const out = await transform(`export { something } from "something";`);
  expect(out).toBe(
    'export { something } from "https://third_party/?name=something&from=/fakepath";',
  );
});

test('should transform export all', async () => {
  const out = await transform(`export * from "something";`);
  expect(out).toBe(
    'export * from "https://third_party/?name=something&from=/fakepath";',
  );
});
