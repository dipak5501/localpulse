/** Public Google Maps Platform key (browser-safe when HTTP-referrer restricted). */
export function getGoogleMapsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey() !== null;
}
