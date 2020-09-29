import { createEmptyTestResult } from '@jest/test-result';
import type * as Jest from '@jest/types';
import { formatExecError } from 'jest-message-util';
import type {
  OnTestFailure,
  OnTestStart,
  OnTestSuccess,
  Test,
  TestRunnerOptions,
  TestWatcher,
} from 'jest-runner';
import * as playwright from 'playwright';
import url from 'url';

import { setupPage } from './setup-page';

class PlaywrightRunnerUnit {
  private readonly _globalConfig: Jest.Config.GlobalConfig;
  constructor(globalConfig: Jest.Config.GlobalConfig) {
    this._globalConfig = globalConfig;
  }

  async runTests(
    testSuites: Test[],
    watcher: TestWatcher,
    onStart: OnTestStart,
    onResult: OnTestSuccess,
    onFailure: OnTestFailure,
    options: TestRunnerOptions,
  ) {
    const browser = await playwright.chromium.launch();

    for (const testSuite of testSuites) {
      await onStart(testSuite);
      const page = await browser.newPage();
      await setupPage(page);
      const fileUrl = url.pathToFileURL(testSuite.path);
      await page.addScriptTag({
        type: 'module',
        url: `https://local_url${fileUrl.pathname}`,
      });
      const resultsString: string = await page.evaluate(() =>
        (window as any)['__playwright__runAllTests'](),
      );
      const testResults: Array<{
        result: { status: 'pass' | 'fail' | 'skip'; error?: any };
        name: string;
        fullName: string;
        ancestorTitles: string[];
      }> = JSON.parse(resultsString, (key, value) => {
        if (value.__isError__) {
          const error = new Error(value.message);
          error.name = value.name;
          error.stack = value.stack.replace(/ \(https:\/\/local_url/g, ' (');
          return error;
        }

        return value;
      });
      const assertionResults = testResults.map(
        ({ ancestorTitles, fullName, result, name }) => {
          const { status, error } = result;
          const assertionResult: Jest.TestResult.AssertionResult = {
            ancestorTitles: ancestorTitles,
            failureMessages: [],
            fullName: fullName,
            numPassingAsserts: 0,
            status: status === 'skip' ? 'pending' : 'passed',
            title: name,
          };

          if (status === 'fail') {
            assertionResult.status = 'failed';
            assertionResult.failureMessages.push(
              error instanceof Error
                ? formatExecError(
                    error,
                    {
                      rootDir: this._globalConfig.rootDir,
                      testMatch: [],
                    },
                    {
                      noStackTrace: false,
                    },
                  )
                : String(error),
            );
          }

          return assertionResult;
        },
      );
      await page.close();
      await onResult(
        testSuite,
        makeSuiteResult(assertionResults, testSuite.path),
      );
    }

    await browser.close();
  }
}

function makeSuiteResult(
  assertionResults: Jest.TestResult.AssertionResult[],
  testPath: string,
): import('@jest/test-result').TestResult {
  const result = createEmptyTestResult();
  result.testFilePath = testPath;
  const failureMessages = [];

  for (const assertionResult of assertionResults) {
    if (assertionResult.status === 'passed') {
      result.numPassingTests++;
    } else if (assertionResult.status === 'failed') {
      result.numFailingTests++;
    } else if (assertionResult.status === 'pending') {
      result.numPendingTests++;
    } else if (assertionResult.status === 'todo') {
      result.numTodoTests++;
    }

    result.testResults.push(assertionResult);
    failureMessages.push(...assertionResult.failureMessages);
  }

  result.failureMessage = assertionResults
    .flatMap((result) => result.failureMessages)
    .join('\n');
  return result;
}

export default PlaywrightRunnerUnit;
