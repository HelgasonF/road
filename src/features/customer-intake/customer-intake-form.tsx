"use client";

import {
  Camera,
  Check,
  Crosshair,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CapabilityCode, LocationSource } from "@/lib/domain/types";
import { capabilityCodes } from "@/lib/domain/types";
import { OTHER_VEHICLE_MAKE, vehicleMakes } from "@/lib/domain/vehicle-makes";
import { capabilityLabels } from "@/lib/i18n/is";
import { createClient } from "@/lib/supabase/client";
import {
  finalizeCustomerPhotoUploadAction,
  prepareCustomerPhotoUploadAction,
  removeCustomerPhotoAction,
  submitCustomerIntakeAction,
} from "./actions";
import { CustomerLocationMap } from "./customer-location-map";
import { formatCustomerLinkExpiry } from "./format";
import type { ActiveCustomerIntake, CustomerIntakePhoto } from "./queries";
import {
  type GpsFailureReason,
  GpsLocationError,
  gpsFailureMessages,
  requestCustomerPosition,
} from "./geolocation";
import { CUSTOMER_PHOTO_LIMIT } from "./schemas";

type Language = "en" | "is";

const copy = {
  en: {
    eyebrow: "Secure roadside assistance link",
    title: "Confirm your details",
    intro: "Share the exact location, vehicle information, assistance needed and photos with Iceland Road Assistance dispatch.",
    contact: "Your contact information",
    name: "Full name",
    phone: "Telephone number including country code",
    vehicle: "Vehicle",
    vehicleHelp: "Add the vehicle brand, rental company if applicable, and number of people involved.",
    registration: "Registration number",
    make: "Brand",
    chooseMake: "Choose a brand",
    otherMake: "Other / not listed",
    writeMake: "Enter the brand",
    rentalCompany: "Rental company (if applicable)",
    rentalPlaceholder: "For example: Hertz or Blue Car Rental",
    peopleCount: "Number of people involved",
    peopleHelp: "Include yourself in the total.",
    location: "Confirm the vehicle location",
    gps: "Use my current GPS location",
    confirming: "Finding your location…",
    confirmMap: "Confirm the location shown on the map",
    confirmed: "Location confirmed",
    locationLabel: "Location description",
    mapHelp: "Tap the map or drag the pin to correct the location.",
    problem: "What happened?",
    assistance: "Type of assistance",
    chooseAssistance: "Choose the assistance you need",
    description: "Description",
    problemPlaceholder: "For example: flat front-left tyre, vehicle is safely off the road…",
    photos: "Photos",
    photosHelp: "Optional. Add up to 6 photos of the vehicle, damage and surroundings. Maximum 10 MB each.",
    addPhotos: "Take or choose photos",
    uploading: "Uploading securely…",
    submit: "Send details securely",
    sending: "Sending…",
    privacy: "Photos are private and available only to Iceland Road Assistance staff and the assigned driver.",
    expires: "Link valid until",
    confirmFirst: "Please confirm the location before sending.",
    photoLimit: `You can upload up to ${CUSTOMER_PHOTO_LIMIT} photos.`,
    photosFailed: "These photos could not be uploaded. Please try them again:",
  },
  is: {
    eyebrow: "Öruggur tengill fyrir vegaaðstoð",
    title: "Staðfestu upplýsingarnar",
    intro: "Sendu nákvæma staðsetningu, upplýsingar um ökutækið, aðstoðina sem þarf og myndir til aðgerðastjórnar Iceland Road Assistance.",
    contact: "Samskiptaupplýsingar",
    name: "Fullt nafn",
    phone: "Símanúmer með landskóða",
    vehicle: "Ökutæki",
    vehicleHelp: "Skráðu bílamerki, bílaleigu ef við á og fjölda fólks.",
    registration: "Skráningarnúmer",
    make: "Bílamerki",
    chooseMake: "Veldu bílamerki",
    otherMake: "Önnur / ekki á lista",
    writeMake: "Skrifaðu bílamerkið",
    rentalCompany: "Bílaleiga (ef við á)",
    rentalPlaceholder: "Til dæmis Hertz eða Blue Car Rental",
    peopleCount: "Fjöldi fólks",
    peopleHelp: "Teldu þig með í heildarfjöldanum.",
    location: "Staðfestu staðsetningu ökutækisins",
    gps: "Nota núverandi GPS-staðsetningu",
    confirming: "Finn staðsetningu…",
    confirmMap: "Staðfesta staðinn sem sést á kortinu",
    confirmed: "Staðsetning staðfest",
    locationLabel: "Lýsing á staðsetningu",
    mapHelp: "Snertu kortið eða dragðu pinnann til að leiðrétta staðsetninguna.",
    problem: "Hvað gerðist?",
    assistance: "Tegund aðstoðar",
    chooseAssistance: "Veldu aðstoðina sem þú þarft",
    description: "Lýsing",
    problemPlaceholder: "Til dæmis: sprungið vinstra framdekk, bíllinn er örugglega utan vegar…",
    photos: "Myndir",
    photosHelp: "Valfrjálst. Bættu við allt að 6 myndum af ökutæki, skemmdum og umhverfi. Hámark 10 MB hver.",
    addPhotos: "Taka eða velja myndir",
    uploading: "Hleð upp á öruggan hátt…",
    submit: "Senda upplýsingar örugglega",
    sending: "Sendi…",
    privacy: "Myndir eru einkagögn og aðeins sýnilegar starfsfólki Iceland Road Assistance og úthlutuðum ökumanni.",
    expires: "Tengill gildir til",
    confirmFirst: "Staðfestu staðsetninguna áður en þú sendir.",
    photoLimit: `Þú getur hlaðið upp allt að ${CUSTOMER_PHOTO_LIMIT} myndum.`,
    photosFailed: "Ekki tókst að hlaða upp þessum myndum. Reyndu aftur:",
  },
} as const;

