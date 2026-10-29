import assert from "node:assert/strict";
import { test } from "node:test";
import { bindNamedParams } from "../app/db/sql.ts";

test("keeps Postgres type casts like ::int and ::numeric", () => {
  const sql = `
    SELECT COUNT(*)::int AS c, AVG(p.price)::numeric AS avg_price
    FROM products p
    JOIN stores s ON p.store_id = s.id
    WHERE s.store_name = :storeName
  `;
  const { text, values } = bindNamedParams(sql, { storeName: "demo-shop" });

  assert.match(text, /COUNT\(\*\)::int/);
  assert.match(text, /AVG\(p\.price\)::numeric/);
  assert.match(text, /store_name = \$1/);
  assert.deepEqual(values, ["demo-shop"]);
  assert.doesNotMatch(text, /COUNT\(\*\):\$/);
});

test("binds the same name once and reuses the index", () => {
  const { text, values } = bindNamedParams(
    "SELECT :storeName AS a, :storeName AS b",
    { storeName: "x" }
  );
  assert.equal(text, "SELECT $1 AS a, $1 AS b");
  assert.deepEqual(values, ["x"]);
});

test("keeps cast after a bound param (:days)::interval style", () => {
  const sql = `WHERE created_at >= NOW() - (:days || ' days')::interval`;
  const { text, values } = bindNamedParams(sql, { days: 30 });
  assert.equal(text, `WHERE created_at >= NOW() - ($1 || ' days')::interval`);
  assert.deepEqual(values, [30]);
});

test("leaves unknown :tokens alone", () => {
  const { text, values } = bindNamedParams("SELECT :missing, :ok", { ok: 1 });
  assert.equal(text, "SELECT :missing, $1");
  assert.deepEqual(values, [1]);
});
