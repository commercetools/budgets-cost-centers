// msw server for the Merchant Center API proxy, shared by the data tests. [BCC-VIEW-8]
import { setupServer } from 'msw/node';

export const PROJECT = 'demo';
// window.app.mcApiUrl of the MC Jest preset, plus the proxy path of the platform target.
export const API = `http://localhost:8080/proxy/ctp/${PROJECT}`;

export function startServer() {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

// The query parameters of a request, `where` as a list.
export const whereOf = (url: URL) => url.searchParams.getAll('where');
