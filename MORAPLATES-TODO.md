# MoraPlates update checklist

## Canteens

- [x] Show **Closed today** or **Opened** after a canteen status report and display when it was last reported in Colombo time.
- [x] Let admins choose a canteen’s primary gallery photo for the canteen page, cards and home slideshow.
- [x] Let admins customize daily opening and closing times to the minute.
- [x] Restore the canteen slideshow above the main feed.
- [x] Integrate Google Maps for canteen locations, location picking and walking directions.
- [x] Open a food-specific list of posts from a canteen menu item.
- [x] Let each user pin up to three canteens. Account pins sync across devices and guest pins are stored in the browser.

## Social and interaction

- [x] Add replies to post comments.
- [x] Add follow and unfollow on public profiles.
- [x] Display a blue tick after four earned badges.
- [x] Add a subtle looping animation to the MoraPlates header text.
- [x] Let users hold and drag across mobile navigation tabs, then release to switch.
- [x] Add a short sound on likes and subtle haptics on supported devices.
- [x] Let users double-tap a post to like it.
- [x] Preserve 1:1, 4:5, 3:4 and 16:9 post photos. Center a full 9:16 or similarly tall photo in a square over a blurred copy.

## Post and food edits

- [x] Let authors edit their own post's caption, rating, canteen, food and photo.
- [x] Let any signed-in student update a menu item's name and price from the canteen menu or food page.
- [x] Verify both edit flows in mobile Chromium with signed-in API fixtures and check permissions in isolated PostgreSQL.

## Verification

- [x] Run the production build and all 23 unit tests.
- [x] Run all 21 Chromium browser tests and exercise signed-in flows and Google Maps with local API fixtures.
- [x] Verify the migration chain, authorization and write behavior in disposable PostgreSQL with Supabase auth and storage stand-ins.

## Production rollout

- [ ] Apply pending migrations to the live Supabase project in filename order, including the post and food edit migration.
- [ ] Configure the deployed Google Maps browser key and map ID, then deploy the frontend. OpenStreetMap is available without credentials.

See the [app README](app/README.md) for configuration and deployment details.
