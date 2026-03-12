"use client"

import dynamic from "next/dynamic"

const CookieBanner = dynamic(
  () => import("@/app/components/CookieBanner").then((module) => module.CookieBanner),
  { ssr: false }
)
const ServiceWorkerRegister = dynamic(
  () =>
    import("@/app/components/pwa/ServiceWorkerRegister").then(
      (module) => module.ServiceWorkerRegister
    ),
  { ssr: false }
)
const ToasterContext = dynamic(() => import("@/app/context/ToasterContext"), { ssr: false })

export function ClientShell() {
  return (
    <>
      <ToasterContext />
      <ServiceWorkerRegister />
      <CookieBanner />
    </>
  )
}
