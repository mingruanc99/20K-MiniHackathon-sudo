// src/components/knowledge/RegionInspector.tsx
/**
 * Page-by-page view of located visual regions (the "khoanh vùng" step before OCR).
 * - PDF pages are rendered for real; PPTX slides are rebuilt from shape boxes + embedded media
 * - regions are overlaid and colored by OCR status; users can switch regions off, draw new ones,
 *   and re-run OCR on the selection
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crop, EyeOff, Eye, RefreshCw, Trash2, ScanText, Loader2 } from 'lucide-react';
import { CanonicalDocumentTree, VisualRegion } from '../../types';
import { regionAssetStore } from '../../pipeline/module1_extractor/regionAssets';
import type { OcrPreference } from '../../pipeline/module1_extractor/visualRegionOcr';

interface Props {
  docTree: CanonicalDocumentTree;
  sourceReady: boolean;
  busy: boolean;
  onChange: (regions: VisualRegion[]) => void;
  onRunOcr: (regionIds: string[], preference: OcrPreference) => void;
}

const STATUS_STYLE: Record<string, { box: string; chip: string; label: string }> = {
  done: { box: 'border-print bg-print/10', chip: 'bg-paper-band text-print', label: 'Đã đọc' },
  pending: { box: 'border-pen bg-pen/10', chip: 'bg-pen-soft text-pen', label: 'Chờ OCR' },
  failed: { box: 'border-pen bg-pen/10', chip: 'bg-pen-soft text-pen', label: 'Lỗi' },
  skipped: { box: 'border-rule-strong bg-rule-strong/10', chip: 'bg-paper-band text-ink-soft', label: 'Bỏ qua' }
};

const KIND_LABEL: Record<string, string> = {
  picture: 'Ảnh',
  table: 'Bảng',
  chart: 'Biểu đồ',
  diagram: 'Sơ đồ',
  smartart: 'SmartArt',
  scanned_page: 'Trang scan',
  manual: 'Vùng tự vẽ'
};

const statusOf = (r: VisualRegion) => r.ocr?.status || 'pending';

export const RegionInspector: React.FC<Props> = ({ docTree, sourceReady, busy, onChange, onRunOcr }) => {
  const regions = docTree.visual_regions || [];
  const pagesWithRegions = useMemo(() => new Set(regions.map((r) => r.page_number)), [regions]);
  const [page, setPage] = useState<number>(() => (regions[0]?.page_number ?? 1));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [preference, setPreference] = useState<OcrPreference>('auto');
  const [draft, setDraft] = useState<number[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<[number, number] | null>(null);

  const section = docTree.sections[page - 1];
  const pageRegions = regions.filter((r) => r.page_number === page);
  const selected = regions.find((r) => r.region_id === selectedId) || null;
  const aspect = docTree.page_aspect || 16 / 9;

  // Real page preview when the source is attached.
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (!sourceReady) return;
    if (docTree.source_type === 'pdf') {
      regionAssetStore.renderPdfPage(docTree.document_id, page, 1.2).then((canvas) => {
        if (!cancelled && canvas) setPreview(canvas.toDataURL('image/jpeg', 0.8));
      });
    } else if (docTree.source_type === 'pptx') {
      pageRegions
        .filter((r) => r.asset_ref && !mediaUrls[r.asset_ref])
        .forEach((r) =>
          regionAssetStore.getMediaUrl(docTree.document_id, r.asset_ref!).then((url) => {
            if (!cancelled && url) setMediaUrls((m) => ({ ...m, [r.asset_ref!]: url }));
          })
        );
    }
    return () => {
      cancelled = true;
    };
  }, [page, sourceReady, docTree.document_id]);

  const toNorm = (e: React.MouseEvent): [number, number] => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))];
  };

  const finishDraw = () => {
    if (draft && draft[2] - draft[0] > 0.03 && draft[3] - draft[1] > 0.03 && section) {
      const n = regions.filter((r) => r.page_number === page).length + 1;
      const region: VisualRegion = {
        region_id: `${section.section_id}_rg_u${Date.now().toString(36)}_${n}`,
        section_id: section.section_id,
        page_number: page,
        kind: 'manual',
        bbox: draft.map((v) => Math.round(v * 1000) / 1000),
        source: 'user',
        ocr: { engine: 'gemini', status: 'pending' }
      };
      onChange([...regions, region]);
      setSelectedId(region.region_id);
    }
    dragStart.current = null;
    setDraft(null);
    setDrawMode(false);
  };

  const update = (id: string, patch: Partial<VisualRegion>) => onChange(regions.map((r) => (r.region_id === id ? { ...r, ...patch } : r)));
  const pendingIds = regions.filter((r) => !r.excluded && ['pending', 'failed'].includes(statusOf(r)) && r.ocr?.engine !== 'native').map((r) => r.region_id);

  return (
    <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_320px]">
      {/* Page list */}
      <div className="max-h-[640px] overflow-y-auto rounded-xl border border-rule bg-paper-sheet p-2">
        {docTree.sections.map((s, i) => {
          const count = regions.filter((r) => r.page_number === i + 1).length;
          return (
            <button
              key={s.section_id}
              type="button"
              onClick={() => {
                setPage(i + 1);
                setSelectedId(null);
              }}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                page === i + 1 ? 'bg-cover text-white' : 'text-ink-soft hover:bg-paper-band'
              }`}
            >
              <span className="w-6 shrink-0 font-mono tabular-nums opacity-70">{i + 1}</span>
              <span className="truncate flex-1">{s.title}</span>
              {count > 0 && (
                <span className={`rounded px-1.5 font-mono text-[11px] ${page === i + 1 ? 'bg-paper-sheet/20' : 'bg-paper-band text-ink-soft'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Page surface */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink">
            Trang {page}: <span className="font-normal text-ink-soft">{section?.title}</span>
          </span>
          <span className="ml-auto" />
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            Engine OCR
            <select
              value={preference}
              onChange={(e) => setPreference(e.target.value as OcrPreference)}
              className="rounded-lg border border-rule-strong bg-paper-sheet px-2 py-1 text-xs text-ink"
              title="Tự động: tesseract cho mọi vùng; Gemini chỉ đọc lại vài vùng tesseract chưa chắc chắn (tối đa 3 lần mỗi lượt)"
            >
              <option value="auto">Tự động</option>
              <option value="tesseract">Chỉ tesseract</option>
              <option value="gemini">Ưu tiên Gemini</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setDrawMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
              drawMode ? 'border-print bg-cover text-white' : 'border-rule-strong bg-paper-sheet text-ink-soft hover:bg-paper-band'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            {drawMode ? 'Kéo để khoanh vùng...' : 'Khoanh vùng mới'}
          </button>
          <button
            type="button"
            disabled={busy || pendingIds.length === 0 || !sourceReady}
            onClick={() => onRunOcr(pendingIds, preference)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cover px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cover disabled:opacity-40"
            title={!sourceReady ? 'Cần mở file nguồn để cắt ảnh' : undefined}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
            OCR {pendingIds.length} vùng chưa đọc
          </button>
        </div>

        <div
          ref={surfaceRef}
          className={`relative w-full overflow-hidden rounded-xl border border-rule-strong bg-paper-sheet ${drawMode ? 'cursor-crosshair' : ''}`}
          style={{ aspectRatio: String(aspect) }}
          onMouseDown={(e) => {
            if (!drawMode) return;
            const p = toNorm(e);
            dragStart.current = p;
            setDraft([p[0], p[1], p[0], p[1]]);
          }}
          onMouseMove={(e) => {
            if (!drawMode || !dragStart.current) return;
            const [x0, y0] = dragStart.current;
            const [x1, y1] = toNorm(e);
            setDraft([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]);
          }}
          onMouseUp={() => drawMode && finishDraw()}
          onMouseLeave={() => drawMode && dragStart.current && finishDraw()}
        >
          {preview ? (
            <img src={preview} alt={`Trang ${page}`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          ) : (
            // Schematic from element boxes (works without the source file).
            section?.elements
              .filter((el) => el.bbox && !el.region_id)
              .map((el) => (
                <div
                  key={el.element_id}
                  className="absolute overflow-hidden rounded border border-dashed border-rule-strong px-1 text-[11px] leading-tight text-ink-faint"
                  style={{ left: `${el.bbox![0] * 100}%`, top: `${el.bbox![1] * 100}%`, width: `${(el.bbox![2] - el.bbox![0]) * 100}%`, height: `${(el.bbox![3] - el.bbox![1]) * 100}%` }}
                >
                  {el.text}
                </div>
              ))
          )}

          {pageRegions.map((r) => {
            const st = STATUS_STYLE[statusOf(r)] || STATUS_STYLE.pending;
            const media = r.asset_ref ? mediaUrls[r.asset_ref] : undefined;
            return (
              <button
                key={r.region_id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!drawMode) setSelectedId(r.region_id);
                }}
                className={`absolute border-2 ${r.excluded ? 'border-dashed border-rule-strong bg-rule/40' : st.box} ${selectedId === r.region_id ? 'ring-2 ring-print ring-offset-1' : ''}`}
                style={{ left: `${r.bbox[0] * 100}%`, top: `${r.bbox[1] * 100}%`, width: `${(r.bbox[2] - r.bbox[0]) * 100}%`, height: `${(r.bbox[3] - r.bbox[1]) * 100}%` }}
                title={`${KIND_LABEL[r.kind] || r.kind} • ${st.label}`}
              >
                {media && !preview && <img src={media} alt="" className="h-full w-full object-contain opacity-90" draggable={false} />}
                <span className={`absolute left-0 top-0 rounded-br px-1 text-[11px] font-semibold ${st.chip}`}>{KIND_LABEL[r.kind] || r.kind}</span>
              </button>
            );
          })}

          {draft && (
            <div
              className="absolute border-2 border-print bg-print"
              style={{ left: `${draft[0] * 100}%`, top: `${draft[1] * 100}%`, width: `${(draft[2] - draft[0]) * 100}%`, height: `${(draft[3] - draft[1]) * 100}%` }}
            />
          )}
        </div>

        {!sourceReady && (
          <p className="text-xs text-pen">
            Chưa mở file nguồn: đang hiển thị sơ đồ bố cục từ toạ độ đã lưu. Mở file nguồn để xem trang thật và OCR lại.
          </p>
        )}
        {pagesWithRegions.size === 0 && <p className="text-xs text-ink-faint">Tài liệu này không có vùng ảnh/bảng/sơ đồ nào được phát hiện. Bạn có thể tự khoanh vùng.</p>}
      </div>

      {/* Region details */}
      <div className="rounded-xl border border-rule bg-paper-sheet p-4 text-xs">
        {!selected ? (
          <div className="space-y-2 text-ink-faint">
            <p className="font-semibold text-ink-soft">Chọn một vùng để xem kết quả đọc.</p>
            <ul className="space-y-1">
              {Object.entries(STATUS_STYLE).map(([k, v]) => (
                <li key={k} className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${v.chip}`}>{v.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">{KIND_LABEL[selected.kind] || selected.kind}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${(STATUS_STYLE[statusOf(selected)] || STATUS_STYLE.pending).chip}`}>
                {(STATUS_STYLE[statusOf(selected)] || STATUS_STYLE.pending).label}
              </span>
              <span className="ml-auto font-mono text-[11px] text-ink-faint">{selected.ocr?.engine}</span>
            </div>

            {selected.ocr?.summary && <p className="text-ink-soft">{selected.ocr.summary}</p>}
            {selected.ocr?.error && <p className="text-pen">{selected.ocr.error}</p>}

            {selected.ocr?.table?.length ? (
              <div className="max-h-56 overflow-auto rounded-lg border border-rule">
                <table className="w-full text-xs">
                  <tbody>
                    {selected.ocr.table.slice(0, 30).map((row, i) => (
                      <tr key={i} className={i === 0 ? 'bg-paper-band font-semibold' : 'border-t border-rule'}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 align-top text-ink-soft">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {selected.ocr?.nodes?.length ? (
              <div>
                <div className="mb-1 font-semibold text-ink-soft">Thành phần sơ đồ</div>
                <div className="flex flex-wrap gap-1">
                  {selected.ocr.nodes.map((n, i) => (
                    <span key={i} className="rounded bg-paper-band px-1.5 py-0.5 text-xs text-ink-soft">
                      {n}
                    </span>
                  ))}
                </div>
                {selected.ocr.edges?.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {selected.ocr.edges.slice(0, 12).map((e, i) => (
                      <li key={i}>
                        {e.from} → {e.to}
                        {e.label ? ` (${e.label})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {!selected.ocr?.table?.length && !selected.ocr?.nodes?.length && selected.ocr?.text && (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-paper-band p-2 text-xs text-ink-soft">{selected.ocr.text}</pre>
            )}

            <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
              <button
                type="button"
                onClick={() => update(selected.region_id, { excluded: !selected.excluded })}
                className="inline-flex items-center gap-1 rounded-lg border border-rule-strong px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-paper-band"
              >
                {selected.excluded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {selected.excluded ? 'Bật lại' : 'Tắt vùng này'}
              </button>
              {selected.ocr?.engine !== 'native' && (
                <button
                  type="button"
                  disabled={busy || !sourceReady || selected.excluded}
                  onClick={() => {
                    update(selected.region_id, { ocr: { engine: selected.ocr?.engine || 'gemini', status: 'pending' } });
                    onRunOcr([selected.region_id], preference);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-rule-strong px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-paper-band disabled:opacity-40"
                >
                  <RefreshCw className="w-3 h-3" /> OCR lại
                </button>
              )}
              {selected.source === 'user' && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(regions.filter((r) => r.region_id !== selected.region_id));
                    setSelectedId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-pen-line px-2 py-1 text-xs font-semibold text-pen hover:bg-pen-soft"
                >
                  <Trash2 className="w-3 h-3" /> Xoá
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
