-- Omnichannel AI Workspace — Postgres schema for Supabase
-- RLS disabled; auth handled in API layer.

-- Tenants: multi-tenant config (system prompt, channels, actions)
CREATE TABLE tenants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  system_prompt     text NOT NULL,
  allowed_channels  text[] DEFAULT '{telegram}',
  allowed_actions   text[] DEFAULT '{}',
  api_key           text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  plan              text DEFAULT 'starter',
  created_at        timestamptz DEFAULT now()
);

-- Users: per-tenant, identified by channel (e.g. telegram id)
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name        text,
  channel_identifiers jsonb DEFAULT '{}',
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- Conversations: one per (tenant, channel, thread)
CREATE TABLE conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel           text NOT NULL,
  channel_thread_id text NOT NULL,
  is_group          boolean DEFAULT false,
  last_active_at    timestamptz DEFAULT now(),
  UNIQUE(tenant_id, channel, channel_thread_id)
);

CREATE INDEX idx_conversations_tenant_channel_thread ON conversations(tenant_id, channel, channel_thread_id);

-- Messages: conversation history for memory
CREATE TABLE messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                text NOT NULL CHECK (role IN ('user', 'assistant')),
  content             text NOT NULL,
  action_triggered    jsonb,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Client-facing content (menu, hours, pricing, FAQs, etc.)
CREATE TABLE client_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         text NOT NULL,
  title       text,
  content     text NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX idx_client_content_tenant_key ON client_content(tenant_id, key);

-- Live inventory (synced from a published Google Sheet)
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  unit text,
  unit_price numeric,
  unit_price_text text,
  updated_at timestamptz DEFAULT now(),
  source jsonb
);

CREATE INDEX idx_inventory_items_tenant_category ON inventory_items(tenant_id, category);
CREATE INDEX idx_inventory_items_tenant_updated_at ON inventory_items(tenant_id, updated_at);

-- Evolving knowledge base: learnings that improve the bot over time
CREATE TABLE knowledge_base (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  topic       text NOT NULL,
  content     text NOT NULL,
  source      text DEFAULT 'admin' CHECK (source IN ('admin', 'user', 'conversation')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_knowledge_base_tenant_id ON knowledge_base(tenant_id);
