# Lime Wood Engineering v3.5

Document Centre and SOP upload reliability update.

## Improvements
- SOP uploads no longer stop the app loading when optional controlled-document tables are unavailable.
- Existing SOP numbers can receive new revisions instead of causing duplicate-number failures.
- Duplicate revision numbers are clearly rejected before the record is completed.
- Failed database saves clean up the uploaded storage file.
- Clearer messages for storage, file-size and Supabase policy errors.
- SOP fallback saves into the standard document library when the controlled SOP tables have not been installed.
- Drawing document type is now displayed correctly.
- Mobile document-upload modal is full-screen and scrollable.
- Selected file name and size are shown before upload.
- Maximum app-side file size is 50 MB.

## Upload to GitHub
Extract this ZIP and replace the matching files in the repository. Keep the folder structure intact.

After GitHub Pages deploys, open:
https://limewood-engineering.pro/?v=34


## v3.5 mobile SOP upload fix
- Document upload modal now scrolls independently on phones.
- Textareas can no longer be resized by dragging.
- Added safe bottom spacing so the upload button remains reachable.
- Uses 16px form text to prevent mobile browser zoom.
