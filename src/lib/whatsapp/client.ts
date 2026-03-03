// =============================================================================
// WhatsApp Client - Singleton wrapper autour de whatsapp-web.js
// Meme pattern que src/lib/linkedin/client.ts mais avec Puppeteer + QR code
// =============================================================================

/* eslint-disable @typescript-eslint/no-require-imports */

import {
  WhatsAppError,
  WhatsAppErrorType,
  type WhatsAppClientStatus,
  type WhatsAppClientInfo,
} from './types';

// whatsapp-web.js est un module CommonJS
const { Client: WAClient, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const SESSION_PATH =
  process.env.WHATSAPP_SESSION_PATH ||
  `${process.cwd()}/.whatsapp_auth`;

// Singleton Map : userId → WhatsAppClientWrapper
const clientInstances = new Map<string, WhatsAppClientWrapper>();

// -----------------------------------------------------------------------------
// Wrapper autour du client whatsapp-web.js
// -----------------------------------------------------------------------------

class WhatsAppClientWrapper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private _status: WhatsAppClientStatus = 'disconnected';
  private _qrCode: string | null = null;
  private _qrDataUrl: string | null = null;
  private _phoneNumber: string | null = null;
  private _lastError: string | null = null;
  private _userId: string;
  private _initializing = false;

  constructor(userId: string) {
    this._userId = userId;
  }

  /**
   * Demarre le client (lance Chromium en arriere-plan)
   */
  async initialize(): Promise<void> {
    if (this._initializing) return;
    if (this._status === 'ready') return;

    this._initializing = true;
    this._status = 'initializing';
    this._lastError = null;

    try {
      // Trouver le chemin vers Chromium
      const chromiumPath = await findChromiumPath();

      this.client = new WAClient({
        authStrategy: new LocalAuth({
          clientId: this._userId,
          dataPath: SESSION_PATH,
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
          ],
          ...(chromiumPath ? { executablePath: chromiumPath } : {}),
        },
      });

      this.setupEventHandlers();
      await this.client.initialize();
    } catch (err) {
      this._status = 'error';
      this._lastError = err instanceof Error ? err.message : 'Erreur inconnue';
      this._initializing = false;
      throw new WhatsAppError(
        `Impossible de demarrer WhatsApp: ${this._lastError}`,
        500,
        WhatsAppErrorType.NETWORK_ERROR
      );
    }
  }

  private setupEventHandlers(): void {
    this.client.on('qr', async (qr: string) => {
      this._status = 'qr_pending';
      this._qrCode = qr;
      try {
        this._qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
      } catch {
        this._qrDataUrl = null;
      }
      console.log(`[WhatsApp ${this._userId}] QR code genere - en attente du scan`);
    });

    this.client.on('authenticated', () => {
      this._status = 'authenticating';
      this._qrCode = null;
      this._qrDataUrl = null;
      console.log(`[WhatsApp ${this._userId}] Authentifie`);
    });

    this.client.on('ready', () => {
      this._status = 'ready';
      this._qrCode = null;
      this._qrDataUrl = null;
      this._initializing = false;
      try {
        const info = this.client.info;
        this._phoneNumber = info?.wid?.user || null;
      } catch {
        // Pas critique
      }
      console.log(`[WhatsApp ${this._userId}] Pret - numero: ${this._phoneNumber}`);
    });

    this.client.on('auth_failure', (msg: string) => {
      this._status = 'error';
      this._lastError = `Echec authentification: ${msg}`;
      this._initializing = false;
      console.error(`[WhatsApp ${this._userId}] Auth failure:`, msg);
    });

    this.client.on('disconnected', (reason: string) => {
      this._status = 'disconnected';
      this._lastError = reason;
      this._initializing = false;
      console.warn(`[WhatsApp ${this._userId}] Deconnecte:`, reason);
    });
  }

  /**
   * Retourne les infos actuelles du client
   */
  getInfo(): WhatsAppClientInfo {
    return {
      status: this._status,
      phoneNumber: this._phoneNumber || undefined,
      qrCode: this._qrDataUrl || undefined,
      lastError: this._lastError || undefined,
    };
  }

  /**
   * Envoie un message WhatsApp
   */
  async sendMessage(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (this._status !== 'ready') {
      throw new WhatsAppError(
        'Le client WhatsApp n\'est pas connecte. Scannez le QR code dans les parametres.',
        503,
        WhatsAppErrorType.NOT_READY
      );
    }

    const chatId = formatPhoneNumber(phoneNumber);

    // Verifier si le numero est sur WhatsApp
    const isRegistered = await this.client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new WhatsAppError(
        `Le numero ${phoneNumber} n'est pas enregistre sur WhatsApp`,
        400,
        WhatsAppErrorType.INVALID_NUMBER
      );
    }

    try {
      const sent = await this.client.sendMessage(chatId, message);
      return {
        success: true,
        messageId: sent?.id?.id || undefined,
      };
    } catch (err) {
      throw new WhatsAppError(
        `Echec envoi du message: ${err instanceof Error ? err.message : 'Erreur inconnue'}`,
        500,
        WhatsAppErrorType.MESSAGE_FAILED
      );
    }
  }

  /**
   * Verifie si un numero est enregistre sur WhatsApp
   */
  async checkNumberRegistered(phoneNumber: string): Promise<boolean> {
    if (this._status !== 'ready') {
      throw new WhatsAppError(
        'Le client WhatsApp n\'est pas connecte',
        503,
        WhatsAppErrorType.NOT_READY
      );
    }

    const chatId = formatPhoneNumber(phoneNumber);
    return this.client.isRegisteredUser(chatId);
  }

  /**
   * Deconnecte et detruit le client
   */
  async destroy(): Promise<void> {
    try {
      if (this.client) {
        await this.client.destroy();
      }
    } catch {
      // Pas critique
    }
    this._status = 'disconnected';
    this._qrCode = null;
    this._qrDataUrl = null;
    this._phoneNumber = null;
    this._initializing = false;
  }
}

