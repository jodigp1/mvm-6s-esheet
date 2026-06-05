-- ============================================================
-- 6S AUDIT MVM — Supabase SQL Schema
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. LOKASI
-- ============================================================
create table if not exists lokasi (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  kode        text not null,
  jumlah_pic  smallint not null default 1,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint lokasi_kode_unique unique (kode)
);

-- 2. MEMBERS
-- ============================================================
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  lokasi_id   uuid not null references lokasi(id) on delete cascade,
  nama        text not null,
  urutan      smallint not null default 0,
  aktif       boolean not null default true
);
create index if not exists members_lokasi_idx on members(lokasi_id);

-- 3. SCORE CONFIG (label skor 0–4, editable)
-- ============================================================
create table if not exists score_config (
  id          uuid primary key default gen_random_uuid(),
  nilai       smallint not null,
  label       text not null,
  deskripsi   text,
  warna       text default '#6b7280',
  constraint score_config_nilai_unique unique (nilai)
);

-- 4. CHECKLIST ITEMS
-- ============================================================
create table if not exists checklist_items (
  id          uuid primary key default gen_random_uuid(),
  lokasi_id   uuid not null references lokasi(id) on delete cascade,
  nomor       smallint not null,
  item        text not null,
  deskripsi   text,
  bobot       numeric(4,2) not null default 1.0,
  aktif       boolean not null default true
);
create index if not exists checklist_lokasi_idx on checklist_items(lokasi_id);

-- 5. AUDIT SESSIONS
-- ============================================================
create table if not exists audit_sessions (
  id              uuid primary key default gen_random_uuid(),
  lokasi_id       uuid not null references lokasi(id),
  tanggal         date not null,
  auditor1        text not null,
  auditor2        text,
  status          text not null default 'draft' check (status in ('draft','completed')),
  waktu_proses    text,
  avg_score_pct   smallint,
  created_at      timestamptz not null default now()
);
create index if not exists sessions_lokasi_idx   on audit_sessions(lokasi_id);
create index if not exists sessions_tanggal_idx  on audit_sessions(tanggal);
create index if not exists sessions_status_idx   on audit_sessions(status);

-- 6. AUDIT RESULTS
-- ============================================================
create table if not exists audit_results (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references audit_sessions(id) on delete cascade,
  lokasi_id       uuid not null references lokasi(id),
  tanggal         date not null,
  auditee_name    text not null,
  scores          jsonb,
  remarks         jsonb,
  total_score     smallint,
  max_score       smallint,
  persen          smallint,
  kategori        text check (kategori in ('EX','SD','NI')),
  skipped         boolean not null default false,
  skip_reason     text,
  created_at      timestamptz not null default now()
);
create index if not exists results_session_idx   on audit_results(session_id);
create index if not exists results_lokasi_idx    on audit_results(lokasi_id);
create index if not exists results_tanggal_idx   on audit_results(tanggal);
create index if not exists results_auditee_idx   on audit_results(auditee_name);
create index if not exists results_kategori_idx  on audit_results(kategori);


-- ============================================================
-- SEED DATA
-- ============================================================

-- Lokasi default
insert into lokasi (id, nama, kode, jumlah_pic) values
  ('11111111-1111-1111-1111-111111111111', 'CABIN',  'CABIN', 2),
  ('22222222-2222-2222-2222-222222222222', 'OTC',    'OTC',   1)
on conflict (kode) do nothing;

-- Score config default
insert into score_config (nilai, label, deskripsi, warna) values
  (0, 'Belum mulai',       'Area/item belum ditangani sama sekali',              '#ef4444'),
  (1, 'Perbaikan major',   'Terdapat ketidaksesuaian besar yang perlu diperbaiki','#f97316'),
  (2, 'Improvement minor', 'Ada perbaikan kecil yang masih diperlukan',           '#facc15'),
  (3, 'Sudah baik',        'Kondisi baik dan sesuai standar',                    '#22c55e'),
  (4, 'Sangat baik!',      'Kondisi sangat baik, melebihi standar',              '#10b981')
