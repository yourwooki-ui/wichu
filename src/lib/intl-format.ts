export function formatNumber(locale: string, value: number) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(locale: string, value: Date) {
  if (Number.isNaN(value.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

export function formatDateTime(locale: string, value: Date) {
  if (Number.isNaN(value.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value);
  } catch {
    return value.toISOString().replace('T', ' ').slice(0, 16);
  }
}
