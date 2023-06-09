'use client'
import Link from 'next/link'
import { AspectRatio } from "@/components/ui/aspect-ratio"

const characters = [
  // List of characters here.
  { name: 'Character 1', image: '/path/to/image1.jpg', chatLink: '/chat/character1' },
  { name: 'Character 2', image: '/path/to/image2.jpg', chatLink: '/chat/character2' },
  // ...
]

export default function ExplorePage() {
  return (
    <section className="p-4 grid grid-cols-5 gap-4">
      {characters.map((character) => (
        <Link key={character.name} href={character.chatLink} passHref>
          <div className="group relative overflow-hidden cursor-pointer rounded-lg">
            <AspectRatio>
              <img src={character.image} alt={character.name} className="object-cover w-full h-full rounded-lg" />
            </AspectRatio>
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 group-hover:bg-opacity-25 transition duration-200 rounded-lg">
              <span className="text-white font-bold">{character.name}</span>
            </div>
          </div>
        </Link>
      ))}
    </section>
  )
}
