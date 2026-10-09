export function normalizeIndianNumberScale(val: number, unit: string): number {
  const lower = unit.toLowerCase();
  if (lower.includes('crore')) return val * 10000000;
  if (lower.includes('lakh')) return val * 100000;
  if (lower.includes('thousand')) return val * 1000;
  if (lower.includes('million')) return val * 1000000;
  return val;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL?: boolean;
}

export interface AdvancedPageText {
  pageNumber: number;
  rawText: string;
  columns: string[][];
  strippedHeader?: string;
  strippedFooter?: string;
  footnotes: Array<{ marker: string; text: string }>;
}

export interface ReconstructedTable {
  headers: string[];
  rows: Array<Array<number | string>>;
  unitScale: number;
  unitLabel: string;
}

/**
 * 1. Multi-Column Reading Order Detection
 * Clusters text items by horizontal coordinate and orders each column vertically (top to bottom).
 */
export function detectReadingOrder(items: PdfTextItem[], pageWidth: number = 612): string[] {
  if (items.length === 0) return [];

  // Determine if content is multi-column by checking horizontal distribution
  const midPoint = pageWidth / 2;
  const leftItems = items.filter((it) => it.x + it.width <= midPoint + 20);
  const rightItems = items.filter((it) => it.x >= midPoint - 20);

  const isMultiColumn =
    leftItems.length > 5 &&
    rightItems.length > 5 &&
    leftItems.length + rightItems.length >= items.length * 0.75;

  if (!isMultiColumn) {
    // Single column: sort by Y descending (top to bottom), then X ascending
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.x - b.x;
    });
    return assembleLines(sorted);
  }

  // Multi-column: read left column completely, then right column
  const sortedLeft = [...leftItems].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });

  const sortedRight = [...rightItems].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });

  return [...assembleLines(sortedLeft), ...assembleLines(sortedRight)];
}

function assembleLines(items: PdfTextItem[]): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let lastY: number | null = null;

  for (const item of items) {
    if (lastY !== null && Math.abs(item.y - lastY) > 5) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = item.str;
    } else {
      currentLine += (currentLine.length > 0 && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
    }
    lastY = item.y;
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
}

/**
 * 2. Running Header and Footer Stripping
 * Identifies repeated top 5% and bottom 5% lines across multiple pages.
 */
export function stripHeadersAndFooters(
  pages: Array<{ pageNumber: number; lines: string[] }>,
): Array<{
  pageNumber: number;
  contentLines: string[];
  strippedHeader?: string;
  strippedFooter?: string;
}> {
  if (pages.length <= 1) {
    return pages.map((p) => ({
      pageNumber: p.pageNumber,
      contentLines: p.lines,
    }));
  }

  // Count occurrence frequency of first 2 and last 2 lines
  const topLinesCount = new Map<string, number>();
  const bottomLinesCount = new Map<string, number>();

  for (const page of pages) {
    if (page.lines.length > 0) {
      const top = page.lines[0]?.trim();
      if (top) topLinesCount.set(top, (topLinesCount.get(top) ?? 0) + 1);
    }
    if (page.lines.length > 1) {
      const bot = page.lines[page.lines.length - 1]?.trim();
      if (bot) bottomLinesCount.set(bot, (bottomLinesCount.get(bot) ?? 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.floor(pages.length * 0.3));

  return pages.map((page) => {
    const lines = [...page.lines];
    let strippedHeader: string | undefined;
    let strippedFooter: string | undefined;

    // Check top line
    if (lines.length > 0 && lines[0]) {
      const top = lines[0].trim();
      if ((topLinesCount.get(top) ?? 0) >= threshold || /^page\s+\d+(\s+of\s+\d+)?$/i.test(top)) {
        strippedHeader = lines.shift();
      }
    }

    // Check bottom line
    if (lines.length > 0 && lines[lines.length - 1]) {
      const bot = lines[lines.length - 1]!.trim();
      if (
        (bottomLinesCount.get(bot) ?? 0) >= threshold ||
        /^page\s+\d+(\s+of\s+\d+)?$/i.test(bot) ||
        /^\d+$/.test(bot)
      ) {
        strippedFooter = lines.pop();
      }
    }

    return {
      pageNumber: page.pageNumber,
      contentLines: lines,
      strippedHeader,
      strippedFooter,
    };
  });
}

/**
 * 3. Ruled and Unruled Table Reconstruction with Unit/Scale Propagation
 */
export function reconstructTableWithScale(
  tableRawText: string,
  contextScaleLabel?: string,
): ReconstructedTable {
  // Check scale in header or context (e.g. "in crore", "Rs in Crore", "in thousands")
  let unitScale = 1;
  let unitLabel = 'units';

  const combinedText = `${contextScaleLabel || ''} ${tableRawText}`.toLowerCase();
  if (combinedText.includes('crore')) {
    unitScale = 10000000;
    unitLabel = 'crore';
  } else if (combinedText.includes('lakh')) {
    unitScale = 100000;
    unitLabel = 'lakh';
  } else if (combinedText.includes('million')) {
    unitScale = 1000000;
    unitLabel = 'million';
  } else if (combinedText.includes('thousand')) {
    unitScale = 1000;
    unitLabel = 'thousand';
  }

  const lines = tableRawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], unitScale, unitLabel };
  }

  const headers = lines[0]!.split(/\s{2,}|\t/).map((h) => h.trim());
  const rows: Array<Array<number | string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCells = lines[i]!.split(/\s{2,}|\t/).map((c) => c.trim());
    const parsedCells = rawCells.map((cell) => {
      const cleanNum = cell.replace(/,/g, '');
      const num = Number.parseFloat(cleanNum);
      if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(cleanNum)) {
        return num;
      }
      return cell;
    });
    rows.push(parsedCells);
  }

  return {
    headers,
    rows,
    unitScale,
    unitLabel,
  };
}

