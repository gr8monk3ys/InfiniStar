"use client"

import Image from "next/image"
import Link from "next/link"

import { AspectRatio } from "@/app/components/ui/aspect-ratio"

const characters = [
  {
    name: "Waifu 1",
    image: "/../public/images/waifu1.png",
    chatLink: "/chat/waifu1",
    width: 500,
    height: 500,
  },
  {
    name: "Waifu 2",
    image: "/../public/images/waifu2.png",
    chatLink: "/chat/waifu2",
    width: 500,
    height: 500,
  },
  // ...
]

export default function ExplorePage() {
  return (
    <section className="flex h-screen flex-col p-4">
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Explore <br className="hidden sm:inline" />
        </h1>
      </div>
      <div className="grid grid-cols-5 gap-4 p-4">
        {characters.map((character) => (
          <Link key={character.name} href={character.chatLink} passHref>
            <div className="group relative cursor-pointer overflow-hidden rounded-lg">
              <AspectRatio>
                <Image
                  src={character.image}
                  alt={character.name}
                  width={character.width}
                  height={character.height}
                  className="h-full w-full rounded-lg object-cover"
                />
              </AspectRatio>
              <div className="group-hover:/25 absolute inset-0 flex items-center justify-center rounded-lg bg-black/10 transition duration-200">
                <span className="font-bold text-white">{character.name}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
