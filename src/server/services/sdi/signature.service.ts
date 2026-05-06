import { logger } from '../../config/logger';
import * as fs from 'fs/promises';
import forge from 'node-forge';
import { Crypto } from '@peculiar/webcrypto';
import * as xadesjs from 'xadesjs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * Signature Service for FatturaPA / SDI
 *
 * Modalita di firma supportate:
 *
 * 1. PROVIDER (default): la firma XAdES e' delegata al provider SDI
 *    (es. Aruba Premium / Aruba Fatturazione). Il provider firma
 *    lato cloud usando un certificato gestito da loro.
 *    NESSUNA configurazione locale richiesta.
 *
 * 2. LOCAL_PKCS12: il sistema firma localmente l'XML usando un
 *    certificato PKCS#12 (.p12/.pfx) caricato dal tenant.
 *    Implementa XAdES-BES enveloped con SHA-256 + RSA, conformemente al
 *    profilo richiesto da SDI per FatturaPA 1.2.2.
 */

export interface SignatureMode {
  mode: 'PROVIDER' | 'LOCAL_PKCS12';
}

export interface LocalSignatureConfig {
  // Path al file PKCS#12 (.p12/.pfx) montato come secret/volume
  pkcs12Path: string;
  // Password del certificato. Stored encrypted in CompanySettings.
  pkcs12Password: string;
  // Subject filter opzionale (se il PKCS12 contiene piu' certificati)
  subjectFilter?: string;
}

export interface SignXmlResult {
  success: boolean;
  signedXml?: string;
  signedFileName?: string;
  error?: string;
  mode: 'PROVIDER' | 'LOCAL_PKCS12';
}

// Configura xadesjs con il polyfill WebCrypto di @peculiar (Node.js
// non ha WebCrypto nativo per RSA/SHA con questo livello di api).
// Eseguito una sola volta a livello modulo.
const cryptoEngine = new Crypto();
xadesjs.Application.setEngine('NodeJS', cryptoEngine);

/**
 * Servizio di firma XML FatturaPA.
 */
class SignatureService {
  /**
   * Determina la modalita di firma in base alle CompanySettings.
   */
  resolveMode(settings: {
    sdiSignatureMode?: 'PROVIDER' | 'LOCAL_PKCS12' | null;
    sdiPkcs12Path?: string | null;
    sdiPkcs12PasswordEnc?: string | null;
  }): 'PROVIDER' | 'LOCAL_PKCS12' {
    if (
      settings.sdiSignatureMode === 'LOCAL_PKCS12' &&
      settings.sdiPkcs12Path &&
      settings.sdiPkcs12PasswordEnc
    ) {
      return 'LOCAL_PKCS12';
    }
    return 'PROVIDER';
  }

  /**
   * Firma XML FatturaPA secondo la modalita configurata.
   */
  async signFatturapaXml(
    xml: string,
    mode: 'PROVIDER' | 'LOCAL_PKCS12',
    config?: LocalSignatureConfig
  ): Promise<SignXmlResult> {
    if (mode === 'PROVIDER') {
      logger.debug('SDI signature: delegated to provider (PROVIDER mode)');
      return {
        success: true,
        signedXml: xml,
        mode: 'PROVIDER',
      };
    }

    if (mode === 'LOCAL_PKCS12') {
      if (!config) {
        return {
          success: false,
          mode: 'LOCAL_PKCS12',
          error: 'Configurazione firma locale mancante (pkcs12Path/password)',
        };
      }
      return this.signLocalPkcs12(xml, config);
    }

    return {
      success: false,
      mode,
      error: `Modalita firma non supportata: ${mode}`,
    };
  }

