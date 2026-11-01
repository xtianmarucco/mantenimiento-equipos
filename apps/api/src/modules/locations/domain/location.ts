/** Where equipment lives: one of the owner's stores, or a third-party kiosk that has it on loan. */
export type LocationKind = 'OWN_STORE' | 'THIRD_PARTY';

/** A place that holds equipment. Absent optional details are `null`. */
export interface Location {
  readonly id: string;
  readonly name: string;
  readonly kind: LocationKind;
  readonly address: string | null;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data needed to register a location. Omitted optional details are stored as `null`. */
export interface NewLocation {
  readonly name: string;
  readonly kind: LocationKind;
  readonly address?: string | null | undefined;
  readonly contactName?: string | null | undefined;
  readonly phone?: string | null | undefined;
}

/**
 * Changes to apply to a location: omitted (or `undefined`) fields are left untouched, `null`
 * clears an optional detail.
 */
export type LocationChanges = { readonly [K in keyof NewLocation]?: NewLocation[K] | undefined };
