import {
  Prisma,
  type Equipment as EquipmentRow,
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
import {
  DuplicateEquipmentCodeError,
  EquipmentLocationNotFoundError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/** Prisma error codes this adapter translates. */
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

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
 * Translates the constraint violations a write can hit into domain errors. `equipment` has one
 * unique column besides its generated id (`code`) and one foreign key (`location_id`), so the
 * error code alone identifies the constraint; anything else is rethrown as is.
 */
function toDomainError(error: unknown, data: EquipmentChanges): unknown {
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
          warrantyUntil: data.warrantyUntil ? toDbDate(data.warrantyUntil) : null,
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
}
