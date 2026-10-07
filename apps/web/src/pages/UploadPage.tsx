import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadDocument } from '../lib/api.js';
import { Button, Card, Toast } from '../components/ui/index.js';
import { UploadCloud, FileText, Loader2, ShieldAlert } from 'lucide-react';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const validateAndSetFile = (file: File) => {
    setValidationError(null);

    // 1. Check extension and MIME type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setValidationError('Only PDF documents are supported for fact extraction and verification.');
      return;
    }

    // 2. Check maximum size (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setValidationError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB limit.`,
      );
      return;
    }

    setSelectedFile(file);
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
      if (file) validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file) validateAndSetFile(file);
    }
  };

  const handleUploadSubmit = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text">
          Upload Civic & Legal Document
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Upload municipal budgets, parliamentary bills, or legal agreements for automated fact
          extraction and quotation verification.
        </p>
      </div>

      {validationError && (
        <Toast
          type="error"
          title="Upload Error"
          message={validationError}
          onDismiss={() => setValidationError(null)}
        />
      )}

      <Card className="border-2 border-dashed border-border p-6 sm:p-10 transition-colors">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer transition-all ${
            isDragging
              ? 'bg-accent-teal/10 border-2 border-accent-teal'
              : 'hover:bg-surface-raised/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="p-4 rounded-full bg-surface-raised border border-border text-brand-navy dark:text-brand-navy-hover mb-4 shadow-sm">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-semibold text-text text-center">
            {isDragging ? 'Drop your PDF here' : 'Click to select or drag and drop your PDF'}
          </h3>
          <p className="text-xs text-text-subtle text-center mt-1">
            Standard PDF documents up to 50 MB (Latin text, scanned, or tables)
          </p>
        </div>

        {selectedFile && (
          <div className="mt-6 p-4 rounded-lg bg-surface border border-border flex items-center justify-between">
            <div className="flex items-center gap-3 truncate">
              <div className="p-2 rounded bg-surface-raised text-accent-teal">
                <FileText className="w-5 h-5" />
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-text truncate">{selectedFile.name}</p>
                <p className="text-xs text-text-subtle">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleUploadSubmit();
              }}
              disabled={uploadMutation.isPending}
              className="shrink-0 flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Start Ingestion</span>
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Trust & Policy Note */}
      <div className="p-4 rounded-lg bg-surface border border-border text-xs text-text-muted space-y-2">
        <div className="flex items-center gap-2 font-semibold text-text">
          <ShieldAlert className="w-4 h-4 text-accent-teal" />
          <span>Deterministic Verifiability Guarantee</span>
        </div>
        <p>
          Juris extracts facts with strict temperature 0 schemas, isolates every numeric value, and
          runs an in-code verifier to confirm that extracted text and numbers appear verbatim in the
          original document.
        </p>
      </div>
    </div>
  );
};
