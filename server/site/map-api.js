function mapStatusPayload(mapStore, amapEnabled) {
  const metadata = mapStore.getMetadata();
  return {
    available: mapStore.available,
    mapProviderReady: Boolean(amapEnabled),
    source: metadata.source_kind || "birdreport",
    coordinateSystem: metadata.coordinate_system || "GCJ-02",
    windowStartDate: metadata.window_start_date || null,
    windowEndDate: metadata.window_end_date || null,
    generatedAt: metadata.generated_at || null,
    placeCount: Number(metadata.place_count || 0),
    reportCount: Number(metadata.report_count || 0),
    observationCount: Number(metadata.observation_count || 0),
    speciesCount: Number(metadata.species_count || 0)
  };
}

function handleMapApi({ amapJsKey, amapSecurityCode, mapStore, pathname, url }) {
  if (pathname === "/api/map/config") {
    const enabled = Boolean(amapJsKey && amapSecurityCode);
    return {
      status: 200,
      payload: {
        enabled,
        key: enabled ? amapJsKey : "",
        securityServiceHost: enabled ? "/_AMapService" : ""
      }
    };
  }
  if (pathname === "/api/map/status") {
    return { status: 200, payload: mapStatusPayload(mapStore, amapJsKey && amapSecurityCode) };
  }
  if (!mapStore.available) {
    return { status: 503, payload: { error: "地图数据尚未生成。" } };
  }
  if (pathname === "/api/map/points") {
    try {
      return {
        status: 200,
        payload: mapStore.listPoints({
          west: url.searchParams.get("west"),
          south: url.searchParams.get("south"),
          east: url.searchParams.get("east"),
          north: url.searchParams.get("north"),
          taxonId: url.searchParams.get("taxonId"),
          limit: url.searchParams.get("limit")
        })
      };
    } catch (error) {
      if (error instanceof RangeError) return { status: 400, payload: { error: error.message } };
      throw error;
    }
  }
  if (pathname === "/api/map/species") {
    return {
      status: 200,
      payload: { species: mapStore.searchSpecies(url.searchParams.get("q"), url.searchParams.get("limit")) }
    };
  }
  const placeMatch = pathname.match(/^\/api\/map\/points\/([^/]+)$/);
  if (placeMatch) {
    const place = mapStore.getPlace(decodeURIComponent(placeMatch[1]));
    return place
      ? { status: 200, payload: { place } }
      : { status: 404, payload: { error: "没有找到这个观鸟点。" } };
  }
  return { status: 404, payload: { error: "Not found" } };
}

module.exports = { handleMapApi, mapStatusPayload };
