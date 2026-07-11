import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// 1. สร้างฟังก์ชัน login
export const login = async (req, res) => { // 
  try {
    const { psu_passport_id } = req.body;

    const user = await prisma.user.findFirst({
      where: { psu_passport_id: psu_passport_id },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ message: "ไม่พบข้อมูลในระบบ" });
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role.role_name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      token: token,
      user: {
        id: user.user_id, // ใช้ user_id จาก DB จริงๆ จะดีกว่า psu_passport_id ค่ะ
        name: user.first_name,
        role: user.role.role_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "server error" });
  }
};

