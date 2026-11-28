# MoraPlates

University of Moratuwa students rate canteen food, post what they ate and vote for a favourite canteen.
React + Vite, Supabase for auth, data and photo storage, and Google Maps with a Leaflet/OpenStreetMap fallback.
Guests can browse everything; posting, liking, commenting, voting, adding canteens, foods and photos need an @uom.lk account.

Features: feed with photo posts, likes and comments · canteen pages with photo slideshows, menus and one-tap voting ·
home slideshow of canteen photos · campus maps (students can add missing locations) ·
weekly podium and vote board · profiles with photos, stats and badges · a looping "friends eating" loader with food quotes.

`moraplates-handoff/website/index.html` is the visual source of truth. `src/styles/global.css` is its
stylesheet copied unchanged; build new screens from its existing class names rather than adding new styles.

## Run it

```sh
npm install
npm run dev
```

With no Supabase keys the app runs on the sample data from the handoff (`src/data/sample.js`).

## Configure Helena

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys). Set `GEMINI_API_KEY` in `app/.env.local` and restart Vite. On Vercel, set the same server environment variable and redeploy. The assistant requires an existing `@uom.lk` sign-in and uses the configured Supabase public canteen and menu views.

Tap **Helena**, the chef icon at the bottom right, to ask in English, Tamil, Sinhala, Tanglish, or romanized Sinhala. Helena follows the language of each question and remembers explicit language preferences in the current browser tab. The student's name stays in the browser and appears in greetings. Gemini interprets the question using up to eight relevant recent exchanges and public catalog labels. The server uses current Supabase records to write the answer.

## Configure Google Maps

