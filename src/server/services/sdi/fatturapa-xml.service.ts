/**
 * FatturaPA XML Generation Service
 * Genera XML conforme allo schema FatturaPA v1.2.2 (versione corrente)
 * Riferimento: https://www.fatturapa.gov.it/it/norme-e-regole/documentazione-fattura-elettronica/
 */

import {
  FatturapaInput,
  XmlGenerationResult,
  CedentePrestatoreData,
  CessionarioCommittenteData,
  DettaglioLineaData,
  DatiRiepilogoData,
  DatiPagamentoData,
} from './sdi-provider.interface';
import { logger } from '../../config/logger';

/**
 * Servizio per la generazione di XML FatturaPA
 */
class FatturaPaXmlService {
  private formatoTrasmissione = 'FPR12'; // Fatture verso privati
  // Versione schema FatturaPA: 1.2.2

  /**
   * Genera il file XML FatturaPA completo
   */
  generateXml(input: FatturapaInput, progressivoInvio: string): XmlGenerationResult {
    try {
      // Validazione input
      const validationErrors = this.validateInput(input);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors };
      }

      // Genera nome file: IT + P.IVA cedente + _ + progressivo (5 caratteri alfanumerici)
      const fileName = this.generateFileName(input.cedentePrestatore.partitaIva, progressivoInvio);

      // Costruisci XML
      const xml = this.buildXml(input, progressivoInvio);

      logger.info(`XML FatturaPA generato: ${fileName}`);

