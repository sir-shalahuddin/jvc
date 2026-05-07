# CI/CD Setup Instructions

Untuk mengaktifkan CI/CD otomatis ke Google Cloud Run, ikuti langkah-langkah berikut:

## 1. Persiapan GCP
1.  **Aktifkan API**: Pastikan Cloud Run, Artifact Registry, dan Cloud Build API sudah aktif di project GCP kamu.
2.  **Service Account**: Buat Service Account dengan role:
    - `Cloud Run Admin`
    - `Storage Admin`
    - `Artifact Registry Administrator`
    - `Service Account User`
3.  **Download JSON Key**: Simpan key tersebut untuk digunakan di GitHub Secrets.

## 2. GitHub Secrets
Buka repository GitHub kamu, lalu ke **Settings > Secrets and variables > Actions**. Tambahkan secret berikut:

### Wajib (Infrastruktur):
- `GCP_PROJECT_ID`: ID Project GCP kamu.
- `GCP_SA_KEY`: Isi dengan seluruh konten file JSON Service Account.

### Aplikasi (Environment):
- `GCS_BUCKET_NAME`: Nama bucket Cloud Storage.
- `GEMINI_API_KEY`: API Key dari Google AI Studio.
- `GOOGLE_CLIENT_ID`: OAuth Client ID.
- `GOOGLE_CLIENT_SECRET`: OAuth Client Secret.
- `JWT_SECRET`: String random untuk signing token.
- `ADMIN_EMAIL`: Email admin (sirajshalahuddin@gmail.com).
- `AUTH_REDIRECT_URL`: URL callback OAuth (misal: `https://retro-gcp-xxx.a.run.app/auth/google/callback`).
- `TRAKTEER_WEBHOOK_SECRET`: Token dari Trakteer.

## 3. Deployment Otomatis
- Setiap kali kamu melakukan `git push origin main`, GitHub Actions akan otomatis:
  1. Menjalankan semua unit test.
  2. Membuild Docker Image.
  3. Push ke Google Container Registry.
  4. Deploy ke Cloud Run.

---
**Catatan Free Tier**: Gunakan region `us-central1`, `us-east1`, atau `us-west1` untuk tetap berada di dalam kuota GCP Always Free Tier.
