export function normalizePage(page: unknown, pageCount: unknown): number;
export function paginate<T>(items: T[], page: unknown, pageSize: unknown): { currentPage: number; pageCount: number; pageSize: number; rows: T[] };
