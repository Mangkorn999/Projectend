<?php
// API Endpoint: /backend/api/v1/score.php
// ทำหน้าที่บันทึกและดึงข้อมูลคะแนนตอบคำถาม

require_once '../../config/database.php';
require_once '../../includes/response.php';

// เปิดการรับข้อมูลข้ามโดเมน (CORS) สำหรับรองรับการเทส
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// จัดการกรณี Preflight Request จาก Browser
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
  // ดึง Connection
  $pdo = getDbConnection();
} catch (Exception $e) {
  // หากฐานข้อมูลหลักยังไม่ได้เซ็ตอัพ ให้ตอบกลับเป็น Mock Success ชั่วคราว (เพื่อไม่ให้เว็บพังเวลารันโหมด Static)
  // แต่บันทึก Log ลงเซิร์ฟเวอร์แจ้งเตือน Dev
  error_log("[Database Inactive - Fallback Mode active] " . $e->getMessage());
  
  // ตรวจจับเมธอดจำลองผลลัพธ์
  if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    sendResponse(true, "เซิร์ฟเวอร์ยังไม่ได้เซ็ตอัพ DB (ทำงานในระบบเซฟออฟไลน์ชั่วคราว)", [
      'quiz_id' => htmlspecialchars($input['quizId'] ?? 'unknown'),
      'score' => (int)($input['score'] ?? 0),
      'total' => (int)($input['total'] ?? 0),
      'timestamp' => date('Y-m-d H:i:s')
    ]);
  } else {
    sendResponse(true, "ฐานข้อมูลออฟไลน์ ดึงข้อมูลจำลองสำเร็จ", []);
  }
}

// ถ้า DB พร้อมทำงานปกติ
match ($method) {
  'GET'    => handleGetScores($pdo),
  'POST'   => handleSaveScore($pdo),
  default  => sendResponse(false, 'Method not allowed', statusCode: 405),
};

/**
 * ดึงรายการคะแนนสอบทั้งหมดจาก Database
 */
function handleGetScores(PDO $pdo) {
  try {
    // ดึงคะแนนล่าสุด 50 แถวแรก
    $stmt = $pdo->prepare("
      SELECT id, quiz_id, score, total, created_at 
      FROM quiz_scores 
      ORDER BY created_at DESC 
      LIMIT 50
    ");
    $stmt->execute();
    $results = $stmt->fetchAll();
    
    sendResponse(true, "ดึงข้อมูลประวัติคะแนนสอบสำเร็จ", $results);
  } catch (PDOException $e) {
    error_log("[API ERROR] GET /score.php: " . $e->getMessage());
    sendResponse(false, "เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ", statusCode: 500);
  }
}

/**
 * บันทึกคะแนนลงในฐานข้อมูล
 */
function handleSaveScore(PDO $pdo) {
  // อ่าน JSON Payload
  $input = json_decode(file_get_contents('php://input'), true);
  
  if (!$input) {
    sendResponse(false, "รูปแบบข้อมูลไม่ถูกต้อง", statusCode: 400);
  }

  // Validate inputs
  $quizId = trim($input['quizId'] ?? '');
  $score = filter_var($input['score'] ?? null, FILTER_VALIDATE_INT);
  $total = filter_var($input['total'] ?? null, FILTER_VALIDATE_INT);

  if ($quizId === '' || $score === false || $total === false) {
    sendResponse(false, "กรุณากรอกข้อมูลให้ครบถ้วน (quizId, score, total)", statusCode: 400);
  }

  try {
    // บันทึกด้วย Prepared Statement เพื่อป้องกัน SQL Injection
    $stmt = $pdo->prepare("
      INSERT INTO quiz_scores (quiz_id, score, total, created_at) 
      VALUES (:quiz_id, :score, :total, NOW())
    ");
    
    $stmt->execute([
      ':quiz_id' => htmlspecialchars($quizId),
      ':score'   => $score,
      ':total'   => $total
    ]);

    sendResponse(true, "บันทึกคะแนนเข้าระบบฐานข้อมูลเซิร์ฟเวอร์เรียบร้อยแล้ว", [
      'id' => $pdo->lastInsertId(),
      'quiz_id' => $quizId,
      'score' => $score,
      'total' => $total
    ], statusCode: 201);

  } catch (PDOException $e) {
    error_log("[API ERROR] POST /score.php: " . $e->getMessage());
    sendResponse(false, "เกิดข้อผิดพลาดในการเขียนข้อมูลลงระบบ", statusCode: 500);
  }
}
