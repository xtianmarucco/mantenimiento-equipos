import { InMemoryLocationRepository } from './in-memory-location-repository.js';
import { describeLocationRepositoryContract } from './location-repository.contract.js';

describeLocationRepositoryContract(
  'InMemoryLocationRepository',
  () => new InMemoryLocationRepository(),
);
