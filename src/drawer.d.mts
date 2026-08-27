export type DrawerName = "detail" | "help" | "import" | "filters" | "create";

export interface DrawerPopResult {
  stack: DrawerName[];
  closed: DrawerName | null;
  active: DrawerName | null;
}

export function pushDrawer(stack: readonly DrawerName[], name: DrawerName): DrawerName[];
export function popDrawer(stack: readonly DrawerName[]): DrawerPopResult;
export function getFocusTrapTarget(count: number, activeIndex: number, shiftKey: boolean): number;
