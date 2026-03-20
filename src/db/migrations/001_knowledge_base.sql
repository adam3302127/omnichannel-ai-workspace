-- Migration: Add evolving knowledge base
-- Run in Supabase SQL editor if you already have the base schema deployed.

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  topic       text NOT NULL,
  content     text NOT NULL,
  source      text DEFAULT 'admin' CHECK (source IN ('admin', 'user', 'conversation')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant_id ON knowledge_base(tenant_id);
