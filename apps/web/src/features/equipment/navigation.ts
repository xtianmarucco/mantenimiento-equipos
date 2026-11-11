import { z } from 'zod';

/**
 * Router state carried from the list to the detail and form pages, so "back" returns to the list
 * with the filters the user had set.
 */
export interface EquipmentNavigationState {
  /** Query string of the list page, without `?`. */
  listSearch: string;
}

const navigationStateSchema = z.object({ listSearch: z.string() });

/** Reads the navigation state from `location.state`; anything else is ignored. */
export function readNavigationState(state: unknown): EquipmentNavigationState | undefined {
  const parsed = navigationStateSchema.safeParse(state);
  return parsed.success ? parsed.data : undefined;
}

/** The list path to go back to, with the filters from the navigation state. */
export function listPath(state: EquipmentNavigationState | undefined): string {
  return state?.listSearch ? `/equipos?${state.listSearch}` : '/equipos';
}
