// ตรวจว่า .env มีตัวแปรสำคัญครบก่อน server เริ่ม
// ถ้าขาดตัวไหน จะ throw error ทันที ไม่ให้ server เริ่มโดยไม่มี config ครบ

const REQUIRED_VARS = ["DATABASE_URL", "JWT_SECRET"];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  console.log("Environment variables validated");
}
