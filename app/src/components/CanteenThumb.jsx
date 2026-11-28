import Dish from './Dish'
import ContentPhoto from './ContentPhoto'

/** Small square canteen picture, with the selected cover taking priority over the newest photo. */
export default function CanteenThumb({ canteen, photo, size = 76 }) {
  const cover = canteen.primaryPhoto ?? photo
  return (
    <span className="cthumb" style={{ width: size, height: size }}>
      {cover
        ? <ContentPhoto src={cover.url} alt="" loading="lazy" />
        : <Dish name={canteen.knownFor || canteen.name} colour={canteen.colour} />}
    </span>
  )
}

/** Newest photo per canteen id from a fetchCanteenPhotos() list (already newest first). */
export function firstPhotoByCanteen(photos) {
  const map = {}
  for (const p of photos ?? []) if (!map[p.canteenId]) map[p.canteenId] = p
  return map
}
