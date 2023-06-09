"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function IndexPage() {
  const [chat, setChat] = useState([
    { user: "bot", message: "Hello, how can I assist you?" },
    { user: "user", message: "Hi, I have a question about your service." },
  ])

  const [message, setMessage] = useState("") // Store the current input

  // Handle the input change
  const handleChange = (e) => setMessage(e.target.value)

  // Handle the button click
  const handleSubmit = () => {
    // Add the current input to the chat as a user message
    setChat((prevChat) => [...prevChat, { user: "user", message }])
    setMessage("") // Clear the input
  }

  return (
    <section className="flex h-screen flex-col p-4">
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Chat <br className="hidden sm:inline" />
        </h1>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg p-4 shadow">
        {chat.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start ${
              msg.user === "user" ? "justify-end" : ""
            } transition-transform duration-500 ease-in-out`}
            style={{
              animation: `slide-in ${
                msg.user === "user" ? "right" : "left"
              } 0.5s ease-in-out`,
            }}
          >
            <div
              className={`rounded-lg px-3 py-2 ${
                msg.user === "user"
                  ? "bg-black text-white"
                  : "bg-gray-300 text-black"
              }`}
            >
              {msg.message}
            </div>
          </div>
        ))}
      </div>
      <form
        className="sticky bottom-0 grid w-full gap-2 bg-white py-2"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center">
          <Textarea
            value={message}
            onChange={handleChange}
            placeholder="Send a message."
            className="mr-2 grow"
          />
          <Button type="submit">Send</Button>
        </div>
      </form>
    </section>
  )
}
