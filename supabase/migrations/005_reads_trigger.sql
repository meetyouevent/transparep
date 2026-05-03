-- ManuscritPro: Reads counter trigger

-- Trigger: auto-increment total_reads when a manuscript_reads row is inserted
create or replace function public.handle_manuscript_read()
returns trigger language plpgsql
as $$
begin
  update public.manuscripts
  set total_reads = total_reads + 1
  where id = new.manuscript_id;
  return new;
end;
$$;

drop trigger if exists on_manuscript_read on public.manuscript_reads;
create trigger on_manuscript_read
  after insert on public.manuscript_reads
  for each row execute procedure public.handle_manuscript_read();

-- Index for duplicate-read queries (analytics)
create index if not exists idx_reads_reader on public.manuscript_reads(reader_id);
