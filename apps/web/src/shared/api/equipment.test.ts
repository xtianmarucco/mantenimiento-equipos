import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, makeEquipment } from '../../test/fixtures';
import { ApiError } from './client';
import { buildEquipmentListPath, listEquipment } from './equipment';

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
