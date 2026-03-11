-- MySQL Schema for School Management System (SMS)
-- Database: ratings
-- This script creates all necessary tables for the SMS application

-- ============================================
-- CORE TABLES
-- ============================================

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50),
    account_status VARCHAR(20) DEFAULT 'active',
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_teacher_id (teacher_id)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(50) NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    teacher_id INT REFERENCES teachers(id),
    capacity INT NOT NULL DEFAULT 40,
    enrollment INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_teacher_id (teacher_id)
);

-- School Years table
CREATE TABLE IF NOT EXISTS school_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_year VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
);

-- Sections table (JHS and SHS sections)
CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section_code VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(10) NOT NULL,
    grade VARCHAR(10) NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    adviser_id INT,
    programme VARCHAR(50),
    track VARCHAR(50),
    electives TEXT,
    class_type VARCHAR(50),
    session VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Active',
    remarks TEXT,
    school_year_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_section_code (section_code),
    INDEX idx_school_year_id (school_year_id),
    INDEX idx_adviser_id (adviser_id),
    FOREIGN KEY (adviser_id) REFERENCES teachers(id),
    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),
    phone VARCHAR(20),
    grade_level VARCHAR(50),
    class_id INT,
    section_id INT,
    school_year_id INT,
    account_status VARCHAR(20) DEFAULT 'active',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    birthdate DATE,
    gender VARCHAR(50),
    address TEXT,
    place_of_birth VARCHAR(255),
    INDEX idx_email (email),
    INDEX idx_student_id (student_id),
    INDEX idx_school_year (school_year_id),
    INDEX idx_section (section_id),
    FOREIGN KEY (section_id) REFERENCES sections(id),
    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    account_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

-- Advisers table (legacy separate accounts for counsellors)
CREATE TABLE IF NOT EXISTS advisers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adviser_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    account_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- ENROLLMENT & GRADES
-- ============================================

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id VARCHAR(50) UNIQUE NOT NULL,
    student_id INT NOT NULL,
    enrollment_data JSON,
    enrollment_files JSON,
    status VARCHAR(20) DEFAULT 'Pending',
    remarks TEXT,
    school_year_id INT,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_school_year (school_year_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade_value INT NOT NULL,
    quarter VARCHAR(10) NOT NULL,
    recorded_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    CONSTRAINT fk_grades_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- NOTIFICATIONS & GUIDANCE
-- ============================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_data JSON,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Guidance Requests table
CREATE TABLE IF NOT EXISTS guidance_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    reason TEXT NOT NULL,
    preferred_date DATE,
    preferred_time TIME,
    message TEXT,
    status VARCHAR(32) DEFAULT 'Pending',
    internal_notes TEXT,
    appointment_date DATE,
    appointment_time TIME,
    guidance_counselor_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_student_id (student_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Guidance Messages table
CREATE TABLE IF NOT EXISTS guidance_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guidance_request_id INT,
    sender_id INT,
    sender_type VARCHAR(32),
    message_content TEXT,
    is_visible_to_student BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    INDEX idx_guidance_request_id (guidance_request_id),
    FOREIGN KEY (guidance_request_id) REFERENCES guidance_requests(id) ON DELETE CASCADE
);

-- Student Risk Flags table
CREATE TABLE IF NOT EXISTS student_risk_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    risk_type VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    flagged_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Guidance Sessions table
CREATE TABLE IF NOT EXISTS guidance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guidance_request_id INT,
    guidance_counselor_id INT,
    student_id INT,
    session_date DATE NOT NULL,
    session_time TIME,
    session_location VARCHAR(255),
    session_notes TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guidance_request_id (guidance_request_id),
    INDEX idx_student_id (student_id),
    FOREIGN KEY (guidance_request_id) REFERENCES guidance_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- ELECTIVES & REGISTRATION
-- ============================================

-- Electives table
CREATE TABLE IF NOT EXISTS electives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_year_id INT,
    track VARCHAR(50),
    elective_code VARCHAR(50) UNIQUE NOT NULL,
    elective_name VARCHAR(100) NOT NULL,
    description TEXT,
    teacher_id INT,
    max_slots INT DEFAULT 40,
    enrolled_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_year_id (school_year_id),
    FOREIGN KEY (school_year_id) REFERENCES school_years(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Registration Codes table
CREATE TABLE IF NOT EXISTS registration_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    school_year_id INT,
    usage_limit INT DEFAULT 1,
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    INDEX idx_code (code),
    INDEX idx_school_year_id (school_year_id),
    FOREIGN KEY (school_year_id) REFERENCES school_years(id),
    FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- ============================================
-- FEEDBACK (for existing users/feedback tables)
-- ============================================

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    teacher_id INT,
    rating INT,
    comment TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_teacher_id (teacher_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Teacher & adviser assignment lookup tables (for sections)
CREATE TABLE IF NOT EXISTS teacher_section_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    section_id INT NOT NULL,
    school_year_id INT NOT NULL,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY(teacher_id, section_id, school_year_id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);

CREATE TABLE IF NOT EXISTS adviser_section_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adviser_id INT NOT NULL,
    section_id INT NOT NULL,
    school_year_id INT NOT NULL,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY(adviser_id, section_id, school_year_id),
    FOREIGN KEY (adviser_id) REFERENCES advisers(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
);

-- Users table (if needed for authentication/reference)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    user_type VARCHAR(50),
    account_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
);
