import React, { useState, useMemo } from 'react';
import {
  type ParsedGeospatialDataset,
  type GeoFeature,
  projectCoordinatesToSVGPath,
  NEUTRAL_BOUNDARY_DISCLAIMER,
  GEODATA_ATTRIBUTION,
} from '@juris/shared';
import { MapPin, Info, AlertTriangle, Layers } from 'lucide-react';

export interface GeospatialMapProps {
  dataset: ParsedGeospatialDataset;
  title?: string;
  selectedMetric?: string;
  className?: string;
}

// 6 discrete steps for choropleth rendering using Juris canonical design tokens
const CHOROPLETH_SHADES = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
];

export const GeospatialMap: React.FC<GeospatialMapProps> = ({
  dataset,
  title = 'Geospatial Intelligence Map',
  selectedMetric,
  className = '',
}) => {
  // Discover all numeric properties available for visualization
  const numericKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of dataset.features) {
      for (const [k, v] of Object.entries(f.properties)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          keys.add(k);
        }
      }
    }
    return Array.from(keys);
  }, [dataset]);

  const [activeMetric, setActiveMetric] = useState<string>(
    selectedMetric || (numericKeys.length > 0 ? numericKeys[0] || '' : ''),
  );
  const [hoveredFeature, setHoveredFeature] = useState<GeoFeature | null>(null);

  // Compute min, max, and quantiles for choropleth styling
  const { minVal, maxVal, valueRanges } = useMemo(() => {
    if (!activeMetric) return { minVal: 0, maxVal: 1, valueRanges: [] };
    const values: number[] = [];
    for (const f of dataset.features) {
      const v = f.properties[activeMetric];
      if (typeof v === 'number') values.push(v);
    }
    if (values.length === 0) return { minVal: 0, maxVal: 1, valueRanges: [] };
    values.sort((a, b) => a - b);
    const min = values[0] || 0;
    const max = values[values.length - 1] || 1;
    const step = (max - min) / 6;
    const ranges = Array.from({ length: 6 }, (_, i) => ({
      min: min + i * step,
      max: min + (i + 1) * step,
      color: CHOROPLETH_SHADES[i]!,
    }));
    return { minVal: min, maxVal: max, valueRanges: ranges };
  }, [dataset, activeMetric]);

  const getColorForValue = (val: number | undefined): string => {
    if (val === undefined || isNaN(val)) return 'var(--surface-raised)';
    if (maxVal === minVal) return CHOROPLETH_SHADES[2]!;
    const normalized = Math.min(
      5,
      Math.max(0, Math.floor(((val - minVal) / (maxVal - minVal || 1)) * 6)),
    );
    return CHOROPLETH_SHADES[normalized]!;
  };

  return (
    <div
      className={`juris-geospatial-card rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm ${className}`}
      data-testid="geospatial-map"
    >
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h3 className="text-lg font-serif font-semibold text-[var(--text)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent-teal)]" />
            {title}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Format: {dataset.format.toUpperCase()} | Features: {dataset.featureCount} | Offline
            Vector Renderer
          </p>
        </div>

        {numericKeys.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="metric-select" className="text-xs font-medium text-[var(--text-muted)]">
              Metric:
            </label>
            <select
              id="metric-select"
              value={activeMetric}
              onChange={(e) => setActiveMetric(e.target.value)}
              className="text-xs rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[var(--text)]"
            >
              {numericKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Ambiguous place names alert if present */}
      {dataset.flaggedAmbiguities.length > 0 && (
        <div className="mb-4 rounded-md border border-[var(--unverified-border)] bg-[var(--unverified-bg)] p-3 text-xs text-[var(--unverified)] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Ambiguous Places Flagged:</span>
            <ul className="list-disc pl-4 mt-1">
              {dataset.flaggedAmbiguities.map((a, i) => (
                <li key={i}>
                  &quot;{a.query}&quot; matches {a.candidates.join(' / ')} (Manual jurisdiction
                  disambiguation required)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Pure Vector Map SVG Renderer (Zero External Tile Servers) */}
      <div className="relative w-full aspect-[16/10] bg-[var(--bg)] rounded-md border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full object-contain"
          role="img"
          aria-label="Vector Choropleth Map"
        >
          {/* Base geometries */}
          {dataset.features.map((feature) => {
            if (!feature.geometry) return null;
            const pathData = projectCoordinatesToSVGPath(
              feature.geometry,
              dataset.bbox,
              800,
              500,
              24,
            );
            if (!pathData) return null;

            const val = activeMetric
              ? (feature.properties[activeMetric] as number | undefined)
              : undefined;
            const fillColor = getColorForValue(val);
            const isHovered = hoveredFeature?.id === feature.id;

            return (
              <path
                key={feature.id}
                d={pathData}
                fill={fillColor}
                stroke={isHovered ? 'var(--text)' : 'var(--border)'}
                strokeWidth={isHovered ? 2.5 : 1}
                className="transition-all duration-150 cursor-pointer hover:opacity-90"
                onMouseEnter={() => setHoveredFeature(feature)}
                onMouseLeave={() => setHoveredFeature(null)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredFeature && (
          <div className="absolute bottom-3 left-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded shadow-lg p-2.5 max-w-xs text-xs pointer-events-none z-10">
            <div className="font-semibold text-[var(--text)] flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
              {String(hoveredFeature.properties.name || hoveredFeature.id)}
            </div>
            {activeMetric && (
              <div className="text-[var(--text-muted)] font-mono">
                {activeMetric}: {String(hoveredFeature.properties[activeMetric] ?? 'N/A')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {valueRanges.length > 0 && activeMetric && (
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
          <span>Min: {minVal.toLocaleString()}</span>
          <div className="flex gap-1 items-center">
            {valueRanges.map((r, i) => (
              <div
                key={i}
                className="w-6 h-3 rounded-sm border border-[var(--border)]"
                style={{ backgroundColor: r.color }}
                title={`${r.min.toFixed(0)} - ${r.max.toFixed(0)}`}
              />
            ))}
          </div>
          <span>Max: {maxVal.toLocaleString()}</span>
        </div>
      )}

      {/* Mandatory Cartographic Footer: Neutral Boundary Disclaimer & Attribution */}
      <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] flex flex-col gap-1">
        <p className="flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0 text-[var(--text-muted)]" />
          <span>{NEUTRAL_BOUNDARY_DISCLAIMER}</span>
        </p>
        <p className="pl-4">{GEODATA_ATTRIBUTION}</p>
      </div>
    </div>
  );
};
