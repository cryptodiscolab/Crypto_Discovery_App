# Kiro Work Report — API TypeScript Hardening Session

**Tanggal:** 2026-05-16  
**Workspace:** `E:\Disco Gacha\Disco_DailyApp`  
**Area kerja:** `Raffle_Frontend/api`  
**Tujuan:** Menangani error TypeScript pada bundle API yang muncul dari strict `unknown` handling, payload typing, dan Supabase dynamic-table typing.

---

## 1. Ringkasan Eksekutif

Pada sesi ini dilakukan hardening TypeScript secara surgical pada beberapa file API backend Vercel serverless:

- `Raffle_Frontend/api/admin-bundle.ts`
- `Raffle_Frontend/api/user-bundle.ts`
- `Raffle_Frontend/api/is-admin.ts`
- `Raffle_Frontend/api/lurah-cron.ts`

Fokus utama adalah memperbaiki error yang dilaporkan pada API bundle, terutama:

- `payload` bertipe `unknown` yang dipakai langsung sebagai object.
- `unknown` yang dikirim ke parameter bertipe `Json`.
- Spread operation dari `unknown`.
- Catch variable `unknown` yang dipakai langsung sebagai `Error`.
- Import type yang tidak lagi diekspor.
- Supabase dynamic table query yang tidak ada di generated type.

Verifikasi dilakukan dengan menjalankan:

```powershell
npx tsc --noEmit --pretty false
```

di folder:

```text
Raffle_Frontend
```

Hasil verifikasi menunjukkan error API yang menjadi target sesi sudah tidak muncul pada output terbaru, tetapi TypeScript full-project masih gagal karena banyak error existing pada area frontend `src/*`.

---

## 2. File yang Dikerjakan

### 2.1 `Raffle_Frontend/api/admin-bundle.ts`

#### Masalah awal yang ditangani

Error awal yang relevan:

- `Property '_tx_hash' does not exist...`
- `Argument of type 'unknown' is not assignable to parameter of type 'Json'.`
- `Spread types may only be created from object types.`
- `'payload' is of type 'unknown'.`
- `No overload matches this call.`
- Dynamic Supabase query ke `system_error_logs` tidak ada di schema typed client.

#### Yang diperbaiki

1. Menambahkan helper lokal untuk normalisasi payload:

```ts
type JsonObject = { [key: string]: Json | undefined };
const toJson = (value: unknown): Json => value as Json;
const toJsonObject = (value: unknown): JsonObject => (
    value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
);
```

2. Menambahkan `payloadRecord` dan `payloadArray` setelah parsing body agar akses payload tidak langsung dari `unknown`.

3. Menambahkan field `_tx_hash` ke body type agar destructuring tidak error.

4. Mengganti direct access seperti:

```ts
payload.target_address
payload.id
payload.length
payload.address
```

menjadi akses guarded/casted melalui:

```ts
payloadRecord.target_address
payloadRecord.id
payloadArray.length
payloadRecord.address
```

5. Mengganti call yang membutuhkan `Json` agar melewati `toJson(...)`.

6. Mengganti spread dari `payload` unknown menjadi spread dari `payloadRecord`.

7. Menambahkan optional `payment_token` ke `UgcMissionCreatePayload` untuk mendukung field legacy yang sebelumnya diakses via `(payload as unknown).payment_token`.

8. Menangani dynamic query `system_error_logs` memakai cast lokal supaya tidak bentrok dengan generated Supabase schema.

#### Status

- Target error API dari daftar awal pada `admin-bundle.ts` sudah ditangani.
- Ada penggunaan `any` terbatas pada query dynamic `system_error_logs` sebagai compatibility bridge karena table tersebut tidak tersedia pada generated schema typed client.

---

### 2.2 `Raffle_Frontend/api/user-bundle.ts`

#### Masalah awal yang ditangani

Error awal yang relevan:

