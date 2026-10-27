"use client";

import { FormEvent } from "react";
import { BRAND, YACHTS } from "@/data/yachts";

export default function Footer() {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = `Name: ${f.get("name")}\nDates: ${f.get("dates")}\nYacht: ${f.get("yacht")}\n\n${f.get("message")}`;
    window.location.href = `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent("Charter enquiry")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <footer id="contact" className="relative z-40 bg-[#041322] text-[#f3efe6]">
      <div className="mx-auto grid max-w-[1500px] gap-14 px-5 py-24 sm:px-10 md:grid-cols-2 md:py-32">
        <div>
          <p className="font-mono text-[10px] tracking-[0.4em] text-[#3fd8d2]">CHARTER ENQUIRY</p>
          <h2 className="mt-5 font-serif text-[13vw] leading-[0.92] sm:text-[8vw] md:text-[5.5vw]">
            Your next
            <br />
            <em className="italic text-[#9fe9e4]">sea day.</em>
          </h2>
          <dl className="mt-10 space-y-5 text-sm">
            <div>
              <dt className="font-mono text-[10px] tracking-[0.3em] text-white/50">EMAIL</dt>
              <dd className="mt-1 font-serif text-2xl">{BRAND.contactEmail}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.3em] text-white/50">PHONE</dt>
              <dd className="mt-1 font-serif text-2xl">{BRAND.contactPhone}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.3em] text-white/50">BASE</dt>
              <dd className="mt-1 font-serif text-2xl">{BRAND.base}</dd>
            </div>
          </dl>
        </div>
        <form onSubmit={submit} className="space-y-6 self-end">
          {[
            ["name", "Your name", "text"],
            ["dates", "Preferred dates", "text"],
          ].map(([n, label, type]) => (
            <label key={n} className="block">
              <span className="font-mono text-[10px] tracking-[0.3em] text-white/50">{label.toUpperCase()}</span>
              <input name={n} type={type} required className="field" />
            </label>
          ))}
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/50">YACHT</span>
            <select name="yacht" className="field">
              {YACHTS.map((y) => (
                <option key={y.id} value={y.name} className="bg-[#041322]">
                  {y.name} — {y.type}
                </option>
              ))}
              <option className="bg-[#041322]">Not sure yet</option>
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/50">MESSAGE</span>
            <textarea name="message" rows={3} className="field resize-none" />
          </label>
          <button className="btn">Send enquiry</button>
        </form>
      </div>
      <div className="border-t border-white/10 px-5 py-6 font-mono text-[10px] tracking-[0.25em] text-white/45 sm:px-10">
        © 2026 {BRAND.name} {BRAND.tag.toUpperCase()} — PLACEHOLDER CONTENT, REPLACE WITH CLIENT DETAILS.
      </div>
    </footer>
  );
}
