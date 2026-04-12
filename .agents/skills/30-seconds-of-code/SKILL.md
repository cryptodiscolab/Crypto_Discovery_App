---
name: 30-seconds-of-code
description: "WORKFLOW SKILL — Gunakan referensi 30-seconds-of-code untuk membangun, meninjau, dan mengadaptasi snippet JavaScript/CSS/HTML kecil dengan pendekatan yang cepat, aman, dan lisensi-aware."
---

# Skill: 30-seconds-of-code

## Use When
- Anda perlu membuat atau memperbaiki utilitas JavaScript kecil, CSS snippets, atau HTML patterns.
- Anda ingin mengadaptasi snippet dari 30-seconds-of-code menjadi bagian dari aplikasi atau dokumentasi.
- Anda ingin menulis ulang ide snippet menjadi kode yang lebih sesuai dengan konteks proyek.
- Anda ingin mengidentifikasi pola singkat, idiom JavaScript modern, dan best practice dari koleksi snippet.

## Goal
Bantu agent bekerja dengan cepat menggunakan prinsip singkat, teruji, dan mudah dipahami dari 30-seconds-of-code, sambil menjaga kualitas, keamanan, dan kepatuhan lisensi.

## Recommended Workflow
1. Pahami konteks penggunaan snippet sebelum menyalin:
   - Apakah fungsi diperlukan untuk proyek tersebut?
   - Apakah utility-nya jelas, sederhana, dan tidak berlebihan?
   - Apakah ada alternatif built-in atau dependency yang lebih tepat?
2. Cari pola snippet yang relevan:
   - Fokus pada utilitas kecil dan reusable seperti manipulasi string, array, DOM, event, formatting, validasi, atau helper DOM/CSS.
   - Gunakan snippet sebagai inspirasi, bukan sebagai copy-paste langsung tanpa adaptasi.
3. Adaptasi kode ke standar proyek:
   - Gunakan style guide dan linting proyek.
   - Pastikan snippet bekerja di target runtime (browser, Node.js, bundler, framework).
   - Simplifikasi nama fungsi, parameter, dan dokumentasi agar jelas bagi tim.
4. Validasi dan uji:
   - Tambahkan test unit sederhana untuk snippet utilitas.
   - Uji edge case dan input tak terduga.
   - Pastikan tidak ada efek samping yang tidak diinginkan.
5. Dokumentasikan sumber dan tujuan:
   - Jelaskan bahwa idenya terinspirasi oleh 30-seconds-of-code.
   - Saat menggunakan contoh yang serupa, sertakan catatan lisensi CC-BY-4.0 jika diperlukan.

## Content Themes
- JavaScript modern: utilitas ES6+, array methods, function composition, async/await, manipulasi objek.
- CSS/HTML patterns: styling kecil, responsive patterns, layout helpers, aksesibilitas ringan.
- Best practice snippet: debugging kecil, validasi input, safe default, fallback behavior.

## Quality Safeguards
- Hindari menyalin konten besar dari repositori tanpa penyesuaian.
- Jaga keamanan: validasi input, hindari eksekusi dinamis yang tidak terkontrol, cek XSS untuk snippet DOM.
- Pastikan lisensi: 30-seconds-of-code berada di bawah CC-BY-4.0, jadi gunakan ide dan adaptasi secara wajar.
- Jangan menyimpan kredensial atau data sensitif dalam snippet kecil.

## Notes
- Skill ini tidak dimaksudkan untuk menyalin artikel atau dokumentasi secara utuh.
- Gunakan 30-seconds-of-code sebagai sumber inspirasi dan referensi pattern, bukan sebagai satu-satunya basis implementasi.
