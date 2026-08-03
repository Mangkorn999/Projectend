import multer from "multer";
import fs from "fs";
import path from "path";

// เก็บไฟล์จริงที่ disk — ใน DB เก็บแค่ file_path (ห้ามเก็บ binary ใน DB)
const UPLOAD_DIR = path.resolve("uploads/certificates");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // สร้างโฟลเดอร์ทุกครั้งที่จะเขียน ไม่ใช่แค่ตอน import
    // (ถ้าโฟลเดอร์ถูกลบระหว่าง server ทำงาน หรือ deploy ใหม่แล้วยังไม่มี จะได้ไม่พัง)
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // ตั้งชื่อไฟล์เอง กันชื่อซ้ำ + กัน path traversal จากชื่อไฟล์เดิมที่ client ส่งมา
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}.pdf`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    const err = new Error("รับเฉพาะไฟล์ PDF เท่านั้น");
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
};

export const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── รูปภาพประกอบข่าว/ประกาศ ────────────────────────────
const NEWS_IMAGE_DIR = path.resolve("uploads/news");

// รับได้ทุกขนาดภาพ (เจ้าหน้าที่แนบภาพจากมือถือ/สแกนมาขนาดไม่เท่ากัน) — จำกัดแค่ขนาดไฟล์
const IMAGE_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(NEWS_IMAGE_DIR, { recursive: true });
      cb(null, NEWS_IMAGE_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // ตั้งชื่อเองเหมือนฝั่ง PDF — กันชื่อซ้ำและ path traversal จากชื่อไฟล์เดิม
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${IMAGE_EXT[file.mimetype] ?? ".img"}`);
  },
});

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXT[file.mimetype]) {
      const err = new Error("รับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP, GIF)");
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
