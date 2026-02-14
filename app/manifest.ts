import { type MetadataRoute } from "next"

import { siteConfig } from "@/config/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: "InfiniStar",
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#09090B",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
