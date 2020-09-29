import React from 'react';
import ReactDOM from 'react-dom';

import { App } from './App';

test('should work', () => {
  const container = document.createElement('div');
  ReactDOM.render(<App />, container);
  expect(container.textContent).toBe('Hello World');
});

test('should type into an input', async () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  await (window as any).keyboard.type('Hello World');
  expect(input.value).toBe('Hello World');
});
