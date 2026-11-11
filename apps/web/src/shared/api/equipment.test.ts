import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, makeEquipment } from '../../test/fixtures';
import { ApiError } from './client';
import {
  buildEquipmentListPath,
  createEquipment,
  getEquipment,
  listEquipment,
  retireEquipment,
  updateEquipment,
} from './equipment';

describe('buildEquipmentListPath', () => {
  it('has no query string when no filter is set', () => {
    expect(buildEquipmentListPath({})).toBe('/api/equipment');
  });

  it('includes only the filters that are set', () => {
    expect(buildEquipmentListPath({ status: 'RETIRED', locationId: undefined })).toBe(
      '/api/equipment?status=RETIRED',
    );
  });

  it('combines every set filter', () => {
    expect(
      buildEquipmentListPath({
        status: 'IN_REPAIR',
        locationId: '11111111-1111-4111-8111-111111111111',
        type: 'FREEZER',
      }),
    ).toBe(
      '/api/equipment?status=IN_REPAIR&locationId=11111111-1111-4111-8111-111111111111&type=FREEZER',
    );
  });
});

describe('listEquipment', () => {
  it('GETs the filtered list with the given signal and returns the parsed items', async () => {
    const item = makeEquipment();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([item]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(
      listEquipment({ status: 'RETIRED' }, { signal: controller.signal }),
    ).resolves.toEqual([item]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/equipment?status=RETIRED',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('rejects with an ApiError when an item does not match the schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse([{ ...makeEquipment(), status: 'BROKEN' }])),
    );

    await expect(listEquipment({})).rejects.toBeInstanceOf(ApiError);
  });

  it('exposes the status and the message of an API error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: 'Invalid query', issues: [{ path: 'status', message: 'x' }] } },
            { status: 400 },
          ),
        ),
    );

    const error: unknown = await listEquipment({}).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).apiMessage).toBe('Invalid query');
    expect((error as ApiError).issues).toEqual([{ path: 'status', message: 'x' }]);
  });

  it('has no API message when the error body is not the error contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    );

    const error: unknown = await listEquipment({}).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).apiMessage).toBeUndefined();
  });
});

const ID = makeEquipment().id;

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>): unknown {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
}

describe('getEquipment', () => {
  it('GETs one item by id and returns it parsed', async () => {
    const item = makeEquipment();
    const fetchMock = stubFetch(jsonResponse(item));
    const controller = new AbortController();

    await expect(getEquipment(ID, { signal: controller.signal })).resolves.toEqual(item);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/equipment/${ID}`,
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('escapes the id in the path', async () => {
    const fetchMock = stubFetch(jsonResponse(makeEquipment()));

    await getEquipment('a/b?c');
    expect(fetchMock).toHaveBeenCalledWith('/api/equipment/a%2Fb%3Fc', expect.anything());
  });

  it('rejects with an ApiError carrying 404 when the item does not exist', async () => {
    stubFetch(jsonResponse({ error: { message: 'Equipment not found' } }, { status: 404 }));

    const error: unknown = await getEquipment(ID).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });
});

describe('createEquipment', () => {
  const input = {
    code: 'EQ-0100',
    name: 'Vitrina nueva',
    type: 'DISPLAY_CASE' as const,
    brand: 'Gafa',
    model: 'V-200',
    purchaseDate: '2026-10-01',
    locationId: makeEquipment().locationId,
  };

  it('POSTs the input as JSON and returns the created item', async () => {
    const created = makeEquipment({ ...input, id: ID });
    const fetchMock = stubFetch(jsonResponse(created, { status: 201 }));

    await expect(createEquipment(input)).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/equipment',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }) as unknown,
      }),
    );
    expect(sentBody(fetchMock)).toEqual(input);
  });

  it('exposes a 409 conflict', async () => {
    stubFetch(jsonResponse({ error: { message: 'Code in use' } }, { status: 409 }));

    const error: unknown = await createEquipment(input).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).apiMessage).toBe('Code in use');
  });

  it('wraps a network failure in an ApiError without status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error: unknown = await createEquipment(input).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBeUndefined();
  });
});

describe('updateEquipment', () => {
  it('PATCHes only the given changes, keeping null to clear a field', async () => {
    const updated = makeEquipment({ name: 'Otro nombre', notes: null });
    const fetchMock = stubFetch(jsonResponse(updated));

    await expect(updateEquipment(ID, { name: 'Otro nombre', notes: null })).resolves.toEqual(
      updated,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/equipment/${ID}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(sentBody(fetchMock)).toEqual({ name: 'Otro nombre', notes: null });
  });
});

describe('retireEquipment', () => {
  it('POSTs to the retire action without a body and returns the retired item', async () => {
    const retired = makeEquipment({ status: 'RETIRED' });
    const fetchMock = stubFetch(jsonResponse(retired));

    await expect(retireEquipment(ID)).resolves.toEqual(retired);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/equipment/${ID}/retire`,
      expect.objectContaining({ method: 'POST' }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
  });

  it('rejects with an ApiError when the response is not an equipment item', async () => {
    stubFetch(jsonResponse({ ok: true }));

    await expect(retireEquipment(ID)).rejects.toBeInstanceOf(ApiError);
  });
});