Enable the Maps JavaScript API with billing in Google Cloud. Set `VITE_GOOGLE_MAPS_API_KEY` to a browser key restricted to the app's origins and the Maps JavaScript API. Set `VITE_GOOGLE_MAPS_MAP_ID` to a JavaScript map ID for the deployed app. The app uses Google's demo map ID during local testing when this value is empty. Rebuild after changing these variables. Without a working browser key, interactive maps use OpenStreetMap and canteen directions still open in Google Maps. [Google Maps setup](https://developers.google.com/maps/documentation/javascript/get-api-key)

## Connect Supabase

1. Create a project at supabase.com.
2. Run each file in `supabase/migrations/` in name order, then `supabase/seed.sql` (SQL editor, or `supabase db push` with the CLI).
3. Copy `.env.example` to `.env` and fill in the project URL and publishable (anon) key. Never commit `.env`.
4. Auth > URL configuration: add `http://localhost:5173` (and the live URL later) as redirect URLs. 
5. Sign-in is email + password. "Confirm email" is currently off; before launch turn it back on and set up
   custom SMTP (Auth > Emails), since Supabase's built-in email only reaches project team members.

## Rules the schema enforces

- Anyone can read. Only signed-in `@uom.lk` accounts can post, like, vote or add foods (`public.is_student()`).
- One vote per student per week, changeable or removable during that week. Weeks start Monday 08:00 Colombo time
  (`public.vote_week()`). Individual votes are private; `canteen_standings` exposes totals only.
- A post's food must belong to the canteen it is tagged with (composite foreign key).

## Layout

| Path | What |
| --- | --- |
| `src/pages/` | Feed (home), Welcome (sign-in), Canteens, Canteen, AddCanteen, Top, Profile |
| `src/components/` | Header, bottom bar, post card, comments, post dialog, OpenStreetMap view, icons |
| `src/lib/` | Supabase client, auth, photos, badges, sign-in gate, toast and confetti, card tilt |
| `src/data/` | All Supabase queries (`queries.js`), plus sample data used without Supabase |
| `supabase/` | Migrations (run in name order) and the seed with the real UoM canteens |


## Mobile social refresh

- Light-only, single-column feed; latest/liked filters, load more, author links and shareable post details.
- A card becomes seen after at least 40% is visible for 900 ms. The current feed does not remove it mid-scroll. On refresh seen posts are excluded; author profiles retain them, with older-post pagination. Signed-in history is stored privately in `post_views`; guests use a bounded local browser history. The feed's filters and Most liked sorting apply to the loaded pages.
- Profile search matches public display names, not private email addresses. Feed suggestions list recent public profiles.
- Photos are cropped client-side with portrait, square or landscape choices, zoom/pan and JPEG export; gallery and avatar crops use fixed ratios.
- Canteen links and map locations can be shared. **Closed today** lasts until Colombo midnight and **Opened** overrides the scheduled hours for up to 60 minutes. The latest report time stays visible after the override expires.
- Open any menu item to see its posts. Pin up to three canteens to move them to the top of the canteen list. Account pins follow the signed-in user across devices, and guest pins stay in the browser.
- Signed-in students can reply to comments and follow profiles. Four earned badges unlock the blue tick. The like button and a double-tap on a post give feedback on supported devices. Tall portraits display in a square over a blurred copy.
- Follow an author from the feed. Visitors can tap follower, following, and like counts to see the public profiles in each list. Tapping the bottom Feed tab scrolls to the top and refreshes the feed.
- The notification bell shows new follows and post likes for the signed-in recipient. Open a notification to mark it read or clear the unread count with **Mark all as read**. New activity appears through private Realtime signals, with refresh on return to the app and foreground polling as a fallback.
- Authors can edit their post's caption, rating, food, canteen and photo. Signed-in students can update any menu item's name and price, keeping existing posts and ratings linked.
- Approved content moderators use their regular sign-in to remove posts, post photos, comments, profile photos, and canteen content from the pages where it appears. Deleting a menu item also removes its posts and ratings. Deleting a canteen removes its menu, posts, photos, votes, pins and status reports.
- The admin console is protected by server-side RPC checks against `public.admin_users`. It manages canteens, foods, content moderation, profile display fields, likes, votes, gallery photos and closure reports. It deliberately does not provision login accounts or assign administrator roles from the browser.
- Administrators can see the university email and ban or unban an account from its public profile or from **Admin console → Accounts**. Bans block login and revoke existing sessions while preserving the account and its posts. Unbanning requires a fresh login. Administrator accounts are protected.

### Deployment order

1. Back up the existing database and test in a separate Supabase project. Apply pending migrations in filename order before deploying the frontend, including `20261128100000_content_moderation.sql` for moderation through the regular app.
2. Verify the administrator's existing account identity independently. In the trusted Supabase SQL editor, insert its verified Auth UUID:
   ```sql
   insert into public.admin_users(user_id) values ('<verified-auth-user-uuid>');
   ```
   To grant content moderation to a verified existing account, use its Auth UUID in the trusted Supabase SQL editor.
   ```sql
   insert into public.content_moderators(user_id) values ('<verified-auth-user-uuid>')
   on conflict do nothing;
   ```
3. Configure SPA fallback to `index.html` so direct /posts/:id, /u/:id and /canteens/:id links work.
4. Run `npm ci && npm test && npm run build` from app. For browser smoke tests, install Playwright locally (see tests README).
5. Confirm storage deletion in a disposable test project and review cascade behavior before allowing production admin deletions.

Database and Storage are separate systems. Deletion removes the row first, then attempts photo removal; a failed storage cleanup is reported rather than falsely claiming deletion of the file.

### Production hotfix: Vercel direct links and phased migrations

Vercel SPA rewrites are provided in `app/vercel.json` (recommended Vercel Root Directory: `app`) and repository-root `vercel.json` for root-based builds. A new deployment is required for these to take effect. The signed-in feed now retries its original posts query if only the optional `post_views` relationship/table is missing, preserving device-local seen history. This is not a replacement for applying the social and admin migrations. Apply only the pending new migrations, in order, on the existing project after backing up; do not reset or seed the live database.
