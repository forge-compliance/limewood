# Limewood Engineering App v5.3

Adds CSV import to the Valve Register.

## Import workflow
1. Open Valve Register.
2. Select Import CSV.
3. Choose a plant room and CSV file.
4. Review the preview and duplicate count.
5. Import new rows or update matching tags.

The importer supports standard exported headings and the Forest Cottage two-column format (`Valve No`, `Description`). Numeric valve numbers are converted to stable tags such as `FC-V-001`.

# Limewood Engineering v5.2

Adds a working valve register and PPM planner.

- PPM schedules are generated from asset PPM frequency fields.
- Valve records include tag, duty, type, size, position, location and isolation purpose.
- Both modules support search, filters, editing and CSV export.
- They work immediately using local browser storage.
- For shared cloud records, run `SUPABASE_V5.2_OPTIONAL.sql` once in the Supabase SQL editor.

Upload the matching files/folders over the existing repository. Do not delete existing data, documents, manifest or service-worker files.


## v5.3.4
- Keeps valve import Cancel and Import valves buttons visible on mobile.
- Detects Supabase JWT clock-skew errors and gives clear automatic date/time instructions.