  /**
   * Firma XAdES-BES locale usando PKCS#12.
   *
   * Step:
   * 1. Carica il PKCS#12 e estrae chiave privata + certificato X.509
   * 2. Importa la chiave privata in WebCrypto come `RSASSA-PKCS1-v1_5` SHA-256
   * 3. Costruisce un `xadesjs.SignedXml` con riferimento enveloped
   * 4. Firma il documento e ritorna l'XML serializzato
   */
  private async signLocalPkcs12(
    xml: string,
    config: LocalSignatureConfig
  ): Promise<SignXmlResult> {
    try {
      // 1. Carica il PKCS12 dal disco
      const p12Buffer = await fs.readFile(config.pkcs12Path);
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, config.pkcs12Password);

      // 2. Estrai chiave privata (PKCS#8 shrouded) e certificato X.509
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

      const keyBagArr = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []) as forge.pkcs12.Bag[];
      const certBagArr = (certBags[forge.pki.oids.certBag] || []) as forge.pkcs12.Bag[];

      if (keyBagArr.length === 0 || keyBagArr[0].key == null) {
        return {
          success: false,
          mode: 'LOCAL_PKCS12',
          error: 'PKCS12: chiave privata non trovata',
        };
      }
      if (certBagArr.length === 0 || certBagArr[0].cert == null) {
        return {
          success: false,
          mode: 'LOCAL_PKCS12',
          error: 'PKCS12: certificato non trovato',
        };
      }

      // Filtra cert per subject se richiesto
      let certBag = certBagArr[0];
      if (config.subjectFilter) {
        const found = certBagArr.find((b) => {
          const subj = b.cert?.subject?.attributes
            .map((a) => `${a.shortName}=${a.value}`)
            .join(',');
          return subj && subj.includes(config.subjectFilter!);
        });
        if (found) certBag = found;
      }

      const privateKeyForge = keyBagArr[0].key as forge.pki.rsa.PrivateKey;
      const certForge = certBag.cert as forge.pki.Certificate;

      // 3. Converti chiave privata in PKCS#8 DER e importa in WebCrypto
      const privateKeyPem = forge.pki.privateKeyToPem(privateKeyForge);
      const privateKeyDer = forge.asn1
        .toDer(forge.pki.privateKeyToAsn1(privateKeyForge))
        .getBytes();
      const privateKeyPkcs8Der = forge.asn1
        .toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKeyForge)))
        .getBytes();
      void privateKeyPem;
      void privateKeyDer;

      const privateKeyArrayBuffer = this.binaryStringToArrayBuffer(privateKeyPkcs8Der);
      const privateKey = await cryptoEngine.subtle.importKey(
        'pkcs8',
        privateKeyArrayBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // 4. Estrai certificato in formato DER per X509Data nella signature
      const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certForge)).getBytes();
      const certBase64 = forge.util.encode64(certDer);

      // 5. Parse XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');

      // 6. Crea SignedXml con XAdES-BES enveloped + SHA-256
      const signedXml = new xadesjs.SignedXml();

      await signedXml.Sign(
        { name: 'RSASSA-PKCS1-v1_5' },
        privateKey,
        doc as unknown as Document,
        {
          references: [
            {
              hash: 'SHA-256',
              transforms: ['enveloped', 'c14n'],
            },
          ],
          signingCertificate: certBase64,
          signerRole: { claimed: ['ITALIAN_SDI_FATTURAPA'] },
          policy: {
            // Identifier policy SDI (puoi sovrascrivere con il tuo OID)
            identifier: {
              value: 'http://www.agenziaentrate.gov.it/sdi/fatturapa',
            },
            hash: 'SHA-256',
          },
        }
      );

      // 7. Serializza il documento firmato
      const serializer = new XMLSerializer();
      // Append signature al root document e serializza
      const signatureNode = signedXml.GetXml();
      if (signatureNode && doc.documentElement) {
        doc.documentElement.appendChild(signatureNode);
      }
      const signedXmlString = serializer.serializeToString(doc as unknown as Node);

      return {
        success: true,
        signedXml: signedXmlString,
        mode: 'LOCAL_PKCS12',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('SDI signature LOCAL_PKCS12 error: ' + message);
      return {
        success: false,
        mode: 'LOCAL_PKCS12',
        error: message,
      };
    }
  }

  /**
   * Helper: converte una binary string (di forge) in ArrayBuffer per WebCrypto.
   */
  private binaryStringToArrayBuffer(binary: string): ArrayBuffer {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const signatureService = new SignatureService();
export default signatureService;
