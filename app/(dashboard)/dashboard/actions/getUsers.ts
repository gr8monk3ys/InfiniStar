import { getServerSession } from "next-auth";
import prisma from "@/app/libs/prismadb";

const getuser = async () => {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return [];
  }

  try {
    const user = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      where: {
        NOT: {
          email: session.user.email
        }
      }
    });

    return user;
  } catch (error: any) {
    return [];
  }
};

export default getuser;
