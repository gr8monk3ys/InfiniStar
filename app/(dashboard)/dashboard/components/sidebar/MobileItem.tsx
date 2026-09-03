import Link from "next/link"
import clsx from "clsx"
import type { IconType } from "react-icons"

interface MobileItemProps {
  label: string
  href: string
  icon: IconType
  active?: boolean
  onClick?: () => void
  /** Draws a hairline on the leading edge, used to set Logout apart from the nav items. */
  separated?: boolean
}

const MobileItem: React.FC<MobileItemProps> = ({
  label,
  href,
  icon: Icon,
  active,
  onClick,
  separated,
}) => {
  const handleClick = () => {
    if (onClick) {
      return onClick()
    }
  }

  return (
    <Link
      onClick={handleClick}
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        `
        group
        flex
        w-full
        flex-col
        items-center
        justify-center
        gap-y-1
        px-1
        py-2.5
        font-medium
        leading-6
        text-muted-foreground
        hover:bg-accent
        hover:text-foreground
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-inset
        focus-visible:ring-ring
      `,
        separated && "border-l border-border",
        active && "bg-accent text-foreground"
      )}
    >
      <Icon className="size-6 shrink-0" aria-hidden="true" />
      <span className="max-w-full truncate text-xs leading-none">{label}</span>
    </Link>
  )
}

export default MobileItem
