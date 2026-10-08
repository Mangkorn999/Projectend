import * as roomsRepo from "./rooms.repository.js";

// GET /rooms — list ห้องเรียนให้ dropdown
export const getAll = async (req, res, next) => {
  try {
    const rooms = await roomsRepo.findAll();
    res.json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};
