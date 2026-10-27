/**
 * All copy and specs live here. These are PLACEHOLDERS: replace the brand,
 * yacht names, numbers and wording with the client's real content.
 */

export const BRAND = {
  name: "HALCYON",
  tag: "Yacht Charters",
  headline: ["Choose your", "yacht."],
  intro: "A private fleet in the Adriatic. Scroll to step aboard.",
  contactEmail: "charter@halcyon.example",
  contactPhone: "+385 00 000 0000",
  base: "Marina Kaštela, Croatia",
};

export type Window =
  | { kind: "image"; src: string; caption: string; alt: string }
  | { kind: "seq"; seq: "a_close" | "b_close"; caption: string; alt: string; poster: string };

export type Yacht = {
  id: "a" | "b";
  index: string;
  name: string;
  type: string;
  tagline: string;
  description: string;
  /** captions that appear one after another while the interior film plays */
  interiorLabel: string;
  interiorNotes: string[];
  specs: { label: string; value: string }[];
  price: string;
  windows: Window[];
};

export const YACHTS: Yacht[] = [
  {
    id: "a",
    index: "01",
    name: "AURA 50",
    type: "Sailing catamaran",
    tagline: "Room to breathe at sea.",
    description:
      "Two wide hulls, a shaded helm and a cockpit made for long lunches. AURA 50 sails flat, anchors quietly and gives ten guests space of their own.",
    interiorLabel: "Main salon",
    interiorNotes: ["Panoramic salon windows", "Light oak, teal accents", "Navigation station"],
    specs: [
      { label: "Length", value: "15.2 m" },
      { label: "Guests", value: "10" },
      { label: "Cabins", value: "4" },
      { label: "Beam", value: "8.1 m" },
      { label: "Draft", value: "1.3 m" },
      { label: "Engines", value: "2 × 45 hp" },
    ],
    price: "From €4,800 / week",
    windows: [
      { kind: "image", src: "img/a-side.webp", caption: "Side profile", alt: "AURA 50 sailing catamaran seen from the side at anchor" },
      { kind: "seq", seq: "a_close", caption: "Helm & cockpit", alt: "A slow glide along the cockpit and helm of AURA 50", poster: "img/a-cockpit.webp" },
    ],
  },
  {
    id: "b",
    index: "02",
    name: "NOCTIS 46",
    type: "Performance sloop",
    tagline: "Built to be sailed.",
    description:
      "A fast, balanced monohull with twin wheels, a teak cockpit and a salon that feels like a small private club. NOCTIS 46 is for guests who want to feel the wind.",
    interiorLabel: "Main salon",
    interiorNotes: ["Warm teak throughout", "Navy upholstery, round portholes", "The whole bay in view"],
    specs: [
      { label: "Length", value: "14.0 m" },
      { label: "Guests", value: "8" },
      { label: "Cabins", value: "3" },
      { label: "Beam", value: "4.4 m" },
      { label: "Draft", value: "2.1 m" },
      { label: "Engine", value: "1 × 75 hp" },
    ],
    price: "From €3,100 / week",
    windows: [
      { kind: "image", src: "img/b-side.webp", caption: "Side profile", alt: "NOCTIS 46 performance sloop seen from the side at anchor" },
      { kind: "seq", seq: "b_close", caption: "Twin wheels & cockpit", alt: "A slow glide along the teak cockpit of NOCTIS 46", poster: "img/b-cockpit.webp" },
    ],
  },
];
