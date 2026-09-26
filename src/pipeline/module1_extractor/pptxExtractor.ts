// src/pipeline/module1_extractor/pptxExtractor.ts
/**
 * Rule-based PPTX Extractor (zero-LLM).
 *
 * Walks the real shape tree of every slide (DrawingML) instead of regex-scanning text:
 * - text boxes & placeholders with normalized bounding boxes (group transforms applied)
 * - the real title placeholder (title / ctrTitle) instead of "first paragraph"
 * - native tables (rows/cells), chart series data, SmartArt node text
 * - embedded pictures, resolved through slide relationships, registered as VisualRegions
 *   so only those crops get OCR'd later
 * - speaker notes resolved through relationships
 */
import JSZip from 'jszip';
import { CanonicalDocumentTree, DocumentSection, ContentElement, VisualRegion } from '../../types';
import { contentPurifierService } from '../services/contentPurifierService';
import { diagramRecognizer } from './diagramRecognizer';
import { regionAssetStore } from './regionAssets';

type Box = { x: number; y: number; w: number; h: number }; // EMU
type GroupTransform = { offX: number; offY: number; chOffX: number; chOffY: number; scaleX: number; scaleY: number };

const IDENTITY: GroupTransform = { offX: 0, offY: 0, chOffX: 0, chOffY: 0, scaleX: 1, scaleY: 1 };
const DEFAULT_SLIDE_W = 12192000; // 16:9
const DEFAULT_SLIDE_H = 6858000;

function children(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === localName);
}

function child(el: Element | null | undefined, ...path: string[]): Element | null {
  let cur: Element | null | undefined = el;
  for (const name of path) {
    if (!cur) return null;
    cur = Array.from(cur.children).find((c) => c.localName === name) || null;
  }
  return cur || null;
}

function descendants(el: Element | Document, localName: string): Element[] {
  return Array.from(el.getElementsByTagNameNS('*', localName));
}

function relAttr(el: Element | null, name: string): string | null {
  if (!el) return null;
  // r:embed / r:id / r:dm live in the officeDocument relationships namespace.
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === name && attr.prefix) return attr.value;
  }
  return el.getAttribute(`r:${name}`);
}

