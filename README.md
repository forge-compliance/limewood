# Lime Wood Engineering

Static, mobile-friendly engineering asset and compliance app for GitHub Pages.

## Upload to GitHub

1. Create a new GitHub repository.
2. Upload every file and folder from this package to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)`, then save.
6. The included `CNAME` file sets the custom domain to `limewoodengineering.pro.co.uk`.
7. At the DNS provider for `pro.co.uk`, point the `limewoodengineering` host to your GitHub Pages hostname using a CNAME record.

## Data storage

This version stores data in the browser using localStorage. Use **Settings & Backup** to export JSON backups. Data will not automatically sync between devices or users.

## Included features

- Dashboard and plant-room summaries
- Editable asset register
- Search and plant-room filters
- Document register
- Reactive job tracker
- JSON backup/import
- CSV asset export
- PWA manifest and offline cache
- Responsive mobile layout
