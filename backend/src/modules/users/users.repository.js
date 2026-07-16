import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

//find ALL
export const findAll = () => {
  prisma.user.findMany({ include: { role: true } });
};

//update role
export const updateRole = () => {
  prisma.user.update({
    where: { user_id: Number(id) },
    data: { role_id },
  });
};

