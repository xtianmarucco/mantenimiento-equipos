import {
  equipmentEventResponseSchema,
  equipmentResponseSchema,
  errorResponseSchema,
  recordEquipmentEventResponseSchema,
  type CreateEquipmentInput,
  type EquipmentResponse,
} from '@mantenimiento/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../app.js';
import type { Location } from '../../locations/domain/location.js';
import { InMemoryLocationRepository } from '../../locations/infrastructure/in-memory-location-repository.js';
import type { Equipment } from '../domain/equipment.js';
import { InMemoryEquipmentRepository } from './in-memory-equipment-repository.js';

const CENTRO_ID = '3b0c5f3e-0000-4000-8000-000000000001';
const KIOSCO_ID = '3b0c5f3e-0000-4000-8000-000000000002';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const NOW = '2026-11-01T12:00:00.000Z';

function location(id: string, name: string): Location {
  const timestamp = new Date('2026-01-01T10:00:00.000Z');
  return {
    id,
    name,
    kind: 'OWN_STORE',
    address: null,
    contactName: null,
    phone: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const freezer: Equipment = {
  id: '7c1d6a4f-0000-4000-8000-000000000001',
  code: 'EQ-0001',
  name: 'Freezer horizontal',
  type: 'FREEZER',
  brand: 'Gafa',
  model: 'HGF-350',
  serialNumber: 'SN-1',
  purchaseDate: '2024-03-15',
  warrantyUntil: '2025-03-15',
  status: 'OPERATIONAL',
  locationId: CENTRO_ID,
  notes: 'Junto a la caja',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
};

const vitrina: Equipment = {
  ...freezer,
  id: '7c1d6a4f-0000-4000-8000-000000000002',
  code: 'EQ-0002',
  name: 'Vitrina',
  type: 'DISPLAY_CASE',
  serialNumber: null,
  warrantyUntil: null,
  status: 'IN_REPAIR',
  locationId: KIOSCO_ID,
  notes: null,
};

const retired: Equipment = {
  ...freezer,
  id: '7c1d6a4f-0000-4000-8000-000000000003',
  code: 'EQ-0003',
  name: 'Antigua heladera',
  type: 'REFRIGERATOR',
  status: 'RETIRED',
};

function createTestApp() {
  const locationRepository = new InMemoryLocationRepository({
    locations: [location(CENTRO_ID, 'Centro'), location(KIOSCO_ID, 'Kiosco')],
  });
  const equipmentRepository = new InMemoryEquipmentRepository({
    locations: locationRepository,
    equipment: [vitrina, freezer, retired],
    now: () => new Date(NOW),
  });
  return {
    app: createApp({ locationRepository, equipmentRepository, today: () => NOW.slice(0, 10) }),
    equipmentRepository,
  };
}

function parseEquipment(body: unknown): EquipmentResponse {
  return equipmentResponseSchema.parse(body);
}

function names(body: unknown): string[] {
  return equipmentResponseSchema
    .array()
    .parse(body)
    .map((item) => item.name);
}

const validBody: CreateEquipmentInput = {
  code: ' eq-0042 ',
  name: 'Máquina de helado soft',
  type: 'ICE_CREAM_MACHINE',
  brand: 'Carpigiani',
  model: '161 G SP',
  purchaseDate: '2026-10-01',
  warrantyUntil: '2027-10-01',
  locationId: KIOSCO_ID,
};

describe('GET /api/equipment', () => {
  it('lists equipment that is not retired, sorted by name, matching the shared schema', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/equipment');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(names(response.body)).toEqual(['Freezer horizontal', 'Vitrina']);
  });

  it('lists retired equipment with status=RETIRED', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/equipment').query({ status: 'RETIRED' });

    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(['Antigua heladera']);
  });

  it('filters by status, location and type', async () => {
    const { app } = createTestApp();

    const byStatus = await request(app).get('/api/equipment?status=IN_REPAIR');
    const byLocation = await request(app).get(`/api/equipment?locationId=${CENTRO_ID}`);
    const byType = await request(app).get('/api/equipment?type=FREEZER');
    const combined = await request(app).get(
      `/api/equipment?type=DISPLAY_CASE&locationId=${CENTRO_ID}`,
    );

    expect(names(byStatus.body)).toEqual(['Vitrina']);
    expect(names(byLocation.body)).toEqual(['Freezer horizontal']);
    expect(names(byType.body)).toEqual(['Freezer horizontal']);
    expect(names(combined.body)).toEqual([]);
  });

  it('answers 400 with each offending query parameter', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(
      '/api/equipment?status=BROKEN&locationId=not-a-uuid&type=freezer',
    );

    expect(response.status).toBe(400);
    const body = errorResponseSchema.parse(response.body);
    expect(body.error.message).toBe('Invalid query string');
    expect(body.error.issues?.map((issue) => issue.path).sort()).toEqual([
      'locationId',
      'status',
      'type',
    ]);
  });

  it('answers 400 for a repeated query parameter', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/equipment?status=RETIRED&status=IN_REPAIR');

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues?.[0]?.path).toBe('status');
  });
});

