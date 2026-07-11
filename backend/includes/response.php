<?php
/**
 * ส่ง JSON response มาตรฐานกลับ frontend แล้วหยุดการทำงานทันที
 * เพื่อป้องกันไม่ให้มีข้อความอื่นๆ หลุดออกไปนอกเหนือจาก JSON
 */
function sendResponse(
  bool $success,
  string $message,
  mixed $data = null,
  array $errors = [],
  int $statusCode = 200
): void {
  http_response_code($statusCode);
  header('Content-Type: application/json; charset=UTF-8');
  
  // CORS Headers
  header('Access-Control-Allow-Origin: *'); // สำหรับ Dev Environment
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');

  echo json_encode([
    'success'   => $success,
    'message'   => $message,
    'data'      => $data,
    'errors'    => $errors,
    'timestamp' => gmdate('c'),
  ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  
  exit; // หยุดการทำงานของเซิร์ฟเวอร์ทันที
}
