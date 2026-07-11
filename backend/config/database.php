<?php
/**
 * ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูล MySQL ด้วย PDO
 * รองรับการอ่านค่า config จาก Environment Variables
 */
function getDbConnection(): PDO {
  // โหลดตัวแปรตั้งค่าหรือใช้ค่าดีฟอลต์ (Dev Environment)
  $host = $_ENV['DB_HOST'] ?? '127.0.0.1';
  $db   = $_ENV['DB_NAME'] ?? 'syntaxcraft_db';
  $user = $_ENV['DB_USER'] ?? 'root';
  $pass = $_ENV['DB_PASS'] ?? '';
  $port = $_ENV['DB_PORT'] ?? '3306';

  $dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $host,
    $port,
    $db
  );
  
  try {
    return new PDO($dsn, $user, $pass, [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false, // สั่งให้ใช้ Prepared Statement จริงป้องกัน SQL Injection
    ]);
  } catch (PDOException $e) {
    // บันทึก Log ฝั่งเซิร์ฟเวอร์ และตอบกลับ API แบบปิดความลับข้อมูลระบบ
    error_log("[Database Connection Error] " . $e->getMessage());
    throw new Exception("ไม่สามารถเชื่อมต่อระบบฐานข้อมูลหลักได้กรุณาติดต่อผู้พัฒนา");
  }
}
