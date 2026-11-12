import type { EquipmentResponse, LocationResponse } from '@mantenimiento/shared';
import { vi } from 'vitest';

export const LOCATION_CENTRO: LocationResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. Siempre Viva 742',
  contactName: null,
  phone: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

export const LOCATION_KIOSCO: LocationResponse = {
  ...LOCATION_CENTRO,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Kiosco Plaza',
  kind: 'THIRD_PARTY',
};

export function makeEquipment(overrides: Partial<EquipmentResponse> = {}): EquipmentResponse {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'EQ-0001',
    name: 'Freezer horizontal',
    type: 'FREEZER',
    brand: 'Inelro',
    model: 'FIH-350',
    serialNumber: null,
    purchaseDate: '2025-01-15',
    warrantyUntil: null,
    status: 'OPERATIONAL',
    locationId: LOCATION_CENTRO.id,
    notes: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

type RouteHandler = (init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * Stubs `fetch` and answers by path (query string excluded): each handler builds a fresh
 * `Response` and gets the request `init` (method, body). Unknown paths answer 404. Returns the
 * mock to inspect calls.
 */
export function stubApi(handlers: Record<string, RouteHandler>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const handler = handlers[url.pathname];
    return Promise.resolve(
      handler ? handler(init) : jsonResponse({ error: { message: 'Not found' } }, { status: 404 }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Paths (with query string) requested through a `stubApi` mock, in call order. */
export function requestedPaths(fetchMock: ReturnType<typeof stubApi>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

/** JSON bodies sent with `method` through a `stubApi` mock, in call order. */
export function sentBodies(fetchMock: ReturnType<typeof stubApi>, method: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([, init]) => JSON.parse(String(init?.body)) as unknown);
}
