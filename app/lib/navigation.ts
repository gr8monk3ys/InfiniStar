export function navigateTo(url: string): void {
  if (typeof window === "undefined") {
    return
  }

  window.location.assign(url)
}
