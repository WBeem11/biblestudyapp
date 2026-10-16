/**
 * Download and verify the pinned source data into data/raw (or $RAW_DIR).
 *   npm run data:fetch            # skips files already present with the right checksum
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { SOURCES } from "./data-manifest";
import { RAW } from "./lib/paths";

const dir = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : RAW;
const sha256 = (buf: Uint8Array) =>
  createHash("sha256").update(buf).digest("hex");

async function main() {
  let fetched = 0;
  for (const s of SOURCES) {
    const dest = path.join(dir, s.path);
    if (fs.existsSync(dest) && sha256(fs.readFileSync(dest)) === s.sha256) {
      if (!s.extract || fs.existsSync(path.join(dir, s.extract.to))) continue;
    } else {
      const res = await fetch(s.url);
      if (!res.ok)
        throw new Error(`${s.path}: HTTP ${res.status} from ${s.url}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const got = sha256(buf);
      if (got !== s.sha256) {
        throw new Error(
          `${s.path}: checksum mismatch (expected ${s.sha256}, got ${got}). ` +
            "The upstream source changed; review it and update scripts/data-manifest.ts.",
        );
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      fetched++;
      console.log(`fetched ${s.path} (${(buf.length / 1e6).toFixed(1)} MB)`);
    }
    if (s.extract) {
      const files = unzipSync(fs.readFileSync(dest), {
        filter: (f) => f.name === s.extract!.member,
      });
      const data = files[s.extract.member];
      if (!data)
        throw new Error(`${s.path}: ${s.extract.member} not found in archive`);
      fs.mkdirSync(path.dirname(path.join(dir, s.extract.to)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(dir, s.extract.to), data);
    }
  }
  console.log(
    `data: ${SOURCES.length} sources verified (${fetched} downloaded) in ${dir}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
