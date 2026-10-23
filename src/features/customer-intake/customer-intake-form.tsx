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
import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CapabilityCode } from "@/lib/domain/types";
import { capabilityCodes } from "@/lib/domain/types";
import { OTHER_VEHICLE_MAKE, vehicleMakes } from "@/lib/domain/vehicle-makes";
import { capabilityLabels } from "@/lib/i18n/is";
import { createClient } from "@/lib/supabase/client";
import { startCustomerCheckoutAction } from "@/features/payments/checkout-actions";
import { PhoneInput } from "@/components/phone-input";
import { FieldError, FormErrorSummary } from "@/components/form-errors";
import { focusFormField, formFieldKey, localizeFieldErrors, nativeFormErrors, type FormErrors } from "@/lib/form-errors";
import { AddressSearchField, type AddressSearchFieldHandle } from "@/features/location/address-search-field";
import type { ResolvedLocation } from "@/features/location/typed-location";
import { searchCustomerLocationsAction } from "./location-actions";
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
import { CUSTOMER_PHOTO_LIMIT, customerIntakeSchema } from "./schemas";

const editableDetailsSchema = customerIntakeSchema.omit({ token: true });

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
    locationLabel: "Town or address",
    mapHelp: "Type a town/address, use GPS, or choose a point on the map.",
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
    locationLabel: "Bær eða heimilisfang",
    mapHelp: "Skrifaðu bæ eða heimilisfang, notaðu GPS eða veldu punkt á kortinu.",
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
  payment?: { enabled: boolean; ready: boolean; amountIsk: number | null };
}

