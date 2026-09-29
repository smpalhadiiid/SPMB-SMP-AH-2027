
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(global as any).window = {
  location: { protocol: 'https:', host: 'localhost:3000', href: 'http://localhost:3000', reload: () => {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  open: () => {}
};
(global as any).localStorage = (global as any).window.localStorage;

const queryClient = new QueryClient();
try {
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
  console.log('RENDER SUCCESS, length:', html.length);
} catch (e) {
  console.error('RENDER FAILED WITH ERROR:', e);
}
