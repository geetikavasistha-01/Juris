import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_MAX_FILE_SIZE_BYTES } from '@juris/shared';
import { uploadDocument } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { Button, Card, Toast } from '../components/ui/index.js';
import {
  UploadCloud,
  FileText,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Calculator,
  Sigma,
  AlertTriangle,
  GitCompare,
  ScanText,
  FileSpreadsheet,
  MapPin,
  Image as ImageIcon,
  ArrowRight,
  ChevronDown,
  Info,
  Sparkles,
  Gavel,
} from 'lucide-react';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signInAsGuest } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<
    'money' | 'timeline' | 'map' | 'table'
  >('money');

  const maxFileSizeMb = Math.round(DEFAULT_MAX_FILE_SIZE_BYTES / (1024 * 1024));

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      navigate(`/documents/${data.documentId}/progress`);
    },
    onError: (err: Error) => {
      setValidationError(
        err.message || 'Failed to upload document. Please check your network connection.',
      );
    },
  });

  const validateAndSetFile = async (file: File) => {
    setValidationError(null);

    const validExtensions = [
      '.pdf',
      '.csv',
      '.tsv',
      '.geojson',
      '.json',
      '.kml',
      '.gpx',
      '.png',
      '.jpg',
      '.jpeg',
      '.tiff',
      '.webp',
      '.xlsx',
    ];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!hasValidExt && !file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setValidationError(
        'Supported formats: PDF, CSV, TSV, GeoJSON, KML, PNG, JPG, TIFF, WebP, and Excel spreadsheets.',
      );
      return;
    }

    if (file.size > DEFAULT_MAX_FILE_SIZE_BYTES) {
      setValidationError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the ${maxFileSizeMb} MB limit.`,
      );
      return;
    }

    setSelectedFile(file);

    try {
      if (!user) {
        await signInAsGuest();
      }
      uploadMutation.mutate(file);
    } catch {
      // Retain selectedFile for manual submit fallback
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) void validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file) void validateAndSetFile(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    if (!user) {
      try {
        await signInAsGuest();
        uploadMutation.mutate(selectedFile);
      } catch {
        setValidationError('Please sign in or continue as guest to upload documents.');
      }
      return;
    }
    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-12">
      {/* 1. HERO SECTION */}
      <section className="w-full pt-2 pb-8 border-b border-border">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="flex items-center gap-2.5">
              <span className="font-serif font-bold text-2xl sm:text-3xl tracking-wider text-text uppercase">
                JURIS
              </span>
            </div>
            <div className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded bg-border-subtle border border-border">
              <span className="w-2 h-2 rounded-full bg-text"></span>
              <span className="font-mono text-xs text-text font-semibold tracking-normal">
                सार्वजनिक अभिलेख सत्यापन · Civic Provenance v2.4
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] text-text tracking-tight max-w-[640px]">
              Understand any public document in a minute.
            </h1>
            <p className="text-base sm:text-lg leading-relaxed text-text-subtle max-w-[580px]">
              Upload a PDF, image, spreadsheet or map. Juris turns it into clear visuals, and every
              number is checked against its source.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-text text-text-inverse font-semibold text-sm hover:opacity-90 transition-all shadow-sm cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload document</span>
              </button>
              <a
                href="#sample-datasets"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-border-subtle text-text font-semibold text-sm hover:bg-border transition-colors border border-border-strong"
              >
                <FileText className="w-4 h-4" />
                <span>Try a sample</span>
              </a>
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg text-text font-semibold text-sm hover:underline transition-colors"
              >
                <span>View Library</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1 text-xs text-text-subtle font-mono">
              <Sparkles className="w-3.5 h-3.5 text-text-muted" />
              <span>
                No account required for public records under 25 MB. Built for low-bandwidth
                connections.
              </span>
            </div>
          </div>

          {/* Right Column: Hero Artwork Placeholder & Interactive Ingest Dropzone */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center gap-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload PDF dropzone or multimodal files"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`group relative w-full flex flex-col items-center justify-center cursor-pointer transition-all p-2 rounded-2xl ${
                isDragging ? 'ring-4 ring-text ring-offset-4 ring-offset-bg' : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,.png,.jpg,.jpeg,.tiff,.csv,.tsv,.xlsx,.geojson,.kml,.gpx"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Large Transparent Lady Justice Provenance Artwork Placeholder */}
              <div className="relative w-full flex items-center justify-center">
                <img
                  src="/assets/hero-justice-cutout.png"
                  alt="Evidentiary provenance: balance of justice resting on civic law ledgers"
                  className="w-full max-h-[740px] object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                />

                {/* Drag-and-drop active overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-text/85 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-text-inverse p-6 animate-in fade-in z-10">
                    <UploadCloud className="w-16 h-16 mb-3 animate-bounce" />
                    <span className="font-serif text-2xl font-bold">
                      Release to Inspect Document
                    </span>
                    <span className="text-sm opacity-80 mt-1">PDF, Scans, CSV, XLSX, GeoJSON</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden description for accessibility & test contracts */}
            <p className="sr-only">
              Click or drag and drop your PDF or multimodal data files here. Standard PDF documents,
              scans, spreadsheets, and GIS maps up to 10MB.
            </p>

            {selectedFile && (
              <div className="p-3.5 rounded-lg bg-surface border border-border flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-text shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-text truncate">{selectedFile.name}</p>
                    <p className="text-[11px] font-mono text-text-subtle">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadSubmit();
                  }}
                  disabled={uploadMutation.isPending}
                  className="shrink-0 flex items-center gap-1.5"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {validationError && (
              <Toast
                type="error"
                title="Upload Error"
                message={validationError}
                onDismiss={() => setValidationError(null)}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. THREE-STEP CIVIC PROVENANCE STRIP */}
      <section className="w-full border border-border rounded-xl bg-border-subtle py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Step 1 */}
          <div className="flex items-start gap-4 px-4 py-3 md:py-0">
            <div className="w-10 h-10 rounded-lg bg-surface border border-border-strong flex items-center justify-center shrink-0 text-text font-serif font-bold text-base shadow-xs">
              01
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  Step 01
                </span>
                <h3 className="font-serif text-base font-bold text-text">Upload</h3>
              </div>
              <p className="text-xs leading-relaxed text-text-subtle mt-1">
                Drop any civic record, ledger scan, or land survey file in any layout.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 px-4 py-3 md:py-0">
            <div className="w-10 h-10 rounded-lg bg-surface border border-border-strong flex items-center justify-center shrink-0 text-text font-serif font-bold text-base shadow-xs">
              02
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  Step 02
                </span>
                <h3 className="font-serif text-base font-bold text-text">We check</h3>
              </div>
              <p className="text-xs leading-relaxed text-text-subtle mt-1">
                Juris reads every cell and confirms calculations against original printed scans.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 px-4 py-3 md:py-0">
            <div className="w-10 h-10 rounded-lg bg-surface border border-border-strong flex items-center justify-center shrink-0 text-text font-serif font-bold text-base shadow-xs">
              03
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  Step 03
                </span>
                <h3 className="font-serif text-base font-bold text-text">You see</h3>
              </div>
              <p className="text-xs leading-relaxed text-text-subtle mt-1">
                Interact with proven money flows, audited timelines, and verified GIS ward maps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INPUT VERSATILITY CARDS */}
      <section className="w-full space-y-6">
        <div className="space-y-1">
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Input Versatility
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text tracking-tight">
            What you can upload
          </h2>
          <p className="text-sm text-text-subtle">
            Accepted formats across municipal, legal, and statutory domains.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: PDF */}
          <Card className="p-5 flex flex-col justify-between space-y-4 hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-border-subtle border border-border flex items-center justify-center text-text">
                  <FileText className="w-5 h-5" />
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-border-subtle text-text border border-border">
                  .PDF · OCR
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-text">PDF Documents</h3>
              <p className="text-xs leading-relaxed text-text-subtle">
                Annual budgets, court judgments, legislative bills, gazettes, tender filings.
              </p>
            </div>
            <div className="pt-3 border-t border-border">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wide block">
                Civic Use Case
              </span>
              <p className="text-xs text-text mt-0.5">
                Scrutinizing High Court verdicts & whitepapers.
              </p>
            </div>
          </Card>

          {/* Card 2: Images & Scans */}
          <Card className="p-5 flex flex-col justify-between space-y-4 hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-border-subtle border border-border flex items-center justify-center text-text">
                  <ImageIcon className="w-5 h-5" />
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-border-subtle text-text border border-border">
                  .PNG .JPG .TIFF
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-text">Images & Scans</h3>
              <p className="text-xs leading-relaxed text-text-subtle">
                Scanned circulars, printed ledgers, camera photos of notice boards, multi-page
                TIFFs.
              </p>
            </div>
            <div className="pt-3 border-t border-border">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wide block">
                Civic Use Case
              </span>
              <p className="text-xs text-text mt-0.5">
                Digitizing physical panchayat resolution boards.
              </p>
            </div>
          </Card>

          {/* Card 3: Spreadsheets */}
          <Card className="p-5 flex flex-col justify-between space-y-4 hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-border-subtle border border-border flex items-center justify-center text-text">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-border-subtle text-text border border-border">
                  .CSV .XLSX .TSV
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-text">Spreadsheets</h3>
              <p className="text-xs leading-relaxed text-text-subtle">
                Treasury line items, procurement manifests, electoral rolls, census tables.
              </p>
            </div>
            <div className="pt-3 border-t border-border">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wide block">
                Civic Use Case
              </span>
              <p className="text-xs text-text mt-0.5">
                Cross-checking public tender bidder manifests.
              </p>
            </div>
          </Card>

          {/* Card 4: Maps & GIS */}
          <Card className="p-5 flex flex-col justify-between space-y-4 hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-border-subtle border border-border flex items-center justify-center text-text">
                  <MapPin className="w-5 h-5" />
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-border-subtle text-text border border-border">
                  .GEOJSON .KML
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-text">Maps & Spatial</h3>
              <p className="text-xs leading-relaxed text-text-subtle">
                Ward boundaries, zoning masterplans, infrastructure right-of-ways, land parcels.
              </p>
            </div>
            <div className="pt-3 border-t border-border">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wide block">
                Civic Use Case
              </span>
              <p className="text-xs text-text mt-0.5">
                Auditing encroachment buffer zones on survey parcels.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. FORENSIC WORKBENCH PREVIEW ("See It Work") */}
      <section className="w-full space-y-6" id="see-it-work">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
              Interactive Forensic Workbench
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text tracking-tight">
              See it work
            </h2>
            <p className="text-sm text-text-subtle">
              Explore how interactive visuals link each sentence directly to statutory source pages.
            </p>
          </div>
          <div className="inline-flex p-1 bg-border-subtle rounded-lg border border-border self-start md:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveWorkbenchTab('money')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeWorkbenchTab === 'money'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              Money flow
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkbenchTab('timeline')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeWorkbenchTab === 'timeline'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkbenchTab('map')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeWorkbenchTab === 'map'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkbenchTab('table')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeWorkbenchTab === 'table'
                  ? 'bg-text text-text-inverse shadow-xs'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        <Card className="overflow-hidden border border-border">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Visual Canvas */}
            <div className="lg:col-span-8 p-6 flex flex-col justify-between space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="font-mono text-[11px] text-text-muted uppercase tracking-wider">
                    Analysis Model · Capital Budget
                  </span>
                  <h3 className="font-serif text-lg font-bold text-text">
                    Capital Outlay Distribution — Urban Transit Infrastructure
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-border-subtle text-text font-mono text-xs border border-border">
                  FY 2025–26
                </span>
              </div>

              {/* Sankey / Flow diagram visualization */}
              <div className="w-full bg-border-subtle rounded-lg p-5 border border-border space-y-4">
                <div className="flex items-center justify-between font-mono text-xs text-text-subtle">
                  <span>SOURCE APPROPRIATION</span>
                  <span>STATUTORY DISBURSEMENTS</span>
                </div>

                <div className="space-y-3">
                  {/* Node 1: Metro Corridor */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 sm:w-36 shrink-0 text-right">
                      <span className="text-xs font-semibold text-text block">Total Grant</span>
                      <span className="font-mono text-xs text-text-subtle">₹14,800 Cr</span>
                    </div>
                    <div className="grow flex items-center">
                      <div className="h-8 w-full bg-text rounded text-text-inverse px-3 flex items-center justify-between ring-2 ring-text ring-offset-2 ring-offset-border-subtle">
                        <span className="text-xs font-medium truncate">
                          Phase-3 Metro Tunnel Works
                        </span>
                        <span className="font-mono font-bold text-xs ml-2">₹8,200 Cr (55.4%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Node 2: Electric Bus */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 sm:w-36 shrink-0 text-right">
                      <span className="text-xs text-text-subtle">Clean Transit Fund</span>
                    </div>
                    <div className="grow flex items-center">
                      <div className="h-7 w-[68%] bg-border-strong rounded text-text-inverse px-3 flex items-center justify-between">
                        <span className="text-xs font-medium truncate">
                          Electric Bus Deployment
                        </span>
                        <span className="font-mono font-bold text-xs ml-2">₹3,400 Cr (23.0%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Node 3: Feeder Stations */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 sm:w-36 shrink-0 text-right">
                      <span className="text-xs text-text-subtle">Suburban Junctions</span>
                    </div>
                    <div className="grow flex items-center">
                      <div className="h-6 w-[44%] bg-brand-navy-hover rounded text-text-inverse px-3 flex items-center justify-between">
                        <span className="text-xs font-medium truncate">
                          Feeder Station Upgrades
                        </span>
                        <span className="font-mono font-bold text-xs ml-2">₹2,100 Cr (14.2%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Node 4: Contingency */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 sm:w-36 shrink-0 text-right">
                      <span className="text-xs text-text-subtle">Statutory Escrow</span>
                    </div>
                    <div className="grow flex items-center">
                      <div className="h-6 w-[24%] bg-surface rounded text-text px-3 flex items-center justify-between border border-border-strong">
                        <span className="text-xs font-medium truncate">Contingency Reserve</span>
                        <span className="font-mono font-bold text-xs ml-2">₹1,100 Cr (7.4%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-text-subtle">
                  <span>
                    Primary Reference: Mumbai Urban Transport Project (MUTP-3B) Schedule IV
                  </span>
                  <span className="font-mono font-semibold text-text">
                    Tabular Sum: ₹14,800.00 Cr · 100% Validated
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-border-subtle border border-border text-xs text-text">
                <CheckCircle2 className="w-4 h-4 text-text shrink-0" />
                <div>
                  <strong>Active coordinate tether:</strong> Bounding box [x:142, y:890, w:410,
                  h:65] on page 22 gazette scan matches <strong>₹8,200 Cr</strong> metro allocation.
                </div>
              </div>
            </div>

            {/* Right Side: Plain-Language Summary with Provenance */}
            <div className="lg:col-span-4 bg-border-subtle/40 border-t lg:border-t-0 lg:border-l border-border p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="border-b border-border pb-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                    Provenance Trail
                  </span>
                  <h4 className="font-serif text-base font-bold text-text">
                    Plain-Language Summary
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-surface border border-border hover:border-text transition-colors">
                    <p className="text-xs leading-relaxed text-text">
                      “The municipal transit outlay rose by 14.2% year-on-year, driven primarily by
                      Phase 3 metro tunnel civil works.”
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border text-text text-[10px] font-mono uppercase">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified · Page 18</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-text-subtle" />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-surface border border-border-strong shadow-xs">
                    <p className="text-xs leading-relaxed text-text font-medium">
                      “₹8,200 Crore is earmarked exclusively for grade-separated rail corridor
                      contracts.”
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border-strong text-text text-[10px] font-mono uppercase font-semibold">
                        <ScanText className="w-3 h-3" />
                        <span>Verified from scan · Page 22</span>
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-text" />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-surface border border-border hover:border-text transition-colors">
                    <p className="text-xs leading-relaxed text-text">
                      “Electric bus fleet subsidies increased by ₹450 Crore to satisfy clean air
                      targets.”
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border text-text text-[10px] font-mono uppercase">
                        <Calculator className="w-3 h-3" />
                        <span>Calculated · Page 31, Item 4</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-text-subtle" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-unverified-bg border border-unverified-border text-unverified text-[11px] flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Click any sentence above to jump directly to the verified coordinate bounding box.
                </span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 5. SAMPLE DATASETS SECTION */}
      <section className="w-full space-y-6" id="sample-datasets">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-text">
              No file handy? Try a sample
            </h3>
            <p className="text-xs sm:text-sm text-text-subtle mt-0.5">
              Inspect pre-verified civic datasets with verified source citations.
            </p>
          </div>
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider mt-1 md:mt-0">
            Pre-computed artifacts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sample 1 */}
          <Card className="p-6 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-border-subtle text-text font-mono text-xs font-semibold">
                  PDF · 42 pages
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-border-subtle border border-border-strong text-text font-mono text-[11px]">
                  <ShieldCheck className="w-3 h-3 text-text" />
                  <span>VERIFIED · P. 42</span>
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-text leading-snug">
                Municipal Capital Budget FY2025–26
              </h4>
              <p className="text-xs text-text-subtle leading-relaxed">
                Brihanmumbai Municipal Corporation urban transit & infrastructure expenditure
                schedule.
              </p>
            </div>
            <div className="pt-4 border-t border-border flex items-center justify-between mt-4">
              <span className="font-mono text-[11px] text-text-subtle">BMC-2025-C8</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/documents')}
                className="flex items-center gap-1 text-xs"
              >
                <span>Inspect Docket</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </Card>

          {/* Sample 2 */}
          <Card className="p-6 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-border-subtle text-text font-mono text-xs font-semibold">
                  CSV · 1,480 rows
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border-strong text-text font-mono text-[11px]">
                  <Calculator className="w-3 h-3" />
                  <span>CALCULATED · 14 COL</span>
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-text leading-snug">
                Public Health Procurement Manifest
              </h4>
              <p className="text-xs text-text-subtle leading-relaxed">
                Line-item vendor disbursements, hospital medical equipment, and statutory audit
                caps.
              </p>
            </div>
            <div className="pt-4 border-t border-border flex items-center justify-between mt-4">
              <span className="font-mono text-[11px] text-text-subtle">PH-9942</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/documents')}
                className="flex items-center gap-1 text-xs"
              >
                <span>Inspect Table</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </Card>

          {/* Sample 3 */}
          <Card className="p-6 flex flex-col justify-between hover:border-border-strong transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-border-subtle text-text font-mono text-xs font-semibold">
                  GeoJSON · 24 wards
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-border-subtle border border-border-strong text-text font-mono text-[11px]">
                  <MapPin className="w-3 h-3 text-text" />
                  <span>POLYGON · GIS</span>
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-text leading-snug">
                Ward Infrastructure Spatial Density
              </h4>
              <p className="text-xs text-text-subtle leading-relaxed">
                Geospatial ward boundaries cross-checked with municipal capital work allocation
                maps.
              </p>
            </div>
            <div className="pt-4 border-t border-border flex items-center justify-between mt-4">
              <span className="font-mono text-[11px] text-text-subtle">GIS-MUM-24</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/documents')}
                className="flex items-center gap-1 text-xs"
              >
                <span>Inspect Map</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 6. HOW WE PROVE EVERY NUMBER (Badge Taxonomy) */}
      <section className="w-full space-y-6">
        <div className="space-y-1">
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Forensic Rigor
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text tracking-tight">
            How we prove every number
          </h2>
          <p className="text-sm text-text-subtle">
            Every metric carries an evidentiary status badge with its own symbol, label, and border
            style.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 space-y-2">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-border-subtle border border-border-strong text-text text-[11px] font-mono uppercase font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">Direct Verbatim Match</h4>
            <p className="text-xs text-text-subtle">
              Exact printed figure matches the primary document verbatim without transformation.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border-strong text-text text-[11px] font-mono uppercase font-semibold">
              <ScanText className="w-3.5 h-3.5" />
              <span>Verified from scan</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">OCR Coordinate Trace</h4>
            <p className="text-xs text-text-subtle">
              Recognized from photograph or physical paper scan with full polygon OCR coordinates.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border-strong text-text text-[11px] font-mono uppercase font-semibold">
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculated</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">Arithmetic Proof</h4>
            <p className="text-xs text-text-subtle">
              Sum, ratio, or variance computed directly from confirmed line items inside the table.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-border-subtle border border-border-strong text-text text-[11px] font-mono uppercase font-semibold">
              <Sigma className="w-3.5 h-3.5" />
              <span>Derived</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">Cross-Section Aggregate</h4>
            <p className="text-xs text-text-subtle">
              Synthesized across multiple isolated document chapters or statutory appendices.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-dashed border-border-strong text-text text-[11px] font-mono uppercase font-semibold">
              <Info className="w-3.5 h-3.5" />
              <span>Estimated</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">Provisional Disclosure</h4>
            <p className="text-xs text-text-subtle">
              Provisional or modeled figure reported prior to final Comptroller audit certification.
            </p>
          </Card>

          <Card className="p-4 space-y-2 bg-unverified-bg/50 border-unverified-border">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-unverified-bg border border-dashed border-unverified text-unverified text-[11px] font-mono uppercase font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Needs review</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">Scan Ambiguity Flag</h4>
            <p className="text-xs text-text">
              Potential scanning discrepancy or ambiguous tabular alignment requiring human
              inspection.
            </p>
          </Card>

          <Card className="p-4 space-y-2 sm:col-span-2 border-2 border-text">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border-2 border-double border-text text-text text-[11px] font-mono uppercase font-semibold">
              <GitCompare className="w-3.5 h-3.5" />
              <span>Conflict Detected</span>
            </div>
            <h4 className="font-serif text-sm font-bold text-text">
              Statutory Statement Contradiction
            </h4>
            <p className="text-xs text-text-subtle">
              Discrepancy identified between an executive summary statement and the detailed
              statutory ledger schedule.
            </p>
          </Card>
        </div>
      </section>

      {/* 7. FAQ ACCORDION */}
      <section className="w-full space-y-4">
        <div className="space-y-1">
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Clear Answers
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text tracking-tight">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          <details
            className="group bg-surface rounded-xl border border-border open:border-text transition-colors"
            open
          >
            <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer list-none select-none font-serif font-bold text-sm sm:text-base text-text">
              <span>Are my uploaded documents kept private?</span>
              <ChevronDown className="w-4 h-4 text-text group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-border text-xs sm:text-sm text-text-subtle leading-relaxed">
              Yes. Documents are processed in an isolated ephemeral sandbox. We never train
              generative AI models on user uploads, and public records remain strictly in your
              active browser session unless you explicitly publish an audit dossier to the public
              archive.
            </div>
          </details>

          <details className="group bg-surface rounded-xl border border-border open:border-text transition-colors">
            <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer list-none select-none font-serif font-bold text-sm sm:text-base text-text">
              <span>Which languages does Juris support?</span>
              <ChevronDown className="w-4 h-4 text-text group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-border text-xs sm:text-sm text-text-subtle leading-relaxed">
              Juris provides full first-class support for English and Hindi (including complex
              Devanagari script legibility and Indic tabular numbers). Regional language support
              across Marathi, Tamil, Bengali, and Telugu is currently operational across judicial
              and gazette corpora.
            </div>
          </details>

          <details className="group bg-surface rounded-xl border border-border open:border-text transition-colors">
            <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer list-none select-none font-serif font-bold text-sm sm:text-base text-text">
              <span>How does Juris prevent AI hallucinations?</span>
              <ChevronDown className="w-4 h-4 text-text group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-border text-xs sm:text-sm text-text-subtle leading-relaxed">
              Juris does not invent or guess statistics. Every metric must be directly tethered to
              bounding box coordinates on the source document scan. If a figure cannot be
              deterministically proven through OCR coordinates or arithmetic derivation, it is
              automatically marked with an evidentiary warning badge.
            </div>
          </details>
        </div>
      </section>

      {/* 8. CALL TO ACTION & CIVIC DISCLAIMER */}
      <section className="w-full pt-4 pb-8">
        <div className="bg-unverified-bg rounded-xl border border-unverified-border p-6 sm:p-10 text-center flex flex-col items-center space-y-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border text-text text-[11px] font-mono uppercase font-semibold">
            <Gavel className="w-3.5 h-3.5 text-text" />
            <span>Public Domain Tooling</span>
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text max-w-xl">
            Bring evidentiary clarity to your public records.
          </h2>
          <p className="text-xs sm:text-sm text-text-subtle max-w-md">
            Join citizens, data journalists, research scholars, and urban analysts who rely on
            verified facts.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Record Now</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Browse Archive Library</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
