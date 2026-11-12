import { InMemoryLocationRepository } from '../../locations/infrastructure/in-memory-location-repository.js';
import { describeEquipmentEventRepositoryContract } from './equipment-event-repository.contract.js';
import { describeEquipmentRepositoryContract } from './equipment-repository.contract.js';
import { InMemoryEquipmentRepository } from './in-memory-equipment-repository.js';

function emptyFixture() {
  const locations = new InMemoryLocationRepository();
  return { equipment: new InMemoryEquipmentRepository({ locations }), locations };
}

describeEquipmentRepositoryContract('InMemoryEquipmentRepository', emptyFixture);
describeEquipmentEventRepositoryContract('InMemoryEquipmentRepository', emptyFixture);