const assistanceLabelsEn: Record<CapabilityCode, string> = {
  towing: "Towing",
  flatbed: "Flatbed transport",
  jump_start: "Jump start",
  tire_assistance: "Tyre assistance",
  fuel_delivery: "Fuel delivery",
  lockout: "Vehicle lockout",
  four_by_four_recovery: "4×4 recovery",
  ev_assistance: "Electric vehicle assistance",
  accident_recovery: "Accident recovery",
  heavy_vehicle: "Heavy vehicle assistance",
  other: "Other assistance",
};

interface CustomerIntakeFormProps {
  expiresAt: string;
  initialPhotos: CustomerIntakePhoto[];
  job: ActiveCustomerIntake["job"];
  token: string;
}

export function CustomerIntakeForm({ expiresAt, initialPhotos, job, token }: CustomerIntakeFormProps) {
  const router = useRouter();
  const initialVehicleMake = job.vehicleMake?.trim() ?? "";
  const knownInitialVehicleMake = vehicleMakes.find(
    (make) => make.toLocaleLowerCase() === initialVehicleMake.toLocaleLowerCase(),
  );
  const [language, setLanguage] = useState<Language>("en");
  const [vehicleMakeSelection, setVehicleMakeSelection] = useState(
    knownInitialVehicleMake ?? (initialVehicleMake ? OTHER_VEHICLE_MAKE : ""),
  );
  const [latitude, setLatitude] = useState(job.latitude);
  const [longitude, setLongitude] = useState(job.longitude);
  const [locationLabel, setLocationLabel] = useState(job.locationLabel);
  const [locationSource, setLocationSource] = useState<Extract<LocationSource, "gps" | "map_pin">>("map_pin");
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsFailure, setGpsFailure] = useState<GpsFailureReason | null>(null);
  // Once the customer describes the spot in their own words, moving the pin
  // must not replace that description with coordinates.
  const [labelEdited, setLabelEdited] = useState(false);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = copy[language];

  function applyLocation(source: "gps" | "map_pin", nextLatitude: number, nextLongitude: number) {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setLocationSource(source);
    if (!labelEdited) {
      const prefix = source === "gps" ? "GPS" : "Map pin";
      setLocationLabel(`${prefix} · ${nextLatitude.toFixed(5)}, ${nextLongitude.toFixed(5)}`);
    }
    setLocationConfirmed(true);
    setGpsFailure(null);
    setError(null);
  }

  function chooseMapLocation(nextLatitude: number, nextLongitude: number) {
    applyLocation("map_pin", nextLatitude, nextLongitude);
  }

  async function locateWithGps() {
    setLocating(true);
    setGpsFailure(null);
    try {
      const position = await requestCustomerPosition(
        "geolocation" in navigator ? navigator.geolocation : undefined,
      );
      applyLocation("gps", position.latitude, position.longitude);
    } catch (caught) {
      if (!(caught instanceof GpsLocationError)) throw caught;
      setGpsFailure(caught.reason);
    } finally {
      setLocating(false);
    }
  }

  async function uploadPhoto(supabase: ReturnType<typeof createClient>, file: File) {
    const prepared = await prepareCustomerPhotoUploadAction({
      token,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!prepared.ok || !prepared.data) return false;

    const { photoId, path, uploadToken } = prepared.data;
    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type });
    const finalized = uploadError ? null : await finalizeCustomerPhotoUploadAction({ token, photoId });
    if (!finalized?.ok) {
      await removeCustomerPhotoAction({ token, photoId });
      return false;
    }

    setPhotos((current) => [...current, {
      id: photoId,
      originalFilename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }]);
    return true;
  }

  async function uploadPhotos(files: File[]) {
    if (photos.length + files.length > CUSTOMER_PHOTO_LIMIT) {
      setError(t.photoLimit);
      return;
    }

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const failedNames: string[] = [];

    // One failed photo on a flaky connection must not silently drop the rest.
    for (const file of files) {
      if (!(await uploadPhoto(supabase, file))) failedNames.push(file.name);
    }
    if (failedNames.length > 0) setError(`${t.photosFailed} ${failedNames.join(", ")}`);
    setUploading(false);
  }

  function removePhoto(photoId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCustomerPhotoAction({ token, photoId });
      if (!result.ok) {
        setError(result.error ?? "Photo could not be removed.");
        return;
      }
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationConfirmed) {
      setError(t.confirmFirst);
      return;
    }
    const form = new FormData(event.currentTarget);
    const vehicleMake = vehicleMakeSelection === OTHER_VEHICLE_MAKE
      ? String(form.get("vehicleMakeOther") ?? "")
      : vehicleMakeSelection;
    setError(null);
    startTransition(async () => {
      const result = await submitCustomerIntakeAction({
        token,
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        vehicleRegistration: String(form.get("vehicleRegistration") ?? ""),
        vehicleMake,
        rentalCompany: String(form.get("rentalCompany") ?? ""),
        peopleCount: Number(form.get("peopleCount")),
        requiredCapability: String(form.get("requiredCapability") ?? ""),
        latitude,
        longitude,
        locationLabel,
        locationSource,
        customerNotes: String(form.get("customerNotes") ?? ""),
      });
      if (!result.ok) {
        setError(result.error ?? "The information could not be sent.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="customer-intake-page">
      <header className="customer-intake-header">
        <div className="customer-intake-brand"><span aria-hidden="true">IR</span><strong>Iceland Road Assistance</strong></div>
        <div className="language-switch" aria-label="Language">
          <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>English</button>
          <button className={language === "is" ? "active" : ""} type="button" onClick={() => setLanguage("is")}>Íslenska</button>
        </div>
      </header>

      <form className="customer-intake-form" onSubmit={submit}>
        <section className="customer-intake-intro">
          <div><p className="eyebrow"><LockKeyhole size={14} /> {t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p></div>
          <span><ShieldCheck size={20} /> {t.expires} {formatCustomerLinkExpiry(expiresAt, language)}</span>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>1</span><div><h2>{t.contact}</h2><p>{language === "en" ? "So dispatch can contact you." : "Svo aðgerðastjórn geti haft samband."}</p></div></div>
          <div className="customer-fields-two">
            <label><span>{t.name}</span><input name="customerName" defaultValue={job.customerName} autoComplete="name" required maxLength={120} /></label>
            <label><span>{t.phone}</span><input name="customerPhone" defaultValue={job.customerPhone} autoComplete="tel" inputMode="tel" type="tel" required maxLength={40} /></label>
          </div>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>2</span><div><h2>{t.vehicle}</h2><p>{t.vehicleHelp}</p></div></div>
          <div className="customer-fields-two">
            <label><span>{t.registration}</span><input name="vehicleRegistration" defaultValue={job.vehicleRegistration ?? ""} autoCapitalize="characters" maxLength={24} /></label>
            <label>
              <span>{t.make}</span>
              <select value={vehicleMakeSelection} onChange={(event) => setVehicleMakeSelection(event.target.value)}>
                <option value="">{t.chooseMake}</option>
                {vehicleMakes.map((make) => <option key={make} value={make}>{make}</option>)}
                <option value={OTHER_VEHICLE_MAKE}>{t.otherMake}</option>
              </select>
            </label>
            {vehicleMakeSelection === OTHER_VEHICLE_MAKE ? (
              <label className="customer-field-wide"><span>{t.writeMake}</span><input name="vehicleMakeOther" defaultValue={knownInitialVehicleMake ? "" : initialVehicleMake} maxLength={120} required /></label>
            ) : null}
            <label><span>{t.rentalCompany}</span><input name="rentalCompany" defaultValue={job.rentalCompany ?? ""} placeholder={t.rentalPlaceholder} maxLength={120} /></label>
            <label><span>{t.peopleCount}</span><input name="peopleCount" defaultValue={job.peopleCount ?? 1} aria-describedby="people-count-help" inputMode="numeric" min={1} max={99} required type="number" /><small id="people-count-help" className="customer-field-help">{t.peopleHelp}</small></label>
          </div>
        </section>

        <section className="customer-form-card customer-location-card">
          <div className="customer-card-heading"><span>3</span><div><h2>{t.location}</h2><p>{t.mapHelp}</p></div></div>
          <div className="customer-location-actions">
            <button type="button" className="customer-gps-button" disabled={locating} onClick={() => void locateWithGps()}>
              {locating ? <LoaderCircle className="spin" size={18} /> : <Crosshair size={18} />} {locating ? t.confirming : t.gps}
            </button>
            <span>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
          </div>
          {gpsFailure ? <p className="customer-form-error customer-location-error" role="alert">{gpsFailureMessages[language][gpsFailure]}</p> : null}
          <CustomerLocationMap latitude={latitude} longitude={longitude} onPick={chooseMapLocation} />
          <label className="customer-location-label"><span>{t.locationLabel}</span><input value={locationLabel} onChange={(event) => { setLocationLabel(event.target.value); setLabelEdited(true); }} maxLength={300} required /></label>
          <button
            className={`customer-confirm-location ${locationConfirmed ? "confirmed" : ""}`}
            type="button"
            onClick={() => { setLocationConfirmed(true); setLocationSource("map_pin"); setError(null); }}
          >
            {locationConfirmed ? <Check size={17} /> : <MapPin size={17} />} {locationConfirmed ? t.confirmed : t.confirmMap}
          </button>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>4</span><div><h2>{t.problem}</h2><p>{language === "en" ? "Include anything the driver should know before arriving." : "Skráðu allt sem ökumaður þarf að vita áður en hann kemur."}</p></div></div>
          <div className="customer-problem-fields">
            <label>
              <span>{t.assistance}</span>
              <select name="requiredCapability" defaultValue={job.requiredCapability ?? ""} required>
                <option value="" disabled>{t.chooseAssistance}</option>
                {capabilityCodes.map((capability) => (
                  <option key={capability} value={capability}>
                    {language === "en" ? assistanceLabelsEn[capability] : capabilityLabels[capability]}
                  </option>
                ))}
              </select>
            </label>
            <label className="customer-description">
              <span>{t.description}</span>
              <textarea name="customerNotes" defaultValue={job.customerNotes ?? ""} placeholder={t.problemPlaceholder} minLength={5} maxLength={4000} required />
            </label>
          </div>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>5</span><div><h2>{t.photos}</h2><p>{t.photosHelp}</p></div></div>
          {photos.length > 0 ? (
            <div className="customer-photo-grid">
              {photos.map((photo, index) => (
                <figure key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/customer/${token}/photos/${photo.id}`} alt={`Vehicle ${index + 1}`} />
                  <figcaption><span>{photo.originalFilename}</span><button type="button" disabled={pending || uploading} onClick={() => removePhoto(photo.id)} aria-label={`Remove ${photo.originalFilename}`}><Trash2 size={15} /></button></figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <label className={`customer-photo-upload ${uploading ? "uploading" : ""}`}>
            {uploading ? <LoaderCircle className="spin" size={24} /> : <Camera size={24} />}
            <strong>{uploading ? t.uploading : t.addPhotos}</strong>
            <small>{photos.length}/{CUSTOMER_PHOTO_LIMIT}</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              disabled={uploading || pending || photos.length >= CUSTOMER_PHOTO_LIMIT}
              onChange={(event) => {
                const input = event.currentTarget;
                const files = [...(input.files ?? [])];
                input.value = "";
                if (files.length > 0) void uploadPhotos(files);
              }}
            />
          </label>
          <p className="customer-privacy"><LockKeyhole size={14} /> {t.privacy}</p>
        </section>

        {error ? <p className="customer-form-error" role="alert">{error}</p> : null}
        <button className="customer-submit-button" type="submit" disabled={pending || uploading || !locationConfirmed}>
          {pending ? <LoaderCircle className="spin" size={19} /> : <Upload size={19} />} {pending ? t.sending : t.submit}
        </button>
      </form>
    </main>
  );
}
