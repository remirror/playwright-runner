/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
module.exports = {
  runner: 'jest-runner-playwright-e2e',
  transform: {
    '^.+\\.ts$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }],
        ['@babel/preset-typescript']
      ],
    }],
  }
};
