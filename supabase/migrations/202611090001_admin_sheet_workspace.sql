create table if not exists public.admin_sheet_records (
  id uuid primary key default gen_random_uuid(),
  sheet_key text not null,
  row_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_sheet_records_sheet_key_check check (
    sheet_key in (
      'panduan','dashboard','reminder-alert','daftar-anggota','rincian-biaya','transaksi',
      'vreeo-bank','rekap-individu','rekap-tim','log-pajak-denda','sponsorship-tracker',
      'leaderboard','season-periode','riwayat-transfer-driver','grafik-tim',
      'riwayat-season-individu','riwayat-season-ekonomi','hall-of-fame','career-path',
      'referensi','skor-lisensi-klasemen','prize-money','evaluasi-owner','pajak-kekayaan-auto'
    )
  )
);
create index if not exists admin_sheet_records_sheet_order_idx on public.admin_sheet_records(sheet_key,sort_order,created_at);
alter table public.admin_sheet_records enable row level security;
drop policy if exists "admin sheet records admin only" on public.admin_sheet_records;
create policy "admin sheet records admin only" on public.admin_sheet_records for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.admin_sheet_records to authenticated;
