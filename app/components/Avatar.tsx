import { User } from "@prisma/client";
import Image from "next/image";
import { FC } from "react";

interface AvatarProps {
  user?: User;
  className?: string;
}

const Avatar: FC<AvatarProps> = ({ user, className }) => {
  return (
    <div className={`relative rounded-full overflow-hidden h-11 w-11 ${className}`}>
      <Image
        fill
        src={user?.image || '/placeholder.jpg'}
        alt="Avatar"
        className="object-cover"
      />
    </div>
  );
};

export default Avatar;
