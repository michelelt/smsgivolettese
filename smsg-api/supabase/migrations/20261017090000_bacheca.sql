-- Phase 6 / ADR-062: bacheca invariants.
update storage.buckets set file_size_limit = 5242880 where id = 'proposals';

alter table public.posts
  add constraint posts_content_array_chk check (jsonb_typeof(content) = 'array'),
  add constraint posts_title_len_chk check (char_length(title) <= 200),
  add constraint posts_location_len_chk check (location is null or char_length(location) <= 200),
  add constraint posts_slug_len_chk check (char_length(slug) <= 80),
  add constraint posts_event_date_chk check (status = 'bozza' or category <> 'evento' or event_date is not null);

-- Slug is frozen once the post has been published (unpublishing keeps published_at).
create function app.posts_freeze_slug() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.published_at is not null and new.slug is distinct from old.slug then
    raise exception 'SLUG_FROZEN';
  end if;
  return new;
end $$;
create trigger posts_freeze_slug before update of slug on public.posts
  for each row execute function app.posts_freeze_slug();

-- Deleting a post or proposal must not be blocked by the one-to-one link.
alter table public.post_proposals drop constraint post_proposals_post_id_fkey,
  add constraint post_proposals_post_id_fkey foreign key (post_id) references public.posts (id) on delete set null;
alter table public.posts drop constraint posts_from_proposal_id_fkey,
  add constraint posts_from_proposal_id_fkey foreign key (from_proposal_id) references public.post_proposals (id) on delete set null;

-- Not on post_proposals: anonymous personal data.
create trigger audit after insert or update or delete on public.posts
  for each row execute function app.audit();
