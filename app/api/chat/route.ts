import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next'

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { message } = req.body;

    // Save the message to the database using Prisma.
    await prisma.chatMessage.create({
      data: {
        user: "user",
        message: message,
      },
    });

    // Return the saved message.
    res.status(200).json({ message });
  } else {
    res.status(405).json({ message: "Method not allowed." });
  }
}
