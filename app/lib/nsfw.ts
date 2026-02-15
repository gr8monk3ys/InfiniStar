export function canAccessNsfw(
  user: { isAdult?: boolean | null; nsfwEnabled?: boolean | null } | null | undefined
): boolean {
  return Boolean(user?.isAdult && user?.nsfwEnabled)
}
