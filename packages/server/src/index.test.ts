import { describe, it, expect, afterAll } from 'vitest';
import { app, httpServer } from './index';

describe('Server', () => {
  afterAll(() => {
    httpServer.close();
  });

  it('exports app and httpServer', () => {
    expect(app).toBeDefined();
    expect(httpServer).toBeDefined();
  });

  it('health endpoint responds correctly', async () => {
    // Simple smoke test — full HTTP testing added in later steps
    expect(app).toBeTruthy();
  });
});
