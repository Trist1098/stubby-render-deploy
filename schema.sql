-- ─────────────────────────────────────────────────────────
--  Database Schema
-- ─────────────────────────────────────────────────────────
--  Single source of truth for the database structure.
--  Update this file whenever you add, remove, or change
--  tables, columns, or indexes.
--
--  Used by: scripts/reset.js
-- ─────────────────────────────────────────────────────────

-- Drop existing tables
DROP TABLE IF EXISTS "Something" CASCADE;
DROP TABLE IF EXISTS "Person" CASCADE;

-- Create tables
CREATE TABLE "Something" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Something_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Person" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar" TEXT,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- =============================================
-- DROP EXISTING TABLES
-- =============================================
DROP TABLE IF EXISTS EventComment;
DROP TABLE IF EXISTS EventParticipant;
DROP TABLE IF EXISTS CalendarEvent;
DROP TABLE IF EXISTS Notification;
DROP TABLE IF EXISTS ChatMessage;
DROP TABLE IF EXISTS ConversationMember;
DROP TABLE IF EXISTS SessionReflection;
DROP TABLE IF EXISTS SessionMember;
DROP TABLE IF EXISTS MatchRequest;
DROP TABLE IF EXISTS MatchPreference;
DROP TABLE IF EXISTS UserBadge;
DROP TABLE IF EXISTS Friendship;
DROP TABLE IF EXISTS UserInterest;
DROP TABLE IF EXISTS UserLanguage;
DROP TABLE IF EXISTS UserModule;
DROP TABLE IF EXISTS ChatConversation;
DROP TABLE IF EXISTS StudySession;
DROP TABLE IF EXISTS Badge;
DROP TABLE IF EXISTS Module;
DROP TABLE IF EXISTS "User";
DROP TABLE IF EXISTS Interest;
DROP TABLE IF EXISTS Language;
DROP TABLE IF EXISTS Diploma;
DROP TABLE IF EXISTS Institution;
DROP TABLE IF EXISTS Country;

-- PostgreSQL trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MASTER DATA
-- =============================================
CREATE TABLE Country (
    country_id SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    code       VARCHAR(10) UNIQUE
);

CREATE TABLE Institution (
    institution_id SERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL UNIQUE,
    location       VARCHAR(255),
    country_id     INT,
    website        VARCHAR(255),
    FOREIGN KEY (country_id) REFERENCES Country(country_id) ON DELETE SET NULL
);

CREATE TABLE Diploma (
    diploma_id     SERIAL PRIMARY KEY,
    institution_id INT NOT NULL,
    name           VARCHAR(255) NOT NULL,
    code           VARCHAR(10) UNIQUE,
    FOREIGN KEY (institution_id) REFERENCES Institution(institution_id) ON DELETE CASCADE
);

CREATE TABLE Module (
    module_id    SERIAL PRIMARY KEY,
    diploma_id   INT,
    name         VARCHAR(255) NOT NULL,
    code         VARCHAR(20) NOT NULL UNIQUE,
    description  TEXT,
    FOREIGN KEY (diploma_id) REFERENCES Diploma(diploma_id) ON DELETE SET NULL
);

CREATE TABLE Language (
    language_id SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(10) UNIQUE
);

CREATE TABLE Interest (
    interest_id SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE
);

-- =============================================
-- CORE: Users & Auth
-- =============================================
CREATE TABLE "User" (
    user_id            SERIAL PRIMARY KEY,
    username           VARCHAR(100) NOT NULL UNIQUE,
    email              VARCHAR(255) NOT NULL UNIQUE,
    password           VARCHAR(255) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    institution_id     INT,
    diploma_id         INT,
    year               INT DEFAULT 1,
    profile_pic        VARCHAR(255),
    profile_text       TEXT,
    is_private         BOOLEAN DEFAULT FALSE,
    is_online          BOOLEAN DEFAULT FALSE,
    push_notif         BOOLEAN DEFAULT TRUE,
    email_notif        BOOLEAN DEFAULT TRUE,
    auto_save          BOOLEAN DEFAULT TRUE,
    has_completed_quiz BOOLEAN DEFAULT FALSE,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES Institution(institution_id) ON DELETE SET NULL,
    FOREIGN KEY (diploma_id)     REFERENCES Diploma(diploma_id) ON DELETE SET NULL
);

CREATE TRIGGER set_updated_at_user
  BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================
-- MANY-TO-MANY RELATIONSHIPS
-- =============================================
CREATE TABLE UserModule (
    id        SERIAL PRIMARY KEY,
    user_id   INT NOT NULL,
    module_id INT NOT NULL,
    FOREIGN KEY (user_id)   REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES Module(module_id) ON DELETE CASCADE,
    UNIQUE(user_id, module_id)
);

CREATE TABLE UserLanguage (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL,
    language_id INT NOT NULL,
    FOREIGN KEY (user_id)     REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (language_id) REFERENCES Language(language_id) ON DELETE CASCADE,
    UNIQUE(user_id, language_id)
);

CREATE TABLE UserInterest (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL,
    interest_id INT NOT NULL,
    FOREIGN KEY (user_id)     REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (interest_id) REFERENCES Interest(interest_id) ON DELETE CASCADE,
    UNIQUE(user_id, interest_id)
);

