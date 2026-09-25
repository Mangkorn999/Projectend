import prisma from "../../config/db.js";

export const findAll = () => prisma.room.findMany({ orderBy: { room_id: "asc" } });
