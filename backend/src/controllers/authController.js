import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const login = async (req, res) => {
  try {
    const { psu_passport_id, first_name, last_name, email } = req.body;

    // upsert: ถ้าไม่มีข้อมูลในระบบจะสร้างใหม่ทันที ถ้ามีแล้วจะอัปเดตข้อมูลให้เป็นปัจจุบัน
    const user = await prisma.user.upsert({
      where: { psu_passport_id: psu_passport_id },
      update: {
        first_name: first_name,
        last_name: last_name,
        email: email
      },
      create: {
        psu_passport_id: psu_passport_id,
        first_name: first_name,
        last_name: last_name,
        email: email,
        role_id: 2 // default role เช่น นักศึกษา
      },
      include: { role: true },
    });

    // JWT Token
    const token = jwt.sign(
      { userId: user.user_id, role: user.role.role_name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      token: token,
      user: {
        id: user.user_id,
        name: user.first_name,
        role: user.role.role_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "server error" });
  }
};