- `"./_shared/types.js" has no exported member named '_UpdateProfilePayload'. Did you mean 'UpdateProfilePayload'?`
- Banyak error `log is of type 'unknown'`.
- Banyak error `claim is of type 'unknown'`.
- Sorting activity logs memakai `unknown` untuk `a` dan `b`.
- `unknown[]` tidak assignable ke `SettingValue`.
- `task is of type 'unknown'` pada `tasks_batch`.
- Arithmetic operation pada `unknown` untuk `mission_duration_days`.
- Dynamic `pending_sync_jobs` table tidak tersedia di generated schema.
- `initErr` unknown pada leaderboard init handling.

#### Yang diperbaiki

1. Menghapus import type yang tidak tersedia:

```ts
_UpdateProfilePayload
```

2. Menambahkan type lokal untuk activity feed:

```ts
type ActivityLogRow = Pick<Database['public']['Tables']['user_activity_logs']['Row'], ...>;
type TaskClaimRow = Pick<Database['public']['Tables']['user_task_claims']['Row'], ...>;
type ActivityFeedItem = { ... };
```

3. Mengubah mapping `logsResult.data` dari `unknown` menjadi `ActivityLogRow[]`.

4. Mengubah mapping `claimsResult.data` dari `unknown` menjadi `TaskClaimRow[]`.

5. Memastikan field nullable seperti `description` dan `created_at` punya fallback string.

6. Memperbaiki deduplication timestamp agar tidak mengharapkan nullable value.

7. Mengubah `SettingValue` agar dapat menerima `Json[]`.

8. Meng-cast `allowedTokens` ke `Json[]` untuk assignment ke settings.

9. Memberi type untuk `tasks_batch` item:

```ts
Array<{ title?: string; platform?: string; action_type?: string; link?: string }>
```

10. Memastikan operasi arithmetic pada `mission_duration_days` memakai `Number(...)`.

11. Mengubah metadata `campaign_id` menjadi string agar sesuai bentuk JSON yang aman.

12. Menambahkan bridge type lokal untuk `pending_sync_jobs` karena table tersebut tidak ada pada generated schema.

13. Memperbaiki `initErr` handling dengan pattern:

```ts
const msg = initErr instanceof Error ? initErr.message : String(initErr);
```

#### Status

- Error API yang dilaporkan pada `user-bundle.ts` sudah ditangani pada area target.
- Full project masih punya banyak error frontend existing di `src/*`, tetapi output verifikasi terbaru tidak lagi menampilkan error `api/user-bundle.ts`.

---

### 2.3 `Raffle_Frontend/api/is-admin.ts`

#### Masalah awal yang ditangani

Error awal:

```text
api/is-admin.ts(28,62): error TS18046: 'e' is of type 'unknown'.
```

#### Yang diperbaiki

Catch variable `unknown` tidak lagi diakses langsung lewat `e.message`. Diganti dengan explicit guard:

```ts
const msg = e instanceof Error ? e.message : String(e);
return res.status(200).json({ isAdmin: false, error: msg });
```

#### Status

- Error target pada `is-admin.ts` sudah diperbaiki.

---

### 2.4 `Raffle_Frontend/api/lurah-cron.ts`

#### Masalah awal yang ditangani

Error awal yang relevan:

- `initErr is of type 'unknown'`.
- Object is of type `unknown` pada dynamic Supabase query.
- Cast Supabase dynamic table yang tidak overlap dengan typed client.

#### Yang diperbaiki

1. Menambahkan type bridge lokal untuk dynamic Supabase table usage:

```ts
type LurahDynamicClient = { ... };
type TopUserQuery = { ... };
```

2. Memperbaiki `initErr` catch handling dengan `instanceof Error` guard.

3. Mengubah dynamic query `user_profiles` top-user check agar tidak memicu `unknown` property access.

4. Mengubah dynamic `system_health` heartbeat update agar tidak bentrok dengan typed Supabase client.

#### Status

- Error target pada `lurah-cron.ts` sudah ditangani.
- Untuk compatibility dengan Supabase typed client yang generic-nya tidak lengkap, digunakan cast `any` terbatas pada query dynamic.

