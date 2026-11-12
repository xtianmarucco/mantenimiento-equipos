import {
  Prisma,
  type Equipment as EquipmentRow,
  type EquipmentEvent as EquipmentEventRow,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { omitUndefined } from '../../../shared/infrastructure/omit-undefined.js';
import type {
  CalendarDate,
  Equipment,
  EquipmentChanges,
  EquipmentFilter,
  NewEquipment,
} from '../domain/equipment.js';
import type {
  EquipmentEvent,
  EquipmentEventEffect,
  NewEquipmentEvent,
  RecordedEquipmentEvent,
} from '../domain/equipment-event.js';
import {
  DuplicateEquipmentCodeError,
  EquipmentEventLocationNotFoundError,
  EquipmentLocationNotFoundError,
  ReplacementEquipmentNotFoundError,
  WarrantyBeforePurchaseError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/** Prisma error codes this adapter translates. */
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

/**
 * The CHECK constraint `warranty_until IS NULL OR warranty_until >= purchase_date` (migration
 * `20261101210000_equipment_warranty_check`). Through `@prisma/adapter-pg` its violation arrives as
 * a `PrismaClientKnownRequestError` whose `meta.driverAdapterError.cause` carries the Postgres
 * SQLSTATE (`23514`) and the message naming the constraint; there is no separate name field.
 */
const CHECK_VIOLATION_SQLSTATE = '23514';
const WARRANTY_CHECK_CONSTRAINT = 'equipment_warranty_after_purchase_check';

/**
 * Foreign keys of `equipment_events` (Prisma's default names, migration
 * `20261112010054_equipment_events`). `equipment_events` has several, so a violation is told
 * apart by the constraint name the driver adapter reports.
 */
const EVENT_EQUIPMENT_FK = 'equipment_events_equipment_id_fkey';
const EVENT_FROM_LOCATION_FK = 'equipment_events_from_location_id_fkey';
const EVENT_TO_LOCATION_FK = 'equipment_events_to_location_id_fkey';
const EVENT_REPLACEMENT_FK = 'equipment_events_replacement_equipment_id_fkey';

/**
 * `DATE` columns travel as a `Date` at UTC midnight. Building and reading them in UTC keeps the
 * calendar day whatever the server's time zone.
 */
function toDbDate(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function fromDbDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

function toDomain(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serialNumber,
    purchaseDate: fromDbDate(row.purchaseDate),
    warrantyUntil: row.warrantyUntil ? fromDbDate(row.warrantyUntil) : null,
    status: row.status,
    locationId: row.locationId,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function eventToDomain(row: EquipmentEventRow): EquipmentEvent {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    type: row.type,
    occurredOn: fromDbDate(row.occurredOn),
    description: row.description,
    technician: row.technician,
    // DECIMAL(10, 2) fits a double exactly enough: every value has at most 10 significant digits.
    cost: row.cost === null ? null : row.cost.toNumber(),
    resultingStatus: row.resultingStatus,
    fromLocationId: row.fromLocationId,
    toLocationId: row.toLocationId,
    replacementEquipmentId: row.replacementEquipmentId,
    createdAt: row.createdAt,
  };
}

function toDbChanges(changes: EquipmentChanges): Prisma.EquipmentUncheckedUpdateInput {
  const { purchaseDate, warrantyUntil, ...rest } = omitUndefined(changes);
  return {
    ...rest,
    ...(purchaseDate !== undefined && { purchaseDate: toDbDate(purchaseDate) }),
    ...(warrantyUntil !== undefined && {
      warrantyUntil: warrantyUntil === null ? null : toDbDate(warrantyUntil),
    }),
  };
}

function knownErrorCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

/**
 * The constraint a foreign key violation names. Through `@prisma/adapter-pg` it arrives in
 * `meta.driverAdapterError.cause.constraint.index`.
 */
function violatedForeignKey(error: unknown): string | undefined {
  if (knownErrorCode(error) !== FOREIGN_KEY_VIOLATION) {
    return undefined;
  }
  const meta = (error as Prisma.PrismaClientKnownRequestError).meta;
  const adapterError = meta?.['driverAdapterError'] as
    { cause?: { constraint?: { index?: unknown } } } | undefined;
  const name = adapterError?.cause?.constraint?.index;
  return typeof name === 'string' ? name : undefined;
}

/** True when the error is a violation of the named warranty CHECK constraint, and only that one. */
function isWarrantyCheckViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  const adapterError: unknown = error.meta?.['driverAdapterError'];
  if (typeof adapterError !== 'object' || adapterError === null || !('cause' in adapterError)) {
    return false;
  }
  const cause: unknown = adapterError.cause;
  if (typeof cause !== 'object' || cause === null) {
    return false;
  }
  const { code, originalMessage } = cause as { code?: unknown; originalMessage?: unknown };
  return (
    code === CHECK_VIOLATION_SQLSTATE &&
    typeof originalMessage === 'string' &&
    originalMessage.includes(`"${WARRANTY_CHECK_CONSTRAINT}"`)
  );
}

/**
 * Translates the constraint violations a write can hit into domain errors. `equipment` has one
 * unique column besides its generated id (`code`) and one foreign key (`location_id`), so the
 * error code alone identifies those; the warranty CHECK is matched by its name. Anything else is
 * rethrown as is.
 */
function toDomainError(error: unknown, data: EquipmentChanges): unknown {
  if (isWarrantyCheckViolation(error)) {
    return new WarrantyBeforePurchaseError();
  }
  const code = knownErrorCode(error);
  if (code === UNIQUE_VIOLATION && data.code !== undefined) {
    return new DuplicateEquipmentCodeError(data.code);
  }
  if (code === FOREIGN_KEY_VIOLATION && data.locationId !== undefined) {
    return new EquipmentLocationNotFoundError(data.locationId);
  }
  return error;
}

/** Adapter: equipment stored in PostgreSQL through Prisma. */
export class PrismaEquipmentRepository implements EquipmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(filter: EquipmentFilter = {}): Promise<Equipment[]> {
    const rows = await this.prisma.equipment.findMany({
      where: {
        status: filter.status ?? { not: 'RETIRED' },
        ...omitUndefined({ locationId: filter.locationId, type: filter.type }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Equipment | undefined> {
    const row = await this.prisma.equipment.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  }

  async create(data: NewEquipment): Promise<Equipment> {
    try {
      const row = await this.prisma.equipment.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type,
          brand: data.brand,
          model: data.model,
          serialNumber: data.serialNumber ?? null,
          purchaseDate: toDbDate(data.purchaseDate),
          warrantyUntil:
            data.warrantyUntil === undefined || data.warrantyUntil === null
              ? null
              : toDbDate(data.warrantyUntil),
          status: data.status,
          locationId: data.locationId,
          notes: data.notes ?? null,
        },
      });
      return toDomain(row);
    } catch (error) {
      throw toDomainError(error, data);
    }
  }

  async update(id: string, changes: EquipmentChanges): Promise<Equipment | undefined> {
    try {
      const row = await this.prisma.equipment.update({
        where: { id },
        data: toDbChanges(changes),
      });
      return toDomain(row);
    } catch (error) {
      if (knownErrorCode(error) === RECORD_NOT_FOUND) {
        return undefined;
      }
      throw toDomainError(error, changes);
    }
  }

  /**
   * One transaction: the event is inserted first (its foreign keys prove the equipment and every
   * referenced record exist), then the effect is applied. Any failure rolls back both.
   */
  async recordEvent(
    data: NewEquipmentEvent,
    effect: EquipmentEventEffect,
  ): Promise<RecordedEquipmentEvent | undefined> {
    const changes = omitUndefined({ status: effect.status, locationId: effect.locationId });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const eventRow = await tx.equipmentEvent.create({
          data: {
            equipmentId: data.equipmentId,
            type: data.type,
            occurredOn: toDbDate(data.occurredOn),
            description: data.description,
            technician: data.technician ?? null,
            cost: data.cost ?? null,
            resultingStatus: data.resultingStatus ?? null,
            fromLocationId: data.fromLocationId ?? null,
            toLocationId: data.toLocationId ?? null,
            replacementEquipmentId: data.replacementEquipmentId ?? null,
          },
        });
        const equipmentRow =
          Object.keys(changes).length === 0
            ? await tx.equipment.findUniqueOrThrow({ where: { id: data.equipmentId } })
            : await tx.equipment.update({ where: { id: data.equipmentId }, data: changes });
        return { event: eventToDomain(eventRow), equipment: toDomain(equipmentRow) };
      });
    } catch (error) {
      switch (violatedForeignKey(error)) {
        case EVENT_EQUIPMENT_FK:
          return undefined;
        case EVENT_FROM_LOCATION_FK:
          throw new EquipmentEventLocationNotFoundError(
            'fromLocationId',
            data.fromLocationId ?? '',
          );
        case EVENT_TO_LOCATION_FK:
          throw new EquipmentEventLocationNotFoundError('toLocationId', data.toLocationId ?? '');
        case EVENT_REPLACEMENT_FK:
          throw new ReplacementEquipmentNotFoundError(data.replacementEquipmentId ?? '');
        default:
          throw toDomainError(error, changes);
      }
    }
  }

  async listEvents(equipmentId: string): Promise<EquipmentEvent[]> {
    const rows = await this.prisma.equipmentEvent.findMany({
      where: { equipmentId },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(eventToDomain);
  }
}
