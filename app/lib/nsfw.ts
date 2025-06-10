export function canAccessNsfw(
  user:
    | {
        isAdult?: boolean | null
        nsfwEnabled?: boolean | null
        adultConfirmedAt?: Date | null
      }
    | null
    | undefined
): boolean {
  return Boolean(user?.isAdult && user?.nsfwEnabled && user?.adultConfirmedAt)
}
