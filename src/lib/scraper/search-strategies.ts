export interface SearchStrategy {
  name: string;
  platform: "linkedin" | "gmaps";
  description: string;
  params: {
    keywords?: string;
    title?: string;
    location?: string;
    query?: string;
  };
}

export const SCRAPING_STRATEGIES: SearchStrategy[] = [
  // ═══════════════════════════════════════════════════════════
  // LINKEDIN - FRANCE
  // ═══════════════════════════════════════════════════════════
  {
    name: "FR - Conciergeries decision makers",
    platform: "linkedin",
    description: "Gerants et fondateurs de conciergeries en France",
    params: {
      keywords: "conciergerie location saisonniere airbnb",
      title: "gerant OR fondateur OR directeur OR CEO",
      location: "France",
    },
  },
  {
    name: "FR - Property managers",
    platform: "linkedin",
    description: "Gestionnaires de biens locatifs courte duree",
    params: {
      keywords: "gestion locative courte duree",
      title: "responsable OR manager OR gerant",
      location: "France",
    },
  },
  {
    name: "FR - Conciergeries nouvelles",
    platform: "linkedin",
    description: "Nouvelles conciergeries (cibles fraiches)",
    params: {
      keywords: "conciergerie airbnb booking",
      title: "fondateur OR co-fondateur OR createur",
      location: "France",
    },
  },

  // ═══════════════════════════════════════════════════════════
  // LINKEDIN - INTERNATIONAL
  // ═══════════════════════════════════════════════════════════
  {
    name: "ES - Vacation rental managers",
    platform: "linkedin",
    description: "Gestionnaires location saisonniere en Espagne",
    params: {
      keywords: "vacation rental management alquiler turistico",
      title: "CEO OR founder OR manager OR director",
      location: "Spain",
    },
  },
  {
    name: "PT - Property managers",
    platform: "linkedin",
    description: "Gestionnaires alojamento local au Portugal",
    params: {
      keywords: "property management short term rental alojamento local",
      title: "CEO OR founder OR gestor",
      location: "Portugal",
    },
  },
  {
    name: "IT - Affitti brevi managers",
    platform: "linkedin",
    description: "Gestionnaires locations courte duree en Italie",
    params: {
      keywords: "gestione affitti brevi property management",
      title: "titolare OR fondatore OR CEO OR direttore",
      location: "Italy",
    },
  },
  {
    name: "UK - Holiday let managers",
    platform: "linkedin",
    description: "Gestionnaires holiday lets au Royaume-Uni",
    params: {
      keywords: "holiday let management short term rental",
      title: "CEO OR founder OR managing director",
      location: "United Kingdom",
    },
  },
  {
    name: "CH - Conciergeries Suisse",
    platform: "linkedin",
    description: "Conciergeries en Suisse romande",
    params: {
      keywords: "conciergerie location saisonniere",
      title: "directeur OR gerant OR fondateur",
      location: "Switzerland",
    },
  },

  // ═══════════════════════════════════════════════════════════
  // GOOGLE MAPS - FRANCE
  // ═══════════════════════════════════════════════════════════
  {
    name: "GMaps FR - Conciergeries Airbnb",
    platform: "gmaps",
    description: "Conciergeries Airbnb listees sur Google Maps France",
    params: {
      query: "conciergerie airbnb",
      location: "France",
    },
  },
  {
    name: "GMaps FR - Gestion locative saisonniere",
    platform: "gmaps",
    description: "Services de gestion locative saisonniere",
    params: {
      query: "gestion locative saisonniere",
      location: "France",
    },
  },
  {
    name: "GMaps FR - Conciergeries par ville",
    platform: "gmaps",
    description: "Conciergeries dans les villes touristiques cles",
    params: {
      query: "conciergerie location vacances",
      location: "Nice, Marseille, Bordeaux, Lyon, Paris",
    },
  },

  // ═══════════════════════════════════════════════════════════
  // GOOGLE MAPS - INTERNATIONAL
  // ═══════════════════════════════════════════════════════════
  {
    name: "GMaps ES - Barcelona vacation rental",
    platform: "gmaps",
    description: "Vacation rental management a Barcelone",
    params: {
      query: "vacation rental management gestion alquiler turistico",
      location: "Barcelona",
    },
  },
  {
    name: "GMaps ES - Madrid & Malaga",
    platform: "gmaps",
    description: "Gestion locations touristiques Madrid & Malaga",
    params: {
      query: "alquiler turistico gestion",
      location: "Madrid, Malaga",
    },
  },
  {
    name: "GMaps PT - Lisbonne & Algarve",
    platform: "gmaps",
    description: "Gestao alojamento local au Portugal",
    params: {
      query: "gestao alojamento local property management",
      location: "Lisboa, Algarve",
    },
  },
  {
    name: "GMaps IT - Rome & Milan",
    platform: "gmaps",
    description: "Gestione affitti brevi en Italie",
    params: {
      query: "gestione affitti brevi",
      location: "Roma, Milano",
    },
  },
  {
    name: "GMaps UK - London & Edinburgh",
    platform: "gmaps",
    description: "Short term rental management au UK",
    params: {
      query: "short term rental management holiday let",
      location: "London, Edinburgh",
    },
  },
  {
    name: "GMaps GR - Athenes & Iles",
    platform: "gmaps",
    description: "Vacation rental management en Grece",
    params: {
      query: "vacation rental management property management",
      location: "Athens, Santorini, Mykonos",
    },
  },
  {
    name: "GMaps HR - Croatie cote",
    platform: "gmaps",
    description: "Vacation rental management en Croatie",
    params: {
      query: "vacation rental management",
      location: "Split, Dubrovnik, Zagreb",
    },
  },
];
