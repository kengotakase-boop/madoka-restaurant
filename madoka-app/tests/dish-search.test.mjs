import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in imports, `Unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
}
const genres = load("../src/constants/genre.ts");
const { formatDateJst } = load("../src/lib/date.ts");
const { filterDishes, sortDishesByRegistration } = load("../src/lib/dishSearch.ts", { "../constants/genre": genres });
const dishes = Object.freeze([
  Object.freeze({ name: "肉じゃが", note: "家族の定番", genre: "washoku" }),
  Object.freeze({ name: "鮭クリームパスタ", note: "家族の定番", genre: "italian" }),
  Object.freeze({ name: "Toast", note: "朝ごはん", genre: "bread" }),
]);
const names = (result) => Array.from(result, (dish) => dish.name);

test("name and memo reuse case-insensitive substring matching", () => {
  assert.deepEqual(names(filterDishes(dishes, "クリーム")), ["鮭クリームパスタ"]);
  assert.deepEqual(names(filterDishes(dishes, "定番")), ["肉じゃが", "鮭クリームパスタ"]);
  assert.deepEqual(names(filterDishes(dishes, "  TOAST  ")), ["Toast"]);
});
test("genre text searches Japanese labels, not internal codes", () => {
  assert.deepEqual(names(filterDishes(dishes, "イタリアン")), ["鮭クリームパスタ"]);
  assert.deepEqual(names(filterDishes(dishes, "italian")), []);
});
test("single genre selection preserves input ordering", () => {
  assert.deepEqual(names(filterDishes(dishes, "", "washoku")), ["肉じゃが"]);
});
test("text and genre are combined with AND", () => {
  assert.deepEqual(names(filterDishes(dishes, "定番", "italian")), ["鮭クリームパスタ"]);
  assert.deepEqual(names(filterDishes(dishes, "イタリアン", "washoku")), []);
});
test("clearing both conditions returns all rows without modifying them", () => {
  assert.deepEqual(names(filterDishes(dishes, "", "all")), names(dishes));
  assert.deepEqual(names(filterDishes(dishes, "   ", "all")), names(dishes));
});
test("empty list and zero matches are supported", () => {
  assert.deepEqual(names(filterDishes([], "", "all")), []);
  assert.deepEqual(names(filterDishes(dishes, "見つからない料理")), []);
});

const timestamp = (value) => ({ toDate: () => new Date(value) });
const ids = (rows) => Array.from(rows, (row) => row.id);
const registered = Object.freeze([
  Object.freeze({ ...dishes[0], id: "b", createdAt: timestamp("2026-09-23T12:00:00Z") }),
  Object.freeze({ ...dishes[1], id: "c", createdAt: timestamp("2026-09-24T12:00:00Z") }),
  Object.freeze({ ...dishes[0], id: "a", createdAt: timestamp("2026-09-22T12:00:00Z") }),
]);

test("registration defaults to newest and supports oldest without mutating input", () => {
  assert.deepEqual(ids(sortDishesByRegistration(registered)), ["c", "b", "a"]);
  assert.deepEqual(ids(sortDishesByRegistration(registered, "oldest")), ["a", "b", "c"]);
  assert.deepEqual(ids(registered), ["b", "c", "a"]);
});

test("equal registration times use a deterministic ID order regardless of response order", () => {
  const rows = ["b", "a", "c"].map((id) => ({ id, createdAt: timestamp(1000) }));
  for (const order of ["newest", "oldest"]) {
    assert.deepEqual(ids(sortDishesByRegistration(rows, order)), ["a", "b", "c"]);
    assert.deepEqual(ids(sortDishesByRegistration([...rows].reverse(), order)), ["a", "b", "c"]);
  }
});

test("missing and invalid registration dates stay last with stable ID ties", () => {
  const rows = [
    { id: "z", createdAt: null }, { id: "y" },
    { id: "x", createdAt: timestamp("invalid") },
    { id: "b", createdAt: timestamp(1000) }, { id: "a", createdAt: timestamp(0) },
  ];
  assert.deepEqual(ids(sortDishesByRegistration(rows)), ["b", "a", "x", "y", "z"]);
  assert.deepEqual(ids(sortDishesByRegistration(rows, "oldest")), ["a", "b", "x", "y", "z"]);
});

test("editing or cooking timestamps cannot affect registration order", () => {
  const rows = registered.map((row, i) => ({ ...row, updatedAt: timestamp(i * 1000), cookedAt: timestamp(i * 2000) }));
  for (const order of ["newest", "oldest"]) {
    const expected = ids(sortDishesByRegistration(rows, order));
    rows[2].updatedAt = timestamp("2099-01-01");
    rows[2].cookedAt = timestamp("2099-01-01");
    assert.deepEqual(ids(sortDishesByRegistration(rows, order)), expected);
  }
});

test("registration sorting applies to combined text and genre filters", () => {
  const filtered = filterDishes(registered, "定番", "washoku");
  assert.deepEqual(ids(sortDishesByRegistration(filtered)), ["b", "a"]);
  assert.deepEqual(ids(sortDishesByRegistration(filtered, "oldest")), ["a", "b"]);
});

test("registration sorting handles empty and single results", () => {
  assert.deepEqual(ids(sortDishesByRegistration([])), []);
  assert.deepEqual(ids(sortDishesByRegistration([registered[0]])), ["b"]);
});

test("card registration dates use dotted JST dates, including midnight and zero padding", () => {
  assert.equal(formatDateJst(timestamp("2026-09-23T15:00:00Z")), "2026.09.24");
  assert.equal(formatDateJst(timestamp("2026-09-23T14:59:59Z")), "2026.09.23");
  assert.equal(formatDateJst(timestamp("2026-01-02T00:00:00Z")), "2026.01.02");
});

test("missing/invalid registration dates are omitted instead of fabricated", () => {
  for (const value of [null, undefined, timestamp("invalid")]) {
    assert.equal(formatDateJst(value), "");
  }
});

test("displayed registration dates agree with both registration sort directions", () => {
  const dates = (order) => Array.from(sortDishesByRegistration(registered, order), (dish) => formatDateJst(dish.createdAt));
  assert.deepEqual(dates("newest"), ["2026.09.24", "2026.09.23", "2026.09.22"]);
  assert.deepEqual(dates("oldest"), ["2026.09.22", "2026.09.23", "2026.09.24"]);
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /formatDateJst\(d\.createdAt\)/);
});
