CREATE DATABASE IF NOT EXISTS nexus_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexus_db;

CREATE TABLE IF NOT EXISTS users (
    id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(80)     NOT NULL,
    last_name  VARCHAR(80)     NOT NULL,
    email      VARCHAR(255)    NOT NULL UNIQUE,
    username   VARCHAR(60)     NOT NULL UNIQUE,
    password   VARCHAR(255)    NOT NULL,
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;