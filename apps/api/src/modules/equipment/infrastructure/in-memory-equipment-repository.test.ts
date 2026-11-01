import { InMemoryLocationRepository } from '../../locations/infrastructure/in-memory-location-repository.js';
import { describeEquipmentRepositoryContract } from './equipment-repository.contract.js';
import { InMemoryEquipmentRepository } from './in-memory-equipment-repository.js';

describeEquipmentRepositoryContract('InMemoryEquipmentRepository', () => {
  const locations = new InMemoryLocationRepository();
  return { equipment: new InMemoryEquipmentRepository({ locations }), locations };
});
