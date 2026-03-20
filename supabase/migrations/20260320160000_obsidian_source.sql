-- Allow 'obsidian' as a source for knowledge_base (Obsidian vault sync)
alter table knowledge_base
  drop constraint if exists knowledge_base_source_check;

alter table knowledge_base
  add constraint knowledge_base_source_check
  check (source in ('admin', 'user', 'conversation', 'obsidian'));
