-- M5: proposal fields come from anonymous users via submit_post_proposal: constrain them in the DB.
-- photo_path is the object path inside the private `proposals` bucket: <uuid>.<ext>.
alter table public.post_proposals
  add constraint post_proposals_photo_path_chk check (photo_path is null or
    photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'),
  add constraint post_proposals_video_url_chk check (video_url is null or
    (video_url ~ '^https://[^[:space:]]+$' and char_length(video_url) <= 500)),
  add constraint post_proposals_location_chk check (location is null or char_length(location) <= 200),
  add constraint post_proposals_submitter_name_chk check (char_length(submitter_name) between 1 and 120),
  add constraint post_proposals_submitter_contact_chk check (submitter_contact is null or char_length(submitter_contact) <= 200);

-- L3: tables never need TRUNCATE/TRIGGER/REFERENCES from API roles (RLS does not cover TRUNCATE).
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- L4: finished transports keep client name/phone visible to the driver for 30 days only.
create or replace view public.volunteer_transports_v with (security_barrier = true) as
select t.id, t.travel_date, t.departure_at, t.appointment_at, t.return_at, t.from_address, t.to_address,
       t.wheelchair, t.companion, t.status, t.km, t.driver_notes,
       c.first_name as client_first_name, c.last_name as client_last_name, c.phone as client_phone,
       v.plate as vehicle_plate, v.model as vehicle_model
from public.transports t
join public.clients c on c.id = t.client_id
left join public.vehicles v on v.id = t.vehicle_id
where t.driver_volunteer_id = auth.uid()
  and (t.status in ('assegnato', 'confermato') or (t.status = 'svolto' and t.travel_date >= current_date - 30));
