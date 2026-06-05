# 6S Audit MVM

Sistem audit 6S lingkungan kerja PT Asahimas Chemical.

## Stack
- **Frontend/Backend**: Next.js 14 App Router
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + Plus Jakarta Sans
- **Hosting**: Vercel
- **Charts**: Recharts
- **Export**: SheetJS (Excel) + jsPDF (PDF)

## Setup

### 1. Supabase
1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** → New Query
3. Copy-paste isi file `sql/schema.sql` → Run
4. Pastikan semua tabel ter-create dan seed data masuk

### 2. Environment Variables
```bash
cp .env.local.example .env.local
```
Isi value di `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — dari Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — dari halaman yang sama
- `SUPABASE_SERVICE_ROLE_KEY` — dari halaman yang sama (jaga kerahasiaan!)
- `APP_PASSWORD` — password yang akan dipakai user untuk login
- `AUTH_TOKEN_SECRET` — random string panjang (min 32 karakter)

### 3. Development (StackBlitz)
Buka [stackblitz.com](https://stackblitz.com) → Import from GitHub → paste URL repo

### 4. Deploy ke Vercel
1. Push ke GitHub
2. Import project di [vercel.com](https://vercel.com)
3. Set semua environment variables yang sama seperti `.env.local`
4. Deploy

## Struktur Folder
```
src/
├── app/
│   ├── page.tsx          → Setup sesi (/)
│   ├── login/            → Login (/login)
│   ├── audit/            → Sesi audit (/audit)
│   ├── review/           → Review & export (/review)
│   ├── history/          → Riwayat audit (/history)
│   ├── settings/         → Pengaturan (/settings)
│   ├── dashboard/        → Dashboard analitik (/dashboard)
│   └── api/              → API routes (pengganti GAS)
├── components/           → Reusable components
├── lib/
│   └── supabase.ts       → Supabase client
└── types/
    └── database.ts       → TypeScript types + helpers
```

## Halaman
| Route | Deskripsi |
|-------|-----------|
| `/` | Setup sesi audit baru + banner resume |
| `/audit` | Pengisian checklist per auditee |
| `/review` | Review hasil + export Excel/PDF |
| `/history` | Riwayat semua sesi, filter, import/export |
| `/settings` | CRUD lokasi, member, checklist, score config |
| `/dashboard` | Analitik: KPI, chart distribusi, ranking |
