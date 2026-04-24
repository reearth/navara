export type Landmark = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  alt: number;
};

// MOCK DATA
export const JAPAN_LANDMARKS: Landmark[] = [
  // Tokyo / Kanto (geoid ~39m)
  {
    id: "tokyo-tower",
    name: "Tokyo Tower",
    lng: 139.7454,
    lat: 35.6586,
    alt: 94,
  },
  {
    id: "sensoji",
    name: "Sensoji Temple",
    lng: 139.7966,
    lat: 35.7148,
    alt: 92,
  },
  {
    id: "meiji-shrine",
    name: "Meiji Shrine",
    lng: 139.6993,
    lat: 35.6764,
    alt: 124,
  },
  {
    id: "skytree",
    name: "Tokyo Skytree",
    lng: 139.8107,
    lat: 35.7101,
    alt: 92,
  },
  {
    id: "shibuya",
    name: "Shibuya Crossing",
    lng: 139.7005,
    lat: 35.6595,
    alt: 114,
  },
  // Chubu (geoid ~39m)
  {
    id: "fuji",
    name: "Mt. Fuji",
    lng: 138.7274,
    lat: 35.3606,
    alt: 3865,
  },
  // Kyoto / Kansai (geoid ~37m)
  {
    id: "kinkakuji",
    name: "Kinkaku-ji",
    lng: 135.7292,
    lat: 35.0394,
    alt: 167,
  },
  {
    id: "fushimi-inari",
    name: "Fushimi Inari Taisha",
    lng: 135.7727,
    lat: 34.9671,
    alt: 137,
  },
  {
    id: "kiyomizu",
    name: "Kiyomizu-dera",
    lng: 135.785,
    lat: 34.9949,
    alt: 187,
  },
  {
    id: "arashiyama",
    name: "Arashiyama Bamboo Grove",
    lng: 135.6713,
    lat: 35.0094,
    alt: 127,
  },
  // Osaka (geoid ~37m)
  {
    id: "osaka-castle",
    name: "Osaka Castle",
    lng: 135.5256,
    lat: 34.6873,
    alt: 97,
  },
  {
    id: "dotonbori",
    name: "Dotonbori",
    lng: 135.5013,
    lat: 34.6687,
    alt: 90,
  },
  // Nara (geoid ~37m)
  {
    id: "nara-park",
    name: "Nara Park",
    lng: 135.8398,
    lat: 34.6851,
    alt: 177,
  },
  {
    id: "todaiji",
    name: "Todai-ji",
    lng: 135.8399,
    lat: 34.6889,
    alt: 187,
  },
  // Hyogo (geoid ~36m)
  {
    id: "himeji-castle",
    name: "Himeji Castle",
    lng: 134.6938,
    lat: 34.8394,
    alt: 131,
  },
  // Hiroshima (geoid ~35m)
  {
    id: "itsukushima",
    name: "Itsukushima Shrine",
    lng: 132.3197,
    lat: 34.2961,
    alt: 87,
  },
  {
    id: "hiroshima-peace",
    name: "Hiroshima Peace Memorial",
    lng: 132.4536,
    lat: 34.3955,
    alt: 88,
  },
  // Nagano (geoid ~39m)
  {
    id: "matsumoto-castle",
    name: "Matsumoto Castle",
    lng: 137.9688,
    lat: 36.2381,
    alt: 679,
  },
  // Ishikawa (geoid ~38m)
  {
    id: "kenrokuen",
    name: "Kenroku-en Garden",
    lng: 136.6633,
    lat: 36.5624,
    alt: 148,
  },
  // Gifu (geoid ~39m)
  {
    id: "shirakawago",
    name: "Shirakawa-go",
    lng: 136.9061,
    lat: 36.2576,
    alt: 539,
  },
  // Tochigi (geoid ~39m)
  {
    id: "nikko-toshogu",
    name: "Nikko Toshogu",
    lng: 139.599,
    lat: 36.7581,
    alt: 719,
  },
  // Kanagawa (geoid ~39m)
  {
    id: "kamakura-daibutsu",
    name: "Kamakura Great Buddha",
    lng: 139.5357,
    lat: 35.3167,
    alt: 119,
  },
  {
    id: "hakone",
    name: "Hakone Shrine",
    lng: 139.0227,
    lat: 35.1956,
    alt: 819,
  },
  // Hokkaido (geoid ~32m)
  {
    id: "sapporo-clock",
    name: "Sapporo Clock Tower",
    lng: 141.3468,
    lat: 43.0625,
    alt: 97,
  },
  {
    id: "otaru-canal",
    name: "Otaru Canal",
    lng: 140.9946,
    lat: 43.1971,
    alt: 87,
  },
  // Kumamoto (geoid ~33m)
  {
    id: "kumamoto-castle",
    name: "Kumamoto Castle",
    lng: 130.7058,
    lat: 32.806,
    alt: 133,
  },
  // Nagasaki (geoid ~33m)
  {
    id: "nagasaki-peace",
    name: "Nagasaki Peace Park",
    lng: 129.8644,
    lat: 32.7748,
    alt: 113,
  },
  // Okinawa (geoid ~30m)
  {
    id: "shuri-castle",
    name: "Shuri Castle",
    lng: 127.7195,
    lat: 26.217,
    alt: 200,
  },
  // Miyagi (geoid ~38m)
  {
    id: "matsushima",
    name: "Matsushima Bay",
    lng: 141.0625,
    lat: 38.3713,
    alt: 90,
  },
  // Kyoto (geoid ~37m)
  {
    id: "amanohashidate",
    name: "Amanohashidate",
    lng: 135.19,
    lat: 35.5723,
    alt: 89,
  },
];
