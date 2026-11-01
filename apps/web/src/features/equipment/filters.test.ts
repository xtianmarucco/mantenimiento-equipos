import { describe, expect, it } from 'vitest';

import { filtersFromSearchParams, filtersToSearchParams } from './filters';

const LOCATION_ID = '11111111-1111-4111-8111-111111111111';

describe('filtersFromSearchParams', () => {
  it('reads every valid filter', () => {
    expect(
      filtersFromSearchParams(
        new URLSearchParams(`status=RETIRED&locationId=${LOCATION_ID}&type=FREEZER`),
      ),
    ).toEqual({ status: 'RETIRED', locationId: LOCATION_ID, type: 'FREEZER' });
  });

  it('ignores missing, empty, invalid and unknown parameters', () => {
    expect(
      filtersFromSearchParams(new URLSearchParams('status=BROKEN&locationId=&type=freezer&q=x')),
    ).toEqual({});
  });
});

describe('filtersToSearchParams', () => {
  it('writes only the filters that are set, in a stable order', () => {
    expect(
      filtersToSearchParams({
        type: 'OTHER',
        status: 'IN_REPAIR',
        locationId: undefined,
      }).toString(),
    ).toBe('status=IN_REPAIR&type=OTHER');
  });

  it('writes nothing when no filter is set', () => {
    expect(filtersToSearchParams({}).toString()).toBe('');
  });
});
