import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, LOCATION_CENTRO, LOCATION_KIOSCO } from '../../test/fixtures';
import { ApiError } from './client';
import { listLocations } from './locations';

describe('listLocations', () => {
  it('GETs /api/locations with the given signal and returns the parsed list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(listLocations({ signal: controller.signal })).resolves.toEqual([
      LOCATION_CENTRO,
      LOCATION_KIOSCO,
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/locations',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('rejects with an ApiError when the payload is not a list of locations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })));

    await expect(listLocations()).rejects.toBeInstanceOf(ApiError);
  });
});
