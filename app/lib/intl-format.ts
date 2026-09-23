/**
 * Locale-aware date and number formatting.
 *
 * Every user-visible date, time or count goes through `Intl` here instead of a
 * hardcoded pattern ("MMM d, yyyy", "en-US"), so it reads naturally in the
 * viewer's locale. `locale` defaults to `undefined`, which is the browser's
 * language on the client and the runtime default on the server.
 *
 * Formatters are expensive to construct, so each one is built once per
 * locale + options pair and reused.
 *
 * Rendering a date during SSR and again on the client can differ (server time
 * zone and locale are not the viewer's). Put `suppressHydrationWarning` on the
 * element that renders the formatted value.
 */

type DateInput = Date | string | number

const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const numberFormatters = new Map<string, Intl.NumberFormat>()
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>()

function cacheKey(locale: string | undefined, options: object): string {
  return `${locale ?? ""}|${JSON.stringify(options)}`
}

function getDateFormatter(
  options: Intl.DateTimeFormatOptions,
  locale?: string
): Intl.DateTimeFormat {
  const key = cacheKey(locale, options)
  let formatter = dateFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    dateFormatters.set(key, formatter)
  }
  return formatter
}

function getNumberFormatter(options: Intl.NumberFormatOptions, locale?: string): Intl.NumberFormat {
  const key = cacheKey(locale, options)
  let formatter = numberFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    numberFormatters.set(key, formatter)
  }
  return formatter
}

function getRelativeFormatter(locale?: string): Intl.RelativeTimeFormat {
  const key = locale ?? ""
  let formatter = relativeFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    relativeFormatters.set(key, formatter)
  }
  return formatter
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/** "Sep 23, 2026" by default; pass options for other shapes. */
export function formatDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale?: string
): string {
  return getDateFormatter(options, locale).format(toDate(value))
}

/** "Sep 23, 2026, 4:05 PM" */
export function formatDateTime(value: DateInput, locale?: string): string {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" }, locale)
}

/** "4:05 PM" */
export function formatTime(value: DateInput, locale?: string): string {
  return formatDate(value, { timeStyle: "short" }, locale)
}

/** "1,234" */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale?: string
): string {
  return getNumberFormatter(options, locale).format(value)
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
]

/** "3 hours ago", "in 2 days", "now" */
export function formatRelative(value: DateInput, now: DateInput = Date.now(), locale?: string) {
  const diff = toDate(value).getTime() - toDate(now).getTime()
  const formatter = getRelativeFormatter(locale)
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }
  return formatter.format(Math.round(diff / 1000), "second")
}
