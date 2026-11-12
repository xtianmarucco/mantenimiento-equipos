import type { CalendarDate, Equipment, EquipmentStatus } from './equipment.js';

/** What happened to an equipment item. Events are append-only and drive its status and location. */
export type EquipmentEventType =
  'MAINTENANCE' | 'BREAKDOWN' | 'REPAIR' | 'TRANSFER' | 'REPLACEMENT' | 'RETIREMENT';

/**
 * Something that happened to an equipment item, as stored: one flat record, with `null` in the
 * fields that do not apply to its type. Never edited or deleted; a correction is a new event.
 */
export interface EquipmentEvent {
  readonly id: string;
  readonly equipmentId: string;
  readonly type: EquipmentEventType;
  readonly occurredOn: CalendarDate;
  readonly description: string;
  readonly technician: string | null;
  /** ARS with at most two decimals. */
  readonly cost: number | null;
  /** The status a breakdown left the equipment in. */
  readonly resultingStatus: EquipmentStatus | null;
  /** Where a transferred equipment item was before the transfer. */
  readonly fromLocationId: string | null;
  readonly toLocationId: string | null;
  /** The equipment that replaced this one, when known. */
  readonly replacementEquipmentId: string | null;
  readonly createdAt: Date;
}

/**
 * Data needed to record an event. Omitted type-specific fields are stored as `null`; which fields
 * a type needs is the use case's concern, not the repository's.
 */
export interface NewEquipmentEvent {
  readonly equipmentId: string;
  readonly type: EquipmentEventType;
  readonly occurredOn: CalendarDate;
  readonly description: string;
  readonly technician?: string | null | undefined;
  readonly cost?: number | null | undefined;
  readonly resultingStatus?: EquipmentStatus | null | undefined;
  readonly fromLocationId?: string | null | undefined;
  readonly toLocationId?: string | null | undefined;
  readonly replacementEquipmentId?: string | null | undefined;
}

/** The effect of an event on its equipment; omitted (or `undefined`) fields are left untouched. */
export interface EquipmentEventEffect {
  readonly status?: EquipmentStatus | undefined;
  readonly locationId?: string | undefined;
}

/** An event just recorded, with its equipment as it is after the event's effect. */
export interface RecordedEquipmentEvent {
  readonly event: EquipmentEvent;
  readonly equipment: Equipment;
}
