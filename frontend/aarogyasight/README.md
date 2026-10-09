# AarogyaSight — HTML, CSS & JavaScript

Open index.html in a browser. No React, package installation, or build step is required. All pages are included, along with local photos and the India state map. Fonts load from Google Fonts when online.

## Files
- index.html: dashboard
- disease-map.html, predictions.html, climate-data.html, iot-sensors.html, insights.html, reports.html, about.html: linked pages
- styles.css: complete shared styles and semantic color tokens
- motion.css / motion.js: the animation layer (see below); delete both and the three tags per page to return to the static UI
- app.js: disease tabs, district selection, map zoom, search, notifications, forecast period, CSV export, and navigation
- assets/: local images and favicon

## Backend integration and data limits
The shared `app.js` checks the existing ClimateGuard `GET /health` endpoint. The Predictions page sends the seven required numeric fields to `POST /predict` and displays the returned risk level, optional elevated probability, and warning. The current model uses synthetic demonstration data; its output is experimental and is not a validated real-world outbreak forecast. Other climate readings, alerts, maps, charts, and sensor values remain illustrative demo content because the backend does not provide those data endpoints. Predictions are not medical advice.

## Data attribution
India boundaries: Amazing-coder1203/BharatMaps (public GeoJSON), simplified for display. Neighboring countries: johan/world.geo.json. City image is AI-generated illustrative imagery, not a verified location photo.

## Motion layer
Loaded after styles.css / app.js on every page. It wraps update() and updateCharts(), so backend data you pass through the existing hooks animates automatically.
- Load: staggered entrance, headline letters, hero heartbeat line, map sweeping in west to east, numbers counting up
- Map: colour change spreads outward from the selected district, rings pulse on markers, hover card shows live disease and level, legend focus, eased zoom
- Charts: lines draw on, dots pop, hover shows date plus predicted and historical values
- Controls: sliding nav indicator and disease-tab pill, button ripple, spotlight on cards, press feedback, `/` focuses search
- Theme: light/dark toggle with a circular reveal (remembered in localStorage)
- Sensor readings drift slightly every few seconds as a sample live feed (motion.js, section 16; remove that block if you do not want it)
- prefers-reduced-motion switches all of it off


## ClimateGuard local development

Serve this folder over HTTP (do not open pages with `file://`): from this directory run `python -m http.server 5500 --bind 127.0.0.1`, then visit `http://127.0.0.1:5500/index.html`. Start the API from `P:\fusion hackthon 2\ClimateGuard` with `..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8002`. The shared `app.js` checks `/health`; the Predictions page submits the seven required numeric fields to `/predict`. Override the development API URL by defining `window.CLIMATEGUARD_API_BASE` before `app.js` loads. Predictions are experimental because the current model uses synthetic demonstration data.
