export type GpsFailureReason = "unsupported" | "denied" | "unavailable" | "timeout" | "outside_iceland";

export class GpsLocationError extends Error {
  constructor(readonly reason: GpsFailureReason) {
    super(`GPS location failed: ${reason}`);
    this.name = "GpsLocationError";
  }
}

export interface CustomerPosition {
  latitude: number;
  longitude: number;
}

const PRECISE_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 };
// Indoors or under a weak sky view the GPS chip may never get a fix; a recent
// network position is still far better than asking the customer to find
// themselves on a map of the whole country.
const FALLBACK_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 };

function isInsideIceland({ latitude, longitude }: CustomerPosition) {
  return latitude >= 62.5 && latitude <= 67.5 && longitude >= -25.5 && longitude <= -12;
}

function failureReason(error: GeolocationPositionError): GpsFailureReason {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

function getPosition(geolocation: Geolocation, options: PositionOptions) {
  return new Promise<CustomerPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new GpsLocationError(failureReason(error))),
      options,
    );
  });
}

export async function requestCustomerPosition(geolocation: Geolocation | undefined): Promise<CustomerPosition> {
  if (!geolocation) throw new GpsLocationError("unsupported");

  let position: CustomerPosition;
  try {
    position = await getPosition(geolocation, PRECISE_OPTIONS);
  } catch (error) {
    if (!(error instanceof GpsLocationError) || error.reason === "denied") throw error;
    position = await getPosition(geolocation, FALLBACK_OPTIONS);
  }

  if (!isInsideIceland(position)) throw new GpsLocationError("outside_iceland");
  return position;
}

export const gpsFailureMessages: Record<"en" | "is", Record<GpsFailureReason, string>> = {
  en: {
    unsupported: "This browser cannot provide a GPS location. Tap the map to mark where the vehicle is.",
    denied: "Location access is blocked for this page. Allow location in the browser settings, or tap the map to mark where the vehicle is.",
    unavailable: "Your phone could not determine its location. Tap the map to mark where the vehicle is.",
    timeout: "Finding your location took too long. Try again outdoors, or tap the map to mark where the vehicle is.",
    outside_iceland: "The GPS position appears to be outside Iceland. Tap the map to mark where the vehicle is.",
  },
  is: {
    unsupported: "Þessi vafri getur ekki gefið upp GPS-staðsetningu. Snertu kortið til að merkja hvar ökutækið er.",
    denied: "Aðgangur að staðsetningu er lokaður fyrir þessa síðu. Leyfðu staðsetningu í stillingum vafrans eða snertu kortið til að merkja hvar ökutækið er.",
    unavailable: "Síminn gat ekki fundið staðsetninguna. Snertu kortið til að merkja hvar ökutækið er.",
    timeout: "Það tók of langan tíma að finna staðsetninguna. Reyndu aftur utandyra eða snertu kortið til að merkja hvar ökutækið er.",
    outside_iceland: "GPS-staðsetningin virðist vera utan Íslands. Snertu kortið til að merkja hvar ökutækið er.",
  },
};
