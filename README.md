# Lime Wood Engineering v5.0 — Live BMS Centre

This release adds a read-only Niagara BMS integration layer.

## Included
- Live BMS Centre in the main menu
- Secure shortcuts to the Niagara estate and building graphics
- Staff House, Main House, Coach House, Spa, Green Barn, The Crescent, Pavilion and oil-system links
- Asset-level “View Live BMS” button based on plant-room mapping
- Estate-network/VPN notice and connection test
- Niagara host configuration in `assets/config.js`

## Safety boundary
This release does not write to Niagara, change setpoints, start/stop plant, or bypass Niagara authentication. It only opens existing HTTPS graphics.

## Deployment
Upload the extracted matching files and folders over the existing GitHub repository. Do not delete unrelated existing folders such as `data` or `documents`.
