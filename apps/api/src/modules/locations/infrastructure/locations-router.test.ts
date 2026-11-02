import {
  errorResponseSchema,
  locationResponseSchema,
  type CreateLocationInput,
  type LocationResponse,
} from '@mantenimiento/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../app.js';
import type { Location } from '../domain/location.js';
import { InMemoryLocationRepository } from './in-memory-location-repository.js';

const CENTRO_ID = '3b0c5f3e-0000-4000-8000-000000000001';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const centro: Location = {
  id: CENTRO_ID,
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. San Martín 123',
  contactName: 'Ana Pérez',
  phone: '+54 11 5555-0101',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
};

const kiosco: Location = {
  id: '3b0c5f3e-0000-4000-8000-000000000002',
  name: 'Almacén Don José',
  kind: 'THIRD_PARTY',
  address: null,
  contactName: null,
  phone: null,
  createdAt: new Date('2026-01-03T10:00:00.000Z'),
  updatedAt: new Date('2026-01-03T10:00:00.000Z'),
};

function createTestApp() {
  const locationRepository = new InMemoryLocationRepository({
    locations: [centro, kiosco],
    now: () => new Date('2026-11-01T12:00:00.000Z'),
  });
  return { app: createApp({ locationRepository }), locationRepository };
}

function parseLocation(body: unknown): LocationResponse {
  return locationResponseSchema.parse(body);
}

describe('GET /api/locations', () => {
  it('returns every location sorted by name, matching the shared response schema', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/locations');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    const body = locationResponseSchema.array().parse(response.body);
    expect(body.map((item) => item.name)).toEqual(['Almacén Don José', 'Heladería Centro']);
  });
});

describe('GET /api/locations/:id', () => {
  it('returns the location with ISO timestamps and null optional fields', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/locations/${kiosco.id}`);

    expect(response.status).toBe(200);
    expect(parseLocation(response.body)).toEqual({
      id: kiosco.id,
      name: 'Almacén Don José',
      kind: 'THIRD_PARTY',
      address: null,
      contactName: null,
      phone: null,
      createdAt: '2026-01-03T10:00:00.000Z',
      updatedAt: '2026-01-03T10:00:00.000Z',
    });
  });

  it('answers 404 for an unknown id', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/locations/${MISSING_ID}`);

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body)).toEqual({
      error: { message: `Location ${MISSING_ID} not found` },
    });
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/locations/not-a-uuid');

    expect(response.status).toBe(400);
    const body = errorResponseSchema.parse(response.body);
    expect(body.error.message).toBe('Invalid location id');
    expect(body.error.issues).toHaveLength(1);
  });
});

describe('POST /api/locations', () => {
  it('creates a location from a valid body and answers 201', async () => {
    const { app, locationRepository } = createTestApp();
    const input: CreateLocationInput = {
      name: '  Kiosco Plaza  ',
      kind: 'THIRD_PARTY',
      contactName: 'Luis Gómez',
    };

    const response = await request(app).post('/api/locations').send(input);

    expect(response.status).toBe(201);
    const body = parseLocation(response.body);
    expect(body).toEqual({
      id: expect.any(String),
      name: 'Kiosco Plaza',
      kind: 'THIRD_PARTY',
      address: null,
      contactName: 'Luis Gómez',
      phone: null,
      createdAt: '2026-11-01T12:00:00.000Z',
      updatedAt: '2026-11-01T12:00:00.000Z',
    });
    await expect(locationRepository.findById(body.id)).resolves.toMatchObject({
      name: 'Kiosco Plaza',
    });
  });

  it('answers 400 with the offending fields for an invalid body', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/locations')
      .send({ name: '   ', kind: 'WAREHOUSE', phone: '12' });

    expect(response.status).toBe(400);
    const body = errorResponseSchema.parse(response.body);
    expect(body.error.message).toBe('Invalid request body');
    expect(body.error.issues?.map((issue) => issue.path).sort()).toEqual(['kind', 'name', 'phone']);
  });

  it('answers 400 when the body is missing', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/locations');

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.message).toBe('Invalid request body');
  });
});

describe('PATCH /api/locations/:id', () => {
  it('updates only the given fields and clears fields sent as null', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/locations/${CENTRO_ID}`)
      .send({ phone: '+54 11 5555-0202', address: null });

    expect(response.status).toBe(200);
    expect(parseLocation(response.body)).toEqual({
      id: CENTRO_ID,
      name: 'Heladería Centro',
      kind: 'OWN_STORE',
      address: null,
      contactName: 'Ana Pérez',
      phone: '+54 11 5555-0202',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-11-01T12:00:00.000Z',
    });
  });

  it('answers 400 for an empty patch', async () => {
    const { app } = createTestApp();

    const response = await request(app).patch(`/api/locations/${CENTRO_ID}`).send({});

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body)).toEqual({
      error: {
        message: 'Invalid request body',
        issues: [{ path: '', message: 'Provide at least one field to update' }],
      },
    });
  });

  it('answers 404 for an unknown id', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/locations/${MISSING_ID}`)
      .send({ name: 'Nuevo nombre' });

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).error.message).toBe(
      `Location ${MISSING_ID} not found`,
    );
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app).patch('/api/locations/123').send({ name: 'Nuevo' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.message).toBe('Invalid location id');
  });
});

describe('DELETE /api/locations/:id', () => {
  it('is not supported', async () => {
    const { app } = createTestApp();

    const response = await request(app).delete(`/api/locations/${CENTRO_ID}`);

    expect(response.status).toBe(404);
  });
});
