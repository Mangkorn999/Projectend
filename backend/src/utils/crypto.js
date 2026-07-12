import crypto from "crypto";

// AES-256-GCM สำหรับ encrypt/decrypt nursing_council_password
// Key ต้องอยู่ใน .env เท่านั้น ห้ามเขียน hardcode ในโค้ด
//
// วิธี generate AES_KEY: node -e "console.log(crypto.randomBytes(32).toString('hex'))"

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.AES_KEY || "", "hex"); // 32 bytes = 64 hex chars

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12); // 96-bit IV สำหรับ GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // เก็บ iv:authTag:ciphertext รวมเป็น string เดียว
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(ciphertext) {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
