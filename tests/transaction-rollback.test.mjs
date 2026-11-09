import test from "node:test";
import assert from "node:assert/strict";
import { runWithAbort } from "../lib/db/transaction-state.mjs";

test("failed transaction body aborts the active MongoDB transaction", async () => {
  let active = true, aborts = 0;
  const session = {
    inTransaction: () => active,
    abortTransaction: async () => { aborts += 1; active = false; },
  };
  await assert.rejects(runWithAbort(session, async () => { throw new Error("forced rollback"); }), /forced rollback/);
  assert.equal(aborts, 1);
  assert.equal(active, false);
});
test("successful transaction body leaves commit control to the transaction wrapper", async () => {
  let aborts = 0;
  const session = { inTransaction: () => true, abortTransaction: async () => { aborts += 1; } };
  assert.equal(await runWithAbort(session, async () => "committable"), "committable");
  assert.equal(aborts, 0);
});
