export interface NigerianState {
  code: string; // 2-letter state prefix
  name: string;
  capital: string;
  geoZone: "South West" | "South South" | "South East" | "North Central" | "North West" | "North East";
  sampleLgas: string[];
  approxCoords: { lat: number; lng: number };
}

export const NIGERIAN_STATES: Record<string, NigerianState> = {
  LA: {
    code: "LA",
    name: "Lagos",
    capital: "Ikeja",
    geoZone: "South West",
    sampleLgas: ["Ikeja", "Eti-Osa", "Lagos Island", "Surulere", "Alimosho", "Oshodi-Isolo", "Kosofe", "Apapa", "Ikorodu", "Badagry"],
    approxCoords: { lat: 6.5244, lng: 3.3792 },
  },
  FC: {
    code: "FC",
    name: "Federal Capital Territory (Abuja)",
    capital: "Abuja",
    geoZone: "North Central",
    sampleLgas: ["Abuja Municipal (AMAC)", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji"],
    approxCoords: { lat: 9.0765, lng: 7.3986 },
  },
  AB: {
    code: "AB",
    name: "Federal Capital Territory (Abuja)",
    capital: "Abuja",
    geoZone: "North Central",
    sampleLgas: ["Abuja Municipal (AMAC)", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji"],
    approxCoords: { lat: 9.0765, lng: 7.3986 },
  },
  RV: {
    code: "RV",
    name: "Rivers",
    capital: "Port Harcourt",
    geoZone: "South South",
    sampleLgas: ["Port Harcourt City", "Obio-Akpor", "Eleme", "Ikwerre", "Bonny", "Oyigbo", "Okrika"],
    approxCoords: { lat: 4.8156, lng: 7.0498 },
  },
  KN: {
    code: "KN",
    name: "Kano",
    capital: "Kano",
    geoZone: "North West",
    sampleLgas: ["Kano Municipal", "Fagge", "Dala", "Gwale", "Nassarawa", "Tarauni", "Kumbotso", "Ungogo"],
    approxCoords: { lat: 12.0022, lng: 8.592 },
  },
  OY: {
    code: "OY",
    name: "Oyo",
    capital: "Ibadan",
    geoZone: "South West",
    sampleLgas: ["Ibadan North", "Ibadan South-West", "Ibadan North-East", "Oluyole", "Ogbomosho North", "Oyo East"],
    approxCoords: { lat: 7.3775, lng: 3.947 },
  },
  OG: {
    code: "OG",
    name: "Ogun",
    capital: "Abeokuta",
    geoZone: "South West",
    sampleLgas: ["Abeokuta South", "Obafemi Owode", "Ado-Odo/Ota", "Sagamu", "Ijebu Ode", "Ifo"],
    approxCoords: { lat: 7.1475, lng: 3.3619 },
  },
  EN: {
    code: "EN",
    name: "Enugu",
    capital: "Enugu",
    geoZone: "South East",
    sampleLgas: ["Enugu North", "Enugu South", "Enugu East", "Nsukka", "Udi", "Nkanu West"],
    approxCoords: { lat: 6.4584, lng: 7.5464 },
  },
  KD: {
    code: "KD",
    name: "Kaduna",
    capital: "Kaduna",
    geoZone: "North West",
    sampleLgas: ["Kaduna North", "Kaduna South", "Chikun", "Zaria", "Sabon Gari", "Igabi"],
    approxCoords: { lat: 10.5105, lng: 7.4165 },
  },
  ED: {
    code: "ED",
    name: "Edo",
    capital: "Benin City",
    geoZone: "South South",
    sampleLgas: ["Oredo", "Ikpoba-Okha", "Egor", "Uhunmwonde", "Esan West", "Ovia North-East"],
    approxCoords: { lat: 6.335, lng: 5.6037 },
  },
  AN: {
    code: "AN",
    name: "Anambra",
    capital: "Awka",
    geoZone: "South East",
    sampleLgas: ["Awka South", "Onitsha North", "Onitsha South", "Nnewi North", "Idemili North", "Aguata"],
    approxCoords: { lat: 6.2209, lng: 7.0723 },
  },
  DE: {
    code: "DE",
    name: "Delta",
    capital: "Asaba",
    geoZone: "South South",
    sampleLgas: ["Oshimili South (Asaba)", "Warri South", "Uvwie", "Sapele", "Ughelli North", "Ika North-East"],
    approxCoords: { lat: 6.1983, lng: 6.732 },
  },
  AK: {
    code: "AK",
    name: "Akwa Ibom",
    capital: "Uyo",
    geoZone: "South South",
    sampleLgas: ["Uyo", "Ikot Ekpene", "Eket", "Oron", "Abak", "Ibesikpo Asutan"],
    approxCoords: { lat: 5.0377, lng: 7.9128 },
  },
  AB_IA: {
    code: "BI",
    name: "Abia",
    capital: "Umuahia",
    geoZone: "South East",
    sampleLgas: ["Aba North", "Aba South", "Umuahia North", "Osisioma", "Ohafia"],
    approxCoords: { lat: 5.526, lng: 7.4896 },
  },
  AD: {
    code: "AD",
    name: "Adamawa",
    capital: "Yola",
    geoZone: "North East",
    sampleLgas: ["Yola North", "Yola South", "Mubi North", "Girei", "Numan"],
    approxCoords: { lat: 9.3265, lng: 12.441 },
  },
  BA: {
    code: "BA",
    name: "Bauchi",
    capital: "Bauchi",
    geoZone: "North East",
    sampleLgas: ["Bauchi", "Katagum", "Misau", "Tafawa Balewa", "Dass"],
    approxCoords: { lat: 10.3158, lng: 9.8442 },
  },
  BY: {
    code: "BY",
    name: "Bayelsa",
    capital: "Yenagoa",
    geoZone: "South South",
    sampleLgas: ["Yenagoa", "Brass", "Sagbama", "Ogbia", "Nembe"],
    approxCoords: { lat: 4.9267, lng: 6.2676 },
  },
  BE: {
    code: "BE",
    name: "Benue",
    capital: "Makurdi",
    geoZone: "North Central",
    sampleLgas: ["Makurdi", "Gboko", "Otukpo", "Gwer East", "Katsina-Ala"],
    approxCoords: { lat: 7.7322, lng: 8.5218 },
  },
  BO: {
    code: "BO",
    name: "Borno",
    capital: "Maiduguri",
    geoZone: "North East",
    sampleLgas: ["Maiduguri", "Jere", "Biu", "Bama", "Konduga"],
    approxCoords: { lat: 11.8333, lng: 13.15 },
  },
  CR: {
    code: "CR",
    name: "Cross River",
    capital: "Calabar",
    geoZone: "South South",
    sampleLgas: ["Calabar Municipal", "Calabar South", "Ikom", "Ogoja", "Akpabuyo"],
    approxCoords: { lat: 4.9757, lng: 8.3417 },
  },
  EB: {
    code: "EB",
    name: "Ebonyi",
    capital: "Abakaliki",
    geoZone: "South East",
    sampleLgas: ["Abakaliki", "Afikpo North", "Ezza South", "Ishielu", "Ohaozara"],
    approxCoords: { lat: 6.3249, lng: 8.1137 },
  },
  EK: {
    code: "EK",
    name: "Ekiti",
    capital: "Ado-Ekiti",
    geoZone: "South West",
    sampleLgas: ["Ado-Ekiti", "Ikere", "Ijero", "Oye", "Irepodun/Ifelodun"],
    approxCoords: { lat: 7.6211, lng: 5.2215 },
  },
  GO: {
    code: "GO",
    name: "Gombe",
    capital: "Gombe",
    geoZone: "North East",
    sampleLgas: ["Gombe", "Akko", "Yamaltu/Deba", "Kaltungo", "Dukku"],
    approxCoords: { lat: 10.2897, lng: 11.1673 },
  },
  IM: {
    code: "IM",
    name: "Imo",
    capital: "Owerri",
    geoZone: "South East",
    sampleLgas: ["Owerri Municipal", "Owerri North", "Owerri West", "Orlu", "Okigwe"],
    approxCoords: { lat: 5.4836, lng: 7.0333 },
  },
  JI: {
    code: "JI",
    name: "Jigawa",
    capital: "Dutse",
    geoZone: "North West",
    sampleLgas: ["Dutse", "Hadejia", "Kazaure", "Gumel", "Ringim"],
    approxCoords: { lat: 11.7562, lng: 9.3389 },
  },
  KT: {
    code: "KT",
    name: "Katsina",
    capital: "Katsina",
    geoZone: "North West",
    sampleLgas: ["Katsina", "Funtua", "Daura", "Malumfashi", "Dutsin-Ma"],
    approxCoords: { lat: 12.9908, lng: 7.6018 },
  },
  KB: {
    code: "KB",
    name: "Kebbi",
    capital: "Birnin Kebbi",
    geoZone: "North West",
    sampleLgas: ["Birnin Kebbi", "Argungu", "Yauri", "Zuru", "Jega"],
    approxCoords: { lat: 12.4504, lng: 4.1975 },
  },
  KO: {
    code: "KO",
    name: "Kogi",
    capital: "Lokoja",
    geoZone: "North Central",
    sampleLgas: ["Lokoja", "Okene", "Idah", "Ajaokuta", "Kabba/Bunu"],
    approxCoords: { lat: 7.7969, lng: 6.7405 },
  },
  KW: {
    code: "KW",
    name: "Kwara",
    capital: "Ilorin",
    geoZone: "North Central",
    sampleLgas: ["Ilorin South", "Ilorin West", "Ilorin East", "Offa", "Omu-Aran"],
    approxCoords: { lat: 8.4966, lng: 4.5421 },
  },
  NA: {
    code: "NA",
    name: "Nasarawa",
    capital: "Lafia",
    geoZone: "North Central",
    sampleLgas: ["Lafia", "Karu", "Keffi", "Akwanga", "Nasarawa"],
    approxCoords: { lat: 8.4932, lng: 8.5153 },
  },
  NI: {
    code: "NI",
    name: "Niger",
    capital: "Minna",
    geoZone: "North Central",
    sampleLgas: ["Chanchaga (Minna)", "Suleja", "Bida", "Kontagora", "Shiroro"],
    approxCoords: { lat: 9.6139, lng: 6.5569 },
  },
  ON: {
    code: "ON",
    name: "Ondo",
    capital: "Akure",
    geoZone: "South West",
    sampleLgas: ["Akure South", "Akure North", "Ondo West", "Owo", "Ikare Akoko"],
    approxCoords: { lat: 7.2571, lng: 5.2058 },
  },
  OS: {
    code: "OS",
    name: "Osun",
    capital: "Osogbo",
    geoZone: "South West",
    sampleLgas: ["Osogbo", "Ife Central", "Ilesa East", "Ede South", "Iwo"],
    approxCoords: { lat: 7.7827, lng: 4.5418 },
  },
  PL: {
    code: "PL",
    name: "Plateau",
    capital: "Jos",
    geoZone: "North Central",
    sampleLgas: ["Jos North", "Jos South", "Barkin Ladi", "Pankshin", "Shendam"],
    approxCoords: { lat: 9.9309, lng: 8.8921 },
  },
  SO: {
    code: "SO",
    name: "Sokoto",
    capital: "Sokoto",
    geoZone: "North West",
    sampleLgas: ["Sokoto North", "Sokoto South", "Wamakko", "Gwadabawa", "Tambuwal"],
    approxCoords: { lat: 13.0627, lng: 5.2339 },
  },
  TA: {
    code: "TA",
    name: "Taraba",
    capital: "Jalingo",
    geoZone: "North East",
    sampleLgas: ["Jalingo", "Wukari", "Bali", "Gashaka", "Takum"],
    approxCoords: { lat: 8.8937, lng: 11.3596 },
  },
  YO: {
    code: "YO",
    name: "Yobe",
    capital: "Damaturu",
    geoZone: "North East",
    sampleLgas: ["Damaturu", "Potiskum", "Gashua (Bade)", "Geidam", "Nguru"],
    approxCoords: { lat: 11.747, lng: 11.9608 },
  },
  ZA: {
    code: "ZA",
    name: "Zamfara",
    capital: "Gusau",
    geoZone: "North West",
    sampleLgas: ["Gusau", "Tsafe", "Kaura Namoda", "Maru", "Talata Mafara"],
    approxCoords: { lat: 12.1628, lng: 6.6614 },
  },
};

export interface PostcodeAnatomy {
  stateCode: string;
  stateName: string;
  zoneCode: string;
  districtCode: string;
  unitCode: string;
  lgaName: string;
  districtName: string;
  coordinates: { lat: number; lng: number };
  zoneCategory: "Prime Commercial" | "Urban Residential" | "Industrial Logistics" | "Mixed Enterprise";
  dispatchHub: string;
  roadAccessibility: "Paved Dual Carriageway" | "Paved Urban Road" | "Collector Arterial" | "Standard Urban Grid";
}

export interface CuratedExample {
  postcode: string;
  label: string;
  state: string;
  lga: string;
  description: string;
}

export const CURATED_EXAMPLES: CuratedExample[] = [
  {
    postcode: "LA010010101",
    label: "Ikeja Central Hub",
    state: "Lagos",
    lga: "Ikeja",
    description: "Allen Avenue Commercial District, Lagos Mainland",
  },
  {
    postcode: "LA020030205",
    label: "Lekki Financial Corridor",
    state: "Lagos",
    lga: "Eti-Osa",
    description: "Victoria Island / Admiralty Way, Lagos Island",
  },
  {
    postcode: "AB010020110",
    label: "Abuja Central Business District",
    state: "FCT Abuja",
    lga: "AMAC",
    description: "Garki 2 / Central Area, Federal Capital Territory",
  },
  {
    postcode: "RV010010304",
    label: "Port Harcourt Commercial Hub",
    state: "Rivers",
    lga: "Port Harcourt City",
    description: "GRA Phase II, Port Harcourt",
  },
  {
    postcode: "KN010010102",
    label: "Kano Bompai Industrial Zone",
    state: "Kano",
    lga: "Kano Municipal",
    description: "Bompai Industrial Area & Logistics Corridor",
  },
  {
    postcode: "OY010020108",
    label: "Ibadan Bodija Enterprise Zone",
    state: "Oyo",
    lga: "Ibadan North",
    description: "Bodija Secretariat Corridor, Ibadan",
  },
  {
    postcode: "OG010010103",
    label: "Ogun Gateway Hub",
    state: "Ogun",
    lga: "Obafemi Owode",
    description: "Magboro / Mowe Industrial Strip",
  },
];

/**
 * Parses an 11-character NDAPS digital postcode into anatomical components.
 * Format: [State: 2 chars][LGA/Zone: 3 chars][District/Sector: 4 chars][Unit: 2 chars]
 */
export function parseNdapsPostcode(postcode: string): PostcodeAnatomy {
  const clean = postcode.trim().toUpperCase();
  const stateCode = clean.slice(0, 2);
  const zoneCode = clean.slice(2, 5);
  const districtCode = clean.slice(5, 9);
  const unitCode = clean.slice(9, 11);

  const matchedState = NIGERIAN_STATES[stateCode] || {
    code: stateCode,
    name: `${stateCode} State / Postal Sector`,
    capital: "Regional Centre",
    geoZone: "South West" as const,
    sampleLgas: ["Municipal District", "Central Zone"],
    approxCoords: { lat: 9.082, lng: 8.6753 },
  };

  // Derive stable LGA and district based on numeric hash of zone and district
  const lgaIndex = Math.abs(parseInt(zoneCode, 10) || 1) % matchedState.sampleLgas.length;
  const lgaName = matchedState.sampleLgas[lgaIndex] || matchedState.sampleLgas[0];

  const districtNames = [
    "Commercial Centre",
    "Central Boulevard",
    "Industrial Park",
    "Government Reservation Area (GRA)",
    "Port Logistics Zone",
    "Tech & Innovation Corridor",
    "Market Square Strip",
    "Expressway Hub",
  ];
  const distNum = parseInt(districtCode, 10) || 1;
  const districtName = `${lgaName} ${districtNames[distNum % districtNames.length]}`;

  // Deterministically adjust coordinates around the state center
  const latOffset = ((parseInt(districtCode, 10) % 200) - 100) * 0.0006;
  const lngOffset = ((parseInt(zoneCode + unitCode, 10) % 200) - 100) * 0.0006;

  const zoneCategories: PostcodeAnatomy["zoneCategory"][] = [
    "Prime Commercial",
    "Urban Residential",
    "Industrial Logistics",
    "Mixed Enterprise",
  ];

  const roadTypes: PostcodeAnatomy["roadAccessibility"][] = [
    "Paved Dual Carriageway",
    "Paved Urban Road",
    "Collector Arterial",
    "Standard Urban Grid",
  ];

  return {
    stateCode,
    stateName: matchedState.name,
    zoneCode,
    districtCode,
    unitCode,
    lgaName,
    districtName,
    coordinates: {
      lat: Number((matchedState.approxCoords.lat + latOffset).toFixed(4)),
      lng: Number((matchedState.approxCoords.lng + lngOffset).toFixed(4)),
    },
    zoneCategory: zoneCategories[distNum % zoneCategories.length],
    dispatchHub: `${matchedState.name} Central Dispatch (${lgaName})`,
    roadAccessibility: roadTypes[distNum % roadTypes.length],
  };
}

/**
 * Generates an official NDAPS format postcode from state and LGA selection.
 */
export function generatePostcodeForLga(stateCode: string, lgaName: string, districtNumber = 1): string {
  const cleanState = stateCode.trim().toUpperCase();
  const state = NIGERIAN_STATES[cleanState] || NIGERIAN_STATES.LA;
  const lgaIndex = state.sampleLgas.indexOf(lgaName);
  const zoneNum = String((lgaIndex >= 0 ? lgaIndex + 1 : 1)).padStart(3, "0");
  const distNum = String(districtNumber).padStart(4, "0");
  const unitNum = "01";
  return `${state.code}${zoneNum}${distNum}${unitNum}`;
}

export interface CorridorCalculation {
  distanceKm: number;
  originAnatomy: PostcodeAnatomy;
  destAnatomy: PostcodeAnatomy;
  dispatchTier: "Same-Day Intra-City" | "Regional Highway Express" | "Interstate Haulage";
  estimatedTransitHours: string;
  recommendedCorridor: string;
  routeConfidence: "Direct Arterial" | "Standard Transit" | "Remote Feeder";
}

/**
 * Calculates distance, dispatch tier, and transit corridor between two Nigerian digital postcodes.
 */
export function calculateCorridor(originCode: string, destCode: string): CorridorCalculation {
  const origin = parseNdapsPostcode(originCode);
  const dest = parseNdapsPostcode(destCode);

  // Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = ((dest.coordinates.lat - origin.coordinates.lat) * Math.PI) / 180;
  const dLon = ((dest.coordinates.lng - origin.coordinates.lng) * Math.PI) / 180;
  const lat1 = (origin.coordinates.lat * Math.PI) / 180;
  const lat2 = (dest.coordinates.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.max(1, Math.round(R * c));

  let dispatchTier: CorridorCalculation["dispatchTier"] = "Same-Day Intra-City";
  let estimatedTransitHours = "2–4 hours (Express Motorcycle / Van)";
  let routeConfidence: CorridorCalculation["routeConfidence"] = "Direct Arterial";

  if (origin.stateCode === dest.stateCode) {
    if (distanceKm < 35) {
      dispatchTier = "Same-Day Intra-City";
      estimatedTransitHours = "2–4 hours";
    } else {
      dispatchTier = "Same-Day Intra-City";
      estimatedTransitHours = "4–8 hours";
    }
  } else if (distanceKm < 300) {
    dispatchTier = "Regional Highway Express";
    estimatedTransitHours = "12–24 hours (Interstate Corridor)";
    routeConfidence = "Standard Transit";
  } else {
    dispatchTier = "Interstate Haulage";
    estimatedTransitHours = "24–48 hours (Cross-Regional Transit)";
    routeConfidence = "Standard Transit";
  }

  const recommendedCorridor =
    origin.stateCode === dest.stateCode
      ? `${origin.lgaName} → ${dest.lgaName} Local Transit Link`
      : `${origin.stateName} (${origin.lgaName}) → ${dest.stateName} (${dest.lgaName}) Interstate Gateway`;

  return {
    distanceKm,
    originAnatomy: origin,
    destAnatomy: dest,
    dispatchTier,
    estimatedTransitHours,
    recommendedCorridor,
    routeConfidence,
  };
}

export interface DefaultLocationItem {
  id: string;
  label: string;
  postcode: string;
  address: string;
  category: "Fulfilment Hub" | "Retail Store" | "Pickup Station" | "Dispatch Office";
  created_at: string;
}

export const INITIAL_DEMO_LOCATIONS: DefaultLocationItem[] = [
  {
    id: "loc-demo-001",
    label: "Ikeja Main Sorting Facility",
    postcode: "LA010010101",
    address: "Plot 14 Allen Avenue, Ikeja, Lagos",
    category: "Fulfilment Hub",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: "loc-demo-002",
    label: "Victoria Island Customer Experience Center",
    postcode: "LA020030205",
    address: "Ahmadu Bello Way, Victoria Island, Lagos",
    category: "Retail Store",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "loc-demo-003",
    label: "Abuja Central Dispatch Gateway",
    postcode: "AB010020110",
    address: "Constitution Avenue, Central Business District, Abuja",
    category: "Dispatch Office",
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "loc-demo-004",
    label: "Port Harcourt Distribution Depot",
    postcode: "RV010010304",
    address: "Tombia Extension, GRA Phase II, Port Harcourt, Rivers State",
    category: "Fulfilment Hub",
    created_at: new Date().toISOString(),
  },
  {
    id: "loc-demo-005",
    label: "Kano Bompai Regional Warehouse",
    postcode: "KN010010102",
    address: "Bompai Industrial Estate, Kano",
    category: "Fulfilment Hub",
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: "loc-demo-006",
    label: "Ibadan Bodija Express Hub",
    postcode: "OY010020108",
    address: "Old Bodija Secretariat Way, Ibadan, Oyo State",
    category: "Pickup Station",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];
