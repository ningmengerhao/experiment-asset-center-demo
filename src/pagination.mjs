export function normalizePage(page, pageCount) {
  const safePageCount = Math.max(1, Math.trunc(Number(pageCount)) || 1);
  return Math.max(1, Math.min(safePageCount, Math.trunc(Number(page)) || 1));
}

export function paginate(items, page, pageSize) {
  const rows = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.trunc(Number(pageSize)) || 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = normalizePage(page, pageCount);
  const start = (currentPage - 1) * size;
  return { currentPage, pageCount, pageSize: size, rows: rows.slice(start, start + size) };
}
