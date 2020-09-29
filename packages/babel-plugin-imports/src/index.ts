import babel from '@babel/core';
import babelUtils from '@babel/helper-plugin-utils';

function transformModulePath(moduleName: string, fileName = ''): string {
  if (
    moduleName.startsWith('.') ||
    moduleName.startsWith('/') ||
    moduleName.startsWith('https://')
  ) {
    return moduleName;
  }

  return `https://third_party/?name=${moduleName}&from=${fileName}`;
}

export default babelUtils.declare(() => {
  return {
    visitor: {
      ImportDeclaration: (nodePath, { filename }) => {
        const modulePath = nodePath.node.source.value;
        const transformedPath = transformModulePath(
          nodePath.node.source.value,
          filename,
        );

        if (transformedPath === modulePath) {
          return;
        }

        const newPath = babel.types.importDeclaration(
          nodePath.node.specifiers,
          babel.types.stringLiteral(transformedPath),
        );
        nodePath.replaceWith(newPath);
      },
      ExportNamedDeclaration: (nodePath, { filename }) => {
        if (!nodePath.node.source) {
          return;
        }

        const modulePath = nodePath.node.source.value;
        const transformedPath = transformModulePath(
          nodePath.node.source.value,
          filename,
        );

        if (transformedPath === modulePath) {
          return;
        }

        const newPath = babel.types.exportNamedDeclaration(
          nodePath.node.declaration,
          nodePath.node.specifiers,
          babel.types.stringLiteral(transformedPath),
        );
        nodePath.replaceWith(newPath);
      },
      ExportAllDeclaration: (nodePath, { filename }) => {
        const modulePath = nodePath.node.source.value;
        const transformedPath = transformModulePath(
          nodePath.node.source.value,
          filename,
        );

        if (transformedPath === modulePath) {
          return;
        }

        const newPath = babel.types.exportAllDeclaration(
          babel.types.stringLiteral(transformedPath),
        );
        nodePath.replaceWith(newPath);
      },
    },
  };
});
