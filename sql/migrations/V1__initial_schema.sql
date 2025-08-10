-- Initial schema for core entities and supporting types

CREATE EXTENSION IF NOT EXISTS citext;

-- Enums
CREATE TYPE user_role AS ENUM ('PATIENT', 'DOCTOR', 'LAB', 'ADMIN');
CREATE TYPE raw_status AS ENUM ('RECEIVED','PARSED','VALIDATION_FAILED','PROCESSED','DLQ');
CREATE TYPE result_status AS ENUM ('NEW','AVAILABLE','RETRACTED','UPDATED');
CREATE TYPE audit_actor AS ENUM ('USER','SYSTEM','ADMIN_TOKEN');

-- Core tables
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  external_ref TEXT,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  sex TEXT,
  contact JSONB,
  pii_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  lanr VARCHAR(9),
  patient_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX users_lanr_doctor_unique
  ON users(lanr)
  WHERE role = 'DOCTOR' AND lanr IS NOT NULL;

CREATE TABLE practices (
  id UUID PRIMARY KEY,
  name TEXT,
  bsnr VARCHAR(9) UNIQUE,
  address JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_practices (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  practice_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, practice_id)
);

CREATE TABLE raw_messages (
  id UUID PRIMARY KEY,
  source_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_size INT NOT NULL,
  sha256 CHAR(64) NOT NULL UNIQUE,
  extracted_lanr VARCHAR(9),
  extracted_bsnr VARCHAR(9),
  external_message_id TEXT,
  status raw_status NOT NULL DEFAULT 'RECEIVED',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX raw_msg_source_extmsg_unique
  ON raw_messages(source_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX raw_msg_extracted_lanr_idx ON raw_messages(extracted_lanr);
CREATE INDEX raw_msg_status_idx ON raw_messages(status);

CREATE TABLE results (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  practice_id UUID REFERENCES practices(id),
  ordering_lanr VARCHAR(9),
  raw_message_id UUID UNIQUE REFERENCES raw_messages(id) ON DELETE RESTRICT,
  message_uid TEXT,
  hash CHAR(64),
  result_date TIMESTAMPTZ,
  status result_status NOT NULL DEFAULT 'NEW',
  duplicate_of_result_id UUID REFERENCES results(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX results_message_uid_unique
  ON results(message_uid)
  WHERE message_uid IS NOT NULL;

CREATE INDEX results_patient_idx ON results(patient_id);
CREATE INDEX results_ordering_lanr_idx ON results(ordering_lanr);

CREATE TABLE reports (
  id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  pdf_storage_path TEXT NOT NULL,
  pdf_sha256 CHAR(64) NOT NULL,
  pdf_size INT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (result_id, version)
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type audit_actor NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  ip INET,
  user_agent TEXT,
  details JSONB
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip INET,
  user_agent TEXT,
  UNIQUE (user_id, token_hash)
);