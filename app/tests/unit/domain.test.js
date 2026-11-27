import test from 'node:test'
import assert from 'node:assert/strict'
import {cropRect} from '../../src/lib/crop.js'
import {canteenStatusLabel,homeCanteenSlides,hourLabel,isOpen,isReportedClosed,isReportedOpen,lastReportLabel,withPrimaryPhoto} from '../../src/lib/food.js'
import {applyVote} from '../../src/lib/vote.js'
import {readSeen,rememberSeen} from '../../src/lib/seen.js'

test('crop is centered, bounded and respects selected aspect ratio',()=>{
  assert.deepEqual(cropRect(1200,800,1),{x:200,y:0,width:800,height:800})
  const r=cropRect(800,1200,.8,2,1,0)
  assert.equal(r.width/r.height,.8)
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=800&&r.y+r.height<=1200)
  assert.equal(cropRect(100,100,1,99,-1,4).x,0)
  assert.throws(()=>cropRect(0,0,1))
})
test('opening hours use Colombo time and temporary reports expire',()=>{
  const at=Date.parse('2026-11-27T04:30:00Z')
  const c={opensAt:7,closesAt:18}
  assert.equal(isOpen(c,at),true)
  assert.equal(isOpen(c,Date.parse('2026-11-27T12:30:00Z')),false)
  const reported={...c,closedUntil:new Date(at+60000).toISOString()}
  assert.equal(isReportedClosed(reported,at),true)
  assert.equal(isOpen(reported,at),false)
  assert.equal(isOpen(reported,at+60001),true)
})
test('a reopening report overrides scheduled hours until it expires', () => {
  const afterHours = Date.parse('2026-11-27T12:30:00Z')
  const expiry = afterHours + 60 * 60_000
  const canteen = { opensAt: 6, closesAt: 17, openUntil: new Date(expiry).toISOString() }
  assert.equal(isReportedOpen(canteen, afterHours), true)
  assert.equal(isOpen(canteen, afterHours), true)
  assert.equal(isReportedOpen(canteen, expiry), false)
  assert.equal(isOpen(canteen, expiry), false)
  assert.equal(isOpen({ ...canteen, closedUntil: canteen.openUntil }, afterHours), false)
})
test('custom canteen schedules start and end on their configured minute', () => {
  const canteen = { opensAt: 6.5, closesAt: 6.75 }
  const at = time => Date.parse(`2026-11-27T${time}Z`)
  assert.equal(isOpen(canteen, at('00:59:00')), false)
  assert.equal(isOpen(canteen, at('01:00:00')), true)
  assert.equal(isOpen(canteen, at('01:15:00')), false)
  assert.equal(hourLabel(canteen.opensAt), '6:30am')
})
test('day-long closure and reopening labels show the latest report in Colombo time', () => {
  const report = '2026-11-27T01:00:00Z'
  const end = '2026-11-27T18:30:00Z'
  const now = Date.parse(report)
  const closed = { opensAt: 6, closesAt: 17, closedUntil: end, closedTodayUntil: end, lastReportedStatus: 'closed', lastReportedAt: report }
  assert.equal(canteenStatusLabel(closed, now), 'Closed today')
  assert.match(lastReportLabel(closed), /Last reported closed on .*6:30.*Colombo time/)
  assert.equal(canteenStatusLabel(closed, Date.parse(end)), 'Closed')
  const opened = { opensAt: 6, closesAt: 17, openUntil: end, lastReportedStatus: 'open', lastReportedAt: report }
  assert.equal(canteenStatusLabel(opened, now), 'Opened')
  assert.match(lastReportLabel(opened), /Last reported open on .*6:30.*Colombo time/)
})
test('the primary photo leads a canteen gallery even when omitted from the newest photos', () => {
  const primaryPhoto = { id: 'selected' }
  const recent = { id: 'recent' }
  assert.deepEqual(withPrimaryPhoto({ primaryPhoto }, [recent]), [primaryPhoto, recent])
  assert.deepEqual(withPrimaryPhoto({ primaryPhoto }, [recent, primaryPhoto]), [primaryPhoto, recent])
})
test('home canteen slides use up to five recent photos and skip canteens without photos', () => {
  const gallery = Array.from({ length: 6 }, (_, index) => ({
    id: `photo-${index + 1}`, canteenId: 'busy', url: `/photo-${index + 1}.jpg`,
  }))
  const canteens = [
    { id: 'empty', votes: 20 },
    { id: 'legacy', votes: 5, photo: '/legacy.jpg' },
    { id: 'busy', votes: 10, primaryPhoto: gallery.at(-1) },
  ]
  const summarize = slides => slides.map(({ canteen, photo }) => [canteen.id, photo.id])
  assert.deepEqual(summarize(homeCanteenSlides(canteens, gallery)), [
    ['busy', 'photo-1'], ['busy', 'photo-2'], ['busy', 'photo-3'], ['busy', 'photo-4'], ['busy', 'photo-5'], ['legacy', 'legacy'],
  ])
  canteens[2].primaryPhoto = gallery[2]
  assert.deepEqual(homeCanteenSlides(canteens, gallery)[0].photo, gallery[2])
  assert.deepEqual(homeCanteenSlides([canteens[0]]), [])
})
test('switching or removing one vote preserves counts and input',()=>{
  const c=[{id:'a',votes:2},{id:'b',votes:3}]
  assert.deepEqual(applyVote(c,'a','b').map(x=>x.votes),[1,4])
  assert.deepEqual(applyVote(c,'a',null).map(x=>x.votes),[1,3])
  assert.deepEqual(applyVote(c,null,'b').map(x=>x.votes),[2,4])
  assert.deepEqual(c.map(x=>x.votes),[2,3])
  assert.equal(applyVote([{id:'a',votes:0}],'a',null)[0].votes,0)
})
test('seen history is durable, deduplicated and scoped per user',()=>{
  const store=new Map()
  globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}
  rememberSeen('a',1);rememberSeen('a','1');rememberSeen('b',2)
  assert.deepEqual([...readSeen('a')],['1'])
  assert.deepEqual([...readSeen('b')],['2'])
  assert.equal(readSeen().size,0)
  delete globalThis.localStorage
})
