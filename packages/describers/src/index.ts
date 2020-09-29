/* eslint-disable jest/expect-expect */
import { Runner } from './runner';

type UserCallback<T = void> = (state: T) => void | Promise<void>;
interface State {
  [key: string]: any;
}

export interface TestRun {
  test: Test;
  status: 'pass' | 'fail' | 'skip';
  error?: any;
}

const TimeoutError = new Error('Timeout');
const TerminatedError = new Error('Terminated');
const NoError = Symbol('NoError');

function runUserCallback(
  callback: (...args: any[]) => any,
  timeout: number,
  args: any[],
) {
  let terminateCallback: (error: Error) => void;
  let timeoutId: any;
  const promise: Promise<any> = Promise.race([
    Promise.resolve()
      .then(callback.bind(null, ...args))
      .then(() => NoError)
      .catch((error: any) => error),
    new Promise((resolve) => {
      timeoutId = timeout
        ? setTimeout(resolve.bind(null, TimeoutError), timeout)
        : undefined;
    }),
    new Promise((resolve) => (terminateCallback = resolve)),
  ])
    .catch((error) => error)
    .finally(() => timeoutId && clearTimeout(timeoutId));
  const terminate = () => terminateCallback(TerminatedError);
  return { promise, terminate };
}

class Suite {
  name: string;
  parentSuite: Suite | null;
  children: Array<Suite | Test> = [];
  #tests: Test[] = [];
  #callback: UserCallback | null;
  beforeEachHooks: Array<UserCallback<State>> = [];
  afterEachHooks: Array<UserCallback<State>> = [];
  beforeAllHooks: Array<UserCallback<State>> = [];
  afterAllHooks: Array<UserCallback<State>> = [];
  focused = false;
  skipped = false;

  constructor(
    name: string,
    parent: Suite | null = null,
    callback: UserCallback | null = null,
  ) {
    this.name = name;
    this.parentSuite = parent;
    this.#callback = callback || (() => void 0);

    if (parent) {
      parent.children.push(this);
    }
  }

  fullName(): string {
    return this.parentSuite
      ? `${this.parentSuite.fullName()} ${this.name}`.trim()
      : this.name;
  }

  ancestorTitles(): string[] {
    if (!this.parentSuite) {
      if (!this.name) {
        return [];
      }

      return [this.name];
    }

    if (!this.name) {
      return this.parentSuite.ancestorTitles();
    }

    return [...this.parentSuite.ancestorTitles(), this.name];
  }

  async runTestsSerially(timeout = 0, hookTimeout = timeout) {
    const tests = await this.tests(hookTimeout);
    const wasFocused = this.focused;
    const results: TestRun[] = [];
    const worker = new TestWorker();
    this.focused = true;

    for (const test of tests) {
      results.push(await worker.run(test, timeout, hookTimeout));
    }

    this.focused = wasFocused;
    await worker.shutdown();
    return results;
  }

  async tests(timeout = 0) {
    if (this.#callback) {
      const callback = this.#callback;
      this.#callback = null;
      const previousSuite = currentSuite;
      currentSuite = this;
      const { promise } = runUserCallback(callback, timeout, []);
      const error = await promise;

      if (error !== NoError) {
        throw error;
      }

      currentSuite = previousSuite;

      for (const testOrSuite of this.children) {
        if (testOrSuite instanceof Test) {
          this.#tests.push(testOrSuite);
        } else {
          this.#tests.push(...(await testOrSuite.tests(timeout)));
        }
      }
    }

    return this.#tests;
  }

  _hasFocusedDescendant(): boolean {
    return this.children.some((child) => {
      return (
        child.focused ||
        (child instanceof Suite && child._hasFocusedDescendant())
      );
    });
  }
}

class Test {
  _callback: UserCallback<State>;
  name: string;
  suite: Suite;
  focused = false;
  skipped = false;

  constructor(name: string, callback: UserCallback<State>) {
    this._callback = callback;
    this.name = name;
    this.suite = currentSuite;
    currentSuite.children.push(this);
  }

  shouldRun() {
    if (this.skipped) {
      return false;
    }

    if (this.focused) {
      return true;
    }

    let suite: Suite | null = this.suite;

    while (suite) {
      if (suite.skipped) {
        return false;
      }

      suite = suite.parentSuite;
    }

    suite = this.suite;

    while (suite.parentSuite) {
      if (suite.focused) {
        break;
      }

      suite = suite.parentSuite;
    }

    if (suite._hasFocusedDescendant()) {
      return false;
    }

    return true;
  }

