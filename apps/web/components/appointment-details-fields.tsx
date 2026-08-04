"use client";

export type BookingAppointmentDetails = {
  appointmentMode: "phone" | "in_person";
  appointmentPhone: string;
  appointmentStreetAddress: string;
  appointmentUnit: string;
  appointmentCity: string;
  appointmentPostalCode: string;
  appointmentCountry: string;
};

export const emptyAppointmentDetails: BookingAppointmentDetails = {
  appointmentMode: "phone",
  appointmentPhone: "",
  appointmentStreetAddress: "",
  appointmentUnit: "",
  appointmentCity: "",
  appointmentPostalCode: "",
  appointmentCountry: "Canada",
};

export function AppointmentDetailsFields({ value, onChange }: { value: BookingAppointmentDetails; onChange: (value: BookingAppointmentDetails) => void }) {
  const update = <K extends keyof BookingAppointmentDetails>(key: K, next: BookingAppointmentDetails[K]) => onChange({ ...value, [key]: next });
  return <fieldset className="appointment-format-fields">
    <legend>How will we meet?</legend>
    <div className="appointment-format-options">
      <label><input type="radio" name="appointmentMode" value="phone" checked={value.appointmentMode === "phone"} onChange={() => update("appointmentMode", "phone")} /><span><strong>By phone</strong><small>I&apos;ll call you at the appointment time.</small></span></label>
      <label><input type="radio" name="appointmentMode" value="in_person" checked={value.appointmentMode === "in_person"} onChange={() => update("appointmentMode", "in_person")} /><span><strong>In person</strong><small>I&apos;ll come to the address you provide.</small></span></label>
    </div>
    {value.appointmentMode === "phone" ? <label>Phone number<input type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="tel" value={value.appointmentPhone} onChange={(event) => update("appointmentPhone", event.target.value.replace(/\D/g, ""))} minLength={7} maxLength={30} required /></label> : <div className="field-grid appointment-address-fields">
      <label className="wide">Street number and street<input autoComplete="street-address" value={value.appointmentStreetAddress} onChange={(event) => update("appointmentStreetAddress", event.target.value)} maxLength={200} required /></label>
      <label>Unit <small>Optional</small><input autoComplete="address-line2" value={value.appointmentUnit} onChange={(event) => update("appointmentUnit", event.target.value)} maxLength={30} /></label>
      <label>City<input autoComplete="address-level2" value={value.appointmentCity} onChange={(event) => update("appointmentCity", event.target.value)} maxLength={100} required /></label>
      <label>Postal code<input autoComplete="postal-code" value={value.appointmentPostalCode} onChange={(event) => update("appointmentPostalCode", event.target.value)} maxLength={20} required /></label>
      <label>Country<input autoComplete="country-name" value={value.appointmentCountry} onChange={(event) => update("appointmentCountry", event.target.value)} maxLength={80} required /></label>
    </div>}
  </fieldset>;
}