on conflict (nilai) do nothing;

-- Member CABIN
insert into members (lokasi_id, nama, urutan) values
  ('11111111-1111-1111-1111-111111111111', 'Risman',      1),
  ('11111111-1111-1111-1111-111111111111', 'Reynaldi',    2),
  ('11111111-1111-1111-1111-111111111111', 'Ikhsan',      3),
  ('11111111-1111-1111-1111-111111111111', 'Hajiji',      4),
  ('11111111-1111-1111-1111-111111111111', 'A. Saeful B', 5),
  ('11111111-1111-1111-1111-111111111111', 'Syihab',      6),
  ('11111111-1111-1111-1111-111111111111', 'Arif H',      7),
  ('11111111-1111-1111-1111-111111111111', 'Sahrudin',    8),
  ('11111111-1111-1111-1111-111111111111', 'Aspiyani',    9),
  ('11111111-1111-1111-1111-111111111111', 'Mukti',       10),
  ('11111111-1111-1111-1111-111111111111', 'Farid',       11),
  ('11111111-1111-1111-1111-111111111111', 'Julianto',    12),
  ('11111111-1111-1111-1111-111111111111', 'Lili M N',    13),
  ('11111111-1111-1111-1111-111111111111', 'Nurcholis',   14),
  ('11111111-1111-1111-1111-111111111111', 'Hatami',      15),
  ('11111111-1111-1111-1111-111111111111', 'Tegar',       16),
  ('11111111-1111-1111-1111-111111111111', 'Muamar',      17),
  ('11111111-1111-1111-1111-111111111111', 'Rozak',       18),
  ('11111111-1111-1111-1111-111111111111', 'TB. Adi',     19),
  ('11111111-1111-1111-1111-111111111111', 'Arya',        20),
  ('11111111-1111-1111-1111-111111111111', 'Tatang',      21);

-- Member OTC
insert into members (lokasi_id, nama, urutan) values
  ('22222222-2222-2222-2222-222222222222', 'Dhika R',     1),
  ('22222222-2222-2222-2222-222222222222', 'Kristian',    2),
  ('22222222-2222-2222-2222-222222222222', 'Mukti N',     3),
  ('22222222-2222-2222-2222-222222222222', 'Arya',        4),
  ('22222222-2222-2222-2222-222222222222', 'Tegar F',     5),
  ('22222222-2222-2222-2222-222222222222', 'Syihab',      6),
  ('22222222-2222-2222-2222-222222222222', 'Muamar',      7),
  ('22222222-2222-2222-2222-222222222222', 'Ikhsan',      8),
  ('22222222-2222-2222-2222-222222222222', 'Reynaldi',    9),
  ('22222222-2222-2222-2222-222222222222', 'Wildayanti',  10),
  ('22222222-2222-2222-2222-222222222222', 'Jodi',        11);

