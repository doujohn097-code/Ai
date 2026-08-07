import { format, isToday } from 'date-fns'
import { arEG } from 'date-fns/locale'

function toDate(value) {
  if (!value) return null
  if (value.toDate) return value.toDate()
  if (value.seconds) return new Date(value.seconds * 1000)
  return new Date(value)
}

export function formatActiveStatus({ online, lastSeen }) {
  if (online) return 'نشط الآن'
  const date = toDate(lastSeen)
  if (!date || isNaN(date.getTime())) return ''
  const diffSec = (Date.now() - date.getTime()) / 1000
  if (diffSec < 60) return 'نشط للتو'
  if (diffSec < 3600) return `نشط منذ ${Math.floor(diffSec / 60)} دقيقة`
  if (isToday(date)) return `نشط الساعة ${format(date, 'HH:mm', { locale: arEG })}`
  return `نشط ${format(date, 'dd/MM/yyyy', { locale: arEG })}`
}
