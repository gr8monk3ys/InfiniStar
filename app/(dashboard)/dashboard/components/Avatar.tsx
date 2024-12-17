'use client';

import { User } from "@prisma/client";

import useActiveList from "../hooks/useActiveList";
import Image from "next/image";

interface AvatarProps {
  user?: User;
};

const Avatar: React.FC<AvatarProps> = ({ user }) => {
  const { members } = useActiveList();
  const isActive = members.indexOf(user?.email!) !== -1;

  return (
    <div className="relative">
      <div className="relative inline-block size-9 overflow-hidden rounded-full md:size-11">
        <Image
          fill
          src={user?.image || '/images/placeholder.jpg'}
          alt="Avatar"
          className="object-cover"
        />
      </div>
      {isActive ? (
        <span className="absolute right-0 top-0 block size-2 rounded-full bg-green-500 ring-2 ring-white md:size-3" />
      ) : null}
    </div>
  );
}

export default Avatar;
