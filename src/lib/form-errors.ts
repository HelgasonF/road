export type FormErrors = Record<string, string>;
export type FormLanguage = "en" | "is";

const labels = {
  en: { customerName: "Full name", customerPhone: "Phone number", vehicleRegistration: "Vehicle registration", vehicleMake: "Vehicle make", rentalCompany: "Rental company", peopleCount: "Number of people", locationLabel: "Location", requiredCapability: "Assistance", requiredCapabilities: "Assistance", customerNotes: "Description", priority: "Priority", notes: "Notes" },
  is: { customerName: "Fullt nafn", customerPhone: "Símanúmer", vehicleRegistration: "Skráningarnúmer", vehicleMake: "Bíltegund", rentalCompany: "Bílaleiga", peopleCount: "Fjöldi fólks", locationLabel: "Staðsetning", requiredCapability: "Aðstoð", requiredCapabilities: "Aðstoð", customerNotes: "Lýsing", priority: "Forgangur", notes: "Athugasemdir" },
};

export function formFieldKey(name: string) {
  if (["latitude", "longitude", "locationSource", "locationQuery"].includes(name)) return "locationLabel";
  if (name === "vehicleMakeOther") return "vehicleMake";
  return name;
}

export function formFieldLabel(name: string, language: FormLanguage) {
  return (labels[language] as Record<string, string>)[formFieldKey(name)] ?? (language === "en" ? "Form" : "Form");
}

export function fieldErrorMessage(name: string, language: FormLanguage) {
  const key = formFieldKey(name);
  const en: Record<string, string> = {
    customerName: "Enter a full name between 2 and 120 characters.", customerPhone: "Enter a valid phone number and country code.",
    vehicleRegistration: "Shorten the vehicle registration.", vehicleMake: "Enter a vehicle make of at most 120 characters.", rentalCompany: "Use at most 120 characters for the rental company.",
    peopleCount: "Enter a whole number of people from 1 to 99.", locationLabel: "Enter a town/address, use GPS or select a point on the map.",
    requiredCapability: "Choose the assistance you need.", requiredCapabilities: "Choose at least one assistance type.", customerNotes: "Describe the problem using 5 to 4,000 characters.",
    priority: "Choose a priority from the list.", notes: "Use at most 4,000 characters for notes.",
  };
  const is: Record<string, string> = {
    customerName: "Sláðu inn fullt nafn, 2–120 stafir.", customerPhone: "Sláðu inn gilt símanúmer og landsnúmer.",
    vehicleRegistration: "Styttu skráningarnúmerið.", vehicleMake: "Sláðu inn bíltegund, að hámarki 120 stafir.", rentalCompany: "Heiti bílaleigu má vera allt að 120 stafir.",
    peopleCount: "Sláðu inn heilan fólksfjölda frá 1 til 99.", locationLabel: "Skrifaðu bæ eða heimilisfang, notaðu GPS eða veldu punkt á kortinu.",
    requiredCapability: "Veldu þá aðstoð sem þarf.", requiredCapabilities: "Veldu að minnsta kosti eina tegund aðstoðar.", customerNotes: "Lýstu vandanum með 5–4.000 stöfum.",
    priority: "Veldu forgang úr listanum.", notes: "Athugasemdir mega vera allt að 4.000 stafir.",
  };
  return (language === "en" ? en : is)[key] ?? (language === "en" ? "Check this field and try again." : "Athugaðu þennan reit og reyndu aftur.");
}

export function localizeFieldErrors(errors: Record<string, string[] | undefined>, language: FormLanguage): FormErrors {
  return Object.fromEntries(Object.keys(errors).filter((key) => errors[key]?.length).map((key) => [formFieldKey(key), fieldErrorMessage(key, language)]));
}

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
function controls(form: HTMLFormElement) {
  return Array.from(form.elements).filter((item): item is FormControl => item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement || item instanceof HTMLButtonElement);
}

export function focusFormField(form: HTMLFormElement | null, name: string) {
  if (!form) return;
  const matching = controls(form).filter((item) => (item.dataset.field ?? formFieldKey(item.name)) === formFieldKey(name) && !(item instanceof HTMLInputElement && item.type === "hidden"));
  const input = matching.find((item) => !item.validity.valid) ?? matching[0];
  input?.focus(); input?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

export function nativeFormErrors(form: HTMLFormElement, language: FormLanguage): FormErrors {
  const errors: FormErrors = {};
  for (const control of controls(form)) {
    if (control.validity.valid) continue;
    const key = formFieldKey(control.dataset.field ?? control.name);
    if (!key || errors[key]) continue;
    const label = control.labels?.[0]?.querySelector("span")?.textContent?.trim() ?? formFieldLabel(key, language);
    errors[key] = control.validity.customError ? control.validationMessage
      : control.validity.valueMissing ? language === "en" ? `${label} is required.` : `${label} vantar.`
        : fieldErrorMessage(key, language);
  }
  return errors;
}
