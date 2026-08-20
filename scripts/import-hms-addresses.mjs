import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import pg from "pg";

try {
  process.loadEnvFile?.(".env.local");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const DEFAULT_SOURCE =
  "https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv";
const DEFAULT_PLACES_SOURCE = "https://overpass-api.de/api/interpreter";
const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const BATCH_SIZE = 1_000;

const PLACE_LABELS = {
  city: ["borg", 100],
  town: ["þéttbýli", 95],
  village: ["þorp", 90],
  suburb: ["borgarhluti", 85],
  hamlet: ["smábyggð", 80],
  quarter: ["hverfi", 78],
  neighbourhood: ["hverfi", 75],
  borough: ["borgarhluti", 75],
  municipality: ["sveitarfélag", 70],
  island: ["eyja", 65],
  isolated_dwelling: ["býli", 55],
  farm: ["býli", 50],
  locality: ["örnefni", 35],
};

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.replace(/\r$/, ""));
  return values;
}

function toRecord(headers, values) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function clean(value) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function createAddress(record) {
  const sourceId = Number(record.HNITNUM);
  const latitude = Number(record.N_HNIT_WGS84);
  const longitude = Number(record.E_HNIT_WGS84);
  const streetName = clean(record.HEITI_NF);

  if (
    !Number.isSafeInteger(sourceId)
    || !streetName
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < 62
    || latitude > 68
    || longitude < -26
    || longitude > -12
  ) {
    return null;
  }

  const houseNumber = [clean(record.HUSNR), clean(record.BOKST)].filter(Boolean).join("") || null;
  const suffix = clean(record.VIDSK);
  const specialName = clean(record.SERHEITI);
  const postalCode = clean(record.POSTNR);
  const address = [streetName, houseNumber, suffix].filter(Boolean).join(" ");
  const addressLabel = [address, specialName, postalCode].filter(Boolean).join(", ");
  const searchText = [
    addressLabel,
    streetName,
    record.HEITI_TGF,
    houseNumber,
    suffix,
    specialName,
    postalCode,
    record.SVFNR,
    record.LANDNR,
    record.VEF_BIRTING,
  ].filter(Boolean).join(" ");

  return {
    sourceId,
    addressLabel,
    streetName,
    houseNumber,
    postalCode,
    municipalityCode: clean(record.SVFNR),
    specialName,
    latitude,
    longitude,
    searchText,
    sourceUpdatedAt: clean(record.DAGS_LEIDR),
  };
}

async function openSource() {
  const filePath = process.env.HMS_ADDRESS_CSV_PATH;
  if (filePath) return createReadStream(filePath, { encoding: "utf8" });

  const sourceUrl = process.env.HMS_ADDRESS_CSV_URL || DEFAULT_SOURCE;
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) {
    throw new Error(`HMS download failed with HTTP ${response.status}.`);
  }
  return Readable.fromWeb(response.body);
}

function createPlace(element) {
  const tags = element.tags ?? {};
  const name = clean(tags["name:is"]) ?? clean(tags.name);
  const category = clean(tags.place);
  const coordinates = element.center ?? element;
  const latitude = Number(coordinates.lat);
  const longitude = Number(coordinates.lon);
  const sourceId = Number(element.id);

  if (
    !name
    || !category
    || !["node", "way", "relation"].includes(element.type)
    || !Number.isSafeInteger(sourceId)
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < 62
    || latitude > 68
    || longitude < -26
    || longitude > -12
  ) {
    return null;
  }

  const [categoryLabel, searchPriority] = PLACE_LABELS[category] ?? ["staðarheiti", 25];
  const searchText = [
    name,
    tags.name,
    tags.alt_name,
    tags.short_name,
    tags.loc_name,
    tags.official_name,
    tags["addr:postcode"],
    category,
    categoryLabel,
  ].filter(Boolean).join(" ");

  return {
    sourceType: element.type,
    sourceId,
    name,
    category,
    categoryLabel,
    searchPriority,
    latitude,
    longitude,
    searchText,
    dedupeKey: tags.wikidata
      ? `wikidata:${tags.wikidata}`
      : `${name.toLocaleLowerCase("is")}|${category}|${latitude.toFixed(3)}|${longitude.toFixed(3)}`,
  };
}

