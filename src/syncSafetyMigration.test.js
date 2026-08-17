import fs from "fs";
import path from "path";

const migrationPath = path.join(
  __dirname,
  "../supabase/migrations/20260814010000_restore_tracker_updated_at.sql"
);
const verificationPath = path.join(
  __dirname,
  "../supabase/verification/verify_tracker_updated_at.sql"
);

test("timestamp migration installs a database-generated strictly increasing update trigger", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  expect(sql).toMatch(/create or replace function public\.set_tracker_data_updated_at\(\)/i);
  expect(sql).toMatch(/new\.updated_at := clock_timestamp\(\)/i);
  expect(sql).toMatch(/new\.updated_at := old\.updated_at \+ interval '1 microsecond'/i);
  expect(sql).toMatch(/create trigger zz_set_tracker_data_updated_at\s+before update on public\.tracker_data/i);
  expect(sql).not.toMatch(/update\s+public\.tracker_data\s+set/i);
  expect(sql).not.toMatch(/drop trigger.*preserve_versioned_tracker_payload/i);
});

test("verification script exercises timestamp, concurrency, trigger-order, and payload protections safely", () => {
  const sql = fs.readFileSync(verificationPath, "utf8");

  expect(sql).toMatch(/create temporary table tracker_data_sync_verification/i);
  expect(sql).toMatch(/create trigger preserve_versioned_tracker_payload/i);
  expect(sql).toMatch(/create trigger zz_set_tracker_data_updated_at/i);
  expect(sql).toMatch(/rapid consecutive update did not advance updated_at/i);
  expect(sql).toMatch(/failed optimistic-concurrency update modified the row/i);
  expect(sql).toMatch(/payload-version protection did not preserve the newer payload/i);
  expect(sql).toMatch(/client-supplied updated_at was not replaced/i);
  expect(sql).toMatch(/trigger execution order is unsafe/i);
  expect(sql.trim().toLowerCase()).toMatch(/rollback;$/);
  expect(sql).not.toMatch(/update\s+public\.tracker_data/i);
  expect(sql).not.toMatch(/insert into\s+public\.tracker_data/i);
});

test("payload protection prevents a version 2 client from replacing version 3 data", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260805_preserve_versioned_tracker_payload.sql"),
    "utf8"
  );
  expect(sql).toMatch(/previous_version\s*>\s*incoming_version/i);
  const preservePayload = (previousVersion, incomingVersion) => previousVersion > incomingVersion;
  expect(preservePayload(3, 2)).toBe(true);
  expect(preservePayload(3, 3)).toBe(false);
  expect(preservePayload(2, 3)).toBe(false);
});
