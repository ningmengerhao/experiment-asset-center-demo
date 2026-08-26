import assert from "node:assert/strict";
import { getFocusTrapTarget, popDrawer, pushDrawer } from "../src/drawer.mjs";

const detailOnly = pushDrawer([], "detail");
const detailThenHelp = pushDrawer(detailOnly, "help");
assert.deepEqual(detailThenHelp, ["detail", "help"], "opening help must layer over detail");
assert.deepEqual(detailOnly, ["detail"], "pushDrawer must not mutate its input");

const afterEscape = popDrawer(detailThenHelp);
assert.equal(afterEscape.closed, "help", "Escape/backdrop pops only the topmost drawer");
assert.equal(afterEscape.active, "detail", "closing help must reveal detail again");
assert.deepEqual(afterEscape.stack, ["detail"]);
assert.deepEqual(detailThenHelp, ["detail", "help"], "popDrawer must not mutate its input");

const duplicateTop = pushDrawer(["detail", "help"], "detail");
assert.deepEqual(duplicateTop, ["help", "detail"], "reopening a drawer moves it to the top without duplication");
assert.equal(new Set(duplicateTop).size, duplicateTop.length);

const detailThenFilters = pushDrawer(detailOnly, "filters");
assert.deepEqual(detailThenFilters, ["detail", "filters"], "opening filters must layer over the active page or drawer");
assert.deepEqual(popDrawer(detailThenFilters), { stack: ["detail"], closed: "filters", active: "detail" }, "closing filters must restore the prior drawer");

const empty = popDrawer([]);
assert.deepEqual(empty, { stack: [], closed: null, active: null }, "empty stack pop must be safe");

assert.equal(getFocusTrapTarget(3, 2, false), 0, "Tab from the last focusable wraps to first");
assert.equal(getFocusTrapTarget(3, 0, true), 2, "Shift+Tab from first wraps to last");
assert.equal(getFocusTrapTarget(3, -1, false), 0, "focus outside the drawer must return to first focusable");
assert.equal(getFocusTrapTarget(3, -1, true), 2, "Shift+Tab from the container must wrap to last focusable");
assert.equal(getFocusTrapTarget(0, -1, false), -1, "drawer with no focusables must keep focus on its container");

console.log("Drawer behavior verification passed.");