-- =============================================
-- MATCHMAKING
-- =============================================
CREATE TABLE MatchPreference (
    preference_id      SERIAL PRIMARY KEY,
    user_id            INT NOT NULL UNIQUE,
    selected_modules   JSONB,
    schedule_set       BOOLEAN DEFAULT FALSE,
    auto_match_enabled BOOLEAN DEFAULT FALSE,
    availability_days  JSONB,
    selected_modes     JSONB,
    selected_times     JSONB,
    start_time         VARCHAR(10),
    end_time           VARCHAR(10),
    match_rate         VARCHAR(20),
    style              VARCHAR(50),
    selected_languages JSONB,
    duration           INT DEFAULT 60,
    priority           INT DEFAULT 1,
    gender_pref        VARCHAR(20),
    partner_level      VARCHAR(20),
    match_my_time      BOOLEAN DEFAULT FALSE,
    study_habit        VARCHAR(50),
    additional_details TEXT,
    FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TABLE MatchRequest (
    request_id  SERIAL PRIMARY KEY,
    sender_id   INT NOT NULL,
    receiver_id INT NOT NULL,
    module_id   INT,
    time_slot   VARCHAR(100),
    location    VARCHAR(255),
    type        VARCHAR(20) DEFAULT 'one-on-one',
    status      VARCHAR(20) DEFAULT 'Pending',
    message     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (module_id)   REFERENCES Module(module_id) ON DELETE SET NULL
);

CREATE TRIGGER set_updated_at_match_request
  BEFORE UPDATE ON MatchRequest
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================
-- STUDY SESSIONS
-- =============================================
CREATE TABLE StudySession (
    session_id     SERIAL PRIMARY KEY,
    host_id        INT NOT NULL,
    title          VARCHAR(255),
    micro_goal     VARCHAR(255),
    duration       INT DEFAULT 0,
    focus_duration INT DEFAULT 0,
    break_duration INT DEFAULT 0,
    status         VARCHAR(20) DEFAULT 'active',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at   TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TABLE SessionMember (
    member_id    SERIAL PRIMARY KEY,
    session_id   INT NOT NULL,
    user_id      INT NOT NULL,
    status       VARCHAR(20) DEFAULT 'focus',
    status_timer INT DEFAULT 0,
    progress     INT DEFAULT 0,
    joined_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES StudySession(session_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TABLE SessionReflection (
    reflection_id SERIAL PRIMARY KEY,
    session_id    INT NOT NULL,
    user_id       INT NOT NULL,
    content       TEXT,
    rating        INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES StudySession(session_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES "User"(user_id) ON DELETE CASCADE
);

-- =============================================
-- CHAT & MESSAGING
-- =============================================
CREATE TABLE ChatConversation (
    conversation_id SERIAL PRIMARY KEY,
    name            VARCHAR(255),
    type            VARCHAR(20) DEFAULT 'friend',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ConversationMember (
    id              SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL,
    user_id         INT NOT NULL,
    role            VARCHAR(20) DEFAULT 'member',
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ChatConversation(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE ChatMessage (
    message_id      SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    text            TEXT,
    file_url        VARCHAR(500),
    file_type       VARCHAR(100),
    file_name       VARCHAR(255),
    file_size       INT,
    duration        INT,
    is_announcement BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ChatConversation(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)       REFERENCES "User"(user_id) ON DELETE CASCADE
);

-- =============================================
-- CALENDAR & EVENTS
-- =============================================
CREATE TABLE CalendarEvent (
    event_id     SERIAL PRIMARY KEY,
    creator_id   INT NOT NULL,
    name         VARCHAR(255) NOT NULL,
    topic        VARCHAR(255),
    location     VARCHAR(255),
    event_date   DATE NOT NULL,
    booking_time VARCHAR(100),
    type         VARCHAR(100) DEFAULT 'Study Session',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

CREATE TRIGGER set_updated_at_calendar_event
  BEFORE UPDATE ON CalendarEvent
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE EventParticipant (
    id       SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    user_id  INT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES CalendarEvent(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE(event_id, user_id)
);

CREATE TABLE EventComment (
    comment_id SERIAL PRIMARY KEY,
    event_id   INT NOT NULL,
    user_id    INT NOT NULL,
    text       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES CalendarEvent(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES "User"(user_id) ON DELETE CASCADE
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE Notification (
    notification_id SERIAL PRIMARY KEY,
    user_id         INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    type            VARCHAR(20) DEFAULT 'info',
    is_read         BOOLEAN DEFAULT FALSE,
    nav_target      VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "User"(user_id) ON DELETE CASCADE
);

-- =============================================
-- BADGES & GAMIFICATION
-- =============================================
CREATE TABLE Badge (
    badge_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    category    VARCHAR(50),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE UserBadge (
    user_badge_id SERIAL PRIMARY KEY,
    user_id       INT NOT NULL,
    badge_id      INT NOT NULL,
    is_selected   BOOLEAN DEFAULT FALSE,
    awarded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES Badge(badge_id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_id)
);

-- =============================================
-- FRIENDS
-- =============================================
CREATE TABLE Friendship (
    friendship_id SERIAL PRIMARY KEY,
    user_id       INT NOT NULL,
    friend_id     INT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES "User"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
);

