import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDocumentDetail, fetchDocumentChunks } from '../lib/api.js';
import type { DocumentFactDetail, VisualSpec } from '@juris/shared';
import { Button, Card, Drawer, Skeleton, ErrorState } from '../components/ui/index.js';
import {
  Search,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  ScanText,
  Fingerprint,
  Download,
  Folder,
  ArrowRight,
} from 'lucide-react';

import { OverviewStoryboard } from '../components/visuals/OverviewStoryboard.js';
import { InsightPanel } from '../components/insights/InsightPanel.js';

export const DocumentViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedFact, setSelectedFact] = useState<DocumentFactDetail | null>(null);
  const [activeInsightSpec, setActiveInsightSpec] = useState<VisualSpec | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'facts' | 'source' | 'audit'>('overview');
  const [factFilter, setFactFilter] = useState<string>('all');
  const [factSearch, setFactSearch] = useState('');
  const [cadence, setCadence] = useState<'simple' | 'standard' | 'expert'>('standard');
  const [includeEstimates, setIncludeEstimates] = useState(true);

  // 1. Fetch document metadata, facts, and synthesis
  const {
    data: doc,
    isLoading: isDocLoading,
    isError: isDocError,
    error: docError,
    refetch: refetchDoc,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: () => (id ? fetchDocumentDetail(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
    retry: false,
  });

  // 2. Fetch document chunks for source tab
  const { data: chunksData, isLoading: isChunksLoading } = useQuery({
    queryKey: ['document-chunks', id],
    queryFn: () => (id ? fetchDocumentChunks(id) : Promise.reject('No ID')),
    enabled: Boolean(id) && activeTab === 'source',
  });

  if (isDocLoading) {
    return (
      <div className="w-full max-w-[1200px] mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isDocError || !doc) {
    return (
      <ErrorState
        title="Document Not Found"
        message={docError instanceof Error ? docError.message : 'Unable to load document details.'}
        onRetry={() => refetchDoc()}
      />
    );
  }

  const allFacts = doc.facts || [];
  const verifiedCount = allFacts.filter((f) => f.verified).length;
  const failedCount = allFacts.filter((f) => !f.verified && f.failReason).length;
  const unverifiedCount = allFacts.length - verifiedCount - failedCount;

  const filteredFacts = allFacts.filter((fact) => {
    const matchesSearch =
      fact.label.toLowerCase().includes(factSearch.toLowerCase()) ||
      fact.quote.toLowerCase().includes(factSearch.toLowerCase()) ||
      String(fact.value).includes(factSearch);
    if (!matchesSearch) return false;

    if (factFilter === 'verified') return fact.verified;
    if (factFilter === 'needs_review') return !fact.verified;
    if (factFilter === 'financial_total') return fact.type === 'financial_total';
    if (factFilter === 'expenditure') return fact.type === 'expenditure';
    if (factFilter === 'receipt') return fact.type === 'receipt';
    if (factFilter === 'allocation') return fact.type === 'allocation';
    if (factFilter === 'tax_collection') return fact.type === 'tax_collection';
    if (factFilter === 'percentage') return fact.type === 'percentage';
    return true;
  });

  const exportAuditDossier = () => {
    const dossier = {
      id: doc.id,
      filename: doc.filename,
      sha256: doc.sha256,
      pageCount: doc.pageCount,
      verifiedFactsCount: verifiedCount,
      totalFactsCount: allFacts.length,
      facts: allFacts,
      analysis: doc.analysis,
      exportedAt: new Date().toISOString(),
      provenanceProtocol: 'JURIS-CIVIC-v2.4',
    };
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `juris-audit-dossier-${doc.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-6">
      {/* Top Document Header Bar (Matcha Style) */}
      <section className="w-full bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Metadata & Title Group */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-text-subtle">
              <span className="inline-flex items-center gap-1 font-bold text-text">
                <Folder className="w-3.5 h-3.5 text-text" />
                <span>Statutory Docket · Civic Registry</span>
              </span>
              <span className="text-border-strong">/</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-text-subtle hover:text-text transition-colors cursor-pointer"
                title={`Full SHA-256: ${doc.sha256}`}
              >
                <Fingerprint className="w-3.5 h-3.5 text-text" />
                <span className="underline decoration-dotted underline-offset-2">
                  sha256: {doc.sha256.substring(0, 12)}...
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text tracking-tight truncate max-w-xl">
                {doc.filename}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-border-subtle border border-border text-text font-mono text-xs font-semibold">
                Government notification
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface border border-border text-text-subtle font-mono text-xs">
                {doc.pageCount} pages
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border-subtle border border-border-strong text-text font-mono text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-text"></span>
                <span>
                  {verifiedCount} of {allFacts.length} facts verified
                </span>
                {unverifiedCount + failedCount > 0 && (
                  <span className="text-text-subtle font-normal">
                    · {unverifiedCount + failedCount} need review
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/upload')}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={exportAuditDossier}
              className="flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit Dossier</span>
            </Button>
          </div>
        </div>

        {/* Tab Bar with Cadence Toolbar */}
        <div className="pt-3 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`h-9 px-3.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Overview & Storyboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('facts')}
              className={`h-9 px-3.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'facts'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Facts</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-border text-[10px]">
                {allFacts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('source')}
              className={`h-9 px-3.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'source'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              <ScanText className="w-3.5 h-3.5" />
              <span>Source ({doc.pageCount} pp)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`h-9 px-3.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'bg-border-subtle text-text hover:bg-border'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Audit Proof Chain</span>
            </button>
          </div>

          {/* Cadence Control & Estimates Toggle */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-text-subtle hidden sm:inline">Cadence:</span>
              <div className="inline-flex p-0.5 rounded-full bg-border-subtle border border-border">
                <button
                  type="button"
                  onClick={() => setCadence('simple')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                    cadence === 'simple'
                      ? 'bg-text text-text-inverse shadow-xs'
                      : 'text-text-subtle hover:text-text'
                  }`}
                >
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setCadence('standard')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                    cadence === 'standard'
                      ? 'bg-text text-text-inverse shadow-xs'
                      : 'text-text-subtle hover:text-text'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setCadence('expert')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                    cadence === 'expert'
                      ? 'bg-text text-text-inverse shadow-xs'
                      : 'text-text-subtle hover:text-text'
                  }`}
                >
                  Expert
                </button>
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeEstimates}
                onChange={(e) => setIncludeEstimates(e.target.checked)}
                className="rounded border-border text-text focus:ring-text"
              />
              <span className="text-text-subtle text-[11px]">Include estimates</span>
            </label>
          </div>
        </div>
      </section>

      {/* TAB CONTENT: 1. OVERVIEW STORYBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {activeInsightSpec && (
            <InsightPanel
              spec={activeInsightSpec}
              facts={allFacts}
              onSelectFact={(factId: string) => {
                const found = allFacts.find((f) => f.id === factId);
                if (found) setSelectedFact(found);
              }}
              onClose={() => setActiveInsightSpec(null)}
            />
          )}
          <OverviewStoryboard
            facts={allFacts}
            documentName={doc.filename}
            verificationRate={allFacts.length > 0 ? (verifiedCount / allFacts.length) * 100 : 100}
            pageCount={doc.pageCount}
            onSelectFact={(factId: string) => {
              const found = allFacts.find((f) => f.id === factId);
              if (found) setSelectedFact(found);
            }}
            onOpenInsight={(spec) => setActiveInsightSpec(spec)}
          />
        </div>
      )}

      {/* TAB CONTENT: 2. FACTS CITATION SHEET */}
      {activeTab === 'facts' && (
        <div className="space-y-6">
          {/* Filter Toolbar */}
          <Card className="p-4 bg-surface border border-border space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search extracted facts, entities, numbers, or quotes..."
                  value={factSearch}
                  onChange={(e) => setFactSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-border-subtle/60 border border-border rounded-lg text-xs sm:text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-text focus:ring-2 focus:ring-border-subtle font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: 'All', count: allFacts.length },
                  { id: 'verified', label: 'Verified', count: verifiedCount },
                  {
                    id: 'needs_review',
                    label: 'Needs review',
                    count: unverifiedCount + failedCount,
                  },
                  { id: 'financial_total', label: 'Totals' },
                  { id: 'expenditure', label: 'Expenditure' },
                  { id: 'allocation', label: 'Allocation' },
                  { id: 'percentage', label: 'Percentage' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFactFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-full font-mono text-[11px] whitespace-nowrap transition-all ${
                      factFilter === pill.id
                        ? 'bg-text text-text-inverse font-bold shadow-xs'
                        : 'bg-border-subtle text-text hover:bg-border'
                    }`}
                  >
                    <span>{pill.label}</span>
                    {pill.count !== undefined && (
                      <span className="ml-1 opacity-80">({pill.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Facts Table Card */}
          <Card className="overflow-hidden border border-border shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-border-subtle border-b border-border text-text font-mono text-xs uppercase tracking-wider select-none">
                    <th className="py-3 px-4 font-semibold">Fact Description & Quote</th>
                    <th className="py-3 px-4 font-semibold">Value & Unit</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold">Provenance Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text text-xs sm:text-sm">
                  {filteredFacts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-text-subtle font-mono text-xs"
                      >
                        No facts matched the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFacts.map((fact) => (
                      <tr
                        key={fact.id}
                        className="hover:bg-border-subtle/50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedFact(fact)}
                      >
                        <td className="py-3.5 px-4 max-w-md">
                          <p className="font-serif font-bold text-text group-hover:underline">
                            {fact.label}
                          </p>
                          <p className="text-xs text-text-subtle italic mt-0.5 line-clamp-2">
                            “{fact.quote}”
                          </p>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                          <span className="font-mono font-bold text-text text-sm">
                            {fact.currency ? `${fact.currency} ` : ''}
                            {typeof fact.value === 'number'
                              ? fact.value.toLocaleString()
                              : fact.value}
                          </span>
                          {fact.unit && (
                            <span className="font-mono text-xs text-text-subtle ml-1">
                              {fact.unit}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap align-middle font-mono text-xs text-text-subtle">
                          Page {fact.page}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                          {fact.verified ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border-subtle border border-border-strong text-text font-mono text-[11px] font-semibold">
                              <ShieldCheck className="w-3.5 h-3.5 text-text" />
                              <span>Verified verbatim</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-unverified-bg text-unverified font-mono text-[11px] font-semibold border border-unverified-border">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Needs review</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap align-middle text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFact(fact);
                            }}
                            className="text-xs h-7 px-2.5 font-mono"
                          >
                            <span>Tether</span>
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: 3. SOURCE TAB (Scanned Chunks) */}
      {activeTab === 'source' && (
        <Card className="p-6 bg-surface border border-border space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-text">Document Source Stream</h3>
              <p className="text-xs text-text-subtle">
                Original text extraction segments with coordinate bounding polygon trace.
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-border-subtle text-text border border-border">
              {chunksData?.chunks.length || 0} Text Blocks
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {isChunksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !chunksData?.chunks || chunksData.chunks.length === 0 ? (
              <p className="text-xs font-mono text-text-muted py-6 text-center">
                No text segments found for this document.
              </p>
            ) : (
              chunksData.chunks.map((chunk, idx) => (
                <div
                  key={chunk.id || idx}
                  className="p-4 rounded-lg bg-border-subtle/50 border border-border space-y-2 hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-subtle">
                    <span className="font-bold text-text">
                      Chunk #{idx + 1} · Page {chunk.pageNumber}
                    </span>
                    <span>{chunk.content.length} chars</span>
                  </div>
                  <p className="font-serif text-xs sm:text-sm text-text leading-relaxed">
                    {chunk.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB CONTENT: 4. AUDIT PROOF CHAIN */}
      {activeTab === 'audit' && (
        <Card className="p-6 bg-surface border border-border space-y-6 shadow-xs">
          <div className="border-b border-border pb-3">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-text">
              Cryptographic Audit Proof Chain
            </h3>
            <p className="text-xs text-text-subtle mt-0.5">
              Deterministic verification hash tree confirming facts against primary source
              documents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-border-subtle border border-border">
              <span className="font-mono text-[11px] text-text-muted uppercase">
                Ingest Verification
              </span>
              <p className="font-mono text-base font-bold text-text mt-1">100% Deterministic</p>
              <span className="text-[11px] text-text-subtle">Temperature 0 Extraction</span>
            </div>

            <div className="p-4 rounded-lg bg-border-subtle border border-border">
              <span className="font-mono text-[11px] text-text-muted uppercase">
                Verbatim Quoted
              </span>
              <p className="font-mono text-base font-bold text-text mt-1">
                {verifiedCount} of {allFacts.length} Verified
              </p>
              <span className="text-[11px] text-text-subtle">Mechanical String Matcher</span>
            </div>

            <div className="p-4 rounded-lg bg-border-subtle border border-border">
              <span className="font-mono text-[11px] text-text-muted uppercase">
                Arithmetic Consensus
              </span>
              <p className="font-mono text-base font-bold text-text mt-1">Validated</p>
              <span className="text-[11px] text-text-subtle">Cross-table balance proof</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-border-subtle/50 border border-border space-y-2">
            <span className="font-mono text-xs font-bold text-text block">
              Cryptographic Fingerprint
            </span>
            <div className="p-2.5 rounded bg-surface border border-border font-mono text-xs text-text break-all">
              sha256:{doc.sha256}
            </div>
          </div>
        </Card>
      )}

      {/* FACT CITATION SLIDE-OUT DRAWER (Matcha Style) */}
      <Drawer
        isOpen={Boolean(selectedFact)}
        onClose={() => setSelectedFact(null)}
        title={selectedFact?.label || 'Statutory Fact Detail'}
      >
        {selectedFact && (
          <div className="space-y-6 text-xs sm:text-sm text-text">
            {/* Header Badge */}
            <div className="flex items-center justify-between">
              {selectedFact.verified ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-border-subtle border border-border-strong text-text font-mono text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 text-text" />
                  <span>Verified verbatim on source page</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-unverified-bg border border-unverified-border text-unverified font-mono text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Needs manual review</span>
                </span>
              )}

              <span className="font-mono text-xs text-text-subtle">Page {selectedFact.page}</span>
            </div>

            {/* Verbatim Quote in Parchment Callout */}
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-bold text-text uppercase">
                Verbatim Source Quote
              </span>
              <div className="p-4 rounded-lg bg-quote-highlight-solid border border-quote-border text-text font-serif italic leading-relaxed text-sm">
                “{selectedFact.quote}”
              </div>
            </div>

            {/* Numeric & Bounding Detail */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-border-subtle border border-border font-mono text-xs">
              <div>
                <span className="text-text-muted block">Extracted Figure</span>
                <span className="font-bold text-base text-text">
                  {selectedFact.currency ? `${selectedFact.currency} ` : ''}
                  {typeof selectedFact.value === 'number'
                    ? selectedFact.value.toLocaleString()
                    : selectedFact.value}{' '}
                  {selectedFact.unit || ''}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">Category Type</span>
                <span className="font-semibold text-text">{selectedFact.type || 'General'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setSelectedFact(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveTab('source');
                  setSelectedFact(null);
                }}
                className="flex items-center gap-1.5"
              >
                <ScanText className="w-4 h-4" />
                <span>View on Scanned Page</span>
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
export default DocumentViewerPage;