function resolvePath(baseFile: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = baseFile.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

async function readRels(zip: JSZip, partPath: string): Promise<Map<string, { target: string; type: string }>> {
  const dir = partPath.split('/').slice(0, -1).join('/');
  const name = partPath.split('/').pop();
  const relsPath = `${dir}/_rels/${name}.rels`;
  const map = new Map<string, { target: string; type: string }>();
  const file = zip.file(relsPath);
  if (!file) return map;
  const doc = new DOMParser().parseFromString(await file.async('text'), 'application/xml');
  descendants(doc, 'Relationship').forEach((r) => {
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target');
    if (!id || !target || r.getAttribute('TargetMode') === 'External') return;
    map.set(id, { target: resolvePath(partPath, target), type: r.getAttribute('Type') || '' });
  });
  return map;
}

function readXfrm(xfrm: Element | null): Box | null {
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  if (!off || !ext) return null;
  return {
    x: Number(off.getAttribute('x') || 0),
    y: Number(off.getAttribute('y') || 0),
    w: Number(ext.getAttribute('cx') || 0),
    h: Number(ext.getAttribute('cy') || 0)
  };
}

function applyGroup(box: Box, g: GroupTransform): Box {
  return {
    x: g.offX + (box.x - g.chOffX) * g.scaleX,
    y: g.offY + (box.y - g.chOffY) * g.scaleY,
    w: box.w * g.scaleX,
    h: box.h * g.scaleY
  };
}

function composeGroup(grpSp: Element, parent: GroupTransform): GroupTransform {
  const xfrm = child(grpSp, 'grpSpPr', 'xfrm');
  const own = readXfrm(xfrm);
  const chOff = child(xfrm, 'chOff');
  const chExt = child(xfrm, 'chExt');
  if (!own || !chOff || !chExt) return parent;
  const chW = Number(chExt.getAttribute('cx') || 0) || own.w || 1;
  const chH = Number(chExt.getAttribute('cy') || 0) || own.h || 1;
  const local: GroupTransform = {
    offX: own.x,
    offY: own.y,
    chOffX: Number(chOff.getAttribute('x') || 0),
    chOffY: Number(chOff.getAttribute('y') || 0),
    scaleX: own.w / chW,
    scaleY: own.h / chH
  };
  // Map the group's own frame through the parent transform, then chain.
  const mapped = applyGroup({ x: local.offX, y: local.offY, w: own.w, h: own.h }, parent);
  return {
    offX: mapped.x,
    offY: mapped.y,
    chOffX: local.chOffX,
    chOffY: local.chOffY,
    scaleX: local.scaleX * parent.scaleX,
    scaleY: local.scaleY * parent.scaleY
  };
}

/** Default frames for placeholders that inherit their position from the layout. */
function placeholderFallbackBox(phType: string | null, slideW: number, slideH: number): Box {
  if (phType === 'title' || phType === 'ctrTitle') return { x: slideW * 0.05, y: slideH * 0.04, w: slideW * 0.9, h: slideH * 0.16 };
  if (phType === 'subTitle') return { x: slideW * 0.1, y: slideH * 0.55, w: slideW * 0.8, h: slideH * 0.2 };
  if (phType === 'ftr' || phType === 'sldNum' || phType === 'dt') return { x: 0, y: slideH * 0.92, w: slideW, h: slideH * 0.08 };
  return { x: slideW * 0.05, y: slideH * 0.22, w: slideW * 0.9, h: slideH * 0.7 };
}

function paragraphsOf(txBody: Element | null): { text: string; level: number; bullet: boolean }[] {
  if (!txBody) return [];
  return children(txBody, 'p')
    .map((p) => {
      const runs = descendants(p, 't').map((t) => t.textContent || '');
      const text = runs.join('').replace(/\s+/g, ' ').trim();
      const pPr = child(p, 'pPr');
      const level = Number(pPr?.getAttribute('lvl') || 0);
      const bullet = Boolean(child(pPr, 'buChar') || child(pPr, 'buAutoNum')) && !child(pPr, 'buNone');
      return { text, level, bullet };
    })
    .filter((p) => p.text);
}

interface RawShape {
  kind: 'text' | 'table' | 'chart' | 'smartart' | 'picture';
  box: Box;
  phType: string | null;
  paragraphs?: { text: string; level: number; bullet: boolean }[];
  rows?: string[][];
  relId?: string | null;
  name?: string;
}

function collectShapes(
  container: Element,
  g: GroupTransform,
  slideW: number,
  slideH: number,
  out: RawShape[]
) {
  for (const node of Array.from(container.children)) {
    const tag = node.localName;
    if (tag === 'grpSp') {
      collectShapes(node, composeGroup(node, g), slideW, slideH, out);
      continue;
    }

    if (tag === 'sp') {
      const ph = child(node, 'nvSpPr', 'nvPr', 'ph');
      const phType = ph ? ph.getAttribute('type') || 'body' : null;
      const own = readXfrm(child(node, 'spPr', 'xfrm'));
      const box = own ? applyGroup(own, g) : placeholderFallbackBox(phType, slideW, slideH);
      const paragraphs = paragraphsOf(child(node, 'txBody'));
      if (paragraphs.length) out.push({ kind: 'text', box, phType, paragraphs });
      continue;
    }

    if (tag === 'pic') {
      const own = readXfrm(child(node, 'spPr', 'xfrm'));
      if (!own) continue;
      const blip = descendants(node, 'blip')[0] || null;
      out.push({
        kind: 'picture',
        box: applyGroup(own, g),
        phType: null,
        relId: relAttr(blip, 'embed'),
        name: child(node, 'nvPicPr', 'cNvPr')?.getAttribute('descr') || child(node, 'nvPicPr', 'cNvPr')?.getAttribute('name') || ''
      });
      continue;
    }

    if (tag === 'graphicFrame') {
      const own = readXfrm(child(node, 'xfrm'));
      const box = own ? applyGroup(own, g) : placeholderFallbackBox(null, slideW, slideH);
      const graphicData = child(node, 'graphic', 'graphicData');
      const uri = graphicData?.getAttribute('uri') || '';
      const tbl = child(graphicData, 'tbl');
      if (tbl) {
        const rows = children(tbl, 'tr').map((tr) =>
          children(tr, 'tc').map((tc) =>
            paragraphsOf(child(tc, 'txBody'))
              .map((p) => p.text)
              .join(' ')
          )
        );
        if (rows.some((r) => r.some((c) => c))) out.push({ kind: 'table', box, phType: null, rows });
      } else if (uri.includes('/chart')) {
        out.push({ kind: 'chart', box, phType: null, relId: relAttr(descendants(graphicData!, 'chart')[0] || null, 'id') });
      } else if (uri.includes('/diagram')) {
        out.push({ kind: 'smartart', box, phType: null, relId: relAttr(descendants(graphicData!, 'relIds')[0] || null, 'dm') });
      }
    }
  }
}

async function readChartAsTable(zip: JSZip, chartPath: string): Promise<{ title: string; rows: string[][] } | null> {
  const file = zip.file(chartPath);
  if (!file) return null;
  const doc = new DOMParser().parseFromString(await file.async('text'), 'application/xml');
  const titleEl = descendants(doc, 'title')[0];
  const title = titleEl ? descendants(titleEl, 't').map((t) => t.textContent || '').join('').trim() : '';
  const series = descendants(doc, 'ser');
  if (!series.length) return null;

  const ptValues = (el: Element | null): string[] => {
    if (!el) return [];
    const pts = descendants(el, 'pt');
    const arr: string[] = [];
    pts.forEach((pt) => {
      const idx = Number(pt.getAttribute('idx') || arr.length);
      arr[idx] = (child(pt, 'v')?.textContent || '').trim();
    });
    return arr;
  };

  const categories = ptValues(child(series[0], 'cat'));
  const header = ['', ...series.map((s, i) => descendants(child(s, 'tx') || s, 'v')[0]?.textContent?.trim() || `Series ${i + 1}`)];
  const values = series.map((s) => ptValues(child(s, 'val')));
  const n = Math.max(categories.length, ...values.map((v) => v.length));
  const rows: string[][] = [header];
  for (let i = 0; i < Math.min(n, 40); i++) {
    rows.push([categories[i] || `${i + 1}`, ...values.map((v) => v[i] ?? '')]);
  }
  return { title, rows };
}

async function readSmartArtText(zip: JSZip, dataPath: string): Promise<string[]> {
  const file = zip.file(dataPath);
  if (!file) return [];
  const doc = new DOMParser().parseFromString(await file.async('text'), 'application/xml');
  return descendants(doc, 'pt')
    .map((pt) => descendants(pt, 't').map((t) => t.textContent || '').join('').trim())
    .filter(Boolean);
}

const tableToText = (rows: string[][]) => rows.map((r) => r.join(' | ')).join('\n');

export class PPTXExtractor {
  async extract(fileData: ArrayBuffer | Blob, filename: string): Promise<CanonicalDocumentTree> {
    const startTime = performance.now();
    const zip = await new JSZip().loadAsync(fileData);
    const documentId = `doc_${Date.now().toString(36)}`;

    const sections: DocumentSection[] = [];
    const regions: VisualRegion[] = [];
    let overallTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

    // Slide size
    let slideW = DEFAULT_SLIDE_W;
    let slideH = DEFAULT_SLIDE_H;
    const presFile = zip.file('ppt/presentation.xml');
    if (presFile) {
      const pres = new DOMParser().parseFromString(await presFile.async('text'), 'application/xml');
      const sz = descendants(pres, 'sldSz')[0];
      if (sz) {
        slideW = Number(sz.getAttribute('cx')) || slideW;
        slideH = Number(sz.getAttribute('cy')) || slideH;
      }
    }
    regionAssetStore.setHandle(documentId, { kind: 'pptx', zip, slideWidthEmu: slideW, slideHeightEmu: slideH });

    const slidePaths = Object.keys(zip.files)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
      .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));

    // Parse all slides first so we can spot decorative images repeated across the deck (logos, backgrounds).
    const parsed = await Promise.all(
      slidePaths.map(async (path) => {
        const xml = await zip.file(path)!.async('text');
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const rels = await readRels(zip, path);
        const spTree = descendants(doc, 'spTree')[0];
        const shapes: RawShape[] = [];
        if (spTree) collectShapes(spTree, IDENTITY, slideW, slideH, shapes);
        return { path, rels, shapes };
      })
    );

    const mediaUse = new Map<string, number>();
    parsed.forEach(({ rels, shapes }) => {
      const seen = new Set<string>();
      shapes.forEach((s) => {
        if (s.kind === 'picture' && s.relId) {
          const t = rels.get(s.relId)?.target;
          if (t && !seen.has(t)) {
            seen.add(t);
            mediaUse.set(t, (mediaUse.get(t) || 0) + 1);
          }
        }
      });
    });
    const repeatedThreshold = Math.max(3, Math.ceil(parsed.length * 0.5));

    for (let i = 0; i < parsed.length; i++) {
      const { rels, shapes } = parsed[i];
      const slideNum = i + 1;
      const secId = `S${slideNum}`;
      const elements: ContentElement[] = [];
      let elIdx = 1;
      const nextId = () => `${secId}_el_${String(elIdx++).padStart(2, '0')}`;
      const norm = (b: Box) => [
        Math.max(0, b.x / slideW),
        Math.max(0, b.y / slideH),
        Math.min(1, (b.x + b.w) / slideW),
        Math.min(1, (b.y + b.h) / slideH)
      ].map((v) => Math.round(v * 1000) / 1000);

      // Reading order: top-to-bottom, then left-to-right (with a small row tolerance).
      shapes.sort((a, b) => (Math.abs(a.box.y - b.box.y) < slideH * 0.03 ? a.box.x - b.box.x : a.box.y - b.box.y));

      const titleShape =
        shapes.find((s) => s.kind === 'text' && (s.phType === 'title' || s.phType === 'ctrTitle')) ||
        shapes.find((s) => s.kind === 'text' && s.phType !== 'ftr' && s.phType !== 'sldNum' && s.phType !== 'dt');
      // A real title placeholder may wrap over several paragraphs; a plain text box used as the title
      // usually holds "title / subtitle", so only its first paragraph is the title.
      const isTitlePlaceholder = titleShape?.phType === 'title' || titleShape?.phType === 'ctrTitle';
      const titleParas = (titleShape?.paragraphs || []).map((p) => p.text.trim()).filter(Boolean);
      const titleText = isTitlePlaceholder ? titleParas.join(' ') : titleParas[0] || '';
      let slideTitle = titleText || `Slide ${slideNum}`;
      slideTitle = contentPurifierService.cleanLine(slideTitle) || slideTitle;
      if (slideNum === 1 && titleShape) overallTitle = slideTitle;

      elements.push({ element_id: nextId(), type: 'title', text: slideTitle, level: 1, bbox: titleShape ? norm(titleShape.box) : undefined });
      if (!isTitlePlaceholder && titleParas.length > 1) {
        const subtitle = contentPurifierService.cleanLine(titleParas.slice(1).join(' '));
        if (subtitle) elements.push({ element_id: nextId(), type: 'heading', text: subtitle, level: 2 });
      }

      let regionIdx = 1;
      const addRegion = (r: Omit<VisualRegion, 'region_id' | 'section_id' | 'page_number' | 'source'>) => {
        const region: VisualRegion = {
          region_id: `${secId}_rg_${String(regionIdx++).padStart(2, '0')}`,
          section_id: secId,
          page_number: slideNum,
          source: 'pptx_xml',
          ...r
        };
        regions.push(region);
        return region;
      };

      for (const shape of shapes) {
        if (shape === titleShape) continue;
        const bbox = norm(shape.box);

        if (shape.kind === 'text') {
          if (shape.phType === 'ftr' || shape.phType === 'sldNum' || shape.phType === 'dt') continue;
          for (const p of shape.paragraphs || []) {
            if (contentPurifierService.isMetadataOrInstructionLine(p.text)) continue;
            const clean = contentPurifierService.cleanLine(p.text);
            if (!clean || clean.length < 3) continue;
            const looksBullet = p.bullet || /^([-*+•■□▪▫●◆▶►‣⁃∙·]|\d+[.)])\s+/.test(p.text);
            elements.push({
              element_id: nextId(),
              type: shape.phType === 'subTitle' ? 'heading' : looksBullet ? 'bullet_point' : 'paragraph',
              text: clean,
              level: 2 + p.level,
              bbox
            });
          }
          continue;
        }

        if (shape.kind === 'table' && shape.rows) {
          const region = addRegion({
            kind: 'table',
            bbox,
            native_text: tableToText(shape.rows),
            ocr: { engine: 'native', status: 'done', content_type: 'table', table: shape.rows, text: tableToText(shape.rows) }
          });
          elements.push({
            element_id: nextId(),
            type: 'table',
            text: tableToText(shape.rows),
            bbox,
            region_id: region.region_id,
            metadata: { rows: shape.rows.length, cols: Math.max(...shape.rows.map((r) => r.length)) }
          });
          continue;
        }

        if (shape.kind === 'chart' && shape.relId) {
          const chartPath = rels.get(shape.relId)?.target;
          const chart = chartPath ? await readChartAsTable(zip, chartPath) : null;
          const text = chart ? `${chart.title ? chart.title + '\n' : ''}${tableToText(chart.rows)}` : '';
          const region = addRegion({
            kind: 'chart',
            bbox,
            native_text: text || undefined,
            ocr: chart
              ? { engine: 'native', status: 'done', content_type: 'chart', table: chart.rows, text, summary: chart.title || undefined }
              : undefined
          });
          if (text) {
            elements.push({ element_id: nextId(), type: 'table', subtype: 'chart', text, bbox, region_id: region.region_id });
          }
          continue;
        }

        if (shape.kind === 'smartart' && shape.relId) {
          const dataPath = rels.get(shape.relId)?.target;
          const nodes = dataPath ? await readSmartArtText(zip, dataPath) : [];
          const region = addRegion({
            kind: 'smartart',
            bbox,
            native_text: nodes.join('\n') || undefined,
            ocr: nodes.length ? { engine: 'native', status: 'done', content_type: 'diagram', nodes, text: nodes.join(' → ') } : undefined
          });
          if (nodes.length) {
            elements.push({ element_id: nextId(), type: 'diagram', subtype: 'smartart', text: nodes.join(' → '), bbox, region_id: region.region_id });
          }
          continue;
        }

        if (shape.kind === 'picture' && shape.relId) {
          const mediaPath = rels.get(shape.relId)?.target;
          if (!mediaPath) continue;
          const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
          const repeated = (mediaUse.get(mediaPath) || 0) >= repeatedThreshold;
          if (area < 0.02 || repeated) continue; // icons, logos, backgrounds
          const region = addRegion({ kind: 'picture', bbox, asset_ref: mediaPath, ocr: { engine: 'gemini', status: 'pending' } });
          elements.push({
            element_id: nextId(),
            type: 'image',
            text: shape.name || '',
            bbox,
            region_id: region.region_id,
            metadata: { asset_ref: mediaPath }
          });
        }
      }

      // Speaker notes via the slide's notesSlide relationship.
      const notesRel = Array.from(rels.values()).find((r) => r.type.endsWith('/notesSlide'));
      if (notesRel) {
        const notesFile = zip.file(notesRel.target);
        if (notesFile) {
          const notesDoc = new DOMParser().parseFromString(await notesFile.async('text'), 'application/xml');
          const noteText = descendants(notesDoc, 'sp')
            .filter((sp) => child(sp, 'nvSpPr', 'nvPr', 'ph')?.getAttribute('type') === 'body')
            .flatMap((sp) => paragraphsOf(child(sp, 'txBody')).map((p) => p.text))
            .join(' ')
            .trim();
          const clean = contentPurifierService.cleanLine(noteText);
          if (clean && !/^Slide \d+$/i.test(clean)) {
            elements.push({ element_id: nextId(), type: 'note', text: clean });
          }
        }
      }

      const { cleanElements } = diagramRecognizer.analyzeSlide(elements, slideTitle, slideNum, `doc_${slideNum}`);

      sections.push({
        section_id: secId,
        title: slideTitle,
        order: slideNum,
        elements: cleanElements,
        raw_text: cleanElements
          .filter((e) => e.type !== 'image')
          .map((e) => (e.type === 'note' ? `[Note: ${e.text}]` : e.text))
          .join('\n')
      });
    }

    if (sections.length === 0) {
      sections.push({
        section_id: 'S1',
        title: overallTitle,
        order: 1,
        elements: [
          { element_id: 'S1_el_01', type: 'title', text: overallTitle, level: 1 },
          { element_id: 'S1_el_02', type: 'paragraph', text: 'Tài liệu bài giảng đã tải lên', level: 2 }
        ],
        raw_text: overallTitle
      });
    }

    return {
      document_id: documentId,
      title: overallTitle,
      source_type: 'pptx',
      source_filename: filename,
      total_sections: sections.length,
      sections,
      visual_regions: regions,
      page_aspect: slideW / slideH,
      extraction_time_ms: Math.round((performance.now() - startTime) * 10) / 10,
      metadata: { slide_count: sections.length, region_count: regions.length }
    };
  }
}
