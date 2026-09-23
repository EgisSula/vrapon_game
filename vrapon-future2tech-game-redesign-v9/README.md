# VrapOn Future2Tech Game — V11

Offline touchscreen game for the VrapOn Future2Tech booth. Open `index.html`
in Chrome or Edge; no server, internet connection, build step or installation is
required.

## What is included

- Premium illustrated Albania map with relief, roads, sea and city labels.
- 21 individually clickable destinations.
- Animated ride from Tiranë to the chosen city.
- Five fixed, reusable coupons:
  - `Future5` — 5% off (26.33% chance)
  - `Future10` — 10% off (26.33% chance)
  - `Future15` — 15% off (26.33% chance)
  - `Future20` — 20% off (20% chance)
  - `Future50` — 50% off (1% chance)
- The supplied VrapOn QR image is displayed unchanged.
- The result stays on screen until `PLAY AGAIN` is pressed, or the booth is
  idle for 25 seconds (configurable via `idleResetDelay` in `script.js`), in
  which case it quietly returns to the start screen so the next visitor
  always finds it ready to go.
- Fills the screen edge-to-edge on any portrait display — a phone, a tablet,
  or a very tall digital-signage panel (tested against a 66 cm × 188 cm
  50" portrait kiosk screen) — with no black letterboxing and no cropped map.
- A small full-screen toggle sits in the top-right corner on every screen,
  for whenever the game is opened in an ordinary browser tab (testing, a
  demo, or a visitor's own phone) rather than launched with a kiosk flag
  that's already full screen.

## Clickable cities

Bajram Curri, Shkodër, Kukës, Lezhë, Burrel, Dibër, Krujë, Durrës, Tiranë,
Elbasan, Lushnjë, Pogradec, Fier, Berat, Korçë, Vlorë, Tepelenë, Përmet,
Gjirokastër, Sarandë and Ksamil.

## Files

- `index.html` — screen structure
- `style.css` — kiosk layout and visual design
- `script.js` — city hotspots, ride animation and prize selection
- `assets/albania-premium-map.jpeg` — illustrated map supplied for V9
- `assets/download-qr.png` — original QR code (unchanged)
- `assets/vrapon-logo.png` — VrapOn logo
- `assets/vrapon-taxi-photo.png` — start-screen car image
- `assets/vrapon-car.svg` — animated map car

## Touchscreen setup

1. Extract the ZIP fully to a normal folder.
2. Open `index.html` in Chrome or Edge.
3. Press `F11` for full screen.
4. For a dedicated kiosk, create a Windows shortcut whose target is:
   `msedge.exe --kiosk "C:\FULL\PATH\TO\index.html" --edge-kiosk-type=fullscreen`

Do not open `index.html` while it is still inside the ZIP archive, because the
browser may fail to load the local CSS, JavaScript and images.
