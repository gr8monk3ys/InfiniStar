import Link from "next/link"
import clsx from "clsx"
import type { IconType } from "react-icons"

interface MobileItemProps {
  href: string
  icon: IconType
  active?: boolean
  onClick?: () => void
}

const MobileItem: React.FC<MobileItemProps> = ({ href, icon: Icon, active, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      return onClick()
    }
  }

  return (
    <Link
      onClick={handleClick}
      href={href}
      className={clsx(
        `
        group
        flex
        gap-x-3
        text-sm
        leading-6
        font-semibold
        w-full
        justify-center
        p-4
        text-muted-foreground
        hover:text-foreground
        hover:bg-accent
      `,
        active && "bg-accent text-foreground"
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </Link>
  )
}

export default MobileItem
