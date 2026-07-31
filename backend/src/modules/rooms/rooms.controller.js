import * as roomsRepo from "./rooms.repository.js";

export const getAll = async (req, res, next) => {
  try {
    const rooms = await roomsRepo.findAll();
    res.json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};
