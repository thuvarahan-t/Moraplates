# MoraPlates design overview

Nov 26, 2026 · @Physics Cubee

## Overview

MoraPlates is a mobile app where University of Moratuwa students rate canteen food, post what they ate, and vote for one favourite canteen. The [design canvas](https://claude.ai/artifact/JCPzbxJFZoAe7tEHCmHsXC) has two parts:

- An animated logo board, 1200 × 675 px.
- Seven linked phone screens, 390 × 844 px each, all clickable in Play mode.

Every screen shares one look: cream background, maroon and tomato brand colours, rounded white cards, and a bottom bar with a raised "+" post button.

## Brand

The logo is a top-down plate whose food forms a three-part donut chart, so the mark itself stands for canteen votes. A fork and spoon sit on either side and steam rises above.

- Wordmark: "Mora" in maroon, "Plates" in tomato, Bricolage Grotesque 800 at 106 px.
- Tagline: "Rate it. Vote it. Eat it."
- Subline: "Every Mora canteen, rated by the students who eat there."

### Colours

| Colour | Hex | Used for |
| --- | --- | --- |
| Maroon | #6B1E2A | "Mora" wordmark, headings, primary buttons, active tab |
| Tomato | #E8492F | "Plates" wordmark, first food segment, vote bars |
| Mustard | #F2A922 | Second food segment, #1 rank badges, podium winner |
| Leaf green | #2F9E5B | Third food segment, Super rating, voted state |
| Cream | #FFF4E4 | Page background on every board |
| White | #FFFFFF | Cards, plate, inputs |

Ratings use three tinted chips: Super (green), Okay (mustard) and Avoid (red). All type is Bricolage Grotesque, weights 400 to 800.

### Logo animation

The animation runs once in about 3 seconds, then the steam keeps looping. A Replay button sits bottom right, and reduced-motion settings turn all motion off.

| Starts at | What happens |
| --- | --- |
| 0.1 s | Plate spins in and pops to size |
| 0.6 s | Inner rim draws around the plate |
| 0.85 to 1.5 s | Tomato, mustard and green segments fill in turn |
| 1.5 s | Fork and spoon slide in from the sides |
| 1.9 s | Centre dot pulses; wordmark letters bounce up one by one |
| 2.1 s | Steam starts rising, on a loop |
| 2.75 s | Tagline fades in |
| 3.0 s | Subline fades in |

## Screens

Seven screens cover the full loop: sign in, browse, rate, vote and check the rankings. Each is 390 × 844 px.

| # | Screen | What it shows | You can tap |
| --- | --- | --- | --- |
| 1 | Welcome | Logo, tagline, three value cards (see what's good, vote, post), "Only @uom.lk accounts" note | Continue with university email; Browse canteens first |
| 2 | Feed | "What's on your plate today?", today's hot plate card, filter chips (Today, All canteens, by canteen), post cards with photo, canteen tag, food, price, caption, rating and likes | Hot plate card, canteen tags, filter chips, like and comment |
| 3 | Canteens | Canteens ranked by weekly votes, each with rank, signature food, closing time and a vote bar; search box ("Where can I get kottu?"); Top voted, Open now and Cheapest chips | Any canteen card |
| 4 | Canteen page | Photo header, #1 this week badge, location and hours, stats (votes, % Super, posts today), favourite vote button, menu with price, post count and rating per food | Back, Vote as my favourite, Add food |
| 5 | New post | Canteen chips, food picker with "Add a new food", optional photo, Super / Okay / Avoid rating, caption box | Rating buttons, Post to feed, Close |
| 6 | Top this week | Podium of the top 3 canteens, top 3 dishes by % Super, top 3 foodies by plates posted | Podium canteens |
| 7 | Profile | Avatar, name, faculty and batch, a badge, stats (plates, canteens tried, likes), favourite canteen, grid of your plates | Change favourite, Settings |

## Navigation and interactions

The canteen page is the hub: all four tabs link into it, and posting always returns you to the feed.

&#91;embedded content: screen links in Play mode · 7 screens\]

The bottom bar sits on every tab screen and on the canteen page, so any screen reaches any tab in one tap. The canteen page also has a back link to Canteens, and New post has a close button back to the feed.

Three controls change state when tapped:

- Vote as my favourite (canteen page) switches to a green "Your favourite canteen" button and back.
- Super / Okay / Avoid (new post) highlights the chosen rating in its own colour.
- Replay (logo board) restarts the logo animation.

## Sample content and open items

All names, prices and numbers on the screens are placeholders, and need real data before build.

| What | Placeholder in the design |
| --- | --- |
| Canteens | IT canteen, Main canteen, Civil canteen, Juice bar, Hostel canteen |
| Foods and prices | Chicken kottu Rs 450, Cheese kottu Rs 550, Egg fried rice Rs 380, Fish bun Rs 80, Rice and curry, String hoppers, Faluda, Egg roti |
| Vote counts | 312, 268, 190, 145, 98 for this week |
| Students | Kavin S, Nila R, Amal M, Sahan P (profile owner) |
| Photos | Grey photo boxes on feed posts, the canteen header and the profile grid |

Open questions:

- [ ] Which canteens exist on campus, with their real locations and opening hours?
- [ ] Is sign-in limited to @uom.lk email accounts, as the Welcome screen says?
- [ ] When do weekly votes reset? The Top screen says Mondays at 8am.
- [ ] Which badges exist besides "Kottu king", and what earns each one?
- [ ] Can one student post the same food more than once a day?
