-- pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- POSTGRESQL DATABASE

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- this will line up with user id if exists, otherwise it is an AI guy
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT, -- this could be a one liner
    system_prompt TEXT, -- this could describe agent behavior or what a person likes to do
    temperature FLOAT DEFAULT 0.0,
    voice TEXT, -- which voice name to use for the persona
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL -- if linked to a profile (The idea is that this is context about the profile that helps AI agents understand it)
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    google_file_id TEXT,
    content TEXT,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE -- if linked to a profile
);

CREATE TABLE IF NOT EXISTS rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    total_points INT DEFAULT 100,
    standard_length INT DEFAULT 5 -- determines how long each standard should be.
);

CREATE TABLE IF NOT EXISTS standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    rubric_id UUID REFERENCES rubrics(id) ON DELETE CASCADE,
    items TEXT[] -- this will be a list of items that are in the standard.
);

CREATE TYPE field_type AS ENUM ('persona', 'document', 'numerical', 'categorical', 'text');

CREATE TABLE IF NOT EXISTS fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    field_type field_type NOT NULL
);

CREATE TABLE IF NOT EXISTS parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    value TEXT -- this could be string (uuid for persona, document), or numerical or categorical, or text
);

CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    field_ids UUID[], -- these correspond to what fields should be used for this training.
    active BOOLEAN DEFAULT FALSE,
    preparation BOOLEAN DEFAULT FALSE
); -- these would be the "simulations", allowing for multiple scenarios for the training

CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    training_id UUID REFERENCES trainings(id) ON DELETE CASCADE,
    rubric_id UUID REFERENCES rubrics(id) ON DELETE SET NULL,
    parameter_ids UUID[] -- these would be used corresponding to the fields in the training.
); -- these are like "scenarios". These cannot be instantiated directly, just a template. If the training is preperation, then all unfilled will show up in forms.

CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    training_id UUID REFERENCES trainings(id) ON DELETE CASCADE
); -- these are nothing but instances of the trainings.

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    completed BOOLEAN DEFAULT FALSE,
    title TEXT,
    trace_id TEXT, -- openAI trace id
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    error TEXT NULL, -- if there is an error, we will store here
    content TEXT NOT NULL,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL -- this will reference the instance of the user that is speaking. We might have many versions of the same user.
);

CREATE TABLE IF NOT EXISTS hints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE, -- will show up right below this message
    contents TEXT[] -- this will be a list of contents that are in the hint.
);

CREATE TABLE IF NOT EXISTS rubric_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    score INT NOT NULL
);

CREATE TABLE IF NOT EXISTS standard_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    standard_id UUID REFERENCES standards(id) ON DELETE CASCADE,
    rubric_grade_id UUID REFERENCES rubric_grades(id) ON DELETE CASCADE,
    score INT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TYPE question_type AS ENUM ('mcq', 'frq');

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    stem TEXT NOT NULL, -- the question stem
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    question_type question_type NOT NULL,
    options TEXT[] NULL, -- if mcq, this will be the options
    value TEXT NULL -- this is either the frq or mcq selection
);

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    strengths TEXT[],
    weaknesses TEXT[],
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE
);


