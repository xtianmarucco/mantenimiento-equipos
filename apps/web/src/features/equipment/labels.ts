import type { EquipmentStatus, EquipmentType } from '@mantenimiento/shared';

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