export function CustomerIntakeForm({ expiresAt, initialPhotos, job, token, payment }: CustomerIntakeFormProps) {
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
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsFailure, setGpsFailure] = useState<GpsFailureReason | null>(null);
  // Once the customer describes the spot in their own words, moving the pin
  // must not replace that description with coordinates.
  const [labelEdited, setLabelEdited] = useState(false);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const locationRef = useRef<AddressSearchFieldHandle>(null);
  const [pending, startTransition] = useTransition();
  const t = copy[language];

  function showFieldErrors(errors: FormErrors) {
    setFieldErrors(errors);
    if (Object.keys(errors)[0]) focusFormField(formRef.current, Object.keys(errors)[0]);
  }

  function fieldProps(name: string) {
    const key = formFieldKey(name);
    return { "data-field": key, "aria-labelledby": `customer-${name}-label`, "aria-invalid": Boolean(fieldErrors[key]) || undefined, "aria-describedby": fieldErrors[key] ? `customer-${key}-error` : undefined };
  }

  function fieldError(name: string) { return <FieldError id={`customer-${name}-error`} message={fieldErrors[name]} />; }

  function resolvedLocationChanged(location: ResolvedLocation | null) {
    if (!location) { setLocationConfirmed(false); return; }
    setLatitude(location.latitude); setLongitude(location.longitude); setLocationLabel(location.label);
    setLocationConfirmed(true); setGpsFailure(null);
    if (location.source === "search") setLabelEdited(false);
    setFieldErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== "locationLabel")));
  }

  function applyLocation(source: "gps" | "map_pin", nextLatitude: number, nextLongitude: number) {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    if (!labelEdited) {
      const prefix = source === "gps" ? "GPS" : "Map pin";
      setLocationLabel(`${prefix} · ${nextLatitude.toFixed(5)}, ${nextLongitude.toFixed(5)}`);
    }
    setLocationConfirmed(true);
    setGpsFailure(null);
    setError(null);
    const prefix = source === "gps" ? "GPS" : "Map pin";
    locationRef.current?.setLocation({ id: source, source, latitude: nextLatitude, longitude: nextLongitude,
      label: labelEdited ? locationLabel : `${prefix} · ${nextLatitude.toFixed(5)}, ${nextLongitude.toFixed(5)}` });
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
    const form = new FormData(event.currentTarget);
    const vehicleMake = vehicleMakeSelection === OTHER_VEHICLE_MAKE
      ? String(form.get("vehicleMakeOther") ?? "")
      : vehicleMakeSelection;
    setError(null);
    startTransition(async () => {
      const location = await locationRef.current?.resolve();
      if (!location) {
        showFieldErrors({ locationLabel: language === "en" ? "Enter a town/address and choose a result if several places match." : "Skrifaðu bæ eða heimilisfang og veldu úr niðurstöðum ef fleiri en einn staður finnst." });
        return;
      }
      const details = {
        token,
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        vehicleRegistration: String(form.get("vehicleRegistration") ?? ""),
        vehicleMake,
        rentalCompany: String(form.get("rentalCompany") ?? ""),
        peopleCount: Number(form.get("peopleCount")),
        requiredCapability: String(form.get("requiredCapability") ?? ""),
        latitude: location.latitude,
        longitude: location.longitude,
        locationLabel: location.label,
        locationSource: location.source,
        customerNotes: String(form.get("customerNotes") ?? ""),
      };
      const parsed = editableDetailsSchema.safeParse(details);
      if (!parsed.success) { showFieldErrors(localizeFieldErrors(parsed.error.flatten().fieldErrors, language)); return; }
      setFieldErrors({});
      if (payment?.enabled) {
        try {
          const checkout = await startCustomerCheckoutAction({ ...details, language });
          if (checkout.ok) {
            window.location.assign(checkout.data.checkoutUrl);
            return;
          }
          if (checkout.fieldErrors) { showFieldErrors(localizeFieldErrors(checkout.fieldErrors, language)); return; }
          setError(checkout.error);
        } catch {
          setError(language === "is" ? "Upplýsingarnar gætu verið vistaðar. Hafðu samband við aðgerðastjórn áður en þú reynir aftur." : "Your details may have been saved. Please contact dispatch before trying again.");
        }
        router.refresh();
        return;
      }
      const result = await submitCustomerIntakeAction(details);
      if (!result.ok) {
        if (result.fieldErrors) { showFieldErrors(localizeFieldErrors(result.fieldErrors, language)); return; }
        setError(result.error ?? "The information could not be sent.");
        return;
      }
      router.refresh();
    });
  }

  function explainInvalidField(event: FormEvent<HTMLFormElement>) {
    showFieldErrors(nativeFormErrors(event.currentTarget, language));
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

      <form ref={formRef} className="customer-intake-form" onSubmit={submit} onInvalidCapture={explainInvalidField}
        onChange={(event) => { const control = event.target; if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return; const key = formFieldKey(control.dataset.field ?? control.name); setFieldErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key))); }}>
        <FormErrorSummary errors={fieldErrors} formRef={formRef} language={language} />
        <section className="customer-intake-intro">
          <div><p className="eyebrow"><LockKeyhole size={14} /> {t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p></div>
          <span><ShieldCheck size={20} /> {t.expires} {formatCustomerLinkExpiry(expiresAt, language)}</span>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>1</span><div><h2>{t.contact}</h2><p>{language === "en" ? "So dispatch can contact you." : "Svo aðgerðastjórn geti haft samband."}</p></div></div>
          <div className="customer-fields-two">
            <label><span id="customer-customerName-label">{t.name}</span><input {...fieldProps("customerName")} name="customerName" defaultValue={job.customerName} autoComplete="name" required maxLength={120} />{fieldError("customerName")}</label>
            <PhoneInput label={t.phone} name="customerPhone" defaultValue={job.customerPhone} language={language} error={fieldErrors.customerPhone} required />
          </div>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>2</span><div><h2>{t.vehicle}</h2><p>{t.vehicleHelp}</p></div></div>
          <div className="customer-fields-two">
            <label><span id="customer-vehicleRegistration-label">{t.registration}</span><input {...fieldProps("vehicleRegistration")} name="vehicleRegistration" defaultValue={job.vehicleRegistration ?? ""} autoCapitalize="characters" maxLength={24} />{fieldError("vehicleRegistration")}</label>
            <label>
              <span id="customer-vehicleMake-label">{t.make}</span>
              <select {...fieldProps("vehicleMake")} value={vehicleMakeSelection} onChange={(event) => setVehicleMakeSelection(event.target.value)}>
                <option value="">{t.chooseMake}</option>
                {vehicleMakes.map((make) => <option key={make} value={make}>{make}</option>)}
                <option value={OTHER_VEHICLE_MAKE}>{t.otherMake}</option>
              </select>
            </label>
            {vehicleMakeSelection === OTHER_VEHICLE_MAKE ? (
              <label className="customer-field-wide"><span id="customer-vehicleMakeOther-label">{t.writeMake}</span><input {...fieldProps("vehicleMakeOther")} name="vehicleMakeOther" defaultValue={knownInitialVehicleMake ? "" : initialVehicleMake} maxLength={120} required />{fieldError("vehicleMake")}</label>
            ) : null}
            <label><span id="customer-rentalCompany-label">{t.rentalCompany}</span><input {...fieldProps("rentalCompany")} name="rentalCompany" defaultValue={job.rentalCompany ?? ""} placeholder={t.rentalPlaceholder} maxLength={120} />{fieldError("rentalCompany")}</label>
            <label><span id="customer-peopleCount-label">{t.peopleCount}</span><input {...fieldProps("peopleCount")} name="peopleCount" defaultValue={job.peopleCount ?? 1} aria-describedby={fieldErrors.peopleCount ? "customer-peopleCount-error people-count-help" : "people-count-help"} inputMode="numeric" min={1} max={99} required type="number" /><small id="people-count-help" className="customer-field-help">{t.peopleHelp}</small>{fieldError("peopleCount")}</label>
          </div>
        </section>

        <section className="customer-form-card customer-location-card">
          <div className="customer-card-heading"><span>3</span><div><h2>{t.location}</h2><p>{t.mapHelp}</p></div></div>
          <AddressSearchField ref={locationRef} label={t.locationLabel} defaultLabel={job.locationLabel}
            defaultLatitude={job.locationLabel && job.locationSource !== "manual" ? job.latitude : undefined}
            defaultLongitude={job.locationLabel && job.locationSource !== "manual" ? job.longitude : undefined}
            defaultSource={job.locationSource}
            language={language} showMap={false} error={fieldErrors.locationLabel}
            searchAction={(query) => searchCustomerLocationsAction({ token, query })}
            onQueryChange={(query) => { setLocationLabel(query); setLabelEdited(true); }}
            onLocationChange={resolvedLocationChanged} />
          <div className="customer-location-actions">
            <button type="button" className="customer-gps-button" disabled={locating} onClick={() => void locateWithGps()}>
              {locating ? <LoaderCircle className="spin" size={18} /> : <Crosshair size={18} />} {locating ? t.confirming : t.gps}
            </button>
            <span>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
          </div>
          {gpsFailure ? <p className="customer-form-error customer-location-error" role="alert">{gpsFailureMessages[language][gpsFailure]}</p> : null}
          <CustomerLocationMap latitude={latitude} longitude={longitude} onPick={chooseMapLocation} />
          <button
            className={`customer-confirm-location ${locationConfirmed ? "confirmed" : ""}`}
            type="button"
            onClick={() => {
              if (locationConfirmed) return;
              if (labelEdited && locationLabel.trim()) { void locationRef.current?.resolve(); return; }
              locationRef.current?.setLocation({ id: "map-pin", source: "map_pin", latitude, longitude,
                label: locationLabel || `Map pin · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
            }}
          >
            {locationConfirmed ? <Check size={17} /> : <MapPin size={17} />} {locationConfirmed ? t.confirmed : t.confirmMap}
          </button>
        </section>

        <section className="customer-form-card">
          <div className="customer-card-heading"><span>4</span><div><h2>{t.problem}</h2><p>{language === "en" ? "Include anything the driver should know before arriving." : "Skráðu allt sem ökumaður þarf að vita áður en hann kemur."}</p></div></div>
          <div className="customer-problem-fields">
            <label>
              <span id="customer-requiredCapability-label">{t.assistance}</span>
              <select {...fieldProps("requiredCapability")} name="requiredCapability" defaultValue={job.requiredCapability ?? ""} required>
                <option value="" disabled>{t.chooseAssistance}</option>
                {capabilityCodes.map((capability) => (
                  <option key={capability} value={capability}>
                    {language === "en" ? assistanceLabelsEn[capability] : capabilityLabels[capability]}
                  </option>
                ))}
              </select>
              {fieldError("requiredCapability")}
            </label>
            <label className="customer-description">
              <span id="customer-customerNotes-label">{t.description}</span>
              <textarea {...fieldProps("customerNotes")} name="customerNotes" defaultValue={job.customerNotes ?? ""} placeholder={t.problemPlaceholder} minLength={5} maxLength={4000} required />
              {fieldError("customerNotes")}
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

        {payment?.enabled ? <section className="customer-form-card intake-payment-card">
          <h2>{language === "is" ? "Upphafsgjald fyrir aðstoð" : "Initial assistance fee"}</h2>
          {payment.amountIsk !== null ? <strong>{new Intl.NumberFormat(language === "is" ? "is-IS" : "en-GB").format(payment.amountIsk)} ISK</strong> : null}
          <p>{language === "is" ? "Upplýsingarnar eru vistaðar áður en myPOS opnast. Beiðnin er send sjálfkrafa þegar greiðsla hefur verið staðfest. Þú þarft ekki að koma aftur á síðuna." : "Your details are saved before myPOS opens. Your request is submitted automatically once payment is confirmed. You do not need to return to this page."}</p>
          <p>{language === "is" ? "Greiðsla fyrir þjónustuna er send sérstaklega eftir að verð liggur fyrir." : "The service payment will be sent separately once the price has been confirmed."}</p>
          {!payment.ready ? <p className="customer-form-error" role="alert">{language === "is" ? "Greiðsla er ekki tiltæk í augnablikinu. Hafðu samband við aðgerðastjórn." : "Payment is currently unavailable. Please contact dispatch."}</p> : null}
        </section> : null}
        {error ? <p className="customer-form-error" role="alert">{error}</p> : null}
        <button className="customer-submit-button" type="submit" disabled={pending || uploading || Boolean(payment?.enabled && !payment.ready)}>
          {pending ? <LoaderCircle className="spin" size={19} /> : <Upload size={19} />} {pending ? t.sending : payment?.enabled ? language === "is" ? "Greiða og senda" : "Pay and submit" : t.submit}
        </button>
      </form>
    </main>
  );
}