// -----------------------------------------------------------------------------
// Formatage des numeros de telephone
// -----------------------------------------------------------------------------

/**
 * Convertit un numero de telephone au format WhatsApp (33612345678@c.us)
 */
export function formatPhoneNumber(phone: string): string {
  // Nettoyer : enlever espaces, tirets, parentheses, points
  let cleaned = phone.replace(/[\s\-\(\)\.\+]/g, '');

  // Numeros francais commencant par 0 → prefixe 33
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '33' + cleaned.substring(1);
  }

  // Numeros francais avec 33 mais sans + (deja nettoye)
  // Rien a faire, c'est deja bon

  // Ajouter @c.us si absent
  if (!cleaned.endsWith('@c.us')) {
    cleaned += '@c.us';
  }

  return cleaned;
}

// -----------------------------------------------------------------------------
// Fonctions factory (point d'entree public)
// -----------------------------------------------------------------------------

/**
 * Obtient le statut WhatsApp pour un utilisateur
 * Ne l'initialise PAS automatiquement - utilisez initializeWhatsAppClient()
 */
export function getWhatsAppClientStatus(userId: string): WhatsAppClientInfo {
  const existing = clientInstances.get(userId);
  if (!existing) {
    return { status: 'disconnected' };
  }
  return existing.getInfo();
}

/**
 * Initialise le client WhatsApp pour un utilisateur (lance Chromium + genere QR)
 */
export async function initializeWhatsAppClient(userId: string): Promise<WhatsAppClientInfo> {
  let wrapper = clientInstances.get(userId);

  if (wrapper) {
    const info = wrapper.getInfo();
    if (info.status === 'ready' || info.status === 'qr_pending' || info.status === 'authenticating') {
      return info;
    }
    // Si erreur ou deconnecte, on detruit et on recommence
    await wrapper.destroy();
  }

  wrapper = new WhatsAppClientWrapper(userId);
  clientInstances.set(userId, wrapper);

  // Lancer l'initialisation en arriere-plan (ne pas await)
  // Le QR code sera disponible via getWhatsAppClientStatus()
  wrapper.initialize().catch((err) => {
    console.error(`[WhatsApp] Erreur init user ${userId}:`, err);
  });

  // Attendre un peu que le QR soit genere
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return wrapper.getInfo();
}

/**
 * Obtient le client WhatsApp pret pour envoyer des messages
 */
export async function getWhatsAppClient(userId: string): Promise<WhatsAppClientWrapper> {
  const wrapper = clientInstances.get(userId);

  if (!wrapper) {
    throw new WhatsAppError(
      'WhatsApp n\'est pas configure. Allez dans Parametres > WhatsApp pour scanner le QR code.',
      503,
      WhatsAppErrorType.NOT_READY
    );
  }

  const info = wrapper.getInfo();
  if (info.status !== 'ready') {
    throw new WhatsAppError(
      `WhatsApp n'est pas pret (statut: ${info.status}). Verifiez les parametres.`,
      503,
      WhatsAppErrorType.NOT_READY
    );
  }

  return wrapper;
}

/**
 * Deconnecte le client WhatsApp d'un utilisateur
 */
export async function disconnectWhatsAppClient(userId: string): Promise<void> {
  const wrapper = clientInstances.get(userId);
  if (wrapper) {
    await wrapper.destroy();
    clientInstances.delete(userId);
  }
}

// -----------------------------------------------------------------------------
// Utilitaires
// -----------------------------------------------------------------------------

async function findChromiumPath(): Promise<string | undefined> {
  // 1. Variable d'environnement
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }

  // 2. Chemins communs sur Linux
  const fs = await import('fs');
  const commonPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];

  for (const p of commonPaths) {
    try {
      await fs.promises.access(p);
      return p;
    } catch {
      // Pas a ce chemin
    }
  }

  // 3. Laisser Puppeteer trouver tout seul (utilisera le bundled chromium si present)
  return undefined;
}
