import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('createApp', () => {
  it('answers GET /api/health with 200 and an ok status', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const response = await request(createApp()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      error: { message: 'Route GET /api/does-not-exist not found' },
    });
  });

  it('answers malformed JSON bodies with a JSON 400', async () => {
    const response = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'Malformed JSON body' } });
  });
});
