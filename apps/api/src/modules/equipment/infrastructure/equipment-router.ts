import {
  createEquipmentSchema,
  equipmentListQuerySchema,
  equipmentResponseSchema,
  idSchema,
  updateEquipmentSchema,
  type EquipmentResponse,
} from '@mantenimiento/shared';
import { Router } from 'express';

import { parseRequest } from '../../../shared/infrastructure/request-validation.js';
import type { CreateEquipmentUseCase } from '../application/create-equipment.js';
import type { GetEquipmentUseCase } from '../application/get-equipment.js';
import type { ListEquipmentUseCase } from '../application/list-equipment.js';
import type { RetireEquipmentUseCase } from '../application/retire-equipment.js';
import type { UpdateEquipmentUseCase } from '../application/update-equipment.js';
import type { Equipment } from '../domain/equipment.js';

export interface EquipmentUseCases {
  listEquipment: ListEquipmentUseCase;
  getEquipment: GetEquipmentUseCase;
  createEquipment: CreateEquipmentUseCase;
  updateEquipment: UpdateEquipmentUseCase;
  retireEquipment: RetireEquipmentUseCase;
}

const INVALID_ID = 'Invalid equipment id';
const INVALID_BODY = 'Invalid request body';
const INVALID_QUERY = 'Invalid query string';

/** Maps the domain entity to the shared response contract, validating it so the API cannot drift. */
function toResponse(item: Equipment): EquipmentResponse {
  return equipmentResponseSchema.parse({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  });
}

/**
 * HTTP adapter for the equipment module, mounted under `/api/equipment`. There is no DELETE:
 * `POST /:id/retire` (status `RETIRED`) replaces it, and the list leaves retired equipment out
 * unless `status=RETIRED` is asked for.
 */
export function createEquipmentRouter(useCases: EquipmentUseCases): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const filter = parseRequest(equipmentListQuerySchema, req.query, INVALID_QUERY);
    const items = await useCases.listEquipment.execute(filter);
    res.status(200).json(items.map(toResponse));
  });

  router.get('/:id', async (req, res) => {
    const id = parseRequest(idSchema, req.params.id, INVALID_ID);
    const item = await useCases.getEquipment.execute(id);
    res.status(200).json(toResponse(item));
  });

  router.post('/', async (req, res) => {
    const data = parseRequest(createEquipmentSchema, req.body, INVALID_BODY);
    const item = await useCases.createEquipment.execute(data);
    res.status(201).json(toResponse(item));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseRequest(idSchema, req.params.id, INVALID_ID);
    const changes = parseRequest(updateEquipmentSchema, req.body, INVALID_BODY);
    const item = await useCases.updateEquipment.execute(id, changes);
    res.status(200).json(toResponse(item));
  });

  router.post('/:id/retire', async (req, res) => {
    const id = parseRequest(idSchema, req.params.id, INVALID_ID);
    const item = await useCases.retireEquipment.execute(id);
    res.status(200).json(toResponse(item));
  });

  return router;
}
