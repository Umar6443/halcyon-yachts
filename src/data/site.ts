/**
 * All copy, names, dates and prices live here. They are PLACEHOLDERS: replace the brand, yacht names,
 * numbers and wording with the client's real content. (Brand names / logos can also be laid over the
 * generated imagery later: the artwork carries only abstract emblems on purpose.)
 */

export const BRAND = {
  name: "BLOCKTIDE",
  tag: "Web3 Yacht Events",
  headline: ["Where Web3", "sets sail."],
  intro: "Private yacht events for crypto, NFT and blockchain communities. Eight yachts, four worlds. Scroll to step aboard.",
  contactEmail: "events@blocktide.example",
  contactPhone: "+385 00 000 0000",
  base: "Split, Croatia · Adriatic",
};

export type YachtId = "meme" | "nft" | "exchange" | "media";

export type Yacht = {
  id: YachtId;
  index: string;
  name: string;
  theme: string;
  short: string;
  tagline: string;
  description: string;
  /** accent colour of the yacht's livery (used for UI accents only) */
  accent: string;
  accent2: string;
  specs: { label: string; value: string }[];
  amenities: string[];
  eventTypes: string[];
  nextEvent: { date: string; title: string };
  price: string;
  priceNote: string;
  beam: string;
  /** interior / detail stills for the viewer */
  rooms: { id: string; label: string; src: string; note: string }[];
  gallery: { src: string; caption: string }[];
  /** quarter views of the 360 loop that the viewer's buttons jump to: [label, mark letter, how far into that stretch] */
  views: { label: string; mark: "a" | "b" | "c" | "d"; at: number }[];
};

const VIEWS: Yacht["views"] = [
  { label: "Stern", mark: "a", at: 0.62 },
  { label: "Port", mark: "b", at: 0.5 },
  { label: "Bow", mark: "c", at: 0.5 },
  { label: "Starboard", mark: "d", at: 0.5 },
];

