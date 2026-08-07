import { format, isToday, isYesterday } from 'date-fns'
import { arEG } from 'date-fns/locale'

function toDate(timestamp) {
  if (!timestamp) return null
  if (timestamp.toDate) return timestamp.toDate()
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000)
  return new Date(timestamp)
}

export function formatMessageTime(timestamp) {
  const date = toDate(timestamp)
  if (!date || isNaN(date.getTime())) return ''
  if (isToday(date)) return format(date, 'HH:mm', { locale: arEG })
  if (isYesterday(date)) return `أمس ${format(date, 'HH:mm', { locale: arEG })}`
  return format(date, 'dd/MM/yyyy HH:mm', { locale: arEG })
}

export function formatListTime(timestamp) {
  const date = toDate(timestamp)
  if (!date || isNaN(date.getTime())) return ''
  if (isToday(date)) return format(date, 'HH:mm', { locale: arEG })
  if (isYesterday(date)) return 'أمس'
  return format(date, 'dd/MM/yyyy', { locale: arEG })
}
