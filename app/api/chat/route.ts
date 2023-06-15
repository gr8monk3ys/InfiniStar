import weaviate from "weaviate-ts-client"

const client = weaviate.client({
  scheme: "https",
  host: "your-weaviate-instance-host",
  apiKey: new weaviate.ApiKey("YOUR-WEAVIATE-API-KEY"),
})

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { message } = req.body

    // Save the message to Weaviate.
    await client.c11n.objects.create({
      class: "ChatMessage",
      properties: {
        user: "user",
        message: message,
      },
    })

    // Return the saved message.
    res.status(200).json({ message })
  } else {
    res.status(405).json({ message: "Method not allowed." })
  }
}
