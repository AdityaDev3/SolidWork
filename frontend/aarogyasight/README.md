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
The shared `app.js` checks ClimateGuard `GET /health`. The Climate Data page loads Pune weather through the backend and labels Open-Meteo current conditions as model estimates (not station observations); its daily historical table uses reanalysis, not measured station data. The Reports page displays only Pune dengue records from the documented official-CSV import workflow; without a verified import it shows an unavailable state rather than sample counts. See `ClimateGuard/data/README.md` for the schema.

`GET /api/weather/pune` returns current modeled temperature, relative humidity, and current-interval precipitation for Pune. `GET /api/weather/pune/history` returns the previous 30 complete days of historical model reanalysis. Open-Meteo provides global model-based coverage; data freshness follows provider model-run ingestion and varies by selected model, so these are estimates rather than a fixed-frequency station feed. No API key is required; requests are made server-side and cached (15 minutes current, 6 hours historical). See the [Open-Meteo documentation](https://open-meteo.com/en/docs) and [historical weather documentation](https://open-meteo.com/en/docs/historical-weather-api). IMD's documented AWS API returned HTTP 401 when its mapping endpoint was checked without credentials, so it is not used.

`GET /api/dengue/pune` reads `ClimateGuard/data/pune_dengue_cases.csv` when supplied. No machine-readable Pune case dataset was verified or imported for this integration. Maharashtra-wide records are not relabelled as Pune data.

`GET /api/environment/pune` reports unavailable until NASA MODIS rasters can be authenticated, quality-screened, and spatially extracted for Pune. Candidate NDVI source: [MOD13Q1.061](https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061) (250 m, 16-day composite, NDVI scale factor 0.0001). A candidate derived surface-water indicator is NDWI from green and near-infrared reflectance in [MOD09A1.061](https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod09a1-061) (500 m, 8-day composite). Both require Earthdata Login, geospatial raster processing, QA/cloud screening, Pune boundary selection, and date alignment. NDWI is not a direct water-area measurement. No NDVI or surface-water values are fabricated.

The Predictions page keeps the existing `/predict` model functional and displays its warning. The Random Forest was trained on synthetic demonstration records, so its output is experimental and not a validated real-world outbreak forecast. Existing maps, alerts, risk charts, and unconnected sensor values remain illustrative; the sensor readings no longer drift as if live. Predictions are not medical advice.

## Data attribution
India boundaries: Amazing-coder1203/BharatMaps (public GeoJSON), simplified for display. Neighboring countries: johan/world.geo.json. City image is AI-generated illustrative imagery, not a verified location photo.

## Motion layer
Loaded after styles.css / app.js on every page. It wraps update() and updateCharts(), so existing UI updates animate automatically.
- Load: staggered entrance, headline letters, hero heartbeat line, map sweeping in west to east, numbers counting up
- Map: colour change spreads outward from the selected district, rings pulse on markers, hover card shows live disease and level, legend focus, eased zoom
- Charts: lines draw on, dots pop, hover shows date plus predicted and historical values
- Controls: sliding nav indicator and disease-tab pill, button ripple, spotlight on cards, press feedback, `/` focuses search
- Theme: light/dark toggle with a circular reveal (remembered in localStorage)
- prefers-reduced-motion switches all of it off


## ClimateGuard local development

Serve this folder over HTTP (do not open pages with `file://`): from this directory run `python -m http.server 5500 --bind 127.0.0.1`, then visit `http://127.0.0.1:5500/index.html`. Start the API from `P:\fusion hackthon 2\ClimateGuard` with `..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8002`. Override the development API URL by defining `window.CLIMATEGUARD_API_BASE` before `app.js` loads. No API key is required for the current Open-Meteo requests.
