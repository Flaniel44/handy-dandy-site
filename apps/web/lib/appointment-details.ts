import { z } from "zod";

const appointmentDetailsShape = {
  appointmentMode: z.enum(["phone", "in_person", "google_meet"]),
  appointmentPhone: z.string().trim().regex(/^\d*$/, "Phone number can only contain numbers.").max(30).default(""),
  appointmentStreetAddress: z.string().trim().max(200).default(""),
  appointmentUnit: z.string().trim().max(30).default(""),
  appointmentCity: z.string().trim().max(100).default(""),
  appointmentPostalCode: z.string().trim().max(20).default(""),
  appointmentCountry: z.string().trim().max(80).default(""),
};

export const appointmentDetailsSchema = z.object(appointmentDetailsShape).superRefine((value, context) => {
    if (value.appointmentMode === "phone") {
      if (value.appointmentPhone.length < 7) context.addIssue({ code: "custom", path: ["appointmentPhone"], message: "Enter a phone number with at least 7 digits." });
      return;
    }
    if (value.appointmentMode !== "in_person") return;
    for (const [field, label] of [
      ["appointmentStreetAddress", "street address"],
      ["appointmentCity", "city"],
      ["appointmentPostalCode", "postal code"],
      ["appointmentCountry", "country"],
    ] as const) {
      if (!value[field]) context.addIssue({ code: "custom", path: [field], message: `Enter the ${label} for the appointment.` });
    }
});

export type AppointmentDetails = {
  appointmentMode: string;
  appointmentPhone: string | null;
  appointmentStreetAddress: string | null;
  appointmentUnit: string | null;
  appointmentCity: string | null;
  appointmentPostalCode: string | null;
  appointmentCountry: string | null;
};

export function appointmentDetailsForStorage(value: Record<keyof AppointmentDetails, string>) {
  return {
    appointmentMode: value.appointmentMode,
    appointmentPhone: value.appointmentMode === "phone" ? value.appointmentPhone || null : null,
    appointmentStreetAddress: value.appointmentMode === "in_person" ? value.appointmentStreetAddress || null : null,
    appointmentUnit: value.appointmentMode === "in_person" ? value.appointmentUnit || null : null,
    appointmentCity: value.appointmentMode === "in_person" ? value.appointmentCity || null : null,
    appointmentPostalCode: value.appointmentMode === "in_person" ? value.appointmentPostalCode || null : null,
    appointmentCountry: value.appointmentMode === "in_person" ? value.appointmentCountry || null : null,
  };
}

export function formatAppointmentAddress(details: Pick<AppointmentDetails, "appointmentStreetAddress" | "appointmentUnit" | "appointmentCity" | "appointmentPostalCode" | "appointmentCountry">) {
  const street = [details.appointmentStreetAddress, details.appointmentUnit && `Unit ${details.appointmentUnit}`].filter(Boolean).join(", ");
  const locality = [details.appointmentCity, details.appointmentPostalCode].filter(Boolean).join(" ");
  return [street, locality, details.appointmentCountry].filter(Boolean).join(", ");
}

export function appointmentModeLabel(mode: string) {
  if (mode === "in_person") return "In person";
  if (mode === "google_meet") return "Google Meet";
  return "By phone";
}
