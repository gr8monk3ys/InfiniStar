import Link from "next/link"

import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"

export default function IndexPage() {
  return (
    <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
      <div className="flex max-w-[980px] flex-col items-start gap-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Welcome to Infinistar <br className="hidden sm:inline" />
        </h1>
        <p className="max-w-[700px] text-lg text-muted-foreground">
          Interactive Virtual Chats with Advanced Language Learning Models Step
          into the future of language learning with Infinistar. Our advanced AI
          technology creates virtual chats that feel just like texting someone
          you are interested in, making your learning experience interactive and
          enjoyable. Harness the power of AI for language learning, brought to
          you by Infinistar.
        </p>
      </div>
    </section>
  )
}
