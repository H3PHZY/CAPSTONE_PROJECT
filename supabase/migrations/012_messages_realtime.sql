-- EcoLoop Step 12: realtime new-message toasts
-- Apply in Supabase Dashboard → SQL Editor
-- Enables live INSERT events on messages for in-app notification previews.

alter table public.messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime for messages in Dashboard → Database → Publications';
end $$;
