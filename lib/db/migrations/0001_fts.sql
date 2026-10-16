-- Full-text index over translation text. External-content table keyed on
-- verse_texts' implicit rowid; the DB build script runs 'rebuild' after
-- loading text (and must not VACUUM afterwards, which can renumber rowids).
CREATE VIRTUAL TABLE `verse_fts` USING fts5(
  `text`,
  `verse_id` UNINDEXED,
  `translation_id` UNINDEXED,
  content='verse_texts',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
