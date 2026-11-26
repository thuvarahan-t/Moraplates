import Dish from './Dish'

/** Small square canteen picture: its newest photo, or the plate illustration until someone adds one. */
export default function CanteenThumb({ canteen, photo, size = 76 }) {
  return (
    <span className="cthumb" style={{ width: size, height: size }}>
      {photo
        ? <img src={photo.url} alt="" loading="lazy" />
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
