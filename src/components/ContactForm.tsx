"use client";

import { FormEvent, useState } from "react";
import { BRAND, YACHTS } from "@/data/site";

/** The enquiry form: opens the visitor's email app with everything filled in (no server needed on a static host). */
export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = `Name: ${f.get("name")}\nEmail: ${f.get("email")}\nOrganisation: ${f.get("org")}\nEvent type: ${f.get("type")}\nPreferred date: ${f.get("date")}\nGuests: ${f.get("guests")}\n\n${f.get("message")}`;
    setSent(true);
    window.location.href = `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent("Event enquiry")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form onSubmit={submit} data-reveal className="space-y-6 self-end">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="label">Your name</span>
          <input name="name" required autoComplete="name" className="field" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="field" />
        </label>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="label">Project / organisation</span>
          <input name="org" autoComplete="organization" className="field" />
        </label>
        <label className="block">
          <span className="label">Event type</span>
          <select name="type" className="field">
            {YACHTS.map((y) => (
              <option key={y.id} value={y.theme}>
                {y.theme}
              </option>
            ))}
            <option>Something else</option>
          </select>
        </label>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="label">Preferred date</span>
          <input name="date" type="date" className="field" />
        </label>
        <label className="block">
          <span className="label">Guests</span>
          <input name="guests" inputMode="numeric" placeholder="e.g. 80" className="field" />
        </label>
      </div>
      <label className="block">
        <span className="label">Tell us about the event</span>
        <textarea name="message" rows={3} className="field resize-none" />
      </label>
      <div className="flex flex-wrap items-center gap-5">
        <button className="btn">Send enquiry</button>
        {sent && (
          <p role="status" className="text-sm text-white/60">
            Opening your email app…
          </p>
        )}
      </div>
    </form>
  );
}
