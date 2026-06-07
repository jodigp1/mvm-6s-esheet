// types/database.ts — generated dari schema, update kalau ada perubahan tabel

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      lokasi: {
        Row: {
          id: string
          nama: string
          kode: string
          jumlah_pic: number
          aktif: boolean
          created_at: string
          icon?: string
          color?: string
        }
        Insert: Omit<Database['public']['Tables']['lokasi']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lokasi']['Insert']>
      }
      members: {
        Row: {
          id: string
          lokasi_id: string
          nama: string
          urutan: number
          aktif: boolean
          is_auditor: boolean
        }
        Insert: Omit<Database['public']['Tables']['members']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['members']['Insert']>
      }
      score_config: {
        Row: {
          id: string
          nilai: number
          label: string
          deskripsi: string | null
          warna: string | null
        }
        Insert: Omit<Database['public']['Tables']['score_config']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['score_config']['Insert']>
      }
      checklist_items: {
        Row: {
          id: string
          lokasi_id: string
          nomor: number
          item: string
          deskripsi: string | null
          bobot: number
          aktif: boolean
        }
        Insert: Omit<Database['public']['Tables']['checklist_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['checklist_items']['Insert']>
      }
      audit_sessions: {
        Row: {
          id: string
          lokasi_id: string
          tanggal: string
          auditor1: string
          auditor2: string | null
          status: 'draft' | 'completed'
          waktu_proses: string | null
          avg_score_pct: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_sessions']['Insert']>
      }
      audit_results: {
        Row: {
          id: string
          session_id: string
          lokasi_id: string
          tanggal: string
          auditee_name: string
          scores: Json | null
          remarks: Json | null
          total_score: number | null
          max_score: number | null
          persen: number | null
          kategori: 'EX' | 'SD' | 'NI' | null
          skipped: boolean
          skip_reason: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_results']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_results']['Insert']>
      }
    }
  }
}

// ── Helper types ──────────────────────────────────────────────
export type Lokasi        = Database['public']['Tables']['lokasi']['Row']
export type Member        = Database['public']['Tables']['members']['Row']
export type ScoreConfig   = Database['public']['Tables']['score_config']['Row']
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row']
export type AuditSession  = Database['public']['Tables']['audit_sessions']['Row']
export type AuditResult   = Database['public']['Tables']['audit_results']['Row']

// ── Session state (simpan di cookie/sessionStorage saat audit berjalan) ──
export interface ActiveSession {
  sessionId:  string
  lokasiId:   string
  lokasiNama: string
  tanggal:    string
  auditor1:   string
  auditor2?:  string
  members:    string[]
  startTime:  number  // Date.now()
}

// ── Skip reason options ──
export type SkipReason = 'Cuti' | 'Sakit' | 'Dinas luar' | 'Lainnya'
export const SKIP_REASONS: SkipReason[] = ['Cuti', 'Sakit', 'Dinas luar', 'Lainnya']

// ── Kategori thresholds ──
export function hitungKategori(persen: number): 'EX' | 'SD' | 'NI' {
  if (persen >= 85) return 'EX'
  if (persen >= 60) return 'SD'
  return 'NI'
}

export const KATEGORI_LABEL: Record<string, string> = {
  EX: 'Excellent',
  SD: 'Standard',
  NI: 'Need Improvement',
}
