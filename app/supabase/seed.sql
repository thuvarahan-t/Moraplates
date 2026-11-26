-- University of Moratuwa canteens. Menus start empty: students add foods and prices in the app.
-- Wala and Goda pins come from OpenStreetMap; students pin the rest from each canteen's page.
-- Hours are placeholders (7am-6pm) until confirmed.

insert into public.canteens (id, name, location, lat, lng, opens_at, closes_at, colour) values
  ('wala',           'Wala Canteen',            'Wala',    6.796924, 79.899594, 7, 18, '#E8492F'),
  ('goda',           'Goda Canteen',            'Goda',    6.796366, 79.900150, 7, 18, '#E09A12'),
  ('goda-uda',       'Goda Uda Canteen',        'Goda',    null,     null,      7, 18, '#2F9E5B'),
  ('goda-uda-staff', 'Goda Uda Staff Canteen',  'Goda',    null,     null,      7, 18, '#7F77DD'),
  ('wala-uda',       'Wala Uda Canteen',        'Wala',    null,     null,      7, 18, '#D4537E'),
  ('l-canteen',      'L Canteen',               'Campus',  null,     null,      7, 18, '#1F8A9E'),
  ('civil',          'Civil Canteen',           'Civil faculty', null, null,    7, 18, '#C9853A'),
  ('village',        'Village Canteen',         'Campus',  null,     null,      7, 18, '#6B1E2A') on conflict (id) do nothing;