  ancestorTitles() {
    return [...this.suite.ancestorTitles(), this.name];
  }

  fullName() {
    return `${this.suite.fullName()} ${this.name}`.trim();
  }

  async runInIsolation(timeout = 0, hookTimeout = timeout): Promise<TestRun> {
    const worker = new TestWorker();
    const result = await worker.run(this, timeout, hookTimeout);
    await worker.shutdown();
    return result;
  }
}

export class TestWorker {
  readonly #suiteStack: Suite[] = [];
  state: State;

  constructor(state: State = {}) {
    this.state = state;
  }

  async run(test: Test, timeout = 0, hookTimeout = timeout): Promise<TestRun> {
    if (!test.shouldRun()) {
      return { test, status: 'skip' };
    }

    const run: TestRun = {
      test,
      status: 'pass',
    };

    const suiteStack: Suite[] = [];

    for (
      let suite: Suite | null = test.suite;
      suite;
      suite = suite.parentSuite
    ) {
      suiteStack.push(suite);
    }

    suiteStack.reverse();

    let common = 0;

    while (
      common < suiteStack.length &&
      this.#suiteStack[common] === suiteStack[common]
    ) {
      common++;
    }

    while (this.#suiteStack.length > common) {
      const suite = this.#suiteStack.pop();

      for (const afterAll of suite?.afterAllHooks ?? []) {
        if (!(await this._runHook(run, afterAll, hookTimeout))) {
          return run;
        }
      }
    }

    while (this.#suiteStack.length < suiteStack.length) {
      const suite = suiteStack[this.#suiteStack.length];
      this.#suiteStack.push(suite);

      for (const beforeAll of suite.beforeAllHooks) {
        if (!(await this._runHook(run, beforeAll, hookTimeout))) {
          return run;
        }
      }
    }

    // From this point till the end, we have to run all hooks
    // no matter what happens.

    for (const suite of this.#suiteStack) {
      for (const beforeEach of suite.beforeEachHooks) {
        await this._runHook(run, beforeEach, hookTimeout);
      }
    }

    if (run.status === 'pass') {
      const { promise } = runUserCallback(test._callback, timeout, [
        this.state,
      ]);
      const error = await promise;

      if (error !== NoError && run.status === 'pass') {
        run.status = 'fail';

        if (error === TimeoutError) {
          run.error = `timed out while running test`;
        } else if (error === TerminatedError) {
          run.error = `terminated while running test`;
        } else {
          run.error = error;
        }
      }
    }

    for (const suite of this.#suiteStack.slice().reverse()) {
      for (const afterEach of suite.afterEachHooks) {
        await this._runHook(run, afterEach, hookTimeout);
      }
    }

    return run;
  }

  async shutdown(hookTimeout = 0) {
    while (this.#suiteStack.length > 0) {
      const suite = this.#suiteStack.pop()!;

      for (const afterAll of suite.afterAllHooks) {
        await this._runHook(null, afterAll, hookTimeout);
      }
    }
  }

  private async _runHook(
    run: TestRun | null,
    hook: UserCallback<State>,
    hookTimeout: number,
  ) {
    const { promise } = runUserCallback(hook, hookTimeout, [this.state]);
    const error = await promise;

    if (error === NoError) {
      return true;
    }

    if (run && run.status === 'pass') {
      run.status = 'fail';

      if (error === TimeoutError) {
        run.error = `timed out while running hook`;
      } else if (error === TerminatedError) {
        run.error = '';
      } // Do not report hook termination details - it's just noise.
      else {
        run.error = error;
      }
    }

    return false;
  }
}

export interface Describe<ReturnValue = void> {
  (name: string, callback: UserCallback): ReturnValue;
  (callback: UserCallback): ReturnValue;
}

type Callback<Input, Output> = (input: Input) => Promise<Output>;

export class Environment<EachState, AllState, InitialState = void> {
  public it: (
    name: string,
    callback: (state: EachState & AllState) => void | Promise<void>,
  ) => void;
  public test: (
    name: string,
    callback: (state: EachState & AllState) => void | Promise<void>,
  ) => void;
  constructor(
    private readonly hooks: {
      beforeAll: Callback<InitialState, AllState>;
      beforeEach: Callback<AllState, EachState>;
      afterEach: Callback<AllState & EachState, void>;
      afterAll: Callback<AllState, void>;
    },
  ) {
    this.it = (name, callback) => {
      test(name, async (state: unknown) => {
        const allState = await this.hooks.beforeAll(state as InitialState);
        const eachState = await this.hooks.beforeEach(allState);
        let success = true;
        let error;
        try {
          await callback({ ...allState, ...eachState });
        } catch (error_) {
          error = error_;
          success = false;
        }
        await this.hooks.afterEach({ ...allState, ...eachState });
        await this.hooks.afterAll(allState);

        if (!success) {
          throw error;
        }
      });
    };

    this.test = this.it;
  }

