import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");
const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";

/** The pieces of a Supabase project the migration depends on. */
const SUPABASE_STUBS = `
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create publication supabase_realtime;
`;

const GRANTS = `
  grant usage on schema public, auth, extensions to anon, authenticated;
  grant all on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
`;

let db: PGlite;

async function asSuperuser() {
  await db.exec(`reset role; select set_config('request.uid', '', false);`);
}

async function asUser(id: string) {
  await db.exec(`set role authenticated; select set_config('request.uid', '${id}', false);`);
}

async function insertPulse(authorId: string, text: string, lat: number, lng: number, hoursAgo = 0) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.pulses (author_id, author_name, text, category, location, created_at)
     values ($1, 'tester', $2, 'food', extensions.st_point($4, $3)::extensions.geography,
             now() - make_interval(hours => $5))
     returning id`,
    [authorId, text, lat, lng, hoursAgo],
  );
  return rows[0].id;
}

const upvotesOf = async (id: string) =>
  (await db.query<{ upvotes: number }>(`select upvotes from public.pulses where id = $1`, [id])).rows[0].upvotes;

beforeAll(async () => {
  db = new PGlite({ extensions: { postgis } });
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(GRANTS);
  await db.exec(`insert into auth.users values ('${ALICE}'), ('${BOB}')`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await asSuperuser();
  await db.exec(`delete from public.pulses`);
});

describe("nearby_pulses", () => {
  it("returns only pulses inside the radius, with distances", async () => {
    await insertPulse(ALICE, "Downtown Long Beach", 33.7701, -118.1937);
    await insertPulse(ALICE, "Belmont Shore", 33.759, -118.1415);
    await insertPulse(ALICE, "Santa Monica", 34.0195, -118.4912);

    const { rows } = await db.query<{ text: string; distance_km: number }>(
      `select text, distance_km from public.nearby_pulses(33.7701, -118.1937, 10)`,
    );

    expect(rows.map((r) => r.text).sort()).toEqual(["Belmont Shore", "Downtown Long Beach"]);
    expect(rows.find((r) => r.text === "Belmont Shore")!.distance_km).toBeCloseTo(4.99, 1);
  });

  it("excludes pulses older than max_age_hours", async () => {
    await insertPulse(ALICE, "fresh", 33.7701, -118.1937, 1);
    await insertPulse(ALICE, "stale", 33.7701, -118.1937, 72);

    const { rows } = await db.query<{ text: string }>(`select text from public.nearby_pulses(33.7701, -118.1937, 5, 48)`);
    expect(rows.map((r) => r.text)).toEqual(["fresh"]);
  });

  it("returns lat/lng that round-trip the stored location", async () => {
    await insertPulse(ALICE, "here", 33.7701, -118.1937);
    const { rows } = await db.query<{ lat: number; lng: number }>(
      `select lat, lng from public.nearby_pulses(33.7701, -118.1937, 1)`,
    );
    expect(rows[0].lat).toBeCloseTo(33.7701, 6);
    expect(rows[0].lng).toBeCloseTo(-118.1937, 6);
  });
});

describe("votes", () => {
  it("keeps the upvote counter in sync and rejects double votes", async () => {
    const id = await insertPulse(ALICE, "vote me", 33.77, -118.19);
    await asUser(BOB);

    await db.query(`insert into public.pulse_votes (pulse_id) values ($1)`, [id]);
    expect(await upvotesOf(id)).toBe(1);

    await expect(db.query(`insert into public.pulse_votes (pulse_id) values ($1)`, [id])).rejects.toThrow();

    await db.query(`delete from public.pulse_votes where pulse_id = $1`, [id]);
    expect(await upvotesOf(id)).toBe(0);
  });

  it("does not let users vote on behalf of someone else", async () => {
    const id = await insertPulse(ALICE, "vote me", 33.77, -118.19);
    await asUser(BOB);
    await expect(
      db.query(`insert into public.pulse_votes (pulse_id, voter_id) values ($1, $2)`, [id, ALICE]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("row-level security on pulses", () => {
  it("lets a signed-in user post as themselves", async () => {
    await asUser(BOB);
    const { rows } = await db.query<{ author_id: string }>(
      `insert into public.pulses (author_name, text, category, location)
       values ('bob', 'hi', 'music', extensions.st_point(-118.19, 33.77)::extensions.geography)
       returning author_id`,
    );
    expect(rows[0].author_id).toBe(BOB);
  });

  it("blocks posting as someone else", async () => {
    await asUser(BOB);
    await expect(
      db.query(
        `insert into public.pulses (author_id, author_name, text, category, location)
         values ($1, 'spoof', 'hi', 'music', extensions.st_point(-118.19, 33.77)::extensions.geography)`,
        [ALICE],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("blocks seeding a pulse with fake upvotes", async () => {
    await asUser(BOB);
    await expect(
      db.query(
        `insert into public.pulses (author_name, text, category, location, upvotes)
         values ('bob', 'hi', 'music', extensions.st_point(-118.19, 33.77)::extensions.geography, 999)`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("only lets authors delete their own pulses", async () => {
    const id = await insertPulse(ALICE, "alice's", 33.77, -118.19);

    await asUser(BOB);
    const bobDelete = await db.query(`delete from public.pulses where id = $1 returning id`, [id]);
    expect(bobDelete.rows).toHaveLength(0);

    await asUser(ALICE);
    const aliceDelete = await db.query(`delete from public.pulses where id = $1 returning id`, [id]);
    expect(aliceDelete.rows).toHaveLength(1);
  });

  it("rejects invalid categories and empty text", async () => {
    await expect(insertPulse(ALICE, "   ", 33.77, -118.19)).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        `insert into public.pulses (author_id, author_name, text, category, location)
         values ($1, 'a', 'hi', 'crypto', extensions.st_point(-118.19, 33.77)::extensions.geography)`,
        [ALICE],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
