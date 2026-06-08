-- ============================================================
-- Migration v3 — Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. members: tambah cam_required (mirror ht_required)
alter table members
  add column if not exists cam_required boolean not null default true;

-- 2. audit_sessions: simpan snapshot checklist saat submit
--    agar history tidak terpengaruh jika checklist diedit/dihapus
alter table audit_sessions
  add column if not exists checklist_snapshot jsonb;