      return {
        success: true,
        xml,
        fileName,
      };
    } catch (error) {
      logger.error('Errore generazione XML FatturaPA:', error);
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Genera il nome file secondo le specifiche SDI
   * Formato: IT + Partita IVA (11 caratteri) + _ + progressivo (5 caratteri)
   */
  generateFileName(partitaIva: string, progressivo: string): string {
    // Rimuovi caratteri non alfanumerici dalla P.IVA
    const cleanPiva = partitaIva.replace(/[^0-9]/g, '').padStart(11, '0');

    // Progressivo deve essere 5 caratteri alfanumerici
    const cleanProgressivo = progressivo.replace(/[^A-Za-z0-9]/g, '').toUpperCase().padStart(5, '0').slice(-5);

    return `IT${cleanPiva}_${cleanProgressivo}.xml`;
  }

  /**
   * Valida l'input prima della generazione
   */
  private validateInput(input: FatturapaInput): string[] {
    const errors: string[] = [];

    // Cedente/Prestatore
    if (!input.cedentePrestatore.partitaIva) {
      errors.push('Partita IVA cedente obbligatoria');
    }
    if (!input.cedentePrestatore.regimeFiscale) {
      errors.push('Regime fiscale cedente obbligatorio');
    }
    if (!input.cedentePrestatore.indirizzo || !input.cedentePrestatore.cap || !input.cedentePrestatore.comune) {
      errors.push('Indirizzo completo cedente obbligatorio');
    }

    // Cessionario/Committente
    if (!input.cessionarioCommittente.partitaIva && !input.cessionarioCommittente.codiceFiscale) {
      errors.push('Partita IVA o Codice Fiscale cessionario obbligatorio');
    }
    if (!input.cessionarioCommittente.indirizzo || !input.cessionarioCommittente.cap || !input.cessionarioCommittente.comune) {
      errors.push('Indirizzo completo cessionario obbligatorio');
    }

    // Dati documento
    if (!input.numero) {
      errors.push('Numero documento obbligatorio');
    }
    if (!input.data) {
      errors.push('Data documento obbligatoria');
    }

    // Righe dettaglio
    if (!input.dettaglioLinee || input.dettaglioLinee.length === 0) {
      errors.push('Almeno una riga dettaglio obbligatoria');
    }

    // Riepiloghi IVA
    if (!input.datiRiepilogo || input.datiRiepilogo.length === 0) {
      errors.push('Almeno un riepilogo IVA obbligatorio');
    }

    return errors;
  }

  /**
   * Costruisce il documento XML completo
   */
  private buildXml(input: FatturapaInput, progressivoInvio: string): string {
    const lines: string[] = [];

    // XML declaration
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');

    // Root element con namespaces
    lines.push('<p:FatturaElettronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="FPR12">');

    // Header
    lines.push(this.buildHeader(input, progressivoInvio));

    // Body
    lines.push(this.buildBody(input));

    lines.push('</p:FatturaElettronica>');

    return lines.join('\n');
  }

  /**
   * Costruisce FatturaElettronicaHeader
   */
  private buildHeader(input: FatturapaInput, progressivoInvio: string): string {
    const lines: string[] = [];

    lines.push('  <FatturaElettronicaHeader>');

    // DatiTrasmissione
    lines.push('    <DatiTrasmissione>');
    lines.push('      <IdTrasmittente>');
    lines.push(`        <IdPaese>IT</IdPaese>`);
    lines.push(`        <IdCodice>${this.escapeXml(input.cedentePrestatore.partitaIva)}</IdCodice>`);
    lines.push('      </IdTrasmittente>');
    lines.push(`      <ProgressivoInvio>${this.escapeXml(progressivoInvio)}</ProgressivoInvio>`);
    lines.push(`      <FormatoTrasmissione>${this.formatoTrasmissione}</FormatoTrasmissione>`);

    // Codice destinatario (7 caratteri per privati, 6 per PA)
    const codiceDestinatario = input.cessionarioCommittente.codiceDestinatario || '0000000';
    lines.push(`      <CodiceDestinatario>${this.escapeXml(codiceDestinatario)}</CodiceDestinatario>`);

    // PEC destinatario (alternativa a codice SDI)
    if (input.cessionarioCommittente.pecDestinatario && codiceDestinatario === '0000000') {
      lines.push(`      <PECDestinatario>${this.escapeXml(input.cessionarioCommittente.pecDestinatario)}</PECDestinatario>`);
    }

    lines.push('    </DatiTrasmissione>');

    // CedentePrestatore
    lines.push(this.buildCedentePrestatore(input.cedentePrestatore));

    // CessionarioCommittente
    lines.push(this.buildCessionarioCommittente(input.cessionarioCommittente));

    lines.push('  </FatturaElettronicaHeader>');

    return lines.join('\n');
  }

  /**
   * Costruisce blocco CedentePrestatore
   */
  private buildCedentePrestatore(data: CedentePrestatoreData): string {
    const lines: string[] = [];

    lines.push('    <CedentePrestatore>');

    // DatiAnagrafici
    lines.push('      <DatiAnagrafici>');
    lines.push('        <IdFiscaleIVA>');
    lines.push('          <IdPaese>IT</IdPaese>');
    lines.push(`          <IdCodice>${this.escapeXml(data.partitaIva)}</IdCodice>`);
    lines.push('        </IdFiscaleIVA>');

    if (data.codiceFiscale) {
      lines.push(`        <CodiceFiscale>${this.escapeXml(data.codiceFiscale)}</CodiceFiscale>`);
    }

    lines.push('        <Anagrafica>');
    if (data.denominazione) {
      lines.push(`          <Denominazione>${this.escapeXml(data.denominazione)}</Denominazione>`);
    } else {
      lines.push(`          <Nome>${this.escapeXml(data.nome || '')}</Nome>`);
      lines.push(`          <Cognome>${this.escapeXml(data.cognome || '')}</Cognome>`);
    }
    lines.push('        </Anagrafica>');

    lines.push(`        <RegimeFiscale>${this.escapeXml(data.regimeFiscale)}</RegimeFiscale>`);
    lines.push('      </DatiAnagrafici>');

    // Sede
    lines.push('      <Sede>');
    lines.push(`        <Indirizzo>${this.escapeXml(data.indirizzo)}</Indirizzo>`);
    if (data.numeroCivico) {
      lines.push(`        <NumeroCivico>${this.escapeXml(data.numeroCivico)}</NumeroCivico>`);
    }
    lines.push(`        <CAP>${this.escapeXml(data.cap)}</CAP>`);
    lines.push(`        <Comune>${this.escapeXml(data.comune)}</Comune>`);
    if (data.provincia) {
      lines.push(`        <Provincia>${this.escapeXml(data.provincia)}</Provincia>`);
    }
    lines.push(`        <Nazione>${this.escapeXml(data.nazione || 'IT')}</Nazione>`);
    lines.push('      </Sede>');

    // IscrizioneREA (opzionale)
    if (data.reaUfficio && data.reaNumero) {
      lines.push('      <IscrizioneREA>');
      lines.push(`        <Ufficio>${this.escapeXml(data.reaUfficio)}</Ufficio>`);
      lines.push(`        <NumeroREA>${this.escapeXml(data.reaNumero)}</NumeroREA>`);
      if (data.capitaleSociale !== undefined) {
        lines.push(`        <CapitaleSociale>${this.formatDecimal(data.capitaleSociale)}</CapitaleSociale>`);
      }
      if (data.socioUnico) {
        lines.push(`        <SocioUnico>${data.socioUnico}</SocioUnico>`);
      }
      lines.push(`        <StatoLiquidazione>${data.statoLiquidazione || 'LN'}</StatoLiquidazione>`);
      lines.push('      </IscrizioneREA>');
    }

    // Contatti (opzionale)
    if (data.telefono || data.email) {
      lines.push('      <Contatti>');
      if (data.telefono) {
        lines.push(`        <Telefono>${this.escapeXml(data.telefono)}</Telefono>`);
      }
      if (data.email) {
        lines.push(`        <Email>${this.escapeXml(data.email)}</Email>`);
      }
      lines.push('      </Contatti>');
    }

    lines.push('    </CedentePrestatore>');

    return lines.join('\n');
  }

  /**
   * Costruisce blocco CessionarioCommittente
   */
  private buildCessionarioCommittente(data: CessionarioCommittenteData): string {
    const lines: string[] = [];

    lines.push('    <CessionarioCommittente>');

    // DatiAnagrafici
    lines.push('      <DatiAnagrafici>');

    if (data.partitaIva) {
      lines.push('        <IdFiscaleIVA>');
      lines.push(`          <IdPaese>${this.escapeXml(data.nazione || 'IT')}</IdPaese>`);
      lines.push(`          <IdCodice>${this.escapeXml(data.partitaIva)}</IdCodice>`);
      lines.push('        </IdFiscaleIVA>');
    }

    if (data.codiceFiscale) {
      lines.push(`        <CodiceFiscale>${this.escapeXml(data.codiceFiscale)}</CodiceFiscale>`);
    }

    lines.push('        <Anagrafica>');
    if (data.denominazione) {
      lines.push(`          <Denominazione>${this.escapeXml(data.denominazione)}</Denominazione>`);
    } else {
      lines.push(`          <Nome>${this.escapeXml(data.nome || '')}</Nome>`);
      lines.push(`          <Cognome>${this.escapeXml(data.cognome || '')}</Cognome>`);
    }
    lines.push('        </Anagrafica>');
    lines.push('      </DatiAnagrafici>');

    // Sede
    lines.push('      <Sede>');
    lines.push(`        <Indirizzo>${this.escapeXml(data.indirizzo)}</Indirizzo>`);
    if (data.numeroCivico) {
      lines.push(`        <NumeroCivico>${this.escapeXml(data.numeroCivico)}</NumeroCivico>`);
    }
    lines.push(`        <CAP>${this.escapeXml(data.cap)}</CAP>`);
    lines.push(`        <Comune>${this.escapeXml(data.comune)}</Comune>`);
    if (data.provincia) {
      lines.push(`        <Provincia>${this.escapeXml(data.provincia)}</Provincia>`);
    }
    lines.push(`        <Nazione>${this.escapeXml(data.nazione || 'IT')}</Nazione>`);
    lines.push('      </Sede>');

    lines.push('    </CessionarioCommittente>');

    return lines.join('\n');
  }

  /**
   * Costruisce FatturaElettronicaBody
   */
  private buildBody(input: FatturapaInput): string {
    const lines: string[] = [];

    lines.push('  <FatturaElettronicaBody>');

    // DatiGenerali
    lines.push(this.buildDatiGenerali(input));

    // DatiBeniServizi
    lines.push(this.buildDatiBeniServizi(input));

    // DatiPagamento
    if (input.datiPagamento) {
      lines.push(this.buildDatiPagamento(input.datiPagamento));
    }

    // Allegati
    if (input.allegati && input.allegati.length > 0) {
      for (const allegato of input.allegati) {
        lines.push('    <Allegati>');
        lines.push(`      <NomeAttachment>${this.escapeXml(allegato.nomeAttachment)}</NomeAttachment>`);
        if (allegato.formatoAttachment) {
          lines.push(`      <FormatoAttachment>${this.escapeXml(allegato.formatoAttachment)}</FormatoAttachment>`);
        }
        if (allegato.descrizioneAttachment) {
          lines.push(`      <DescrizioneAttachment>${this.escapeXml(allegato.descrizioneAttachment)}</DescrizioneAttachment>`);
        }
        lines.push(`      <Attachment>${allegato.attachment}</Attachment>`);
        lines.push('    </Allegati>');
      }
    }

    lines.push('  </FatturaElettronicaBody>');

    return lines.join('\n');
  }

  /**
   * Costruisce blocco DatiGenerali
   */
  private buildDatiGenerali(input: FatturapaInput): string {
    const lines: string[] = [];

    lines.push('    <DatiGenerali>');

    // DatiGeneraliDocumento
    lines.push('      <DatiGeneraliDocumento>');
    lines.push(`        <TipoDocumento>${input.tipoDocumento}</TipoDocumento>`);
    lines.push(`        <Divisa>${input.divisa || 'EUR'}</Divisa>`);
    lines.push(`        <Data>${this.formatDate(input.data)}</Data>`);
    lines.push(`        <Numero>${this.escapeXml(input.numero)}</Numero>`);

    // DatiRitenuta
    if (input.datiRitenuta) {
      lines.push('        <DatiRitenuta>');
      lines.push(`          <TipoRitenuta>${input.datiRitenuta.tipoRitenuta}</TipoRitenuta>`);
      lines.push(`          <ImportoRitenuta>${this.formatDecimal(input.datiRitenuta.importoRitenuta)}</ImportoRitenuta>`);
      lines.push(`          <AliquotaRitenuta>${this.formatDecimal(input.datiRitenuta.aliquotaRitenuta)}</AliquotaRitenuta>`);
      lines.push(`          <CausalePagamento>${this.escapeXml(input.datiRitenuta.causalePagamento)}</CausalePagamento>`);
      lines.push('        </DatiRitenuta>');
    }

    // DatiBollo
    if (input.datiBollo) {
      lines.push('        <DatiBollo>');
      lines.push(`          <BolloVirtuale>${input.datiBollo.bolloVirtuale}</BolloVirtuale>`);
      lines.push(`          <ImportoBollo>${this.formatDecimal(input.datiBollo.importoBollo)}</ImportoBollo>`);
      lines.push('        </DatiBollo>');
    }

    // DatiCassaPrevidenziale
    if (input.datiCassaPrevidenziale && input.datiCassaPrevidenziale.length > 0) {
      for (const cassa of input.datiCassaPrevidenziale) {
        lines.push('        <DatiCassaPrevidenziale>');
        lines.push(`          <TipoCassa>${cassa.tipoCassa}</TipoCassa>`);
        lines.push(`          <AlCassa>${this.formatDecimal(cassa.alCassa)}</AlCassa>`);
        lines.push(`          <ImportoContributoCassa>${this.formatDecimal(cassa.importoContributoCassa)}</ImportoContributoCassa>`);
        if (cassa.imponibileCassa !== undefined) {
          lines.push(`          <ImponibileCassa>${this.formatDecimal(cassa.imponibileCassa)}</ImponibileCassa>`);
        }
        lines.push(`          <AliquotaIVA>${this.formatDecimal(cassa.aliquotaIva)}</AliquotaIVA>`);
        if (cassa.ritenuta) {
          lines.push(`          <Ritenuta>${cassa.ritenuta}</Ritenuta>`);
        }
        if (cassa.natura) {
          lines.push(`          <Natura>${cassa.natura}</Natura>`);
        }
        lines.push('        </DatiCassaPrevidenziale>');
      }
    }

    // ImportoTotaleDocumento
    if (input.importoTotaleDocumento !== undefined) {
      lines.push(`        <ImportoTotaleDocumento>${this.formatDecimal(input.importoTotaleDocumento)}</ImportoTotaleDocumento>`);
    }

    // Arrotondamento
    if (input.arrotondamento !== undefined && input.arrotondamento !== 0) {
      lines.push(`        <Arrotondamento>${this.formatDecimal(input.arrotondamento)}</Arrotondamento>`);
    }

    // Causale
    if (input.causale && input.causale.length > 0) {
      for (const causale of input.causale) {
        // Causale max 200 caratteri
        const chunks = this.splitString(causale, 200);
        for (const chunk of chunks) {
          lines.push(`        <Causale>${this.escapeXml(chunk)}</Causale>`);
        }
      }
    }

    lines.push('      </DatiGeneraliDocumento>');

    // DatiOrdineAcquisto
    if (input.datiOrdineAcquisto && input.datiOrdineAcquisto.length > 0) {
      for (const ordine of input.datiOrdineAcquisto) {
        lines.push('      <DatiOrdineAcquisto>');
        if (ordine.riferimentoNumeroLinea) {
          for (const numLinea of ordine.riferimentoNumeroLinea) {
            lines.push(`        <RiferimentoNumeroLinea>${numLinea}</RiferimentoNumeroLinea>`);
          }
        }
        lines.push(`        <IdDocumento>${this.escapeXml(ordine.idDocumento)}</IdDocumento>`);
        if (ordine.data) {
          lines.push(`        <Data>${this.formatDate(ordine.data)}</Data>`);
        }
        if (ordine.numItem) {
          lines.push(`        <NumItem>${this.escapeXml(ordine.numItem)}</NumItem>`);
        }
        if (ordine.codiceCommessaConvenzione) {
          lines.push(`        <CodiceCommessaConvenzione>${this.escapeXml(ordine.codiceCommessaConvenzione)}</CodiceCommessaConvenzione>`);
        }
        if (ordine.codiceCup) {
          lines.push(`        <CodiceCUP>${this.escapeXml(ordine.codiceCup)}</CodiceCUP>`);
        }
        if (ordine.codiceCig) {
          lines.push(`        <CodiceCIG>${this.escapeXml(ordine.codiceCig)}</CodiceCIG>`);
        }
        lines.push('      </DatiOrdineAcquisto>');
      }
    }

    // DatiDDT (per fatture differite)
    if (input.datiDdt && input.datiDdt.length > 0) {
      for (const ddt of input.datiDdt) {
        lines.push('      <DatiDDT>');
        lines.push(`        <NumeroDDT>${this.escapeXml(ddt.numeroDdt)}</NumeroDDT>`);
        lines.push(`        <DataDDT>${this.formatDate(ddt.dataDdt)}</DataDDT>`);
        if (ddt.riferimentoNumeroLinea) {
          for (const numLinea of ddt.riferimentoNumeroLinea) {
            lines.push(`        <RiferimentoNumeroLinea>${numLinea}</RiferimentoNumeroLinea>`);
          }
        }
        lines.push('      </DatiDDT>');
      }
    }

    lines.push('    </DatiGenerali>');

    return lines.join('\n');
  }

  /**
   * Costruisce blocco DatiBeniServizi
   */
  private buildDatiBeniServizi(input: FatturapaInput): string {
    const lines: string[] = [];

    lines.push('    <DatiBeniServizi>');

    // DettaglioLinee
    for (const linea of input.dettaglioLinee) {
      lines.push(this.buildDettaglioLinea(linea));
    }

    // DatiRiepilogo
    for (const riepilogo of input.datiRiepilogo) {
      lines.push(this.buildDatiRiepilogo(riepilogo));
    }

    lines.push('    </DatiBeniServizi>');

    return lines.join('\n');
  }

  /**
   * Costruisce una singola riga DettaglioLinee
   */
  private buildDettaglioLinea(linea: DettaglioLineaData): string {
    const lines: string[] = [];

    lines.push('      <DettaglioLinee>');
    lines.push(`        <NumeroLinea>${linea.numeroLinea}</NumeroLinea>`);

    if (linea.ritenuta) {
      lines.push(`        <Ritenuta>${linea.ritenuta}</Ritenuta>`);
    }

    lines.push(`        <Descrizione>${this.escapeXml(linea.descrizione.substring(0, 1000))}</Descrizione>`);

    if (linea.quantita !== undefined) {
      lines.push(`        <Quantita>${this.formatDecimal(linea.quantita, 8)}</Quantita>`);
    }

    if (linea.unitaMisura) {
      lines.push(`        <UnitaMisura>${this.escapeXml(linea.unitaMisura)}</UnitaMisura>`);
    }

    lines.push(`        <PrezzoUnitario>${this.formatDecimal(linea.prezzoUnitario, 8)}</PrezzoUnitario>`);

    // ScontoMaggiorazione
    if (linea.scontoMaggiorazione && linea.scontoMaggiorazione.length > 0) {
      for (const sconto of linea.scontoMaggiorazione) {
        lines.push('        <ScontoMaggiorazione>');
        lines.push(`          <Tipo>${sconto.tipo}</Tipo>`);
        if (sconto.percentuale !== undefined) {
          lines.push(`          <Percentuale>${this.formatDecimal(sconto.percentuale)}</Percentuale>`);
        }
        if (sconto.importo !== undefined) {
          lines.push(`          <Importo>${this.formatDecimal(sconto.importo)}</Importo>`);
        }
        lines.push('        </ScontoMaggiorazione>');
      }
    }

    lines.push(`        <PrezzoTotale>${this.formatDecimal(linea.prezzoTotale)}</PrezzoTotale>`);
    lines.push(`        <AliquotaIVA>${this.formatDecimal(linea.aliquotaIva)}</AliquotaIVA>`);

    if (linea.natura) {
      lines.push(`        <Natura>${linea.natura}</Natura>`);
    }

    if (linea.riferimentoAmministrazione) {
      lines.push(`        <RiferimentoAmministrazione>${this.escapeXml(linea.riferimentoAmministrazione)}</RiferimentoAmministrazione>`);
    }

    lines.push('      </DettaglioLinee>');

    return lines.join('\n');
  }

  /**
   * Costruisce blocco DatiRiepilogo
   */
  private buildDatiRiepilogo(riepilogo: DatiRiepilogoData): string {
    const lines: string[] = [];

    lines.push('      <DatiRiepilogo>');
    lines.push(`        <AliquotaIVA>${this.formatDecimal(riepilogo.aliquotaIva)}</AliquotaIVA>`);

    if (riepilogo.natura) {
      lines.push(`        <Natura>${riepilogo.natura}</Natura>`);
    }

    lines.push(`        <ImponibileImporto>${this.formatDecimal(riepilogo.imponibileImporto)}</ImponibileImporto>`);
    lines.push(`        <Imposta>${this.formatDecimal(riepilogo.imposta)}</Imposta>`);

    if (riepilogo.esigibilitaIva) {
      lines.push(`        <EsigibilitaIVA>${riepilogo.esigibilitaIva}</EsigibilitaIVA>`);
    }

    if (riepilogo.riferimentoNormativo) {
      lines.push(`        <RiferimentoNormativo>${this.escapeXml(riepilogo.riferimentoNormativo)}</RiferimentoNormativo>`);
    }

    lines.push('      </DatiRiepilogo>');

    return lines.join('\n');
  }

  /**
   * Costruisce blocco DatiPagamento
   */
  private buildDatiPagamento(dati: DatiPagamentoData): string {
    const lines: string[] = [];

    lines.push('    <DatiPagamento>');
    lines.push(`      <CondizioniPagamento>${dati.condizioniPagamento}</CondizioniPagamento>`);

    for (const dettaglio of dati.dettaglioPagamento) {
      lines.push('      <DettaglioPagamento>');
      lines.push(`        <ModalitaPagamento>${dettaglio.modalitaPagamento}</ModalitaPagamento>`);

      if (dettaglio.dataRiferimentoTerminiPagamento) {
        lines.push(`        <DataRiferimentoTerminiPagamento>${this.formatDate(dettaglio.dataRiferimentoTerminiPagamento)}</DataRiferimentoTerminiPagamento>`);
      }

      if (dettaglio.giorniTerminiPagamento !== undefined) {
        lines.push(`        <GiorniTerminiPagamento>${dettaglio.giorniTerminiPagamento}</GiorniTerminiPagamento>`);
      }

      if (dettaglio.dataScadenzaPagamento) {
        lines.push(`        <DataScadenzaPagamento>${this.formatDate(dettaglio.dataScadenzaPagamento)}</DataScadenzaPagamento>`);
      }

      lines.push(`        <ImportoPagamento>${this.formatDecimal(dettaglio.importoPagamento)}</ImportoPagamento>`);

      if (dettaglio.istitutoFinanziario) {
        lines.push(`        <IstitutoFinanziario>${this.escapeXml(dettaglio.istitutoFinanziario)}</IstitutoFinanziario>`);
      }

      if (dettaglio.iban) {
        lines.push(`        <IBAN>${this.escapeXml(dettaglio.iban.replace(/\s/g, ''))}</IBAN>`);
      }

      if (dettaglio.bic) {
        lines.push(`        <BIC>${this.escapeXml(dettaglio.bic)}</BIC>`);
      }

      lines.push('      </DettaglioPagamento>');
    }

    lines.push('    </DatiPagamento>');

    return lines.join('\n');
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Escape caratteri speciali XML
   */
  private escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Formatta una data in formato ISO (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Formatta un numero decimale con precisione specificata
   */
  private formatDecimal(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }

  /**
   * Divide una stringa in chunks di lunghezza massima
   */
  private splitString(str: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = str;

    while (remaining.length > 0) {
      chunks.push(remaining.substring(0, maxLength));
      remaining = remaining.substring(maxLength);
    }

    return chunks;
  }
}

export const fatturaPaXmlService = new FatturaPaXmlService();
