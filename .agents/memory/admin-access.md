---
name: Admin access
description: Who is the admin and how admin access is enforced in Gol da Sorte
---

# Admin Access Rule

Only the phone number **82993526160** (owner: Kin Lemos) is authorized to see and use the admin panel button.

**Why:** The owner explicitly requested this on 2026-07-02. No other user should ever see the ⚙️ admin button.

**How to apply:**
- The server endpoint `GET /admin/check-admin-phone` hardcodes `ADMIN_PHONE = "82993526160"` — do NOT move this to a DB setting or env var without the owner's explicit approval.
- The frontend (`App.tsx`) wraps the admin button in `{isPhoneAdmin && (...)}` — `isPhoneAdmin` is set by the result of that endpoint.
- Never add any other way to access the admin panel (e.g., URL params like `?admin=1`) for regular users.
