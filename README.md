# Steam DealX Extension

Chrome extension that injects a deal panel directly into Steam Store pages — showing external store prices, historical lows, and active bundles alongside the native Steam listing.

Works with games (`/app/`), packages (`/sub/`), and bundles (`/bundle/`) by calling the [SteamDealX API](https://github.com/renananjos51/steam-dealx) and rendering results in-page without leaving the Store.

## Features

- **Per-store prices** — retail and keyshop offers sorted by price, sourced from gg.deals and IsThereAnyDeal
- **Historical low** — lowest price ever recorded across all tracked stores
- **Active bundles** — links to bundles currently containing the game
- **Collapsible card** — collapse/expand state is persisted locally
- **Configurable** — popup lets you set region (default `br`) and API base URL

## Installation (unpacked)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `steam-dealx-extension` folder
5. Navigate to any Steam Store page — the deal card appears automatically

## Popup Settings

Click the extension icon to open the settings popup:

| Setting | Description | Default |
|---------|-------------|---------|
| Enable / Disable | Toggle the deal card on all Steam pages | Enabled |
| Region | Two-letter region code (`br`, `us`, `eu`, …) | `br` |
| API Base URL | Base URL of the SteamDealX backend | `https://steam-dealx.onrender.com` |

Changes to **Enable** take effect immediately. **Region** and **API URL** are saved on click.

## Project Structure

```
background.js       → service worker: writes default settings on first install
manifest.json       → MV3 manifest (permissions, content script registration)
content/
  content.js        → injected into Steam Store pages; fetches deals and builds the card
  content.css       → card styles
popup/
  popup.html        → settings popup UI
  popup.js          → reads/writes chrome.storage.sync
icons/
  icon16/48/128.svg → extension icons
```

## How It Works

1. On page load, `content.js` parses the current URL to extract the product type (`app`, `sub`, `bundle`) and numeric ID.
2. It reads settings from `chrome.storage.sync` (region, API URL, enabled flag).
3. A loading card is injected into the page's left column while the API call is in flight.
4. The extension calls `GET {apiBaseUrl}/steam/{type}/{id}?region={region}` on the SteamDealX API.
5. The loading card is replaced with the rendered deal data — or an appropriate error/empty state.

## Self-Hosting

The extension defaults to `https://steam-dealx.onrender.com`. To point it at a local instance:

1. Run the [SteamDealX API](https://github.com/renananjos51/steam-dealx) locally (`https://localhost:5001`)
2. Open the extension popup and set **API Base URL** to `https://localhost:5001`
3. Add `"https://localhost:5001/*"` to `host_permissions` in `manifest.json` if needed, then reload the unpacked extension

## Attribution

Deal links sourced from gg.deals are displayed as active hyperlinks per their Terms of Service.