export const YACHTS: Yacht[] = [
  {
    id: "meme",
    index: "01",
    name: "MOONSHOT",
    theme: "Meme Coin Community",
    short: "Meme coins",
    tagline: "Where the community throws its party.",
    description:
      "Black, white and electric lime from bow to stern: a flybridge DJ deck, a giant inflatable mascot on the foredeck and an LED-lit salon built for community launches, listing parties and long, loud afternoons.",
    accent: "#B6FF00",
    accent2: "#f3efe6",
    specs: [
      { label: "Length", value: "24 m" },
      { label: "Guests", value: "120" },
      { label: "Decks", value: "3" },
      { label: "Sound", value: "DJ rig" },
    ],
    amenities: ["Flybridge DJ booth", "LED video wall", "Beanbag decks", "Mascot foredeck", "Neon bar", "Swim platforms"],
    eventTypes: ["Coin launches", "Community parties", "Listing celebrations"],
    nextEvent: { date: "14 Jun 2027", title: "Moon Party — community launch" },
    price: "From €18,500",
    priceNote: "per event · up to 6 hours",
    beam: "img/meme-beam.webp",
    rooms: [
      { id: "salon", label: "Main salon", src: "img/meme-salon.webp", note: "Glossy black floor, lime LED lines and a neon bar" },
      { id: "fly", label: "Flybridge lounge", src: "img/meme-flybridge.webp", note: "DJ booth, beanbags and the whole bay in view" },
      { id: "deck", label: "Aft deck", src: "img/meme-deck.webp", note: "Open cockpit straight into the salon" },
    ],
    gallery: [
      { src: "img/meme-banner.webp", caption: "Branded banners and bunting" },
      { src: "img/meme-event.webp", caption: "A community launch on the flybridge" },
    ],
    views: VIEWS,
  },
  {
    id: "nft",
    index: "02",
    name: "CANVAS",
    theme: "NFT & Digital Art",
    short: "NFT & digital art",
    tagline: "A floating gallery for the next drop.",
    description:
      "Generative-art hull wrap, a gallery wall of LED displays and a glowing pixel-cube sculpture: CANVAS turns a yacht into an exhibition for NFT launches, collector previews and invite-only community nights.",
    accent: "#7B5CFF",
    accent2: "#4D8DFF",
    specs: [
      { label: "Length", value: "24 m" },
      { label: "Guests", value: "90" },
      { label: "Decks", value: "3" },
      { label: "Displays", value: "8 LED" },
    ],
    amenities: ["LED gallery wall", "Pixel-cube sculpture", "Velvet lounges", "Curated bar", "Presentation screen", "Swim platforms"],
    eventTypes: ["NFT launches", "Collector previews", "Digital art shows"],
    nextEvent: { date: "02 Jul 2027", title: "Genesis Drop — collector evening" },
    price: "From €16,000",
    priceNote: "per event · up to 6 hours",
    beam: "img/nft-beam.webp",
    rooms: [
      { id: "salon", label: "Gallery salon", src: "img/nft-salon.webp", note: "Framed LED art, white floors and electric-blue light" },
      { id: "fly", label: "Flybridge art lounge", src: "img/nft-flybridge.webp", note: "Three tall art panels above the bay" },
    ],
    gallery: [
      { src: "img/nft-banner.webp", caption: "Banner, wrap and pennants" },
      { src: "img/nft-event.webp", caption: "An NFT launch reception" },
    ],
    views: VIEWS,
  },
  {
    id: "exchange",
    index: "03",
    name: "LEDGER",
    theme: "Exchange & Fundraising",
    short: "Exchanges & funds",
    tagline: "Where deals are made over the water.",
    description:
      "Deep navy, polished gold and white linen: LEDGER is the professional room for exchange events, investor meetups and fundraising evenings, with a boardroom salon, a champagne bar and a calm, high-end deck.",
    accent: "#C9A24A",
    accent2: "#f3efe6",
    specs: [
      { label: "Length", value: "24 m" },
      { label: "Guests", value: "80" },
      { label: "Decks", value: "3" },
      { label: "Salon", value: "Boardroom" },
    ],
    amenities: ["Boardroom salon", "Champagne bar", "Presentation screen", "Shaded awning deck", "Gold sculpture", "Swim platforms"],
    eventTypes: ["Investor meetups", "Exchange events", "Fundraising dinners"],
    nextEvent: { date: "21 Sep 2027", title: "Founders & Funds — investor evening" },
    price: "From €21,000",
    priceNote: "per event · up to 6 hours",
    beam: "img/exchange-beam.webp",
    rooms: [
      { id: "salon", label: "Investor lounge", src: "img/exchange-salon.webp", note: "Marble, navy velvet and a gold-edged boardroom table" },
      { id: "fly", label: "Flybridge lounge", src: "img/exchange-flybridge.webp", note: "Linen bar and gold lanterns under the hardtop" },
    ],
    gallery: [
      { src: "img/exchange-banner.webp", caption: "Navy banner with the gold node emblem" },
      { src: "img/exchange-event.webp", caption: "An investor reception on deck" },
    ],
    views: VIEWS,
  },
  {
    id: "media",
    index: "04",
    name: "SIGNAL",
    theme: "Crypto News & Web3 Media",
    short: "News & media",
    tagline: "The after-party for the industry.",
    description:
      "Teal, black and white with waveform graphics and display panels: SIGNAL is built for crypto media events, conference after-parties and brand-sponsored networking, with a press wall and a studio lounge.",
    accent: "#0FB5A8",
    accent2: "#f3efe6",
    specs: [
      { label: "Length", value: "24 m" },
      { label: "Guests", value: "100" },
      { label: "Decks", value: "3" },
      { label: "Screens", value: "4 LED" },
    ],
    amenities: ["Press wall", "Studio lounge", "LED display panels", "Studio lighting", "Signal bar", "Swim platforms"],
    eventTypes: ["Conference after-parties", "Media events", "Sponsored networking"],
    nextEvent: { date: "10 Oct 2027", title: "Signal Night — conference after-party" },
    price: "From €17,500",
    priceNote: "per event · up to 6 hours",
    beam: "img/media-beam.webp",
    rooms: [
      { id: "salon", label: "Studio lounge", src: "img/media-salon.webp", note: "Interview set, waveform walls and a teal-lit bar" },
      { id: "fly", label: "Flybridge lounge", src: "img/media-flybridge.webp", note: "Studio light panels and an LED display wall" },
    ],
    gallery: [
      { src: "img/media-banner.webp", caption: "Signal badge banner and waveform wrap" },
      { src: "img/media-event.webp", caption: "A conference after-party" },
    ],
    views: VIEWS,
  },
];

export const EVENTS = YACHTS.map((y) => ({
  yacht: y.id,
  date: y.nextEvent.date,
  title: y.nextEvent.title,
  place: "Adriatic · departs Split",
  image: y.gallery[1].src,
}));

export const ABOUT = {
  heading: ["Not a charter.", "An event on the water."],
  body: [
    "BLOCKTIDE plans exclusive Web3 events and after-parties on luxury yachts: meme-coin launches, NFT drops, investor evenings and media nights. Every yacht is dressed in the identity of its community, from hull wrap to bunting.",
    "We handle the vessel, the crew, the sound and light, the branding and the guest list, so your team only has to show up.",
  ],
  stats: [
    { value: "8", label: "Yachts in the fleet" },
    { value: "4", label: "Event worlds" },
    { value: "120", label: "Guests on the largest deck" },
    { value: "24 m", label: "Catamarans, built for parties" },
  ],
};
