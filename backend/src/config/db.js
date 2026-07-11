import { PrismaClient } from "@prisma/client";

// ใช้ singleton pattern เพื่อไม่ให้สร้าง PrismaClient ซ้ำในทุก import
const prisma = new PrismaClient();

export default prisma;
