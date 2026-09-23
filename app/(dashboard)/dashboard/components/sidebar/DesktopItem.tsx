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

const ITEM_CLASS = `
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
`

const DesktopItem: React.FC<DesktopItemProps> = ({ label, href, icon: Icon, active, onClick }) => {
  const content = (
    <>
      <Icon className="size-6 shrink-0" aria-hidden="true" />
      <span className="text-xs leading-none">{label}</span>
    </>
  )

  return (
    <li>
      {onClick ? (
        // An action (e.g. Logout), not a navigation: a real button.
        <button type="button" onClick={onClick} className={ITEM_CLASS}>
          {content}
        </button>
      ) : (
        <Link
          href={href}
          className={clsx(ITEM_CLASS, active && "bg-accent text-foreground")}
          aria-current={active ? "page" : undefined}
        >
          {content}
        </Link>
      )}
    </li>
  )
}

export default DesktopItem