  extend<NewEachState = EachState, NewAllState = AllState>(hooks: {
    beforeAll?: Callback<AllState, NewAllState>;
    beforeEach?: Callback<EachState, NewEachState>;

    afterEach?: Callback<NewAllState & NewEachState, void>;
    afterAll?: Callback<NewAllState, void>;
  }) {
    const beforeAll = hooks.beforeAll! ?? (async (state) => state);
    const beforeEach = hooks.beforeEach! ?? (async (state) => state);
    const afterEach = hooks.afterEach ?? (async () => void 0);
    const afterAll = hooks.afterAll ?? (async () => void 0);

    let allState: AllState;
    let eachState: EachState;
    return new Environment<NewEachState, NewAllState, InitialState>({
      beforeAll: async (state) => {
        allState = await this.hooks.beforeAll(state);
        return await beforeAll(allState);
      },
      beforeEach: async (newAllState) => {
        eachState = await this.hooks.beforeEach(allState);
        return await beforeEach({ ...eachState, ...newAllState });
      },
      afterEach: async (newCombinedState) => {
        await afterEach(newCombinedState);
        await this.hooks.afterEach({ ...allState, ...eachState });
      },
      afterAll: async (newAllState) => {
        await afterAll(newAllState);
        await this.hooks.afterAll(allState);
      },
    });
  }
}

export const describe: Describe & { only: Describe } = (
  callbackOrName: string | UserCallback,
  callback?: UserCallback,
) => {
  _createSuite(callbackOrName as any, callback as any);
};

export const fdescribe: Describe = (
  callbackOrName: string | UserCallback,
  callback?: UserCallback,
) => {
  const suite = _createSuite(callbackOrName as any, callback as any);
  suite.focused = true;
};
describe.only = fdescribe;

export const xdescribe: Describe = (
  callbackOrName: string | UserCallback,
  callback?: UserCallback,
) => {
  const suite = _createSuite(callbackOrName as any, callback as any);
  suite.skipped = true;
};
const _createSuite: Describe<Suite> = (
  callbackOrName: string | UserCallback,
  callback?: UserCallback,
) => {
  const name = callback ? (callbackOrName as string) : '';

  if (!callback) {
    callback = callbackOrName as UserCallback;
  }

  return new Suite(name, currentSuite, callback);
};

export const createSuite: Describe<Suite> = (
  callbackOrName: string | UserCallback,
  callback?: UserCallback,
) => {
  useDefaultRunner = false;
  return _createSuite(callbackOrName as any, callback as any);
};

export function it(name: string, callback: UserCallback<State>) {
  new Test(name, callback);
}

export function fit(name: string, callback: UserCallback<State>) {
  const test = new Test(name, callback);
  test.focused = true;
}
it.only = fit;
it.beforeEach = beforeEach;
it.beforeAll = beforeAll;
it.afterEach = afterEach;
it.afterAll = afterAll;
it.describe = describe;

export const test = it;

export function xit(name: string, callback: UserCallback<State>) {
  const test = new Test(name, callback);
  test.skipped = true;
}

export function createTest(name: string, callback: UserCallback<State>) {
  return new Test(name, callback);
}

export type It<T> = (name: string, callback: UserCallback<T & State>) => void;
export type BeforeOrAfter<T> = (callback: UserCallback<T & State>) => void;

export function beforeEach(callback: UserCallback<State>) {
  currentSuite.beforeEachHooks.push(callback);
}

export function afterEach(callback: UserCallback<State>) {
  currentSuite.afterEachHooks.push(callback);
}

export function beforeAll(callback: UserCallback<State>) {
  currentSuite.beforeAllHooks.push(callback);
}

export function afterAll(callback: UserCallback<State>) {
  currentSuite.afterAllHooks.push(callback);
}

const rootSuite = new Suite('', null);
let currentSuite = rootSuite;
let useDefaultRunner = true;
setImmediate(async () => {
  if (useDefaultRunner) {
    const runner = new Runner(rootSuite);
    await runner.run();
  }
});

export type { Test };