---

## 3. Verifikasi yang Dilakukan

### 3.1 Percobaan pertama dari root repo

Command:

```powershell
npx tsc --noEmit --pretty false
```

Lokasi:

```text
E:\Disco Gacha\Disco_DailyApp
```

Hasil:

- Gagal karena root repo tidak memiliki `tsconfig.json` TypeScript project untuk frontend.
- Output menampilkan help TypeScript compiler.

### 3.2 Verifikasi dari folder frontend

Command:

```powershell
npx tsc --noEmit --pretty false
```

Lokasi:

```text
E:\Disco Gacha\Disco_DailyApp\Raffle_Frontend
```

Hasil:

- Exit code: `2`
- Full-project TypeScript masih gagal.
- Output terbaru tidak lagi menunjukkan error pada file API target:
  - `api/admin-bundle.ts`
  - `api/user-bundle.ts`
  - `api/is-admin.ts`
  - `api/lurah-cron.ts`
- Error tersisa berada di area frontend `src/*`.

---

## 4. Yang Sudah Fixed

### API Bundle Fixes

- Fixed direct object access dari `payload: unknown` di admin bundle.
- Fixed direct spread dari `payload: unknown`.
- Fixed assignment `unknown` ke parameter `Json` lewat helper cast lokal.
- Fixed missing `_tx_hash` body typing.
- Fixed removed/mismatched type import `_UpdateProfilePayload`.
- Fixed `log`, `claim`, `task`, `a`, `b` unknown access di user activity log path.
- Fixed `unknown[]` assignment ke settings token list.
- Fixed arithmetic dengan `unknown` pada `mission_duration_days`.
- Fixed `catch (e: unknown)` direct `.message` access di `is-admin.ts`.
- Fixed `catch (initErr: unknown)` direct `.message` access di `lurah-cron.ts` dan `user-bundle.ts`.
- Fixed dynamic Supabase table access pada `pending_sync_jobs`, `system_error_logs`, dan `system_health` via local bridge/cast.

---

## 5. Yang Belum Fixed

Full TypeScript project masih gagal karena error existing di frontend `src/*`. Area yang belum diperbaiki pada sesi ini:

### 5.1 Layout / Environment typing

- `src/App.tsx`
  - `top`, `bottom`, dan `config` tidak ada pada type `{}`.
- `src/components/BottomNav.tsx`
  - `config` dan `bottom` tidak ada pada type `{}`.

### 5.2 Component state / props typing

- `src/components/ErrorBoundary.tsx`
  - `_error` tidak ada pada `State`; kemungkinan harus pakai `error`.
- `src/components/home/NexusPulseStrip.tsx`
  - `dau`, `totalMembers`, `online`, `totalTx` tidak ada pada type `{}`.
- `src/components/home/RaffleCard.tsx`
  - `displayedRaffle` masih `unknown` di banyak akses.
- `src/components/home/TaskCard.tsx`
  - `task` masih `unknown`.
- `src/components/tasks/TaskList.tsx`
  - `task`, `c`, `err`, dan hook return field masih belum typed.
- `src/components/tasks/OffersList.tsx`
  - `campaign`, `query`, `c`, `err` masih `unknown`.

### 5.3 SBT / Rewards / Notification typing

- `src/components/SBTRewardsDashboard.tsx`
  - catch `err/e` masih `unknown`.
  - operasi numeric terhadap `{}`.
  - beberapa value `{}` dikirim sebagai `ReactNode`.
- `src/services/notificationService.ts`
  - `reward` masih `unknown`.

### 5.4 Auth / OAuth / Profile pages

- `src/pages/LoginPage.tsx`
  - akses `fid`, `email`, `username` pada object `{}`.
  - `unknown` dipakai sebagai `ReactNode`.
- `src/pages/OAuthCallbackPage.tsx`
  - catch `e` masih `unknown`.
- `src/pages/ProfilePage.tsx`
  - `_disconnect`, `_ecosystemSettings`, dan profile fields belum sesuai type.