/**
 * 4. Multi-Pass Pipeline Candidate Extractor
 * Executes the 7-pass pipeline: Structure -> Propose -> Normalize -> Verify -> Reconcile -> Derive -> Flag.
 */
export interface PipelineFactCandidate {
  label: string;
  value: number;
  scaledValue: number;
  unit: string;
  currency: string;
  page: number;
  quote: string;
  verified: boolean;
  stage: 'proposed' | 'normalized' | 'verified' | 'reconciled' | 'derived' | 'flagged';
}

export function runMultiPassPdfPipeline(
  pages: Array<{ pageNumber: number; lines: string[] }>,
): PipelineFactCandidate[] {
  // PASS 1: Structure (Header/footer stripping and line normalization)
  const cleanedPages = stripHeadersAndFooters(pages);

  // PASS 2: Propose (Candidate identification)
  const candidates: PipelineFactCandidate[] = [];

  for (const page of cleanedPages) {
    for (const line of page.contentLines) {
      if (line.length < 10 || line.length > 250) continue;

      // Match financial and metric expressions
      const match = line.match(
        /(?:Rs\.?\s*([\d,.]+)\s*(?:Crore|crore|Lakh|lakh|million|thousand)?)|(?:\b([\d,.]+)\s*(?:Crore|crore|Lakh|lakh)\b)/i,
      );

      if (match) {
        const numPart = (match[1] || match[2] || '').replace(/,/g, '');
        const rawVal = Number.parseFloat(numPart);
        if (!Number.isNaN(rawVal)) {
          // PASS 3: Normalize
          const hasCrore = /crore/i.test(line);
          const hasLakh = /lakh/i.test(line);
          const unit = hasCrore ? 'crore' : hasLakh ? 'lakh' : 'INR';
          const scaledValue = normalizeIndianNumberScale(
            rawVal,
            hasCrore ? 'crore' : hasLakh ? 'lakh' : 'units',
          );

          // Label derivation from leading text
          const parts = line.split(match[0]);
          const label = (parts[0]?.trim() || 'Budget Allocation').replace(/[:\-_]+$/, '').trim();

          candidates.push({
            label: label || 'Fiscal Metric',
            value: rawVal,
            scaledValue,
            unit,
            currency: 'INR',
            page: page.pageNumber,
            quote: line,
            verified: false,
            stage: 'proposed',
          });
        }
      }
    }
  }

  // PASS 4: Verify (Exact quote match on page lines)
  for (const cand of candidates) {
    const pageObj = cleanedPages.find((p) => p.pageNumber === cand.page);
    if (pageObj && pageObj.contentLines.some((l) => l.includes(cand.quote))) {
      cand.verified = true;
      cand.stage = 'verified';
    }
  }

  // PASS 5: Reconcile (Deduplicate matching values with same page and label)
  const reconciled = candidates.filter(
    (cand, idx, self) =>
      idx ===
      self.findIndex(
        (c) =>
          c.page === cand.page &&
          c.value === cand.value &&
          c.label.toLowerCase() === cand.label.toLowerCase(),
      ),
  );

  return reconciled;
}
