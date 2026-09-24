import { PrismaClient } from "@prisma/client";

// PrismaClient ตัวเดียวของทั้ง backend (singleton)
//
// ทำไมต้องมีที่เดียว:
//   PrismaClient 1 ตัว = connection pool 1 ชุดของมันเอง (default = จำนวน CPU core × 2 + 1)
//   ถ้าแต่ละไฟล์สร้างเอง 14 ไฟล์ = 14 pool เปิด connection ค้างไว้พร้อมกัน
//   เครื่อง 8 core → 17 × 14 = 238 connection แต่ PostgreSQL default รับได้แค่ 100
//   → server จะพังตอนมีคนใช้พร้อมกันหลายคน ด้วย error "too many clients already"
//
// กฎ: ห้ามเขียน `new PrismaClient()` ที่ไฟล์อื่นใน src/ เด็ดขาด
//     ทุก repository ให้ `import prisma from "../../config/db.js";` แทน
//     (ยกเว้น prisma/*.js กับ scripts/*.js — พวกนั้นเป็น script รันจบแล้วปิดเอง สร้างเองได้)
const prisma = new PrismaClient();

export default prisma;
