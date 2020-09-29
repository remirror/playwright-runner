interface PlaywrightState {
  page: import('playwright').Page;
  context: import('playwright').BrowserContext;
}
declare let expect: typeof import('expect');
declare let it: import('@jestify/describers').It<PlaywrightState>;
declare let describers: typeof import('@jestify/describers').describe;
declare let beforeEach: import('@jestify/describers').BeforeOrAfter<PlaywrightState>;
