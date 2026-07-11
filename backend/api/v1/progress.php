<?php
// API Endpoint: /backend/api/v1/progress.php
// ทำหน้าที่จัดการบันทึกและดึงข้อมูลความคืบหน้าการเรียน

require_once '../../config/database.php';
require_once '../../includes/response.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
  $pdo = getDbConnection();
} catch (Exception $e) {
  error_log("[Database Inactive - Progress Fallback] " . $e->getMessage());
  
  if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    sendResponse(true, "ความคืบหน้าจำลองสำเร็จ (DB ปิด)", $input);
  } else {
    sendResponse(true, "ดึงความคืบหน้าจำลองสำเร็จ", [
      'completed_topics' => [],
      'active_language'  => 'js'
    ]);
  }
}

match ($method) {
  'GET'    => handleGetProgress($pdo),
  'POST'   => handleSaveProgress($pdo),
  default  => sendResponse(false, 'Method not allowed', statusCode: 405),
};

function handleGetProgress(PDO $pdo) {
  try {
    // โหลดความคืบหน้าล่าสุด (Dev mock ดึงจาก ID 1 เสมอ)
    $stmt = $pdo->prepare("SELECT completed_topics, active_language FROM user_progress WHERE id = 1");
    $stmt->execute();
    $result = $stmt->fetch();
    
    if (!$result) {
      $result = [
        'completed_topics' => '[]',
        'active_language'  => 'js'
      ];
    }
    
    sendResponse(true, "ดึงข้อมูลความคืบหน้าสำเร็จ", [
      'completed_topics' => json_decode($result['completed_topics']),
      'active_language'  => $result['active_language']
    ]);
  } catch (PDOException $e) {
    error_log("[API ERROR] GET /progress.php: " . $e->getMessage());
    sendResponse(false, "เกิดข้อผิดพลาดในการดึงความคืบหน้า", statusCode: 500);
  }
}

function handleSaveProgress(PDO $pdo) {
  $input = json_decode(file_get_contents('php://input'), true);
  if (!$input) {
    sendResponse(false, "รูปแบบข้อมูลไม่ถูกต้อง", statusCode: 400);
  }

  $activeLang = htmlspecialchars($input['active_language'] ?? 'js');
  $completedTopics = json_encode($input['completed_topics'] ?? []);

  try {
    // บันทึก/อัปเดตแบบ UPSERT ลงตำแหน่งแถวที่ 1
    $stmt = $pdo->prepare("
      INSERT INTO user_progress (id, completed_topics, active_language, updated_at)
      VALUES (1, :completed, :lang, NOW())
      ON DUPLICATE KEY UPDATE 
        completed_topics = :completed,
        active_language = :lang,
        updated_at = NOW()
    ");
    
    $stmt->execute([
      ':completed' => $completedTopics,
      ':lang'      => $activeLang
    ]);

    sendResponse(true, "อัปเดตข้อมูลความคืบหน้าสำเร็จ", [
      'completed_topics' => json_decode($completedTopics),
      'active_language'  => $activeLang
    ]);
  } catch (PDOException $e) {
    error_log("[API ERROR] POST /progress.php: " . $e->getMessage());
    sendResponse(false, "เกิดข้อผิดพลาดในการเขียนความคืบหน้า", statusCode: 500);
  }
}
