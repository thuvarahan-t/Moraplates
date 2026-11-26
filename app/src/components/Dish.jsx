// CSS plate illustration (dish() and pal() in index.html), coloured by food type.

const palette = name =>
  /kottu/i.test(name) ? ['#B5652B', '#E9B44C', '#4E8F3A']
  : /rice/i.test(name) ? ['#F3E4C8', '#F2A922', '#C23A22']
  : /hopper|pittu|roti|parata|bun|wade/i.test(name) ? ['#E8C9A0', '#C9853A', '#E8492F']
  : /faluda|juice|tea/i.test(name) ? ['#F4A7C0', '#E7C27A', '#D4537E']
  : /noodle/i.test(name) ? ['#E9B44C', '#C23A22', '#4E8F3A']
  : ['#E8492F', '#F2A922', '#2F9E5B']

export default function Dish({ name, colour }) {
  const [a, b, c] = palette(name)
  return (
    <div className="dish" style={{ '--a': a, '--b': b, '--c': c, '--cc': colour }} role="img" aria-label={`${name} illustration`}>
      <i />
    </div>
  )
}
