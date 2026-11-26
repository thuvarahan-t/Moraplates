// Sample content copied from moraplates-handoff/website/index.html.
// Used when no Supabase project is configured. All of it is placeholder data.

export const SAMPLE_CANTEENS = [
  { id: 'it', name: 'IT canteen', location: 'Near the IT faculty', opensAt: 7, closesAt: 19, knownFor: 'Chicken kottu', votes: 312, colour: '#E8492F' },
  { id: 'main', name: 'Main canteen', location: 'Beside the library', opensAt: 7, closesAt: 16, knownFor: 'Rice and curry', votes: 268, colour: '#E09A12' },
  { id: 'civil', name: 'Civil canteen', location: 'Civil faculty block', opensAt: 7, closesAt: 17, knownFor: 'String hoppers', votes: 190, colour: '#2F9E5B' },
  { id: 'juice', name: 'Juice bar', location: 'Near the ground', opensAt: 9, closesAt: 18, knownFor: 'Faluda', votes: 145, colour: '#D4537E' },
  { id: 'hostel', name: 'Hostel canteen', location: 'Inside the hostel premises', opensAt: 6, closesAt: 22, knownFor: 'Egg roti', votes: 98, colour: '#7F77DD' },
]

export const SAMPLE_FOODS = [
  ['kottu', 'it', 'Chicken kottu', 450, 114, 8, 2], ['ckottu', 'it', 'Cheese kottu', 550, 53, 6, 2],
  ['efr', 'it', 'Egg fried rice', 380, 15, 30, 2], ['fbun', 'it', 'Fish bun', 80, 5, 6, 11],
  ['rc', 'main', 'Rice and curry', 220, 70, 40, 10], ['vrc', 'main', 'Veg rice and curry', 180, 40, 22, 6],
  ['par', 'main', 'Parata with dhal', 150, 30, 12, 3],
  ['sh', 'civil', 'String hoppers', 200, 55, 8, 2], ['pit', 'civil', 'Pittu with curry', 190, 20, 14, 5],
  ['wade', 'civil', 'Wade', 50, 25, 10, 4],
  ['fal', 'juice', 'Faluda', 250, 72, 6, 2], ['wood', 'juice', 'Wood apple juice', 180, 30, 10, 3],
  ['lime', 'juice', 'Lime juice', 120, 18, 12, 6],
  ['eroti', 'hostel', 'Egg roti', 120, 40, 10, 4], ['nood', 'hostel', 'Noodles', 300, 14, 16, 9],
  ['tea', 'hostel', 'Plain tea', 40, 22, 20, 5],
].map(([id, canteenId, name, price, superCount, okayCount, avoidCount]) => ({ id, canteenId, name, price, superCount, okayCount, avoidCount }))

export const SAMPLE_PLATES_TODAY = 38

// [author, faculty, canteen, food id, rating, caption, likes, minutes ago]
export const SAMPLE_POSTS = [
  [1, 'Kavin S', 'IT', 'it', 'kottu', 'super', 'Spice level perfect, portion huge. Worth every rupee after a 4-hour lab.', 24, 12],
  [2, 'Nila R', 'Civil', 'main', 'rc', 'okay', 'Dhal was great, chicken curry a bit cold by 1pm. Go early.', 9, 40],
  [3, 'Amal M', 'Mechanical', 'juice', 'fal', 'super', 'Faluda after a lab hits different. Not too sweet today.', 31, 65],
  [4, 'Dinu W', 'Electrical', 'civil', 'sh', 'super', 'String hoppers with kiri hodi, still hot at 7.30am.', 17, 95],
  [5, 'Sahan P', 'IT', 'it', 'fbun', 'avoid', 'Fish bun was mostly bun today. Skip it.', 6, 130],
  [6, 'Riya K', 'Architecture', 'hostel', 'eroti', 'super', 'Egg roti with lunu miris at 9pm saved my assignment night.', 22, 180],
  [7, 'Sahan P', 'IT', 'it', 'ckottu', 'super', 'Cheese kottu, extra cheese, zero regrets.', 14, 1500],
]

export const SAMPLE_ME = { id: 'sample', fullName: 'Sahan P', faculty: 'IT faculty', batch: 'Batch 22' }
