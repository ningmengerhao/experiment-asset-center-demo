import assert from "node:assert/strict";
import { normalizePage, paginate } from "../src/pagination.mjs";

assert.equal(normalizePage(-2, 4), 1);
assert.equal(normalizePage(2, 4), 2);
assert.equal(normalizePage(12, 4), 4);
assert.equal(normalizePage("invalid", 0), 1);

const rows = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
assert.deepEqual(paginate(rows, 1, 10), { currentPage: 1, pageCount: 2, pageSize: 10, rows: rows.slice(0, 10) });
assert.deepEqual(paginate(rows, 2, 10), { currentPage: 2, pageCount: 2, pageSize: 10, rows: ["k"] });
assert.equal(paginate(rows, 99, 10).currentPage, 2);
assert.deepEqual(paginate([], 4, 10), { currentPage: 1, pageCount: 1, pageSize: 10, rows: [] });

console.log("Pagination verification passed.");
