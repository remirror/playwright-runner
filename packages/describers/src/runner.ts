import { createSuite, TestRun, TestWorker } from '.';

export class Runner {
  constructor(private readonly suite: ReturnType<typeof createSuite>) {}
  async run() {
    const tests = await this.suite.tests();
    const worker = new TestWorker();
    const results: TestRun[] = [];

    for (const test of tests) {
      const result = await worker.run(test);
      results.push(result);

      if (result.status === 'pass') {
        process.stdout.write('.');
      } else if (result.status === 'fail') {
        process.stdout.write('F');
      } else if (result.status === 'skip') {
        process.stdout.write('*');
      }
    }

    process.stdout.write('\n');

    for (const result of results) {
      process.stdout.write('\n');

      if (result.status !== 'fail') {
        continue;
      }

      console.log(`${result.test.fullName()}`);
      console.log(result.error?.stack ? result.error.stack : result.error);
    }
  }
}
