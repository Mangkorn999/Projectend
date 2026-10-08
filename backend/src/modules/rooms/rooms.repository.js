import prisma from "../../config/db.js";

// ห้องเรียนทั้งหมด
export const findAll = () => prisma.room.findMany({ orderBy: { room_id: "asc" } });
