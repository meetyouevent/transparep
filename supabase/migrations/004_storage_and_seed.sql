-- ManuscritPro: Storage Buckets & Seed Data

-- Storage buckets (run via Supabase Dashboard or CLI)
-- insert into storage.buckets (id, name, public) values ('manuscripts', 'manuscripts', false);
-- insert into storage.buckets (id, name, public) values ('excerpts', 'excerpts', true);
-- insert into storage.buckets (id, name, public) values ('covers', 'covers', true);
-- insert into storage.buckets (id, name, public) values ('ai-reports', 'ai-reports', false);

-- Storage RLS: manuscripts bucket (private, author + service role)
-- create policy "manuscripts_storage_author" on storage.objects
--   for select using (bucket_id = 'manuscripts' and auth.uid()::text = (storage.foldername(name))[1]);

-- Seed: default badges
insert into public.badges (slug, name, description, icon, criteria_type, criteria_value) values
  ('debutant', 'Critique débutant', 'A rédigé sa première critique', '✍️', 'reviews_given', 1),
  ('lecteur_assidu', 'Lecteur assidu', 'A rédigé 10 critiques', '📚', 'reviews_given', 10),
  ('plume_affutee', 'Plume aiguisée', 'A rédigé 25 critiques', '🪶', 'reviews_given', 25),
  ('expert_litteraire', 'Expert littéraire', 'A rédigé 50 critiques', '🏆', 'reviews_given', 50),
  ('grand_lecteur', 'Grand lecteur', 'A rédigé 100 critiques', '👑', 'reviews_given', 100)
on conflict (slug) do nothing;
