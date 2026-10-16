/**
 * Pinned source data. Every file is verified by SHA-256 before the database is built, so a build
 * can only ever contain these exact, reviewed texts (see config/hermeneutics.ts).
 *
 * To update a source: download it, review the changes, then update the URL pin and checksum here.
 */
export interface SourceFile {
  path: string; // relative to data/raw
  url: string;
  sha256: string;
  /** For archives: the member to extract and where to put it. */
  extract?: { member: string; to: string };
}

const STEP = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/bd09545c7a44b39ace20f16c0359915f2aa23a62";
const step = (path: string, file: string, sha256: string): SourceFile => ({
  path: `stepbible/${file}`,
  url: `${STEP}/${path.split("/").map(encodeURIComponent).join("/")}`,
  sha256,
});

export const SOURCES: SourceFile[] = [
  {
    path: "bsb.txt",
    url: "https://bereanbible.com/bsb.txt",
    sha256: "2ac3af1de52d4e68261cba91d85c320b7eadc6560e830d99e591767b8ff5ca96",
  },
  {
    path: "KJV.csv",
    url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/formats/csv/KJV.csv",
    sha256: "a1051b4395bee78d01e239984425f3919563db5caee6fc162d4ddc7faff7eaa8",
  },
  {
    path: "cross-references.zip",
    url: "https://a.openbible.info/data/cross-references.zip",
    sha256: "3b694f0db9ea81e125c78e88b1845ec18e8b99e63ac94eee3be58ab92cca27f1",
    extract: { member: "cross_references.txt", to: "openbible/cross_references.txt" },
  },
  step("Translators Amalgamated OT+NT/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "TAHOT-Gen-Deu.txt", "e9b8546ee48fe0bfc57c3b70f5f40e98d96580e803526d19026224e31753368b"),
  step("Translators Amalgamated OT+NT/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "TAHOT-Jos-Est.txt", "195fee1dc3653bab33701f170734eb894ed647c10cd08cc61749375fe8b73775"),
  step("Translators Amalgamated OT+NT/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "TAHOT-Job-Sng.txt", "bb508af3af07822fca84cc43a0eba79eb70eecf672aabc0245b8d8cecf329d96"),
  step("Translators Amalgamated OT+NT/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "TAHOT-Isa-Mal.txt", "f3ded203d2a74d6368932c97ae550d1d0754b271af491dc0dedf36fe3ba0bcc5"),
  step("Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt", "TAGNT-Mat-Jhn.txt", "ab8eaaeb68e17a1dcfa34e1e9350358f22f03bc2a97244d848750ad81044bc8e"),
  step("Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt", "TAGNT-Act-Rev.txt", "524e32375361e6d3fa2f7ef00b87605fdc4317a762f395651a05fdc31ad031b7"),
  step("Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt", "TBESH.txt", "464dccadd95fd8620dd05fa0d7a4caba58ec3c4d5db3ebf38e43d046ca25b591"),
  step("Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt", "TBESG.txt", "312f723d7b8ef263bbdfb0451c9b8057125804dfff390b6f8544cff2a84b57f4"),
  step("Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt", "TEHMC.txt", "78779bea824b31d4467dec0161d547481c86f266bc39def12cd11dc7dcbe6da7"),
  step("Morphology codes/TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt", "TEGMC.txt", "5f0416f7617019a6082285214903bde569a980d5fd3b88b8d7020d944e94de82"),
];