async function loadPlaces() {
  const filePath = process.env.OSM_PLACES_JSON_PATH;
  let payload;

  if (filePath) {
    payload = JSON.parse(await readFile(filePath, "utf8"));
  } else {
    const query = '[out:json][timeout:90];area["ISO3166-1"="IS"][admin_level=2]->.is;nwr["place"](area.is);out center tags;';
    const response = await fetch(process.env.OSM_PLACES_URL || DEFAULT_PLACES_SOURCE, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: {
        Accept: "application/json",
        "User-Agent": "VegstodDispatchAddressImporter/0.1 (+https://github.com/HelgasonF/road)",
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`OpenStreetMap place download failed with HTTP ${response.status}.`);
    payload = await response.json();
  }

  const places = new Map();
  for (const element of payload.elements ?? []) {
    const place = createPlace(element);
    if (!place) continue;
    const existing = places.get(place.dedupeKey);
    if (!existing || place.searchPriority > existing.searchPriority || place.sourceType === "node") {
      places.set(place.dedupeKey, place);
    }
  }
  return [...places.values()];
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return;

  await client.query(
    `insert into road_address_import (
      source_id, address_label, street_name, house_number, postal_code,
      municipality_code, special_name, latitude, longitude, search_text, source_updated_at
    )
    select * from unnest(
      $1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[],
      $6::text[], $7::text[], $8::double precision[], $9::double precision[],
      $10::text[], $11::date[]
    )`,
    [
      batch.map((row) => row.sourceId),
      batch.map((row) => row.addressLabel),
      batch.map((row) => row.streetName),
      batch.map((row) => row.houseNumber),
      batch.map((row) => row.postalCode),
      batch.map((row) => row.municipalityCode),
      batch.map((row) => row.specialName),
      batch.map((row) => row.latitude),
      batch.map((row) => row.longitude),
      batch.map((row) => row.searchText),
      batch.map((row) => row.sourceUpdatedAt),
    ],
  );
}

async function insertPlaceBatch(client, batch) {
  if (batch.length === 0) return;

  await client.query(
    `insert into road_place_import (
      source_type, source_id, name, category, category_label,
      search_priority, latitude, longitude, search_text
    )
    select * from unnest(
      $1::text[], $2::bigint[], $3::text[], $4::text[], $5::text[],
      $6::integer[], $7::double precision[], $8::double precision[], $9::text[]
    )`,
    [
      batch.map((row) => row.sourceType),
      batch.map((row) => row.sourceId),
      batch.map((row) => row.name),
      batch.map((row) => row.category),
      batch.map((row) => row.categoryLabel),
      batch.map((row) => row.searchPriority),
      batch.map((row) => row.latitude),
      batch.map((row) => row.longitude),
      batch.map((row) => row.searchText),
    ],
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const hostname = new URL(databaseUrl).hostname;
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: ["127.0.0.1", "localhost"].includes(hostname) ? false : { rejectUnauthorized: false },
  });
  let accepted = 0;
  let skipped = 0;

  try {
  await client.connect();
  await client.query("begin");
  await client.query(`
    create temporary table road_address_import (
      source_id bigint primary key,
      address_label text not null,
      street_name text not null,
      house_number text,
      postal_code text,
      municipality_code text,
      special_name text,
      latitude double precision not null,
      longitude double precision not null,
      search_text text not null,
      source_updated_at date
    ) on commit drop
  `);
  await client.query(`
    create temporary table road_place_import (
      source_type text not null,
      source_id bigint not null,
      name text not null,
      category text not null,
      category_label text not null,
      search_priority integer not null,
      latitude double precision not null,
      longitude double precision not null,
      search_text text not null,
      primary key (source_type, source_id)
    ) on commit drop
  `);

  const lines = createInterface({ input: await openSource(), crlfDelay: Infinity });
  let headers;
  let batch = [];

  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line).map((header) => header.replace(/^\uFEFF/, ""));
      continue;
    }

    const address = createAddress(toRecord(headers, parseCsvLine(line)));
    if (!address) {
      skipped += 1;
      continue;
    }

    batch.push(address);
    accepted += 1;
    if (batch.length >= BATCH_SIZE) {
      await insertBatch(client, batch);
      batch = [];
    }
  }

  await insertBatch(client, batch);
  const places = await loadPlaces();
  for (let index = 0; index < places.length; index += BATCH_SIZE) {
    await insertPlaceBatch(client, places.slice(index, index + BATCH_SIZE));
  }

  await client.query("lock table public.iceland_addresses, public.iceland_places in exclusive mode");
  await client.query("truncate table public.iceland_addresses");
  await client.query("truncate table public.iceland_places");
  await client.query(`
    insert into public.iceland_addresses (
      source_id, address_label, street_name, house_number, postal_code,
      municipality_code, special_name, latitude, longitude, search_text, source_updated_at
    )
    select
      source_id, address_label, street_name, house_number, postal_code,
      municipality_code, special_name, latitude, longitude, search_text, source_updated_at
    from road_address_import
  `);
  await client.query(`
    insert into public.iceland_places (
      source_type, source_id, name, category, category_label,
      search_priority, latitude, longitude, search_text
    )
    select
      source_type, source_id, name, category, category_label,
      search_priority, latitude, longitude, search_text
    from road_place_import
  `);
  await client.query("analyze public.iceland_addresses");
  await client.query("analyze public.iceland_places");
  await client.query("commit");

  const size = await client.query(
    `select pg_size_pretty(
      pg_total_relation_size('public.iceland_addresses')
      + pg_total_relation_size('public.iceland_places')
    ) as size`,
  );
  console.log(`Imported ${accepted.toLocaleString("en-US")} HMS addresses; skipped ${skipped.toLocaleString("en-US")} invalid rows.`);
  console.log(`Imported ${places.length.toLocaleString("en-US")} deduplicated OpenStreetMap place names.`);
  console.log(`PostgreSQL search tables and indexes use ${size.rows[0].size}.`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { createAddress, createPlace, main, parseCsvLine };
