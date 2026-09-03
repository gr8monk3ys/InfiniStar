import Link from "next/link"
import clsx from "clsx"
import type { IconType } from "react-icons"

interface DesktopItemProps {
  label: string
  icon: IconType
  href: string
  onClick?: () => void
  active?: boolean
}

const DesktopItem: React.FC<DesktopItemProps> = ({ label, href, icon: Icon, active, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      return onClick()
    }
  }

  return (
    <li onClick={handleClick} key={label}>
      <Link
        href={href}
        className={clsx(
          `
            group
            flex
            w-16
            flex-col
            items-center
            gap-y-1
            rounded-md
            px-2
            py-2.5
            font-medium
            text-muted-foreground
            hover:text-foreground
            hover:bg-accent
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-ring
            focus-visible:ring-offset-2
          `,
          active && "bg-accent text-foreground"
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="size-6 shrink-0" aria-hidden="true" />
        <span className="text-xs leading-none">{label}</span>
      </Link>
    </li>
  )
}

export default DesktopItem
