-- SQL Migration Schema for SyntaxCraft Database
-- Version: MySQL 8.0+

CREATE DATABASE IF NOT EXISTS syntaxcraft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE syntaxcraft_db;

-- 1. Table for tracking Quiz Score History
CREATE TABLE IF NOT EXISTS quiz_scores (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id      VARCHAR(100) NOT NULL,
  score        INT NOT NULL,
  total        INT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quiz_id (quiz_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table for tracking student active progress (completed topics & settings)
CREATE TABLE IF NOT EXISTS user_progress (
  id                 INT PRIMARY KEY, -- We default to ID 1 for single player dev state
  completed_topics   TEXT NOT NULL,   -- JSON array of topics read: ["variables", "loops"]
  active_language    VARCHAR(10) DEFAULT 'js',
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
