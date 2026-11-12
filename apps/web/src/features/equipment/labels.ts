import type {
  EquipmentEventType,
  EquipmentStatus,
  EquipmentType,
  LocationKind,
} from '@mantenimiento/shared';

/** Spanish labels for equipment enum values: the single source for UI copy. */
export const STATUS_LABELS: Record<EquipmentStatus, string> = {
  OPERATIONAL: 'Operativo',
  IN_REPAIR: 'En reparación',
  OUT_OF_SERVICE: 'Fuera de servicio',
  RETIRED: 'Dado de baja',
};

export const TYPE_LABELS: Record<EquipmentType, string> = {
  FREEZER: 'Freezer',
  REFRIGERATOR: 'Heladera',
  DISPLAY_CASE: 'Vitrina',
  ICE_CREAM_MACHINE: 'Máquina de helado',
  OTHER: 'Otro',
};

/** Status filter options. The API lists active equipment without a status filter. */
export const STATUS_FILTER_LABELS: Record<EquipmentStatus, string> = {
  ...STATUS_LABELS,
  RETIRED: 'Dados de baja',
};

/** Location kinds, singular (detail) and as option group labels (location select). */
export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  OWN_STORE: 'Local propio',
  THIRD_PARTY: 'Kiosco',
};

export const LOCATION_KIND_GROUP_LABELS: Record<LocationKind, string> = {
  OWN_STORE: 'Locales propios',
  THIRD_PARTY: 'Kioscos',
};

/** What happened to an equipment item, as shown in its history. */
export const EVENT_TYPE_LABELS: Record<EquipmentEventType, string> = {
  MAINTENANCE: 'Mantenimiento',
  BREAKDOWN: 'Rotura',
  REPAIR: 'Reparación',
  TRANSFER: 'Traslado',
  REPLACEMENT: 'Cambio',
  RETIREMENT: 'Baja',
};
