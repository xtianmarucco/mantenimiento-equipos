import {
  Prisma,
  type Location as LocationRow,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { omitUndefined } from '../../../shared/infrastructure/omit-undefined.js';
import type { Location, LocationChanges, NewLocation } from '../domain/location.js';
import type { LocationRepository } from '../domain/location-repository.js';

/** Prisma error code for "the record to update was not found". */
const RECORD_NOT_FOUND = 'P2025';

function toDomain(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    address: row.address,
    contactName: row.contactName,
    phone: row.phone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Adapter: locations stored in PostgreSQL through Prisma. */
export class PrismaLocationRepository implements LocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Location[]> {
    const rows = await this.prisma.location.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Location | undefined> {
    const row = await this.prisma.location.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  }

  async create(data: NewLocation): Promise<Location> {
    const row = await this.prisma.location.create({
      data: {
        name: data.name,
        kind: data.kind,
        address: data.address ?? null,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
      },
    });
    return toDomain(row);
  }

  async update(id: string, changes: LocationChanges): Promise<Location | undefined> {
    try {
      const row = await this.prisma.location.update({
        where: { id },
        data: omitUndefined(changes),
      });
      return toDomain(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        return undefined;
      }
      throw error;
    }
  }
}
