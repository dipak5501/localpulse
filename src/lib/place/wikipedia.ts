import type { LatLng } from "../types";
import type { WikiPlace } from "./types";

interface GeoSearchItem {
  title: string;
  lat: number;
  lon: number;
  dist: number;
}

interface GeoSearchResponse {
  query?: { geosearch?: GeoSearchItem[] };
}

interface SummaryResponse {
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  type?: string;
}

const UA = "Harborbrief/1.0 (https://github.com/dipak5501/localpulse; educational portfolio demo)";

/**
 * Nearest Wikipedia article via MediaWiki GeoSearch + REST summary.
 * Uses `origin=*` so the browser CORS request is allowed.
 */
export async function fetchWikipediaNearby(
  origin: LatLng,
  signal?: AbortSignal,
): Promise<WikiPlace | null> {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "geosearch");
  searchUrl.searchParams.set("gscoord", `${origin.lat}|${origin.lng}`);
  searchUrl.searchParams.set("gsradius", "10000");
  searchUrl.searchParams.set("gslimit", "5");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");

  const searchRes = await fetch(searchUrl, {
    signal,
    headers: { Accept: "application/json", "Api-User-Agent": UA },
  });
  if (!searchRes.ok) throw new Error(`Wikipedia geosearch ${searchRes.status}`);
  const searchData = (await searchRes.json()) as GeoSearchResponse;
  const hits = searchData.query?.geosearch ?? [];
  if (hits.length === 0) return null;

  // Prefer a place/landmark with a readable extract; skip disambiguation stubs.
  for (const hit of hits.slice(0, 4)) {
    const titlePath = encodeURIComponent(hit.title.replace(/ /g, "_"));
    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${titlePath}`,
      { signal, headers: { Accept: "application/json", "Api-User-Agent": UA } },
    );
    if (!summaryRes.ok) continue;
    const summary = (await summaryRes.json()) as SummaryResponse;
    if (summary.type === "disambiguation") continue;
    const extract = summary.extract?.trim();
    if (!extract) continue;
    return {
      title: summary.title ?? hit.title,
      extract: extract.length > 320 ? `${extract.slice(0, 317).trimEnd()}…` : extract,
      url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${titlePath}`,
      distanceM: typeof hit.dist === "number" ? hit.dist : null,
    };
  }
  return null;
}
