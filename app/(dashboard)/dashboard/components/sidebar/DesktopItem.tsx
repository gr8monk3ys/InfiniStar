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
            gap-x-3 
            rounded-md 
            p-3 
            text-sm 
            leading-6 
            font-semibold 
            text-gray-500 
            hover:text-black 
            hover:bg-gray-100
          `,
          active && "bg-gray-100 text-black"
        )}
      >
        <Icon className="size-6 shrink-0" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </Link>
    </li>
  )
}

export default DesktopItem
