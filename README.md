# Lime Wood Engineering v5.4.1

Role-based Supabase access update built from v5.4 Plant Room Hubs.

- Engineer: QR generation/printing, PPM completion, uploads, photos, documents, defects and BMS viewing.
- Supervisor: engineer permissions plus asset/valve editing and CSV imports.
- Administrator: all permissions plus plant-room creation and Administration navigation.

The app reads the role from Supabase Auth `app_metadata.role` or `user_metadata.role`. Supported values include `engineer`, `supervisor`, `administrator` and `admin`. If no role is found, the safe default is Engineer.
