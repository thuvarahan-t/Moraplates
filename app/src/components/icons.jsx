// App icons, all from Lucide (https://lucide.dev) so strokes, corners and sizes match.
import {
  ArrowLeft, Camera, Check, ChevronRight, Clock, Crown, Flame, Heart, LocateFixed, Lock, LogOut,
  Mail, MapPin, Map as MapLucide, MessageCircle, Pencil, Plus, Search, Sparkles, Store, Trophy, UserRound,
  Trash2, Utensils, X,
} from 'lucide-react'

const icon = (Cmp, defaults = {}) => {
  const Wrapped = ({ size = defaults.size ?? 20, strokeWidth = defaults.strokeWidth ?? 2, className, style }) => (
    <Cmp size={size} strokeWidth={strokeWidth} className={'ic' + (className ? ' ' + className : '')} style={style} aria-hidden="true" />
  )
  Wrapped.displayName = Cmp.displayName
  return Wrapped
}

export const PlusIcon = icon(Plus, { size: 18, strokeWidth: 2.4 })
export const CheckIcon = icon(Check, { strokeWidth: 2.6 })
export const HeartIcon = icon(Heart)
export const BackIcon = icon(ArrowLeft, { size: 18 })
export const ChevronIcon = icon(ChevronRight, { size: 18 })
export const FlameIcon = icon(Flame, { size: 22 })
export const ClockIcon = icon(Clock, { size: 22 })
export const SparkIcon = icon(Sparkles, { size: 22 })
export const MailIcon = icon(Mail, { size: 22 })
export const CommentIcon = icon(MessageCircle)
export const PinIcon = icon(LocateFixed, { size: 18 })
export const LocationIcon = icon(MapPin, { size: 14 })
export const MapIcon = icon(MapLucide, { size: 18 })
export const UserIcon = icon(UserRound, { size: 22 })
export const CameraIcon = icon(Camera, { size: 28 })
export const SearchIcon = icon(Search, { size: 28 })
export const TrophyIcon = icon(Trophy, { size: 28 })
export const FeedIcon = icon(Utensils, { size: 24 })
export const StoreIcon = icon(Store, { size: 24 })
export const CloseIcon = icon(X)
export const LockIcon = icon(Lock)
export const CrownIcon = icon(Crown, { size: 34 })
export const LogOutIcon = icon(LogOut, { size: 18 })
export const TrashIcon = icon(Trash2, { size: 18 })
export const PencilIcon = icon(Pencil, { size: 16 })
