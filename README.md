# ระบบบันทึกใบประกอบวิชาชีพ (Nursing License Record System)

เว็บแอปสำหรับ **บันทึกและติดตามผลสอบใบประกอบวิชาชีพของนักศึกษาพยาบาล** คณะพยาบาลศาสตร์ มหาวิทยาลัยสงขลานครินทร์

โปรเจกต์จบหลักสูตรปริญญาตรี สาขาเทคโนโลยีสารสนเทศ

| | |
|---|---|
| **ที่ปรึกษา** | ผศ.ดร.กิตย์ศิริ ช่อเจี้ยง |
| **Backend + Database** | มังกร (ธัญเทพ) |
| **Frontend** | แก้ม (ฉันท์ชนก) |

---

## ระบบทำอะไร

นักศึกษาพยาบาลต้องสอบใบประกอบวิชาชีพ 8 รายวิชา และสอบได้หลายรอบจนกว่าจะผ่านครบ เดิมคณะเก็บผลสอบด้วยเอกสาร/ไฟล์กระจาย ตามผลรายคนยาก สรุปภาพรวมยากกว่า

ระบบนี้ย้ายทั้งกระบวนการมาอยู่ที่เดียว:

- **นักศึกษา** กรอกผลสอบรายวิชา + แนบไฟล์ PDF หลักฐาน แล้วดูสถานะว่าเจ้าหน้าที่ยืนยันหรือตีกลับ
- **เจ้าหน้าที่คณะ** ตรวจ/ยืนยัน/ตีกลับผลสอบ เปิด-ปิดรอบการกรอก จัดการรายวิชาและผู้ใช้ ออกรายงาน PDF
- **ผู้บริหารคณะ** ดู Dashboard สรุปภาพรวมและสถิติอัตราผ่าน (อ่านอย่างเดียว ไม่เห็นข้อมูลรายบุคคล)

---

## Tech Stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL + Prisma ORM |
| Auth | Login ด้วยรหัสในระบบ → ออก JWT เก็บใน httpOnly cookie |
| ไฟล์แนบ | multer เขียนลง disk (DB เก็บแค่ path) |
| รายงาน PDF | pdfkit |

---

## โครงสร้างโฟลเดอร์

```
backend/            Express + Prisma (มังกรดูแล)
  prisma/           schema.prisma, migrations, seed
  src/
    modules/        แยกตามเรื่อง เช่น students, examResults, dashboard
                    แต่ละ module = routes → controller → service → repository
    middlewares/    authenticate, requireRole, upload
    utils/          ตัวช่วยที่ใช้ร่วมกันหลาย module
  tests/            smoke test ยิง endpoint จริง (ไม่ใช้ framework)

frontend/           React + Vite (แก้มดูแล)
  src/design/       หน้าจอจริงทั้งหมด + api.js ที่คุย backend
  public/design/    prototype HTML ก่อนย้ายมา React (ไว้เทียบดีไซน์)

docs/               เอกสารออกแบบระหว่างทาง
```

---

## ติดตั้งและรัน

ต้องมี **Node.js 18+** และ **PostgreSQL** ที่รันอยู่แล้ว

### 1. Backend

```bash
cd backend
npm install
```

สร้างไฟล์ `backend/.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/ProjectEnd"
JWT_SECRET="ตั้งข้อความยาว ๆ อะไรก็ได้ ห้ามใช้ค่าเดียวกับตอน deploy จริง"
PORT=3000
```

สร้างตารางและใส่ข้อมูลตั้งต้น แล้วรัน:

```bash
npx prisma migrate dev     # สร้างตารางตาม schema + seed อัตโนมัติ
npm start                  # http://localhost:3000
```

### 2. Frontend

เปิด terminal ใหม่ (ปล่อย backend รันค้างไว้):

```bash
cd frontend
npm install
npm run dev                # http://localhost:5174
```

### บัญชีทดสอบ (มาจาก seed)

| บทบาท | รหัสผู้ใช้ | รหัสผ่าน |
|---|---|---|
| นักศึกษา | `6610210631` | `6610210631` |
| เจ้าหน้าที่ | `456` | `456` |
| ผู้บริหาร | `789` | `789` |

---

## เทสต์

```bash
cd backend
npx prisma migrate reset --force   # ล้าง DB + seed ใหม่ (ต้องทำก่อนรันทุกครั้ง)
npm start                          # เปิด server ค้างไว้อีก terminal
npm test                           # ยิง endpoint จริงทั้ง 6 ไฟล์
```

> เทสต์ยิงผ่าน HTTP จริง ถ้าไม่ reset ก่อนจะเจอ error จากข้อมูลรอบก่อน และถ้า login รัว ๆ จนเจอ `429` ให้รีสตาร์ท server แล้วรันใหม่

---

## เอกสารเพิ่มเติม

| ไฟล์ | เนื้อหา |
|---|---|
| [`backend/BACKEND_GUIDE.md`](backend/BACKEND_GUIDE.md) | อธิบาย backend ทั้งหมด — ทุก endpoint, กฎธุรกิจ, โครงสร้าง DB, changelog |
| [`backend/Backend.md`](backend/Backend.md) | แผนงานแบ่งเป็น phase + สรุป endpoint |
| [`backend/SYNTAX_NOTES.md`](backend/SYNTAX_NOTES.md) | cheat sheet syntax JS/SQL/Prisma/Git |
| [`CLAUDE.md`](CLAUDE.md) | ขอบเขตงาน กติกาการแบ่งงาน และ convention ของโปรเจกต์ |
