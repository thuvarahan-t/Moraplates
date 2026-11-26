-- Real University of Moratuwa canteens replace the placeholders from the design handoff.
-- The placeholders had no student posts, votes, photos or foods when this ran.
--
-- Wala and Goda pins come from OpenStreetMap. The others start unpinned; the first
-- student who knows where one is can drop its pin from the canteen page.
-- Hours (7am-6pm) and locations are placeholders until confirmed.

delete from public.canteens where id in ('it', 'main', 'civil', 'juice', 'hostel');

insert into public.canteens (id, name, location, lat, lng, opens_at, closes_at, colour) values
  ('wala',           'Wala Canteen',            'Wala',    6.796924, 79.899594, 7, 18, '#E8492F'),
  ('goda',           'Goda Canteen',            'Goda',    6.796366, 79.900150, 7, 18, '#E09A12'),
  ('goda-uda',       'Goda Uda Canteen',        'Goda',    null,     null,      7, 18, '#2F9E5B'),
  ('goda-uda-staff', 'Goda Uda Staff Canteen',  'Goda',    null,     null,      7, 18, '#7F77DD'),
  ('wala-uda',       'Wala Uda Canteen',        'Wala',    null,     null,      7, 18, '#D4537E'),
  ('l-canteen',      'L Canteen',               'Campus',  null,     null,      7, 18, '#1F8A9E'),
  ('civil',          'Civil Canteen',           'Civil faculty', null, null,    7, 18, '#C9853A'),
  ('village',        'Village Canteen',         'Campus',  null,     null,      7, 18, '#6B1E2A');

-- Students may set the location of a canteen that has none yet, and nothing else.
create policy "students pin unpinned canteens" on public.canteens for update to authenticated
  using ((select public.is_student()) and lat is null)
  with check (lat is not null and lng is not null);
grant update (lat, lng) on public.canteens to authenticated;
