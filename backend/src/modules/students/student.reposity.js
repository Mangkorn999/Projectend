import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const findAll = () => {
  prisma.student.findMany({ include: true, faculty: true, room: true });
};
export const findById = (id) =>
  prisma.student.findUnique({
    where: { student_id: id },
    include: { user: true, faculty: true, room: true },
  });

export const updateCredentials = (student_id, encryptedPassword, email) =>
  prisma.student.update({
    where: { student_id },
    data: {
      nursing_council_email: email,
      nursing_council_password: encryptedPassword,
    },
  });
