import { transformFileAsync } from '@babel/core';

import { requireResolve } from './require-resolve';

export async function transformLocalFile(filePath: string): Promise<string> {
  const resolvedPath = await requireResolve(filePath);
  const plugins = [];

  const tsPlugin = attemptToToGetModule('@babel/plugin-transform-typescript');

  if (tsPlugin) {
    plugins.push([tsPlugin, { isTSX: true }]);
  }

  const jsxPlugin = attemptToToGetModule('@babel/plugin-transform-react-jsx');

  if (jsxPlugin) {
    plugins.push(jsxPlugin);
  }

  plugins.push('@jestify/babel-plugin-imports');
  const result = await transformFileAsync(resolvedPath, {
    cwd: __dirname,
    plugins,
  });

  if (!result || !result.code) {
    throw new Error(`could not transform ${filePath}`);
  }

  return result.code;

  function attemptToToGetModule(moduleName: string) {
    try {
      return require(require.resolve(moduleName, {
        paths: [filePath, __filename],
      }));
    } catch {
      return null;
    }
  }
}
