/** Partes de fecha/hora en una zona IANA (ej. Europe/Madrid). */
export function localStampInZone(
  timeZone: string,
  date = new Date(),
): { localDate: string; localTime: string } {
  const zone = timeZone || 'Europe/Madrid';
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;

    let hour = parts.hour || '00';
    if (hour === '24') hour = '00';

    return {
      localDate: `${parts.year}-${parts.month}-${parts.day}`,
      localTime: `${hour.padStart(2, '0')}:${(parts.minute || '00').padStart(2, '0')}`,
    };
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return { localDate: `${y}-${m}-${d}`, localTime: `${hh}:${mm}` };
  }
}

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
