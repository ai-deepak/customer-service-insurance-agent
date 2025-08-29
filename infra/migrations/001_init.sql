CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	source TEXT NOT NULL,
	title TEXT,
	content TEXT NOT NULL,
	embedding vector(1536),
	metadata JSONB DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
	policy_id TEXT PRIMARY KEY,
	plan TEXT,
	collision_coverage INT,
	roadside_assistance BOOLEAN,
	deductible INT
);

CREATE TABLE IF NOT EXISTS claims (
	claim_id TEXT PRIMARY KEY,
	status TEXT NOT NULL,
	last_updated TIMESTAMPTZ DEFAULT now()
);
