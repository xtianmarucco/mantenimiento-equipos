import type { LocationRepository } from '../../locations/domain/location-repository.js';
import type { CalendarDate, Equipment, EquipmentStatus } from '../domain/equipment.js';
import type {
  EquipmentEventEffect,
  NewEquipmentEvent,
  RecordedEquipmentEvent,
} from '../domain/equipment-event.js';
import {
  EquipmentEventLocationNotFoundError,
  EquipmentNotFoundError,
  InvalidEquipmentEventError,
  ReplacementEquipmentNotFoundError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';
import { localToday } from './today.js';

interface CommonInput {
  readonly occurredOn: CalendarDate;
  readonly description: string;
}

interface WorkInput extends CommonInput {
  readonly technician?: string | null | undefined;
  readonly cost?: number | null | undefined;
}

/** An event to record, by type; only the fields of its own type are read. */
export type RecordEquipmentEventInput =
  | (WorkInput & { readonly type: 'MAINTENANCE' | 'REPAIR' })
  | (CommonInput & {
      readonly type: 'BREAKDOWN';
      readonly resultingStatus: 'IN_REPAIR' | 'OUT_OF_SERVICE';
    })
  | (CommonInput & { readonly type: 'TRANSFER'; readonly toLocationId: string })
  | (CommonInput & {
      readonly type: 'REPLACEMENT';
      readonly replacementEquipmentId?: string | null | undefined;
    })
  | (CommonInput & { readonly type: 'RETIREMENT' });

/** What to store for the event and how it changes the equipment. */
interface Derived {
  readonly event: NewEquipmentEvent;
  readonly effect: EquipmentEventEffect;
}

const REPAIRABLE: readonly EquipmentStatus[] = ['IN_REPAIR', 'OUT_OF_SERVICE'];

/**
 * Use case: record something that happened to a piece of equipment and apply its effect (status or
 * location) atomically. Rules, checked against the stored equipment: retired equipment accepts no
 * events; `occurredOn` is neither after today nor before the purchase date; `REPAIR` only from
 * `IN_REPAIR` or `OUT_OF_SERVICE`; a transfer goes to another, existing location; replacement
 * equipment exists, is another item and is not retired. Throws `EquipmentNotFoundError` or a
 * `DomainValidationError` (`InvalidEquipmentEventError`, `EquipmentEventLocationNotFoundError`,
 * `ReplacementEquipmentNotFoundError`).
 *
 * Known race (accepted while there is a single owner and no auth): the rules read the equipment
 * before the write, without a lock, so two concurrent events can both pass against the same
 * stored status (for example two retirements, or a repair racing a retirement). The repository
 * still keeps each write atomic and every reference valid.
 */
export class RecordEquipmentEventUseCase {
  constructor(
    private readonly equipment: EquipmentRepository,
    private readonly locations: LocationRepository,
    /** Today's date, `YYYY-MM-DD`; injectable so tests are deterministic. */
    private readonly today: () => CalendarDate = () => localToday(),
  ) {}

  async execute(
    equipmentId: string,
    input: RecordEquipmentEventInput,
  ): Promise<RecordedEquipmentEvent> {
    const current = await this.equipment.findById(equipmentId);
    if (!current) {
      throw new EquipmentNotFoundError(equipmentId);
    }
    if (current.status === 'RETIRED') {
      throw new InvalidEquipmentEventError('type', 'Retired equipment accepts no events');
    }
    this.ensureDateInRange(current, input.occurredOn);

    const { event, effect } = await this.derive(current, input);
    // `undefined` here means the record was removed after it was read.
    const recorded = await this.equipment.recordEvent(event, effect);
    if (!recorded) {
      throw new EquipmentNotFoundError(equipmentId);
    }
    return recorded;
  }

  private ensureDateInRange(current: Equipment, occurredOn: CalendarDate): void {
    // `YYYY-MM-DD` strings compare in date order.
    if (occurredOn > this.today()) {
      throw new InvalidEquipmentEventError('occurredOn', 'Date cannot be in the future');
    }
    if (occurredOn < current.purchaseDate) {
      throw new InvalidEquipmentEventError('occurredOn', 'Date cannot be before the purchase date');
    }
  }

  private async derive(current: Equipment, input: RecordEquipmentEventInput): Promise<Derived> {
    const base = {
      equipmentId: current.id,
      type: input.type,
      occurredOn: input.occurredOn,
      description: input.description,
    };
    switch (input.type) {
      case 'MAINTENANCE':
        return {
          event: { ...base, technician: input.technician, cost: input.cost },
          effect: {},
        };
      case 'REPAIR':
        if (!REPAIRABLE.includes(current.status)) {
          throw new InvalidEquipmentEventError(
            'type',
            'Only equipment in repair or out of service can be repaired',
          );
        }
        return {
          event: { ...base, technician: input.technician, cost: input.cost },
          effect: { status: 'OPERATIONAL' },
        };
      case 'BREAKDOWN':
        // Allowed from every non-retired status, retired equipment was rejected above.
        return {
          event: { ...base, resultingStatus: input.resultingStatus },
          effect: { status: input.resultingStatus },
        };
      case 'TRANSFER':
        await this.ensureTransferDestination(current, input.toLocationId);
        return {
          event: { ...base, fromLocationId: current.locationId, toLocationId: input.toLocationId },
          effect: { locationId: input.toLocationId },
        };
      case 'REPLACEMENT':
        if (input.replacementEquipmentId) {
          await this.ensureReplacement(current, input.replacementEquipmentId);
        }
        return {
          event: { ...base, replacementEquipmentId: input.replacementEquipmentId },
          effect: { status: 'RETIRED' },
        };
      case 'RETIREMENT':
        return { event: base, effect: { status: 'RETIRED' } };
    }
  }

  private async ensureTransferDestination(current: Equipment, toLocationId: string): Promise<void> {
    if (toLocationId === current.locationId) {
      throw new InvalidEquipmentEventError('toLocationId', 'Equipment is already at this location');
    }
    // The repository enforces the same reference (foreign key) for a location removed meanwhile.
    if (!(await this.locations.findById(toLocationId))) {
      throw new EquipmentEventLocationNotFoundError('toLocationId', toLocationId);
    }
  }

  private async ensureReplacement(current: Equipment, replacementId: string): Promise<void> {
    if (replacementId === current.id) {
      throw new InvalidEquipmentEventError(
        'replacementEquipmentId',
        'Equipment cannot replace itself',
      );
    }
    const replacement = await this.equipment.findById(replacementId);
    if (!replacement) {
      throw new ReplacementEquipmentNotFoundError(replacementId);
    }
    if (replacement.status === 'RETIRED') {
      throw new InvalidEquipmentEventError(
        'replacementEquipmentId',
        'Replacement equipment is retired',
      );
    }
  }
}
