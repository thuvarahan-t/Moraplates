# MoraPlates

University of Moratuwa students rate canteen food, post what they ate and vote for a favourite canteen.
React + Vite, Supabase for auth, data and photo storage, Leaflet + OpenStreetMap for maps.
Guests can browse everything; posting, liking, commenting, voting, adding canteens, foods and photos need an @uom.lk account.

Features: feed with photo posts, likes and comments · canteen pages with photo slideshows, menus and one-tap voting ·
home banner of canteen photos · OpenStreetMap pins (students pin canteens that aren't on the map yet) ·
weekly podium and vote board · profiles with photos, stats and badges · a looping "friends eating" loader with food quotes.

`moraplates-handoff/website/index.html` is the visual source of truth. `src/styles/global.css` is its
stylesheet copied unchanged; build new screens from its existing class names rather than adding new styles.

## Run it

```sh
npm install
npm run dev
```

With no Supabase keys the app runs on the sample data from the handoff (`src/data/sample.js`).

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
- Canteen links and map pins can be shared. Community closure reports last 60 minutes and are labelled as reports, not verified opening hours. The reporter can withdraw their own report; scheduled opening hours are evaluated in Colombo time.
- The admin console is protected by server-side RPC checks against `public.admin_users`. It manages canteens, foods, content moderation, profile display fields, likes, votes, gallery photos and closure reports. It deliberately does not provision login accounts or assign administrator roles from the browser.

### Deployment order

1. Back up the existing database and test in a separate Supabase project. Apply the two new migrations in filename order (social refresh, admin console) before deploying the frontend. Do not rerun historical destructive migrations on a live database.
2. Verify the administrator's existing account identity independently. In the trusted Supabase SQL editor, insert its verified Auth UUID:
   ```sql
   insert into public.admin_users(user_id) values ('<verified-auth-user-uuid>');
   ```
   Do not grant admin based on an unverified university email. The known email/password confirmation issue is intentionally unchanged; fix it before public production release.
3. Configure SPA fallback to `index.html` so direct /posts/:id, /u/:id and /canteens/:id links work.
4. Run `npm ci && npm test && npm run build` from app. For browser smoke tests, install Playwright locally (see tests README).
5. Confirm storage deletion in a disposable test project and review cascade behavior before allowing production admin deletions.

Database and Storage are separate systems. Deletion removes the row first, then attempts photo removal; a failed storage cleanup is reported rather than falsely claiming deletion of the file.
