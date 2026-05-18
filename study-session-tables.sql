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

CREATE TABLE StudySession (
    session_id     SERIAL PRIMARY KEY,
    host_id        INT NOT NULL,
    title          VARCHAR(255),
    micro_goal     VARCHAR(255),
    duration       INT DEFAULT 0,
    planned_duration_seconds INT,
    focus_duration INT DEFAULT 0,
    break_duration INT DEFAULT 0,
    status         VARCHAR(20) DEFAULT 'active',
    started_at     TIMESTAMP,
    ended_at       TIMESTAMP,
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
    left_at      TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES StudySession(session_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE(session_id, user_id)
);

CREATE TABLE SessionReflection (
    reflection_id SERIAL PRIMARY KEY,
    session_id    INT NOT NULL,
    user_id       INT NOT NULL,
    content       TEXT,
    rating        INT,
    quick_rating  VARCHAR(50),
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES StudySession(session_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE(session_id, user_id)
);

CREATE TABLE status_events (
    id                           SERIAL PRIMARY KEY,
    study_session_participant_id INT NOT NULL,
    status                       VARCHAR(50) NOT NULL,
    started_at                   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at                     TIMESTAMP,
    FOREIGN KEY (study_session_participant_id) REFERENCES SessionMember(member_id) ON DELETE CASCADE
);

CREATE TABLE micro_goals (
    id                 SERIAL PRIMARY KEY,
    study_session_id   INT NOT NULL,
    created_by_user_id INT NOT NULL,
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    queue_position     INT NOT NULL,
    status             VARCHAR(50) NOT NULL,
    activated_at       TIMESTAMP,
    completed_at       TIMESTAMP,
    FOREIGN KEY (study_session_id)   REFERENCES StudySession(session_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE (study_session_id, queue_position)
);

CREATE TABLE micro_goal_progress (
    id               SERIAL PRIMARY KEY,
    micro_goal_id    INT NOT NULL,
    user_id          INT NOT NULL,
    progress_percent INT NOT NULL DEFAULT 0,
    is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at     TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (micro_goal_id) REFERENCES micro_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)       REFERENCES "User"(user_id) ON DELETE CASCADE,
    UNIQUE (micro_goal_id, user_id)
);

CREATE TABLE micro_goal_workings (
    id                     SERIAL PRIMARY KEY,
    micro_goal_progress_id INT NOT NULL,
    content_type           VARCHAR(50) NOT NULL,
    text_content           TEXT,
    image_url              VARCHAR(500),
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (micro_goal_progress_id) REFERENCES micro_goal_progress(id) ON DELETE CASCADE
);

CREATE TABLE micro_goal_ai_checks (
    id                SERIAL PRIMARY KEY,
    study_session_id  INT NOT NULL,
    micro_goal_id     INT NOT NULL,
    user_id           INT NOT NULL,
    equation_text     TEXT,
    file_name         VARCHAR(255),
    file_type         VARCHAR(50),
    feedback_status   VARCHAR(50) NOT NULL,
    summary           TEXT NOT NULL,
    strengths         JSONB NOT NULL DEFAULT '[]'::jsonb,
    issues            JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_step         TEXT,
    confidence        VARCHAR(20),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_session_id) REFERENCES StudySession(session_id) ON DELETE CASCADE,
    FOREIGN KEY (micro_goal_id)    REFERENCES micro_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)          REFERENCES "User"(user_id) ON DELETE CASCADE
);