-- Checklist items CABIN (contoh, sesuaikan dengan checklist asli)
insert into checklist_items (lokasi_id, nomor, item, deskripsi, bobot) values
  ('11111111-1111-1111-1111-111111111111', 1,  'Sort — Pemilahan barang',         'Barang tidak diperlukan sudah dipisahkan', 1.0),
  ('11111111-1111-1111-1111-111111111111', 2,  'Sort — Label red-tag',            'Item tidak perlu diberi red-tag dan dipindahkan', 1.0),
  ('11111111-1111-1111-1111-111111111111', 3,  'Set — Penataan area kerja',       'Semua item memiliki tempat yang jelas', 1.0),
  ('11111111-1111-1111-1111-111111111111', 4,  'Set — Label & marking',           'Label dan floor marking tersedia dan jelas', 1.0),
  ('11111111-1111-1111-1111-111111111111', 5,  'Shine — Kebersihan area',         'Area bersih dari debu, kotoran, dan tumpahan', 1.0),
  ('11111111-1111-1111-1111-111111111111', 6,  'Shine — Peralatan kebersihan',    'Peralatan kebersihan tersedia dan terawat', 1.0),
  ('11111111-1111-1111-1111-111111111111', 7,  'Standardize — SOP tersedia',      'SOP/WI terpasang dan mudah diakses', 1.0),
  ('11111111-1111-1111-1111-111111111111', 8,  'Standardize — Visual management', 'Visual standar terpasang dengan benar', 1.0),
  ('11111111-1111-1111-1111-111111111111', 9,  'Sustain — Jadwal audit rutin',    'Jadwal audit 6S dijalankan secara konsisten', 1.0),
  ('11111111-1111-1111-1111-111111111111', 10, 'Sustain — Training awareness',    'Anggota tim memahami standar 6S', 1.0),
  ('11111111-1111-1111-1111-111111111111', 11, 'Safety — APD tersedia',           'APD lengkap, tersedia dan dalam kondisi baik', 1.0),
  ('11111111-1111-1111-1111-111111111111', 12, 'Safety — Jalur evakuasi',         'Jalur evakuasi bersih dan bertanda jelas', 1.0);

-- Checklist items OTC
insert into checklist_items (lokasi_id, nomor, item, deskripsi, bobot) values
  ('22222222-2222-2222-2222-222222222222', 1,  'Sort — Pemilahan barang',         'Barang tidak diperlukan sudah dipisahkan', 1.0),
  ('22222222-2222-2222-2222-222222222222', 2,  'Sort — Label red-tag',            'Item tidak perlu diberi red-tag dan dipindahkan', 1.0),
  ('22222222-2222-2222-2222-222222222222', 3,  'Set — Penataan area kerja',       'Semua item memiliki tempat yang jelas', 1.0),
  ('22222222-2222-2222-2222-222222222222', 4,  'Set — Label & marking',           'Label dan floor marking tersedia dan jelas', 1.0),
  ('22222222-2222-2222-2222-222222222222', 5,  'Shine — Kebersihan area',         'Area bersih dari debu, kotoran, dan tumpahan', 1.0),
  ('22222222-2222-2222-2222-222222222222', 6,  'Shine — Peralatan kebersihan',    'Peralatan kebersihan tersedia dan terawat', 1.0),
  ('22222222-2222-2222-2222-222222222222', 7,  'Standardize — SOP tersedia',      'SOP/WI terpasang dan mudah diakses', 1.0),
  ('22222222-2222-2222-2222-222222222222', 8,  'Standardize — Visual management', 'Visual standar terpasang dengan benar', 1.0),
  ('22222222-2222-2222-2222-222222222222', 9,  'Sustain — Jadwal audit rutin',    'Jadwal audit 6S dijalankan secara konsisten', 1.0),
  ('22222222-2222-2222-2222-222222222222', 10, 'Safety — APD tersedia',           'APD lengkap, tersedia dan dalam kondisi baik', 1.0);


-- ============================================================
-- ROW LEVEL SECURITY
-- Pakai anon key untuk read, service_role key untuk write dari API routes
-- ============================================================
alter table lokasi          enable row level security;
alter table members         enable row level security;
alter table score_config    enable row level security;
alter table checklist_items enable row level security;
alter table audit_sessions  enable row level security;
alter table audit_results   enable row level security;

-- Semua tabel: anon bisa baca (web app publik setelah login password)
create policy "anon read lokasi"          on lokasi          for select using (true);
create policy "anon read members"         on members         for select using (true);
create policy "anon read score_config"    on score_config    for select using (true);
create policy "anon read checklist_items" on checklist_items for select using (true);
create policy "anon read audit_sessions"  on audit_sessions  for select using (true);
create policy "anon read audit_results"   on audit_results   for select using (true);

-- Write hanya dari service_role (via Next.js API routes, bukan langsung dari browser)
-- Tidak perlu policy tambahan — service_role bypass RLS secara default
