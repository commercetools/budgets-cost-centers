// The seed runs only against the configured sandbox, named explicitly. [BCC-SEED-4]
import * as logger from '../../shared/src/logger';
import { main } from '../src/index';
import { FakePort } from './fake-port';

const ENV = {
  CTP_PROJECT_KEY: 'bcc-sandbox',
  CTP_AUTH_URL: 'https://auth.example.com',
  CTP_API_URL: 'https://api.example.com',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'secret',
  CTP_SCOPE: 'manage_business_units:bcc-sandbox view_types:bcc-sandbox',
};

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'));
});
afterEach(() => jest.restoreAllMocks());

describe('[BCC-SEED-4] safety', () => {
  test.each([
    ['missing --project', [], ENV],
    ['--project without a value', ['--project'], ENV],
    ['a different --project', ['--project', 'bcc-production'], ENV],
    ['a different --project= form', ['--project=bcc-production'], ENV],
    ['no CTP_PROJECT_KEY configured', ['--project', 'bcc-sandbox'], { ...ENV, CTP_PROJECT_KEY: '' }],
    ['a client with manage_project', ['--project', 'bcc-sandbox'], { ...ENV, CTP_SCOPE: 'manage_project:bcc-sandbox' }],
  ])('%s exits 1 before any request', async (_label, argv, env) => {
    const createPort = jest.fn(() => new FakePort());
    expect(await main(argv, env, createPort)).toBe(1);
    expect(createPort).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('error', expect.any(String));
  });

  test('the configured project, named explicitly, runs the seed', async () => {
    const port = new FakePort();
    const createPort = jest.fn(() => port);
    expect(await main(['--project', 'bcc-sandbox'], ENV, createPort)).toBe(0);
    expect(createPort).toHaveBeenCalledWith(expect.objectContaining({ projectKey: 'bcc-sandbox' }));
    expect(port.writes.length).toBeGreaterThan(0);
  });

  test('the --project= form is accepted', async () => {
    expect(await main(['--project=bcc-sandbox'], ENV, () => new FakePort())).toBe(0);
  });

  test('a failure while applying exits 1 with the reason', async () => {
    const port = new FakePort();
    port.types.clear();
    expect(await main(['--project', 'bcc-sandbox'], ENV, () => port)).toBe(1);
    expect(logger.log).toHaveBeenCalledWith('error', expect.stringMatching(/service postDeploy/));
    expect(port.writes).toEqual([]);
  });
});
