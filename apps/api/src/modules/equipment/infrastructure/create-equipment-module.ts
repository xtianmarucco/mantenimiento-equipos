import type { Router } from 'express';

import type { LocationRepository } from '../../locations/domain/location-repository.js';
import { CreateEquipmentUseCase } from '../application/create-equipment.js';
import { GetEquipmentUseCase } from '../application/get-equipment.js';
import { ListEquipmentUseCase } from '../application/list-equipment.js';
import { RetireEquipmentUseCase } from '../application/retire-equipment.js';
import { UpdateEquipmentUseCase } from '../application/update-equipment.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';
import { createEquipmentRouter } from './equipment-router.js';

/**
 * Composes the equipment use cases over their repositories and returns their HTTP router. The
 * location repository answers whether a `locationId` exists.
 */
export function createEquipmentModule(
  equipment: EquipmentRepository,
  locations: LocationRepository,
): Router {
  return createEquipmentRouter({
    listEquipment: new ListEquipmentUseCase(equipment),
    getEquipment: new GetEquipmentUseCase(equipment),
    createEquipment: new CreateEquipmentUseCase(equipment, locations),
    updateEquipment: new UpdateEquipmentUseCase(equipment, locations),
    retireEquipment: new RetireEquipmentUseCase(equipment),
  });
}
