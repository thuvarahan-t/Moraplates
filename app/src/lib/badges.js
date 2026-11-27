// Badge rules. Each one reads a count from the profile_stats view.
// [id, name, how to earn it, stat, goal, colour pair]

export const BADGES = [
  ['first', 'First plate', 'Post your first plate', 'plates', 1, 'leaf'],
  ['regular', 'Regular', 'Post 25 plates', 'plates', 25, 'mus'],
  ['kottu', 'Kottu king', 'Post 10 kottu plates', 'kottu_plates', 10, 'mus'],
  ['explorer', 'Canteen explorer', 'Post from 5 different canteens', 'canteens_tried', 5, 'tom'],
  ['early', 'Early bird', 'Post a plate before 8am', 'early_plates', 1, 'leaf'],
  ['night', 'Night owl', 'Post a plate after 9pm', 'night_plates', 1, 'tom'],
  ['loved', 'Crowd favourite', 'Get 50 likes on your plates', 'likes_received', 50, 'tom'],
  ['chatty', 'Table talker', 'Leave 20 comments', 'comments_made', 20, 'mus'],
  ['menu', 'Menu helper', 'Add 5 foods to canteen menus', 'foods_added', 5, 'leaf'],
  ['mapper', 'Map maker', 'Add a canteen to the map', 'canteens_added', 1, 'leaf'],
].map(([id, name, how, stat, goal, tone]) => ({ id, name, how, stat, goal, tone }))

/** Badges with progress for one profile_stats row. */
export const badgesFor = stats =>
  BADGES.map(b => {
    const have = stats?.[b.stat] ?? 0
    return { ...b, have: Math.min(have, b.goal), earned: have >= b.goal }
  })

export const VERIFIED_BADGE_COUNT = 4
export const isVerifiedProfile = stats => badgesFor(stats).filter(badge => badge.earned).length >= VERIFIED_BADGE_COUNT
