-- Placeholder canteens and menus from the design handoff (index.html).
-- Replace with real campus data before launch: names, locations and hours are not confirmed.

insert into public.canteens (id, name, location, opens_at, closes_at, known_for, colour) values
  ('it',     'IT canteen',     'Near the IT faculty',        7, 19, 'Chicken kottu',  '#E8492F'),
  ('main',   'Main canteen',   'Beside the library',         7, 16, 'Rice and curry', '#E09A12'),
  ('civil',  'Civil canteen',  'Civil faculty block',        7, 17, 'String hoppers', '#2F9E5B'),
  ('juice',  'Juice bar',      'Near the ground',            9, 18, 'Faluda',         '#D4537E'),
  ('hostel', 'Hostel canteen', 'Inside the hostel premises', 6, 22, 'Egg roti',       '#7F77DD');

insert into public.foods (canteen_id, name, price, created_by) values
  ('it', 'Chicken kottu', 450, null), ('it', 'Cheese kottu', 550, null),
  ('it', 'Egg fried rice', 380, null), ('it', 'Fish bun', 80, null),
  ('main', 'Rice and curry', 220, null), ('main', 'Veg rice and curry', 180, null),
  ('main', 'Parata with dhal', 150, null),
  ('civil', 'String hoppers', 200, null), ('civil', 'Pittu with curry', 190, null),
  ('civil', 'Wade', 50, null),
  ('juice', 'Faluda', 250, null), ('juice', 'Wood apple juice', 180, null),
  ('juice', 'Lime juice', 120, null),
  ('hostel', 'Egg roti', 120, null), ('hostel', 'Noodles', 300, null),
  ('hostel', 'Plain tea', 40, null);
