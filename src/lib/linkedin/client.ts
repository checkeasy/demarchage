// =============================================================================
// LinkedIn API Client
// Interagit avec l'API Voyager de LinkedIn via les cookies de session
// =============================================================================

import {
  type LinkedInAccountConfig,
  type LinkedInProfile,
  type LinkedInSearchParams,
  type LinkedInSearchResponse,
  type LinkedInSearchResult,
  type LinkedInCompany,
  type LinkedInConnectionInfo,
  type LinkedInConversation,
  LinkedInError,
  LinkedInErrorType,
} from './types';
import { sleep } from './rate-limiter';
import { HttpsProxyAgent } from 'https-proxy-agent';

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

const LINKEDIN_BASE_URL = 'https://www.linkedin.com';
const VOYAGER_API = `${LINKEDIN_BASE_URL}/voyager/api`;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_S = 4;

// -----------------------------------------------------------------------------
// Mapping des localisations françaises vers geoUrn IDs LinkedIn
// -----------------------------------------------------------------------------

const GEO_URN_MAP: Record<string, string> = {
  // Pays
  'france': '105015875',
  'belgique': '100565514',
  'suisse': '106693272',
  'luxembourg': '104042105',
  'canada': '101174742',
  'monaco': '100459367',

  // Grandes villes
  'paris': '105554916',
  'marseille': '102905578',
  'lyon': '105694682',
  'toulouse': '101989498',
  'bordeaux': '104048561',
  'nantes': '102378674',
  'lille': '105090995',
  'nice': '103174524',
  'strasbourg': '102424997',
  'montpellier': '100570996',
  'rennes': '102840116',
  'grenoble': '102217331',
  'rouen': '100576929',
  'toulon': '103016652',
  'dijon': '101829718',
  'angers': '104901489',
  'saint-etienne': '101068756',
  'le havre': '104032813',
  'reims': '100538308',
  'clermont-ferrand': '101688089',
  'tours': '104421854',
  'amiens': '101597547',
  'limoges': '103684973',
  'metz': '100541145',
  'besancon': '103093287',
  'orleans': '103267992',
  'caen': '101823202',
  'mulhouse': '104267567',
  'perpignan': '106236025',
  'brest': '101700700',
  'nancy': '101308403',
  'avignon': '107103765',
  'cannes': '101679037',
  'aix-en-provence': '106421372',
  'la rochelle': '104429779',
  'pau': '103453836',
  'bayonne': '100665652',
  'valence': '102652488',
  'chambery': '103284478',
  'ajaccio': '104247428',
  'poitiers': '102891685',

  // Régions
  'ile-de-france': '104246759',
  'ile de france': '104246759',
  'idf': '104246759',
  'region parisienne': '104246759',
  'provence-alpes-cote d\'azur': '100757685',
  'provence alpes cote d azur': '100757685',
  'paca': '100757685',
  'auvergne-rhone-alpes': '102781839',
  'auvergne rhone alpes': '102781839',
  'ara': '102781839',
  'occitanie': '106329080',
  'nouvelle-aquitaine': '106478979',
  'nouvelle aquitaine': '106478979',
  'hauts-de-france': '100731614',
  'hauts de france': '100731614',
  'grand est': '101327750',
  'pays de la loire': '104257579',
  'bretagne': '104143521',
  'normandie': '104891397',
  'bourgogne-franche-comte': '103958508',
  'bourgogne franche comte': '103958508',
  'centre-val de loire': '103592065',
  'centre val de loire': '103592065',
  'corse': '101761799',

  // Départements populaires
  'nord': '104455744',
  'rhone': '101861301',
  'bouches-du-rhone': '103474645',
  'bouches du rhone': '103474645',
  'gironde': '103693291',
  'haute-garonne': '103925131',
  'haute garonne': '103925131',
  'seine-saint-denis': '101824925',
  'hauts-de-seine': '101832647',
  'val-de-marne': '103168766',
  'yvelines': '103558494',
  'essonne': '106167889',
  'seine-et-marne': '101803893',
  'val-d\'oise': '101917177',
  'alpes-maritimes': '103560740',
  'loire-atlantique': '100893744',
  'bas-rhin': '100997768',
  'haut-rhin': '102429064',
  'herault': '104029505',
  'var': '102953020',
  'isere': '104703290',
};

/**
 * Résout un texte de localisation en geoUrn LinkedIn.
 * Normalise le texte (minuscules, suppression accents) et cherche dans le mapping.
 */
