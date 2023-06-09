"use client"

import Link from "next/link"

import { AspectRatio } from "@/components/ui/aspect-ratio"

const characters = [
  // List of characters here.
  {
    name: "Character 1",
    image: "/path/to/image1.jpg",
    chatLink: "/chat/character1",
  },
  {
    name: "Character 2",
    image: "/path/to/image2.jpg",
    chatLink: "/chat/character2",
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
                <img
                  src={character.image}
                  alt={character.name}
                  className="h-full w-full rounded-lg object-cover"
                />
              </AspectRatio>
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black bg-opacity-10 transition duration-200 group-hover:bg-opacity-25">
                <span className="font-bold text-white">{character.name}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
