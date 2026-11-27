-- Campus canteen schedules in Colombo time.
update public.canteens
set opens_at = 6,
    closes_at = case when id in ('l-canteen', 'goda-uda-staff') then 17 else 21 end
where id in ('wala', 'goda', 'goda-uda', 'goda-uda-staff', 'wala-uda', 'l-canteen', 'civil', 'village');
