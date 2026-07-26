-- Qelly Part 21 migration contract only. Do not execute against production without review.
CREATE TABLE IF NOT EXISTS migration_ledger (
  migration_id text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS organizations (
  organization_id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
