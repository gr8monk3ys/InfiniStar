"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function IndexPage() {
  const [chat, setChat] = useState([
    { user: "bot", message: "Hello, how can I assist you?" },
    { user: "user", message: "Hi, I have a question about your service." },
    // add more chat messages here
  ])

  return (
    <section className="flex flex-col h-screen p-4 bg-gray-100">
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Chat <br className="hidden sm:inline" />
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow p-4 space-y-2">
        {chat.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start ${
              msg.user === "user" ? "justify-end" : ""
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 ${
                msg.user === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-black"
              }`}
            >
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      <div className="grid w-full gap-2 sticky bottom-0 py-2 ">
        <Textarea placeholder="Type your message here." />
        <Button>Send message</Button>
      </div>
    </section>
  )
}
