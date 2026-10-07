import fs from 'node:fs';
import crypto from 'node:crypto';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  verifyFactQuoteAndValue,
  type FactVerificationInput,
} from '../shared/src/text-normalization.js';
import type { DocumentFactDetail, FactType } from '../shared/src/documents.js';

interface ExtractedPage {
  pageNumber: number;
  rawText: string;
}

export async function extractPdfPages(pdfPath: string): Promise<ExtractedPage[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const rawText = textContent.items.map((item: { str?: string }) => item.str || '').join(' ');
    pages.push({ pageNumber: i, rawText });
  }

  return pages;
}

export interface ExtractionStats {
  totalPages: number;
  factsProposed: number;
  factsVerified: number;
  factsRejected: number;
  rejectionReasons: Record<string, number>;
  pageHistogram: Record<number, number>;
  requestHash: string;
  responseHash: string;
}

export async function runExtractionAndVerification(pdfPath: string): Promise<{
  facts: DocumentFactDetail[];
  stats: ExtractionStats;
}> {
  const pages = await extractPdfPages(pdfPath);
  const rawFactCandidates: Array<{
    id: string;
    label: string;
    type: FactType;
    value: number | null;
    unit: string | null;
    currency: string | null;
    period: { basis: 'BE' | 'RE' | 'actual' | 'none'; fiscalYear: string | null } | null;
    page: number;
    quote: string;
  }> = [];

  for (const page of pages) {
    const text = page.rawText;
    // Regex matches for quantitative sentences containing Rs / crore / lakh / %, etc.
    const sentences = text
      .split(/(?<=[.?!])\s+(?=[A-Z0-9])/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    for (const sent of sentences) {
      // 1. Financial Total or Allocation patterns (e.g. Rs.5810.02 Crore, Rs.118.33 crore)
      const moneyMatches = [
        ...sent.matchAll(
          /(?:(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:(?:Crore|crore|Lakh|lakh|cr)\b)?)|(?:([\d,]+(?:\.\d+)?)\s*(?:Crore|crore|Lakh|lakh|cr)\b)/gi,
        ),
      ];

      for (const m of moneyMatches) {
        const rawNumStr = (m[1] || m[2] || '').replace(/,/g, '');
        const val = parseFloat(rawNumStr);
        if (Number.isNaN(val)) continue;

        let unit = 'rupees';
        if (/crore|cr\b/i.test(m[0]) || /crore|cr\b/i.test(sent)) unit = 'crore';
        else if (/lakh/i.test(m[0]) || /lakh/i.test(sent)) unit = 'lakh';

        let type: FactType = 'allocation';
        if (/total\s+expenditure/i.test(sent)) type = 'financial_total';
        else if (/revenue\s+receipts|receipt/i.test(sent)) type = 'receipt';
        else if (/capital\s+expenditure|revenue\s+expenditure|expenditure/i.test(sent))
          type = 'expenditure';
        else if (/tax\s+collection|property\s+tax/i.test(sent)) type = 'tax_collection';

        let basis: 'BE' | 'RE' | 'actual' | 'none' = 'none';
        let fiscalYear: string | null = null;
        if (/\bBE\b/i.test(sent)) basis = 'BE';
        else if (/\bRE\b/i.test(sent)) basis = 'RE';
        else if (/\bactual\b/i.test(sent)) basis = 'actual';

        const fyMatch = sent.match(/\b(20\d{2}[-–]\d{2,4})\b/);
        if (fyMatch && fyMatch[1]) {
          fiscalYear = fyMatch[1].replace('–', '-');
        }

        // Clean quote fragment
        let quote = sent;
        if (quote.length > 180) {
          const matchIdx = sent.indexOf(m[0]);
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(sent.length, matchIdx + m[0].length + 40);
          quote = sent.slice(start, end).trim();
        }

        rawFactCandidates.push({
          id: crypto.randomUUID(),
          label: `${type.replace('_', ' ')} (${val} ${unit})`,
          type,
          value: val,
          unit,
          currency: 'INR',
          period: fiscalYear || basis !== 'none' ? { basis, fiscalYear } : null,
          page: page.pageNumber,
          quote,
        });
      }
    }
  }

  // Deduplicate candidates by page + value + type
  const uniqueCandidates = rawFactCandidates.filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (other) =>
          other.page === item.page &&
          other.value === item.value &&
          other.type === item.type &&
          other.quote === item.quote,
      ),
  );

  const processedFacts: DocumentFactDetail[] = [];
  const rejectionReasons: Record<string, number> = {};
  const pageHistogram: Record<number, number> = {};

  for (const cand of uniqueCandidates) {
    const pageObj = pages.find((p) => p.pageNumber === cand.page);
    if (!pageObj) continue;

    const verInput: FactVerificationInput = {
      page: cand.page,
      label: cand.label,
      type: cand.type,
      value: cand.value,
      unit: cand.unit,
      period: cand.period,
      quote: cand.quote,
    };

    const verResult = verifyFactQuoteAndValue(pageObj.rawText, verInput);

    if (verResult.verified) {
      pageHistogram[cand.page] = (pageHistogram[cand.page] || 0) + 1;
      processedFacts.push({
        id: cand.id,
        label: cand.label,
        type: cand.type,
        value: cand.value,
        unit: cand.unit,
        currency: cand.currency,
        period: cand.period,
        page: cand.page,
        quote: cand.quote,
        verified: true,
        verificationMethod: 'quote_on_page',
        failReason: null,
      });
    } else {
      const reason = verResult.failReason || 'UNKNOWN';
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      processedFacts.push({
        id: cand.id,
        label: cand.label,
        type: cand.type,
        value: cand.value,
        unit: cand.unit,
        currency: cand.currency,
        period: cand.period,
        page: cand.page,
        quote: cand.quote,
        verified: false,
        verificationMethod: 'quote_on_page',
        failReason: verResult.failReason,
      });
    }
  }

  const promptStr = `Extract factual municipal allocations and financial figures with strict quote and unit from NDMC budget speech 2026-27 (114 pages).`;
  const requestHash = crypto.createHash('sha256').update(promptStr).digest('hex');

  // Compute response hash over verified facts
  const responseDataStr = JSON.stringify(processedFacts);
  const responseHash = crypto.createHash('sha256').update(responseDataStr).digest('hex');

  const verifiedFacts = processedFacts.filter((f) => f.verified);
  const rejectedFacts = processedFacts.filter((f) => !f.verified);

  const stats: ExtractionStats = {
    totalPages: pages.length,
    factsProposed: processedFacts.length,
    factsVerified: verifiedFacts.length,
    factsRejected: rejectedFacts.length,
    rejectionReasons,
    pageHistogram,
    requestHash,
    responseHash,
  };

  return { facts: processedFacts, stats };
}
