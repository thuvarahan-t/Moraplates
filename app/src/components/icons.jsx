// App icons use consistent Lucide strokes, corners and sizes.
import {
  ArrowLeft, Camera, Check, ChefHat, ChevronDown, ChevronRight, Clock, Crown, Flame, Heart, LocateFixed, Lock, LogOut,
  Mail, MapPin, Map as MapLucide, MessageCircle, Pencil, Plus, Search, Sparkles, Store, Trophy, UserRound,
  Trash2, Utensils, X, Download, Share, SquarePlus, RefreshCw,
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
export const ChevronDownIcon = icon(ChevronDown, { size: 20 })
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
export function PasswordPlateIcon({ open = false }) {
  return (
    <svg className="ic password-plate" data-open={open} width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 18.5h18M5 18.5l1.5 2h11l1.5-2" />
      <g className="password-plate-lid">
        <path d="M4.5 18.5a7.5 7.5 0 0 1 15 0Z" />
        <path d="M10.7 11.1v-1a1.3 1.3 0 0 1 2.6 0v1" />
      </g>
    </svg>
  )
}
export const CrownIcon = icon(Crown, { size: 34 })
export const LogOutIcon = icon(LogOut, { size: 18 })
export const TrashIcon = icon(Trash2, { size: 18 })
export const PencilIcon = icon(Pencil, { size: 16 })
export const ChefHatIcon = icon(ChefHat, { size: 18 })
export const ForkKnifeIcon = icon(Utensils, { size: 18 })
export const DownloadIcon = icon(Download, { size: 18 })
export const ShareIcon = icon(Share, { size: 16 })
export const AddSquareIcon = icon(SquarePlus, { size: 16 })
export const RefreshIcon = icon(RefreshCw, { size: 18 })
