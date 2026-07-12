import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const login = async (req, res) => {
  try {
    const { psu_passport_id, first_name, last_name, email } = req.body;

    // ค้นหาผู้ใช้ที่มี psu_passport_id นี้อยู่แล้ว
    let user = await prisma.user.findFirst({
      where: { psu_passport_id: psu_passport_id },
      include: { role: true },
    });

    if (user) {
      // อัปเดตข้อมูลให้เป็นปัจจุบัน
      user = await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          first_name: first_name,
          last_name: last_name,
          email: email,
        },
        include: { role: true },
      });
    } else {
      // สร้างข้อมูลใหม่
      user = await prisma.user.create({
        data: {
          psu_passport_id: psu_passport_id,
          first_name: first_name,
          last_name: last_name,
          email: email,
          phone: "",
          role_id: 2, // default role เช่น นักศึกษา
        },
        include: { role: true },
      });
    }

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