### 5.5 Raffle / Tasks pages

- `src/pages/raffle/RaffleDetailPage.tsx`
  - lucide-react import `_Calendar` dan `_ArrowRight` tidak ada; harus memakai `Calendar` dan `ArrowRight`.
  - catch `e` masih `unknown`.
- `src/pages/RafflesPage.tsx`
  - `useState` belum ditemukan/import.
- `src/pages/TasksPage.tsx`
  - data collection masih `{}`/`unknown` sehingga `.map` dan property access gagal.

### 5.6 Services / Shared Context

- `src/services/raffleService.ts`
  - `r` masih `unknown`.
- `src/services/userService.ts`
  - spread dari non-object / unknown.
- `src/shared/context/FarcasterContext.tsx`
  - object masih `unknown`.
- `src/shared/context/PointsContext.tsx`
  - `reward` dan `rank_name` belum typed.
- `src/useEnvironment.ts`
  - object masih `unknown`.
- `src/wagmiConfig.ts`
  - Coinbase options masih `unknown`.
  - identifier `mock` tidak ditemukan.

---

## 6. Risiko Teknis Tersisa

1. **Full build belum hijau**  
   API target sudah dibersihkan, tetapi full `tsc` masih gagal karena frontend typing debt.

2. **Beberapa dynamic Supabase table belum ada di generated schema**  
   Table seperti `pending_sync_jobs`, `system_error_logs`, atau beberapa health/error tables perlu dipastikan sudah masuk ke generated `database.types.ts`. Jika table memang production-ready, sebaiknya regenerate schema types daripada memakai cast jangka panjang.

3. **Penggunaan `any` terbatas**  
   Ada `any` pada dynamic Supabase query untuk unblock TypeScript. Ini acceptable sebagai tactical bridge, tetapi sebaiknya diganti dengan generated DB types setelah schema lengkap.

4. **Frontend strict typing debt besar**  
   Banyak component masih menerima `{}` atau `unknown` dari hook/context/API response tanpa interface eksplisit.

---

## 7. Rekomendasi Next Step

### Prioritas 1 — Regenerate Supabase DB Types

Pastikan table dynamic berikut masuk ke generated schema:

- `pending_sync_jobs`
- `system_error_logs`
- `system_health`
- table admin/health lain yang dipakai API

Setelah itu, hapus bridge `any`/dynamic cast secara bertahap.

### Prioritas 2 — Frontend Context Typing

Buat atau perbaiki type untuk:

- environment/config context
- points context
- raffle data model
- task data model
- campaign/UGC model
- ecosystem stats model

Ini akan menurunkan banyak error `Property X does not exist on type '{}'` dan `unknown` sekaligus.

### Prioritas 3 — Fix Import/Hook Regression

Perbaiki error yang terlihat jelas:

- `src/pages/RafflesPage.tsx`: import `useState`.
- `src/pages/raffle/RaffleDetailPage.tsx`: ganti `_Calendar` menjadi `Calendar`, `_ArrowRight` menjadi `ArrowRight`.
- `src/components/ErrorBoundary.tsx`: sinkronkan `_error` vs `error` di interface `State`.

### Prioritas 4 — Run Build Loop Lagi

Setelah frontend typing diperbaiki, jalankan ulang:

```powershell
npx tsc --noEmit --pretty false
npm run build
```

---

## 8. Kesimpulan

Sesi ini berhasil menutup masalah TypeScript pada area API target yang dilaporkan, terutama di `admin-bundle.ts`, `user-bundle.ts`, `is-admin.ts`, dan `lurah-cron.ts`. Full TypeScript check masih belum pass karena error yang tersisa berada di frontend `src/*` dan bukan bagian dari patch API yang diminta pada sesi ini.

Status akhir:

- **API target:** fixed secara tactical/surgical.
- **Full project TypeScript:** masih failing karena frontend typing debt.
- **Build-ready:** belum, sampai error frontend `src/*` ikut dibereskan.
