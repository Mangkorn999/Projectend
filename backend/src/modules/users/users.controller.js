import { Prisma } from "@prisma/client";
import * as UserRepo from "../users/users.repository.js";

export const getAll = async (req, res, next) => {
  try {
    const users = await userRepo.findAll();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

export const updataRole = async (req, res, next) => {
  try {
    const { role_id } = req.body;
    const user = await userRepo.updataRole(req.params.id, role_id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