function resolveGeoUrn(locationText: string): string | null {
  if (!locationText) return null;

  // Normalise : minuscules, suppression accents, trim
  const normalized = locationText
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ');

  // Essai direct
  if (GEO_URN_MAP[normalized]) {
    return GEO_URN_MAP[normalized];
  }

  // Essai sans "region " prefix
  const withoutRegion = normalized.replace(/^region\s+/, '');
  if (GEO_URN_MAP[withoutRegion]) {
    return GEO_URN_MAP[withoutRegion];
  }

  // Essai en enlevant ", france" à la fin
  const withoutCountry = normalized.replace(/,?\s*(france|fr)$/i, '').trim();
  if (GEO_URN_MAP[withoutCountry]) {
    return GEO_URN_MAP[withoutCountry];
  }

  // Recherche partielle (si le texte contient une ville connue)
  for (const [key, urn] of Object.entries(GEO_URN_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return urn;
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Client LinkedIn
// -----------------------------------------------------------------------------

export class LinkedInClient {
  private liAt: string;
  private jsessionId: string;
  private proxyUrl?: string;

  constructor(config?: LinkedInAccountConfig) {
    this.liAt = config?.liAt ?? process.env.LINKEDIN_SESSION_COOKIE ?? '';
    this.jsessionId = config?.jsessionId ?? process.env.LINKEDIN_JSESSIONID ?? '';
    this.proxyUrl = config?.proxyUrl ?? process.env.LINKEDIN_PROXY_URL;

    if (!this.liAt || !this.jsessionId) {
      throw new LinkedInError(
        'Cookies LinkedIn manquants (li_at et JSESSIONID requis)',
        401,
        LinkedInErrorType.SESSION_EXPIRED
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Headers standard
  // ---------------------------------------------------------------------------

  private getHeaders(): Record<string, string> {
    // Nettoyer le JSESSIONID (retirer guillemets s'il y en a)
    const cleanJsessionId = this.jsessionId.replace(/"/g, '');

    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/vnd.linkedin.normalized+json+2.1',
      'csrf-token': cleanJsessionId,
      Cookie: `li_at=${this.liAt}; JSESSIONID="${cleanJsessionId}"`,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'fr_FR',
      'x-li-track':
        '{"clientVersion":"1.13.8","mpVersion":"1.13.8","osName":"web","timezoneOffset":1}',
      'x-li-page-instance':
        'urn:li:page:d_flagship3_search_srp_people;0',
    };
  }

  // ---------------------------------------------------------------------------
  // Requête HTTP avec retry + rate limiting
  // ---------------------------------------------------------------------------

  private async request<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // Délai aléatoire avant chaque requête (comportement humain)
    if (retryCount === 0) {
      await sleep(2, 8);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchOptions: Record<string, any> = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers as Record<string, string> || {}),
      },
    };

    // Route through proxy if configured
    if (this.proxyUrl) {
      const agent = new HttpsProxyAgent(this.proxyUrl);
      // Node.js fetch supports the dispatcher option via undici,
      // but for compatibility we use the agent pattern
      (fetchOptions as Record<string, unknown>).agent = agent;
    }

    try {
      const response = await fetch(url, fetchOptions);

      // Gestion des erreurs HTTP
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const error = this.mapHttpError(response.status, errorBody);

        // Retry pour les erreurs rate-limit ou réseau
        if (
          retryCount < MAX_RETRIES &&
          (error.errorType === LinkedInErrorType.RATE_LIMITED ||
            error.errorType === LinkedInErrorType.NETWORK_ERROR)
        ) {
          const delay = INITIAL_RETRY_DELAY_S * Math.pow(2, retryCount);
          console.warn(
            `[LinkedIn] Retry ${retryCount + 1}/${MAX_RETRIES} après ${delay}s - ${error.message}`
          );
          await sleep(delay, delay * 1.5);
          return this.request<T>(url, options, retryCount + 1);
        }

        throw error;
      }

      const data = await response.json();
      return data as T;
    } catch (err) {
      if (err instanceof LinkedInError) {
        throw err;
      }

      // Erreur réseau
      if (retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_S * Math.pow(2, retryCount);
        console.warn(
          `[LinkedIn] Retry réseau ${retryCount + 1}/${MAX_RETRIES} après ${delay}s`
        );
        await sleep(delay, delay * 1.5);
        return this.request<T>(url, options, retryCount + 1);
      }

      throw new LinkedInError(
        `Erreur réseau LinkedIn: ${(err as Error).message}`,
        0,
        LinkedInErrorType.NETWORK_ERROR
      );
    }
  }

  private mapHttpError(status: number, body: string): LinkedInError {
    switch (status) {
      case 401:
      case 403:
        if (body.includes('CSRF') || body.includes('session')) {
          return new LinkedInError(
            'Session LinkedIn expirée. Veuillez mettre à jour vos cookies.',
            status,
            LinkedInErrorType.SESSION_EXPIRED
          );
        }
        return new LinkedInError(
          'Accès interdit par LinkedIn',
          status,
          LinkedInErrorType.FORBIDDEN
        );
      case 404:
        return new LinkedInError(
          'Ressource non trouvée sur LinkedIn',
          status,
          LinkedInErrorType.NOT_FOUND
        );
      case 429:
        return new LinkedInError(
          'Limite de requêtes LinkedIn atteinte. Réessayez plus tard.',
          status,
          LinkedInErrorType.RATE_LIMITED
        );
      default:
        if (status >= 500) {
          return new LinkedInError(
            `Erreur serveur LinkedIn (${status})`,
            status,
            LinkedInErrorType.NETWORK_ERROR
          );
        }
        return new LinkedInError(
          `Erreur LinkedIn (${status}): ${body.slice(0, 200)}`,
          status,
          LinkedInErrorType.UNKNOWN
        );
    }
  }

  // ---------------------------------------------------------------------------
  // RECHERCHE DE PROFILS
  // ---------------------------------------------------------------------------

  async searchPeople(params: LinkedInSearchParams): Promise<LinkedInSearchResponse> {
    const start = params.start ?? 0;
    const count = Math.min(params.count ?? 25, 49);

    // Construire le paramètre query() au format LinkedIn Voyager
    const queryParts: string[] = [];
    const queryParams: string[] = ['resultType:List(PEOPLE)'];

    // Injecter la localisation dans les keywords (le filtre geoUrn ne fonctionne pas via Voyager)
    let keywords = params.keywords || '';
    if (params.location) {
      keywords = keywords ? `${keywords} ${params.location}` : params.location;
    }

    if (keywords) {
      queryParts.push(`keywords:${encodeURIComponent(keywords)}`);
    }

    queryParts.push('flagshipSearchIntent:SEARCH_SRP');

    if (params.network && params.network.length > 0) {
      queryParams.push(`network:List(${params.network.join(',')})`);
    }

    if (params.title) {
      queryParams.push(`title:List(${encodeURIComponent(params.title)})`);
    }

    if (params.industry) {
      queryParams.push(`industry:List(${encodeURIComponent(params.industry)})`);
    }

    if (params.company) {
      queryParams.push(`currentCompany:List(${encodeURIComponent(params.company)})`);
    }

    if (params.companySize && params.companySize.length > 0) {
      queryParams.push(`companySize:List(${params.companySize.join(',')})`);
    }

    if (params.school) {
      queryParams.push(`school:List(${encodeURIComponent(params.school)})`);
    }

    if (params.connectionOf) {
      queryParams.push(`connectionOf:List(${encodeURIComponent(params.connectionOf)})`);
    }

    queryParts.push(`queryParameters:(${queryParams.join(',')})`);

    const queryString = `(${queryParts.join(',')})`;

    const url = `${VOYAGER_API}/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-186&origin=SWITCH_SEARCH_VERTICAL&q=all&query=${queryString}&start=${start}&count=${count}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(url);

    // Parser les résultats de recherche
    const results: LinkedInSearchResult[] = [];
    let total = 0;

    try {
      // Les résultats sont dans data.included (entités normalisées) et data.data
      const included = data.included || [];
      const paging = data.data?.paging || data.paging;

      if (paging) {
        total = paging.total || 0;
      }

      // Extraire les profils des entités incluses
      for (const entity of included) {
        // Les profils sont des entités de type com.linkedin.voyager.dash.search.EntityResultViewModel
        if (
          entity.$type === 'com.linkedin.voyager.dash.search.EntityResultViewModel' ||
          entity.template === 'UNIVERSAL'
        ) {
          const profile = this.parseSearchEntity(entity, included);
          if (profile) {
            results.push(profile);
          }
        }
      }

      // Fallback: chercher dans les éléments directement
      if (results.length === 0 && included.length > 0) {
        for (const entity of included) {
          if (entity.publicIdentifier || entity.entityUrn?.includes('miniProfile')) {
            const profile = this.parseMiniProfile(entity);
            if (profile) {
              results.push(profile);
            }
          }
        }
      }
    } catch (err) {
      console.error('[LinkedIn] Erreur parsing résultats de recherche:', err);
      throw new LinkedInError(
        'Erreur lors du parsing des résultats de recherche',
        0,
        LinkedInErrorType.PARSE_ERROR
      );
    }

    return {
      results,
      total,
      start,
      count: results.length,
      hasMore: start + results.length < total,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseSearchEntity(entity: any, included: any[]): LinkedInSearchResult | null {
    try {
      // L'entité contient une référence vers le miniProfile
      const title = entity.title?.text || '';
      const primarySubtitle = entity.primarySubtitle?.text || null;
      const secondarySubtitle = entity.secondarySubtitle?.text || null;

      // Extraire le publicIdentifier de navigationUrl ou de l'entityUrn
      let publicIdentifier = '';
      const navUrl = entity.navigationUrl || '';
      const match = navUrl.match(/\/in\/([^/?]+)/);
      if (match) {
        publicIdentifier = match[1];
      }

      if (!publicIdentifier) {
        // Chercher le miniProfile lié dans included
        const entityUrn = entity.entityUrn || entity.trackingUrn || '';
        const miniProfileUrn = entityUrn.replace(
          'urn:li:fsd_entityResultViewModel:',
          ''
        );

        // Chercher le miniProfile correspondant
        const miniProfile = included.find(
          (e: { entityUrn?: string; publicIdentifier?: string }) =>
            e.entityUrn?.includes(miniProfileUrn) && e.publicIdentifier
        );
        if (miniProfile) {
          publicIdentifier = miniProfile.publicIdentifier;
        }
      }

      if (!publicIdentifier) return null;

      // Séparer le nom complet
      const nameParts = title.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Extraire l'image de profil
      let profilePictureUrl: string | null = null;
      const image = entity.image?.attributes?.[0]?.detailData?.nonEntityProfilePicture?.vectorImage;
      if (image?.rootUrl && image?.artifacts?.[0]?.fileIdentifyingUrlPathSegment) {
        profilePictureUrl =
          image.rootUrl + image.artifacts[image.artifacts.length - 1].fileIdentifyingUrlPathSegment;
      }

      // Extraire l'entreprise du headline (patterns courants)
      let currentCompany: string | null = null;
      let currentTitle: string | null = primarySubtitle;

      if (primarySubtitle) {
        // Pattern 1: "Title at/chez/@ Company"
        let companyMatch = primarySubtitle.match(
          /^(.+?)\s+(?:at|chez|@)\s+(.+)$/i
        );
        if (companyMatch) {
          currentTitle = companyMatch[1].trim();
          currentCompany = companyMatch[2].trim();
        }

        // Pattern 2: "Title | Company" or "Title - Company" or "Title – Company"
        if (!currentCompany) {
          companyMatch = primarySubtitle.match(
            /^(.+?)\s+[-|–—]\s+(.+)$/
          );
          if (companyMatch) {
            currentTitle = companyMatch[1].trim();
            currentCompany = companyMatch[2].trim();
          }
        }

        // Pattern 3: "Title, Company" (uniquement si la virgule sépare 2 parties claires)
        if (!currentCompany) {
          const parts = primarySubtitle.split(/\s*,\s*/);
          if (parts.length === 2 && parts[1].length > 2) {
            currentTitle = parts[0].trim();
            currentCompany = parts[1].trim();
          }
        }
      }

      // Extraire le degré de connexion du badge
      const badgeText = entity.badgeText?.text || '';
      let connectionDegree: string | null = null;
      if (badgeText.includes('1st') || badgeText.includes('1er')) connectionDegree = '1er';
      else if (badgeText.includes('2nd') || badgeText.includes('2e')) connectionDegree = '2e';
      else if (badgeText.includes('3rd') || badgeText.includes('3e')) connectionDegree = '3e+';

      // Ou depuis entityCustomTrackingInfo
      if (!connectionDegree) {
        const distance = entity.entityCustomTrackingInfo?.memberDistance;
        if (distance === 'DISTANCE_1') connectionDegree = '1er';
        else if (distance === 'DISTANCE_2') connectionDegree = '2e';
        else if (distance === 'DISTANCE_3') connectionDegree = '3e+';
      }

      return {
        profileId: entity.entityUrn || entity.trackingUrn || publicIdentifier,
        publicIdentifier,
        firstName,
        lastName,
        headline: primarySubtitle,
        location: secondarySubtitle,
        profileUrl: `${LINKEDIN_BASE_URL}/in/${publicIdentifier}`,
        profilePictureUrl,
        connectionDegree,
        currentCompany,
        currentTitle,
      };
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseMiniProfile(entity: any): LinkedInSearchResult | null {
    try {
      if (!entity.publicIdentifier) return null;

      let profilePictureUrl: string | null = null;
      const picture = entity.picture || entity.profilePicture;
      if (picture?.displayImageReference?.vectorImage) {
        const vi = picture.displayImageReference.vectorImage;
        if (vi.rootUrl && vi.artifacts?.length > 0) {
          profilePictureUrl =
            vi.rootUrl + vi.artifacts[vi.artifacts.length - 1].fileIdentifyingUrlPathSegment;
        }
      }

      return {
        profileId: entity.entityUrn || entity.objectUrn || entity.publicIdentifier,
        publicIdentifier: entity.publicIdentifier,
        firstName: entity.firstName || '',
        lastName: entity.lastName || '',
        headline: entity.occupation || entity.headline || null,
        location: entity.locationName || null,
        profileUrl: `${LINKEDIN_BASE_URL}/in/${entity.publicIdentifier}`,
        profilePictureUrl,
        connectionDegree: null,
        currentCompany: null,
        currentTitle: entity.occupation || null,
      };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // PROFIL COMPLET
  // ---------------------------------------------------------------------------

  async getProfile(publicIdentifier: string): Promise<LinkedInProfile> {
    const url = `${VOYAGER_API}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicIdentifier)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(url);

    return this.parseFullProfile(data, publicIdentifier);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseFullProfile(data: any, publicIdentifier: string): LinkedInProfile {
    const included = data.included || [];

    // Trouver le profil principal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileEntity = included.find(
      (e: { $type?: string; publicIdentifier?: string }) =>
        (e.$type === 'com.linkedin.voyager.dash.identity.profile.Profile' ||
          e.$type === 'com.linkedin.voyager.identity.shared.MiniProfile') &&
        e.publicIdentifier === publicIdentifier
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) || included.find((e: any) => e.publicIdentifier === publicIdentifier) || {};

    // Extraire les expériences
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const experiences = included
      .filter(
        (e: { $type?: string }) =>
          e.$type === 'com.linkedin.voyager.dash.identity.profile.Position' ||
          e.$type === 'com.linkedin.voyager.identity.shared.Position'
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((exp: any) => ({
        title: exp.title || '',
        companyName: exp.companyName || exp.company?.name || '',
        companyId: exp.companyUrn?.split(':').pop() || null,
        location: exp.locationName || null,
        startDate: exp.timePeriod?.startDate
          ? `${exp.timePeriod.startDate.year}-${String(exp.timePeriod.startDate.month || 1).padStart(2, '0')}`
          : null,
        endDate: exp.timePeriod?.endDate
          ? `${exp.timePeriod.endDate.year}-${String(exp.timePeriod.endDate.month || 1).padStart(2, '0')}`
          : null,
        description: exp.description || null,
        isCurrent: !exp.timePeriod?.endDate,
      }));

    // Extraire les formations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const education = included
      .filter(
        (e: { $type?: string }) =>
          e.$type === 'com.linkedin.voyager.dash.identity.profile.Education' ||
          e.$type === 'com.linkedin.voyager.identity.shared.Education'
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((edu: any) => ({
        schoolName: edu.schoolName || edu.school?.name || '',
        degreeName: edu.degreeName || null,
        fieldOfStudy: edu.fieldOfStudy || null,
        startDate: edu.timePeriod?.startDate
          ? `${edu.timePeriod.startDate.year}`
          : null,
        endDate: edu.timePeriod?.endDate
          ? `${edu.timePeriod.endDate.year}`
          : null,
      }));

    // Extraire les compétences
    const skills = included
      .filter(
        (e: { $type?: string }) =>
          e.$type === 'com.linkedin.voyager.dash.identity.profile.Skill' ||
          e.$type === 'com.linkedin.voyager.identity.shared.Skill'
      )
      .map((s: { name?: string }) => s.name || '')
      .filter(Boolean);

    // Photo de profil
    let profilePictureUrl: string | null = null;
    const picture =
      profileEntity.profilePicture ||
      profileEntity.picture;
    if (picture?.displayImageReference?.vectorImage) {
      const vi = picture.displayImageReference.vectorImage;
      if (vi.rootUrl && vi.artifacts?.length > 0) {
        profilePictureUrl =
          vi.rootUrl + vi.artifacts[vi.artifacts.length - 1].fileIdentifyingUrlPathSegment;
      }
    }

    // Poste et entreprise actuels
    const currentExperience = experiences.find(
      (e: { isCurrent: boolean }) => e.isCurrent
    );

    return {
      profileId: profileEntity.entityUrn || profileEntity.objectUrn || publicIdentifier,
      publicIdentifier,
      firstName: profileEntity.firstName || '',
      lastName: profileEntity.lastName || '',
      headline: profileEntity.headline || profileEntity.occupation || null,
      summary: profileEntity.summary || null,
      location: profileEntity.locationName || profileEntity.geoLocationName || null,
      industryName: profileEntity.industryName || profileEntity.industry || null,
      profileUrl: `${LINKEDIN_BASE_URL}/in/${publicIdentifier}`,
      profilePictureUrl,
      connectionDegree: null,
      currentCompany: currentExperience?.companyName || null,
      currentTitle: currentExperience?.title || null,
      experience: experiences,
      education,
      skills,
      emailAddress: profileEntity.emailAddress || null,
    };
  }

  // ---------------------------------------------------------------------------
  // DETAILS ENTREPRISE
  // ---------------------------------------------------------------------------

  async getCompany(companyId: string): Promise<LinkedInCompany> {
    // companyId peut être un universalName ou un ID numérique
    const url = `${VOYAGER_API}/organization/companies?decorationId=com.linkedin.voyager.deco.organization.web.WebFullCompanyMain-35&q=universalName&universalName=${encodeURIComponent(companyId)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(url);

    return this.parseCompany(data, companyId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCompany(data: any, companyId: string): LinkedInCompany {
    const included = data.included || [];

    // Trouver l'entité entreprise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyEntity = included.find(
      (e: { $type?: string }) =>
        e.$type === 'com.linkedin.voyager.organization.Company' ||
        e.$type === 'com.linkedin.voyager.dash.organization.Company'
    ) || {};

    // Extraire le logo
    let logoUrl: string | null = null;
    const logo = companyEntity.logo?.image?.['com.linkedin.common.VectorImage'];
    if (logo?.rootUrl && logo?.artifacts?.length > 0) {
      logoUrl =
        logo.rootUrl + logo.artifacts[logo.artifacts.length - 1].fileIdentifyingUrlPathSegment;
    }

    // Mapper la taille d'entreprise
    const staffCountRange = companyEntity.staffCountRange || {};
    const companySize = staffCountRange.start && staffCountRange.end
      ? `${staffCountRange.start}-${staffCountRange.end}`
      : staffCountRange.start
        ? `${staffCountRange.start}+`
        : null;

    return {
      companyId: companyEntity.entityUrn?.split(':').pop() || companyId,
      name: companyEntity.name || '',
      universalName: companyEntity.universalName || null,
      description: companyEntity.description || null,
      industry:
        companyEntity.companyIndustries?.[0]?.localizedName ||
        companyEntity.industryName ||
        null,
      companySize,
      employeeCount: companyEntity.staffCount || null,
      website: companyEntity.companyPageUrl || companyEntity.website || null,
      headquartersLocation: companyEntity.headquarter
        ? `${companyEntity.headquarter.city || ''}, ${companyEntity.headquarter.country || ''}`.trim()
        : null,
      logoUrl,
      specialities: companyEntity.specialities || [],
    };
  }

  // ---------------------------------------------------------------------------
  // VUE DE PROFIL (warm-up)
  // ---------------------------------------------------------------------------

  async viewProfile(publicIdentifier: string): Promise<void> {
    // Enregistrer une vue de profil en chargeant le profil
    const url = `${VOYAGER_API}/identity/profiles/${encodeURIComponent(publicIdentifier)}/profileView`;

    await this.request<unknown>(url, { method: 'GET' });
  }

  // ---------------------------------------------------------------------------
  // DEMANDE DE CONNEXION
  // ---------------------------------------------------------------------------

  async sendConnectionRequest(
    profileId: string,
    message?: string
  ): Promise<{ success: boolean; invitationId?: string }> {
    // Le profileId doit être un URN: urn:li:fsd_profile:XXXXXXXXXX
    // ou on peut le construire si c'est juste l'ID
    const profileUrn = profileId.startsWith('urn:li:')
      ? profileId
      : `urn:li:fsd_profile:${profileId}`;

    // Valider la longueur du message (max 300 caractères)
    if (message && message.length > 300) {
      throw new LinkedInError(
        'Le message de connexion ne peut pas dépasser 300 caractères',
        400,
        LinkedInErrorType.UNKNOWN
      );
    }

    const url = `${VOYAGER_API}/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      inviteeProfileUrn: profileUrn,
    };

    if (message) {
      body.customMessage = message;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return {
      success: true,
      invitationId: data?.value?.invitationUrn?.split(':').pop() || undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // ENVOI DE MESSAGE
  // ---------------------------------------------------------------------------

  async sendMessage(profileUrn: string, message: string): Promise<{ success: boolean }> {
    // Le profileUrn doit être un URN complet
    const targetUrn = profileUrn.startsWith('urn:li:')
      ? profileUrn
      : `urn:li:fsd_profile:${profileUrn}`;

    const url = `${VOYAGER_API}/voyagerMessagingDashMessengerMessages?action=createMessage`;

    const body = {
      message: {
        body: {
          text: message,
        },
        renderContentUnions: [],
      },
      mailboxUrn: 'urn:li:fsd_profile:me',
      recipientProfileUrns: [targetUrn],
    };

    await this.request<unknown>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // STATUT DE CONNEXION
  // ---------------------------------------------------------------------------

  async checkConnectionStatus(publicIdentifier: string): Promise<LinkedInConnectionInfo> {
    const url = `${VOYAGER_API}/identity/profiles/${encodeURIComponent(publicIdentifier)}/networkinfo`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any>(url);

      const distance = data?.distance?.value || data?.data?.distance?.value;

      if (distance === 'DISTANCE_1') {
        return { status: 'connected' };
      }

      // Vérifier s'il y a une invitation en attente
      const entityUrn = data?.entityUrn || '';
      if (entityUrn.includes('PENDING')) {
        return {
          status: 'pending_outgoing',
          invitationId: data?.pendingInvitation?.invitationId || undefined,
        };
      }

      if (distance === 'DISTANCE_2') {
        return { status: 'not_connected' };
      }

      if (distance === 'DISTANCE_3' || distance === 'OUT_OF_NETWORK') {
        return { status: 'not_connected' };
      }

      return { status: 'unknown' };
    } catch (err) {
      if (err instanceof LinkedInError && err.errorType === LinkedInErrorType.NOT_FOUND) {
        return { status: 'unknown' };
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // MESSAGES DE CONVERSATION (Reply Detection)
  // ---------------------------------------------------------------------------

  /**
   * Récupère les conversations récentes de la boîte de réception LinkedIn.
   * Utilise l'API Voyager Messaging pour lister les conversations avec messages récents.
   */
  async getInboxConversations(count = 20): Promise<LinkedInConversation[]> {
    const url = `${VOYAGER_API}/messaging/conversations?keyVersion=LEGACY_INBOX&q=syncToken&count=${count}`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any>(url);
      const elements = data?.elements || data?.included || [];

      const conversations: LinkedInConversation[] = [];

      for (const conv of elements) {
        if (!conv.entityUrn && !conv['*participants']) continue;

        const lastMessage = conv.events?.[0] || conv.lastMessage;
        const participantUrns: string[] = [];

        // Extract participant URNs
        const participants = conv['*participants'] || conv.participants || [];
        for (const p of participants) {
          const urn = typeof p === 'string' ? p : p?.['*miniProfile'] || p?.entityUrn;
          if (urn) participantUrns.push(urn);
        }

        conversations.push({
          conversationUrn: conv.entityUrn || '',
          participantUrns,
          lastMessageText: lastMessage?.eventContent?.messageEvent?.body || lastMessage?.body?.text || null,
          lastMessageSenderUrn: lastMessage?.from?.['*miniProfile'] || lastMessage?.from?.entityUrn || null,
          lastMessageAt: lastMessage?.createdAt ? new Date(lastMessage.createdAt).toISOString() : null,
        });
      }

      return conversations;
    } catch (err) {
      console.error('[LinkedIn] Error fetching inbox conversations:', err);
      return [];
    }
  }

  /**
   * Vérifie si un prospect spécifique a répondu en cherchant une conversation avec lui.
   * @param profileUrn - URN du profil du prospect (urn:li:fsd_profile:xxx)
   * @returns L'objet conversation si trouvé avec un message du prospect, null sinon
   */
  async checkForReply(profileUrn: string): Promise<{ replied: boolean; lastMessageText: string | null; lastMessageAt: string | null }> {
    // Normaliser le profileUrn
    const targetUrn = profileUrn.startsWith('urn:li:')
      ? profileUrn
      : `urn:li:fsd_profile:${profileUrn}`;

    try {
      const conversations = await this.getInboxConversations(40);

      for (const conv of conversations) {
        // Check if this conversation involves the target prospect
        const hasTarget = conv.participantUrns.some(
          (urn) => urn.includes(targetUrn) || targetUrn.includes(urn.split(':').pop() || '___')
        );

        if (hasTarget && conv.lastMessageSenderUrn) {
          // Check if the last message was sent BY the prospect (not by us)
          const senderIsTarget = conv.lastMessageSenderUrn.includes(targetUrn) ||
            targetUrn.includes(conv.lastMessageSenderUrn.split(':').pop() || '___');

          if (senderIsTarget) {
            return {
              replied: true,
              lastMessageText: conv.lastMessageText,
              lastMessageAt: conv.lastMessageAt,
            };
          }
        }
      }

      return { replied: false, lastMessageText: null, lastMessageAt: null };
    } catch (err) {
      console.error('[LinkedIn] Error checking for reply:', err);
      // TODO: Voyager messaging API endpoint may differ — adjust URL if needed
      return { replied: false, lastMessageText: null, lastMessageAt: null };
    }
  }

  // ---------------------------------------------------------------------------
  // RETRAIT DE CONNEXION
  // ---------------------------------------------------------------------------

  async withdrawConnection(invitationId: string): Promise<{ success: boolean }> {
    const url = `${VOYAGER_API}/voyagerRelationshipsDashInvitations/${encodeURIComponent(invitationId)}?action=withdraw`;

    await this.request<unknown>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    return { success: true };
  }
}

// -----------------------------------------------------------------------------
// Instance par défaut (utilise les variables d'environnement)
// -----------------------------------------------------------------------------

let defaultClient: LinkedInClient | null = null;

export function getLinkedInClient(): LinkedInClient {
  if (!defaultClient) {
    defaultClient = new LinkedInClient();
  }
  return defaultClient;
}

/**
 * Crée un nouveau client avec des cookies spécifiques
 */
export function createLinkedInClient(config: LinkedInAccountConfig): LinkedInClient {
  return new LinkedInClient(config);
}

/**
 * Crée un client LinkedIn en lisant les cookies de l'utilisateur depuis linkedin_accounts.
 * Fallback sur getLinkedInClientForWorkspace puis les variables d'environnement.
 */
export async function getLinkedInClientForUser(userId: string, workspaceId: string): Promise<LinkedInClient> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    const { data: account } = await supabase
      .from('linkedin_accounts')
      .select('li_at_cookie, jsessionid_cookie, proxy_url')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (account?.li_at_cookie && account?.jsessionid_cookie) {
      return new LinkedInClient({
        liAt: account.li_at_cookie,
        jsessionId: account.jsessionid_cookie,
        proxyUrl: account.proxy_url || undefined,
      });
    }
  } catch {
    // Fallback
  }

  return getLinkedInClientForWorkspace(workspaceId);
}

/**
 * Crée un client LinkedIn en lisant les cookies depuis linkedin_accounts pour le workspace.
 * Fallback sur les variables d'environnement si rien en BDD.
 */
export async function getLinkedInClientForWorkspace(workspaceId: string): Promise<LinkedInClient> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Chercher dans linkedin_accounts d'abord
    const { data: account } = await supabase
      .from('linkedin_accounts')
      .select('li_at_cookie, jsessionid_cookie, proxy_url')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (account?.li_at_cookie && account?.jsessionid_cookie) {
      return new LinkedInClient({
        liAt: account.li_at_cookie,
        jsessionId: account.jsessionid_cookie,
        proxyUrl: account.proxy_url || undefined,
      });
    }

    // Fallback: lire depuis workspaces.settings (legacy)
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    const settings = (workspace?.settings || {}) as Record<string, string>;
    const liAt = settings.linkedin_li_at;
    const jsessionId = settings.linkedin_jsessionid;

    if (liAt && jsessionId) {
      return new LinkedInClient({ liAt, jsessionId });
    }
  } catch {
    // Fallback to env vars
  }

  return getLinkedInClient();
}
