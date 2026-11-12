/** Kind of machine. */
export type EquipmentType =
  'FREEZER' | 'REFRIGERATOR' | 'DISPLAY_CASE' | 'ICE_CREAM_MACHINE' | 'OTHER';

/** Operating state. `RETIRED` replaces deletion: retired equipment is kept but hidden by default. */
export type EquipmentStatus = 'OPERATIONAL' | 'IN_REPAIR' | 'OUT_OF_SERVICE' | 'RETIRED';

/**
 * A calendar date without time or zone, `YYYY-MM-DD`. Kept as text so no time zone can shift it;
 * values in this format compare correctly as strings.
 */
export type CalendarDate = string;

/** A piece of equipment, identified by its unique internal code. Absent optional details are `null`. */
export interface Equipment {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: EquipmentType;
  readonly brand: string;
  readonly model: string;
  readonly serialNumber: string | null;
  readonly purchaseDate: CalendarDate;
  readonly warrantyUntil: CalendarDate | null;
  readonly status: EquipmentStatus;
  /** The location that currently holds it. */
  readonly locationId: string;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data needed to register equipment. Omitted optional details are stored as `null`. */
export interface NewEquipment {
  readonly code: string;
  readonly name: string;
  readonly type: EquipmentType;
  readonly brand: string;
  readonly model: string;
  readonly serialNumber?: string | null | undefined;
  readonly purchaseDate: CalendarDate;
  readonly warrantyUntil?: CalendarDate | null | undefined;
  readonly status: EquipmentStatus;
  readonly locationId: string;
  readonly notes?: string | null | undefined;
}

/**
 * Changes to apply to equipment: omitted (or `undefined`) fields are left untouched, `null` clears
 * an optional detail.
 */
export type EquipmentChanges = { readonly [K in keyof NewEquipment]?: NewEquipment[K] | undefined };

/**
 * Changes an update may make: every detail but `status` and `locationId`, which change only
 * through equipment events.
 */
export type EquipmentDetailChanges = Omit<EquipmentChanges, 'status' | 'locationId'>;

/**
 * Which equipment to list; the filters combine with AND. Without `status`, retired equipment is
 * left out; ask for `status: 'RETIRED'` to list it.
 */
export interface EquipmentFilter {
  readonly status?: EquipmentStatus | undefined;
  readonly locationId?: string | undefined;
  readonly type?: EquipmentType | undefined;
}
