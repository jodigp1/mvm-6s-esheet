-- ============================================================
-- Migration v2 — Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. checklist_items: tambah tipe & jawaban_custom
alter table checklist_items
  add column if not exists tipe text not null default 'bobot'
    check (tipe in ('bobot', 'non_bobot')),
  add column if not exists jawaban_custom jsonb;

-- 2. members: tambah serial number camera & HT + toggle wajib HT
alter table members
  add column if not exists sn_camera   text,
  add column if not exists sn_ht       text,
  add column if not exists ht_required boolean not null default true;

-- 3. audit_results: tambah kolom non_bobot_answers
alter table audit_results
  add column if not exists non_bobot_answers jsonb;

-- 4. app_config: tabel baru untuk simpan password yang bisa diubah dari UI
create table if not exists app_config (
  key   text primary key,
  value text not null
);
alter table app_config enable row level security;
-- Tidak ada policy anon — hanya service_role yang bisa akses

-- Seed: settings_password default (ganti sesuai keinginan)
insert into app_config (key, value) values
  ('settings_password', 'admin')
on conflict (key) do nothing;