describe('GET /api/equipment/:id', () => {
  it('returns the equipment with YYYY-MM-DD dates and ISO timestamps', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/equipment/${vitrina.id}`);

    expect(response.status).toBe(200);
    expect(parseEquipment(response.body)).toEqual({
      id: vitrina.id,
      code: 'EQ-0002',
      name: 'Vitrina',
      type: 'DISPLAY_CASE',
      brand: 'Gafa',
      model: 'HGF-350',
      serialNumber: null,
      purchaseDate: '2024-03-15',
      warrantyUntil: null,
      status: 'IN_REPAIR',
      locationId: KIOSCO_ID,
      notes: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
    });
  });

  it('returns retired equipment too', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/equipment/${retired.id}`);

    expect(response.status).toBe(200);
    expect(parseEquipment(response.body).status).toBe('RETIRED');
  });

  it('answers 404 for an unknown id', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/equipment/${MISSING_ID}`);

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body)).toEqual({
      error: { message: `Equipment ${MISSING_ID} not found` },
    });
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/equipment/EQ-0001');

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.message).toBe('Invalid equipment id');
  });
});

describe('POST /api/equipment', () => {
  it('creates equipment with a normalized code and default status, answering 201', async () => {
    const { app, equipmentRepository } = createTestApp();

    const response = await request(app).post('/api/equipment').send(validBody);

    expect(response.status).toBe(201);
    const body = parseEquipment(response.body);
    expect(body).toEqual({
      id: expect.any(String),
      code: 'EQ-0042',
      name: 'Máquina de helado soft',
      type: 'ICE_CREAM_MACHINE',
      brand: 'Carpigiani',
      model: '161 G SP',
      serialNumber: null,
      purchaseDate: '2026-10-01',
      warrantyUntil: '2027-10-01',
      status: 'OPERATIONAL',
      locationId: KIOSCO_ID,
      notes: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(equipmentRepository.findById(body.id)).resolves.toMatchObject({
      code: 'EQ-0042',
    });
  });

  it('answers 409 for a code already in use, after normalizing it', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/equipment')
      .send({ ...validBody, code: 'eq-0003' });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toEqual({
      error: { message: 'Equipment code EQ-0003 is already in use' },
    });
  });

  it('answers 400 with an issue at locationId for a location that does not exist', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/equipment')
      .send({ ...validBody, locationId: MISSING_ID });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body)).toEqual({
      error: {
        message: `Location ${MISSING_ID} not found`,
        issues: [{ path: 'locationId', message: 'Location does not exist' }],
      },
    });
  });

  it('answers 400 with the offending fields for an invalid body', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/equipment').send({
      code: 'EQ42',
      name: ' ',
      type: 'TOASTER',
      brand: 'Gafa',
      model: 'X',
      purchaseDate: '2026-02-30',
      locationId: 'nope',
    });

    expect(response.status).toBe(400);
    const body = errorResponseSchema.parse(response.body);
    expect(body.error.message).toBe('Invalid request body');
    expect(body.error.issues?.map((issue) => issue.path).sort()).toEqual([
      'code',
      'locationId',
      'name',
      'purchaseDate',
      'type',
    ]);
  });

  it('answers 400 when both dates are sent and the warranty ends first', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/equipment')
      .send({ ...validBody, warrantyUntil: '2026-09-30' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues?.[0]?.path).toBe('warrantyUntil');
  });
});

describe('PATCH /api/equipment/:id', () => {
  it('updates only the given fields and clears fields sent as null', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ code: 'fz-0001', serialNumber: null, locationId: KIOSCO_ID });

    expect(response.status).toBe(200);
    expect(parseEquipment(response.body)).toMatchObject({
      code: 'FZ-0001',
      serialNumber: null,
      locationId: KIOSCO_ID,
      name: 'Freezer horizontal',
      notes: 'Junto a la caja',
      updatedAt: NOW,
    });
  });

  it('can change the status to RETIRED and back', async () => {
    const { app } = createTestApp();

    const retiredResponse = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ status: 'RETIRED' });
    const restored = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ status: 'OPERATIONAL' });

    expect(parseEquipment(retiredResponse.body).status).toBe('RETIRED');
    expect(parseEquipment(restored.body).status).toBe('OPERATIONAL');
  });

  it('answers 400 when only warrantyUntil is sent and it ends before the stored purchase date', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ warrantyUntil: '2024-03-14' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body)).toEqual({
      error: {
        message: 'Warranty cannot end before the purchase date',
        issues: [
          { path: 'warrantyUntil', message: 'Warranty cannot end before the purchase date' },
        ],
      },
    });
  });

  it('answers 400 when only purchaseDate is sent and it falls after the stored warranty', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ purchaseDate: '2025-03-16' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues?.[0]?.path).toBe('warrantyUntil');
  });

  it('answers 409 for a code used by other equipment', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ code: 'EQ-0002' });

    expect(response.status).toBe(409);
  });

  it('answers 400 with an issue at locationId for a location that does not exist', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .patch(`/api/equipment/${freezer.id}`)
      .send({ locationId: MISSING_ID });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
      { path: 'locationId', message: 'Location does not exist' },
    ]);
  });

  it('answers 400 for an empty patch', async () => {
    const { app } = createTestApp();

    const response = await request(app).patch(`/api/equipment/${freezer.id}`).send({});

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
      .patch(`/api/equipment/${MISSING_ID}`)
      .send({ name: 'Nuevo' });

    expect(response.status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app).patch('/api/equipment/123').send({ name: 'Nuevo' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.message).toBe('Invalid equipment id');
  });
});

describe('POST /api/equipment/:id/retire', () => {
  it('retires the equipment and answers 200 every time', async () => {
    const { app } = createTestApp();

    const first = await request(app).post(`/api/equipment/${freezer.id}/retire`);
    const second = await request(app).post(`/api/equipment/${freezer.id}/retire`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(parseEquipment(first.body)).toEqual({
      ...parseEquipment(second.body),
      status: 'RETIRED',
      updatedAt: NOW,
    });
    const list = await request(app).get('/api/equipment');
    expect(names(list.body)).toEqual(['Vitrina']);
  });

  it('answers 404 for an unknown id', async () => {
    const { app } = createTestApp();

    const response = await request(app).post(`/api/equipment/${MISSING_ID}/retire`);

    expect(response.status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/equipment/abc/retire');

    expect(response.status).toBe(400);
  });
});

describe('POST /api/equipment/:id/events', () => {
  it('records the event and answers 201 with the event and the equipment after its effect', async () => {
    const { app } = createTestApp();

    const response = await request(app).post(`/api/equipment/${vitrina.id}/events`).send({
      type: 'REPAIR',
      occurredOn: '2026-10-20',
      description: '  Compressor replaced ',
      technician: 'Frío Sur',
      cost: 42000.5,
      toLocationId: CENTRO_ID,
    });

    expect(response.status).toBe(201);
    expect(recordEquipmentEventResponseSchema.parse(response.body)).toEqual({
      event: {
        id: expect.any(String),
        equipmentId: vitrina.id,
        type: 'REPAIR',
        occurredOn: '2026-10-20',
        description: 'Compressor replaced',
        technician: 'Frío Sur',
        cost: 42000.5,
        resultingStatus: null,
        fromLocationId: null,
        toLocationId: null,
        replacementEquipmentId: null,
        createdAt: NOW,
      },
      equipment: {
        ...vitrina,
        status: 'OPERATIONAL',
        createdAt: vitrina.createdAt.toISOString(),
        updatedAt: NOW,
      },
    });
  });

  it('records a transfer with the previous location', async () => {
    const { app } = createTestApp();

    const response = await request(app).post(`/api/equipment/${freezer.id}/events`).send({
      type: 'TRANSFER',
      occurredOn: '2026-11-01',
      description: 'A',
      toLocationId: KIOSCO_ID,
    });

    expect(response.status).toBe(201);
    const body = recordEquipmentEventResponseSchema.parse(response.body);
    expect(body.event).toMatchObject({ fromLocationId: CENTRO_ID, toLocationId: KIOSCO_ID });
    expect(body.equipment.locationId).toBe(KIOSCO_ID);
  });

  it('answers 400 with an issue at type for an invalid transition', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post(`/api/equipment/${freezer.id}/events`)
      .send({ type: 'REPAIR', occurredOn: '2026-10-20', description: 'A' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
      { path: 'type', message: 'Only equipment in repair or out of service can be repaired' },
    ]);
  });

  it('answers 400 with an issue at type for retired equipment', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post(`/api/equipment/${retired.id}/events`)
      .send({ type: 'MAINTENANCE', occurredOn: '2026-10-20', description: 'A' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
      { path: 'type', message: 'Retired equipment accepts no events' },
    ]);
  });

  it('answers 400 with an issue at occurredOn for a future date', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post(`/api/equipment/${freezer.id}/events`)
      .send({ type: 'MAINTENANCE', occurredOn: '2026-11-02', description: 'A' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
      { path: 'occurredOn', message: 'Date cannot be in the future' },
    ]);
  });

  it('answers 400 with an issue at toLocationId for a same-location transfer', async () => {
    const { app } = createTestApp();

    const response = await request(app).post(`/api/equipment/${freezer.id}/events`).send({
      type: 'TRANSFER',
      occurredOn: '2026-10-20',
      description: 'A',
      toLocationId: CENTRO_ID,
    });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
      { path: 'toLocationId', message: 'Equipment is already at this location' },
    ]);
  });

  it('answers 400 with an issue at toLocationId for a transfer to an unknown location', async () => {
    const { app } = createTestApp();

    const response = await request(app).post(`/api/equipment/${freezer.id}/events`).send({
      type: 'TRANSFER',
      occurredOn: '2026-10-20',
      description: 'A',
      toLocationId: MISSING_ID,
    });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
      { path: 'toLocationId', message: 'Location does not exist' },
    ]);
  });

  it.each([
    { case: 'missing', replacementEquipmentId: MISSING_ID, message: 'Equipment does not exist' },
    {
      case: 'self',
      replacementEquipmentId: freezer.id,
      message: 'Equipment cannot replace itself',
    },
    {
      case: 'retired',
      replacementEquipmentId: retired.id,
      message: 'Replacement equipment is retired',
    },
  ])(
    'answers 400 with an issue at replacementEquipmentId for a $case replacement',
    async ({ replacementEquipmentId, message }) => {
      const { app, equipmentRepository } = createTestApp();

      const response = await request(app).post(`/api/equipment/${freezer.id}/events`).send({
        type: 'REPLACEMENT',
        occurredOn: '2026-10-20',
        description: 'A',
        replacementEquipmentId,
      });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(response.body).error.issues).toEqual([
        { path: 'replacementEquipmentId', message },
      ]);
      expect((await equipmentRepository.findById(freezer.id))?.status).toBe('OPERATIONAL');
    },
  );

  it('answers 400 with the schema issues for an invalid body', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post(`/api/equipment/${freezer.id}/events`)
      .send({ type: 'BREAKDOWN', occurredOn: '2026-10-20', description: 'A' });

    expect(response.status).toBe(400);
    const { error } = errorResponseSchema.parse(response.body);
    expect(error.message).toBe('Invalid request body');
    expect(error.issues?.map((issue) => issue.path)).toEqual(['resultingStatus']);
  });

  it('answers 404 for unknown equipment', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post(`/api/equipment/${MISSING_ID}/events`)
      .send({ type: 'MAINTENANCE', occurredOn: '2026-10-20', description: 'A' });

    expect(response.status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/equipment/abc/events')
      .send({ type: 'MAINTENANCE', occurredOn: '2026-10-20', description: 'A' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.message).toBe('Invalid equipment id');
  });
});

describe('GET /api/equipment/:id/events', () => {
  it('lists the history newest first, matching the shared schema', async () => {
    const { app } = createTestApp();
    const post = (body: object) =>
      request(app).post(`/api/equipment/${freezer.id}/events`).send(body);
    await post({ type: 'MAINTENANCE', occurredOn: '2026-09-01', description: 'First' });
    await post({
      type: 'BREAKDOWN',
      occurredOn: '2026-10-01',
      description: 'Third',
      resultingStatus: 'IN_REPAIR',
    });
    await post({ type: 'MAINTENANCE', occurredOn: '2026-09-15', description: 'Second' });

    const response = await request(app).get(`/api/equipment/${freezer.id}/events`);

    expect(response.status).toBe(200);
    expect(
      equipmentEventResponseSchema
        .array()
        .parse(response.body)
        .map((event) => event.description),
    ).toEqual(['Third', 'Second', 'First']);
  });

  it('answers an empty list for equipment without events', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/equipment/${vitrina.id}/events`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('answers 404 for unknown equipment', async () => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/equipment/${MISSING_ID}/events`);

    expect(response.status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/equipment/abc/events');

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).error.message).toBe('Invalid equipment id');
  });
});

describe('DELETE /api/equipment/:id', () => {
  it('is not supported', async () => {
    const { app } = createTestApp();

    const response = await request(app).delete(`/api/equipment/${freezer.id}`);

    expect(response.status).toBe(404);
  });
});
