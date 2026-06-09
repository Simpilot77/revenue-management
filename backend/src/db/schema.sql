-- Revenue Management Tool - Workation Wolfsburg (Wettmershagen)
-- Database Schema

CREATE DATABASE IF NOT EXISTS revenue_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE revenue_management;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'viewer') DEFAULT 'viewer',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Houses table
CREATE TABLE IF NOT EXISTS houses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(10) NOT NULL,
  house_number VARCHAR(10) NOT NULL,
  capacity INT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE
);

-- Booking channels
CREATE TABLE IF NOT EXISTS channels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(20) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  active BOOLEAN DEFAULT TRUE
);

-- Main bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Object
  house_id INT NOT NULL,
  channel_id INT,
  external_reference VARCHAR(100),

  -- Dates
  booking_date DATE NOT NULL,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  nights INT GENERATED ALWAYS AS (DATEDIFF(checkout_date, checkin_date)) STORED,

  -- Guest
  guest_name VARCHAR(150) NOT NULL,
  company_name VARCHAR(150),
  guest_email VARCHAR(150),
  guest_phone VARCHAR(50),
  nationality VARCHAR(50),
  is_returning_guest BOOLEAN DEFAULT FALSE,

  -- Occupancy
  guest_count INT NOT NULL DEFAULT 1,
  adults INT DEFAULT 1,
  children INT DEFAULT 0,

  -- Pricing
  daily_rate DECIMAL(10,2),
  cleaning_fee DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Payment
  payment_method ENUM('bar','ueberweisung','kreditkarte','paypal','sonstige') DEFAULT 'ueberweisung',
  payment_status ENUM('offen','anzahlung','bezahlt','erstattet') DEFAULT 'offen',
  invoice_number VARCHAR(50),

  -- Status
  status ENUM('angefragt','bestaetigt','eingecheckt','ausgecheckt','storniert','no_show') DEFAULT 'bestaetigt',
  cancellation_date DATE,
  cancellation_reason TEXT,

  -- Extras
  breakfast_included BOOLEAN DEFAULT FALSE,
  pets_allowed BOOLEAN DEFAULT FALSE,
  parking BOOLEAN DEFAULT FALSE,

  -- Notes
  guest_notes TEXT,
  internal_notes TEXT,

  -- Meta
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (house_id) REFERENCES houses(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (created_by) REFERENCES users(id),

  INDEX idx_checkin (checkin_date),
  INDEX idx_checkout (checkout_date),
  INDEX idx_booking_date (booking_date),
  INDEX idx_house (house_id),
  INDEX idx_status (status)
);

-- Seed data: Houses
INSERT INTO houses (name, short_name, house_number, capacity) VALUES
  ('Haus 1', 'H1', '15a', 6),
  ('Haus 2', 'H2', '15b', 7),
  ('Haus 3', 'H3', '15c', 7);

-- Seed data: Channels
INSERT INTO channels (name, short_name, color) VALUES
  ('Direkt', 'DIREKT', '#10b981'),
  ('Booking.com', 'BDC', '#003580'),
  ('Airbnb', 'AIRBNB', '#ff5a5f'),
  ('HRS', 'HRS', '#e65100'),
  ('Expedia', 'EXPEDIA', '#ffc107'),
  ('Firma / Direktvertrag', 'FIRMA', '#8b5cf6'),
  ('Sonstige', 'SONST', '#6b7280');

-- Seed data: Admin user (password: admin123 - change immediately!)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Administrator', 'info@workation-wolfsburg.com', '$2a$12$/U6GY90fuyU7uEaf.1Lbve.GCU5mOBcyn8gEMrd8o.OQFjB4.04Jm', 'admin');
