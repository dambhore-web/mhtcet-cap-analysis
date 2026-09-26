// Print row counts and content checksums of the loaded tables (staging), to prove idempotent loads.
// Usage: npm run db:checksum
import { connectStaging } from "../db.ts";

const client = await connectStaging();
try {
  const q = async (sql: string): Promise<unknown> => (await client.query(sql)).rows[0];
  const out = {
    college: await q("select count(*) n, md5(string_agg(concat_ws('|', authority, code, exam, name, status, home_university, total_intake), ',' order by authority, code)) h from college"),
    branch: await q("select count(*) n, md5(string_agg(concat_ws('|', authority, choice_code, college_code, exam, name, status), ',' order by authority, choice_code)) h from branch"),
    cutoff: await q("select count(*) n, md5(string_agg(concat_ws('|', authority, exam, year, list, round, choice_code, section, seat_type, stage, college_code, closing_merit, closing_percentile, source, source_page), ',' order by authority, exam, year, list, round, choice_code, section, seat_type, stage)) h from cutoff"),
    merit_lookup: await q("select count(*) n, md5(string_agg(concat_ws('|', authority, year, list, merit, exam, score), ',' order by authority, year, list, merit)) h from merit_lookup"),
    runs: (await client.query("select id, status from ingest_run order by id")).rows,
  };
  console.log(JSON.stringify(out, null, 1));
} finally {
  await client.end();
}
