/**
 * Basemap / tile layer registry.
 *
 * `env` names a Vite env var holding the provider's API key. A basemap whose
 * key is missing is filtered out of the switcher, so the UI never offers a
 * layer that would return 401s.
 *
 * Keys live in `web/.env` (git-ignored). Copy `.env.example` to `.env` and fill
 * in whichever you have. Note that Vite inlines `VITE_*` vars into the client
 * bundle, so a key here is visible to anyone who loads the page -- that is
 * normal for these services, which expect you to restrict the key by HTTP
 * referrer in the provider's dashboard. Do not put a secret server key here.
 *
 * `{s}` is expanded to the subdomains below; `{r}` to a retina marker, and
 * `{key}` to the resolved API key. Both map engines consume these templates, so
 * a basemap only has to be declared once.
 */
const SUBDOMAINS = ['a', 'b', 'c']

export const BASEMAPS = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'carto-light',
    name: 'Carto Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>, &copy; OpenStreetMap contributors',
    maxZoom: 20,
  },
  {
    id: 'carto-dark',
    name: 'Carto Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>, &copy; OpenStreetMap contributors',
    maxZoom: 20,
  },
  {
    id: 'esri-imagery',
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  {
    id: 'esri-topo',
    name: 'Esri World Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, USGS, NPS',
    maxZoom: 19,
  },
  {
    id: 'opentopo',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), &copy; OpenStreetMap contributors',
    maxZoom: 17,
  },
  {
    id: 'cyclosm',
    name: 'CyclOSM (cycling)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.cyclosm.org/">CyclOSM</a> &copy; OpenStreetMap contributors',
    maxZoom: 20,
  },
  {
    id: 'openseamap',
    name: 'OpenSeaMap (marine)',
    url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
    attribution: 'Chart data &copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors',
    maxZoom: 18,
  },
  {
    id: 'google-sat',
    name: 'Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google',
    maxZoom: 20,
  },
  {
    id: 'google-terrain',
    name: 'Google Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: 'Terrain &copy; Google',
    maxZoom: 20,
  },
  {
    id: 'stadia',
    name: 'Stadia Alidade Smooth',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; OpenStreetMap contributors',
    maxZoom: 20,
    env: 'VITE_STADIA_API_KEY',
  },
  {
    id: 'mapbox-streets',
    name: 'Mapbox Streets',
    url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token={key}',
    attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
    maxZoom: 20,
    env: 'VITE_MAPBOX_TOKEN',
  },
  {
    id: 'mapbox-satellite',
    name: 'Mapbox Satellite',
    url: 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}@2x?access_token={key}',
    attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
    maxZoom: 20,
    env: 'VITE_MAPBOX_TOKEN',
  },
  {
    id: 'google-map',
    name: 'Google Map (road)',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: 'Map data &copy; Google',
    maxZoom: 20,
  },
  {
    id: 'google-hybrid',
    name: 'Google Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google, Map data &copy; Google',
    maxZoom: 20,
  },
]

/** Basemaps whose API key is present, plus every keyless one. */
export function availableBasemaps() {
  return BASEMAPS.filter((b) => !b.env || import.meta.env[b.env])
}

/** Expand a template into a concrete tile URL for Leaflet. */
export function leafletUrl(basemap, retina) {
  return basemap.url
    .replace('{s}', SUBDOMAINS[0])
    .replace('{r}', retina ? '@2x' : '')
    .replace('{key}', basemap.env ? import.meta.env[basemap.env] : '')
}

/**
 * Expand a template for OpenLayers, which takes a list of concrete URLs rather
 * than a template and has no notion of subdomains or retina suffixes.
 */
export function openlayersUrls(basemap) {
  const key = basemap.env ? import.meta.env[basemap.env] : ''
  const hasSubdomains = basemap.url.includes('{s}')
  const hosts = hasSubdomains ? SUBDOMAINS : ['']
  return hosts.map((host) =>
    basemap.url
      .replace('{s}', host)
      .replace('{r}', '@2x')
      .replace('{key}', key),
  )
}
