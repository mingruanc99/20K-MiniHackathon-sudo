// src/components/knowledge/KnowledgeTreeDiagram.tsx
/**
 * Left-to-right tree diagram: document -> chapters -> pages -> keywords.
 * Structural nodes show their lecture time and share of the parent; keyword nodes show weight.
 * Clicking a node selects it (editing happens in the side panel); the chevron expands/collapses.
 */
import React, { useMemo } from 'react';
import { ChevronRight, ChevronDown, Lock, EyeOff } from 'lucide-react';
import { KnowledgeTreeNode } from '../../types';

const NODE_W = 216;
const NODE_H = 46;
const KW_H = 30;
const COL_GAP = 64;
const ROW_GAP = 8;

interface Placed {
  node: KnowledgeTreeNode;
  depth: number;
  x: number;
  y: number;
  h: number;
  parentId?: string;
  excluded: boolean;
  share?: number;
}

interface Props {
  root: KnowledgeTreeNode;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

const fmtSec = (s?: number) => {
  const v = Math.round(s || 0);
  return v >= 60 ? `${Math.floor(v / 60)}m${String(v % 60).padStart(2, '0')}s` : `${v}s`;
};

export const KnowledgeTreeDiagram: React.FC<Props> = ({ root, expanded, selectedId, onToggle, onSelect }) => {
  const { placed, width, height } = useMemo(() => {
    const out: Placed[] = [];
    let cursorY = 0;

    const layout = (node: KnowledgeTreeNode, depth: number, parent: KnowledgeTreeNode | undefined, ancestorExcluded: boolean): number => {
      const excluded = ancestorExcluded || Boolean(node.excluded);
      const h = node.kind === 'keyword' ? KW_H : NODE_H;
      const kids = expanded.has(node.id) ? node.children : [];
      const x = depth * (NODE_W + COL_GAP);
      const parentActive = parent ? parent.children.filter((c) => c.kind !== 'keyword' && !c.excluded).reduce((s, c) => s + (c.duration_sec || 0), 0) : 0;
      const share = node.kind !== 'keyword' && parentActive > 0 && !node.excluded ? (node.duration_sec || 0) / parentActive : undefined;

      if (kids.length === 0) {
        const y = cursorY;
        cursorY += h + ROW_GAP;
        out.push({ node, depth, x, y, h, parentId: parent?.id, excluded, share });
        return y + h / 2;
      }
      const centers = kids.map((k) => layout(k, depth + 1, node, excluded));
      const mid = (centers[0] + centers[centers.length - 1]) / 2;
      out.push({ node, depth, x, y: mid - h / 2, h, parentId: parent?.id, excluded, share });
      return mid;
    };

    layout(root, 0, undefined, false);
    const maxDepth = Math.max(...out.map((p) => p.depth));
    return { placed: out, width: (maxDepth + 1) * (NODE_W + COL_GAP), height: Math.max(cursorY, NODE_H) };
  }, [root, expanded]);

  const byId = useMemo(() => new Map(placed.map((p) => [p.node.id, p])), [placed]);

  return (
    <div className="relative" style={{ width, height }}>
      <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden>
        {placed
          .filter((p) => p.parentId)
          .map((p) => {
            const parent = byId.get(p.parentId!)!;
            const x1 = parent.x + NODE_W;
            const y1 = parent.y + parent.h / 2;
            const x2 = p.x;
            const y2 = p.y + p.h / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`e_${p.node.id}`}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                className={p.excluded ? 'stroke-paper' : 'stroke-paper/80'}
                strokeWidth={p.node.kind === 'keyword' ? 1 : 1.5}
                strokeDasharray={p.excluded ? '4 4' : undefined}
              />
            );
          })}
      </svg>

      {placed.map((p) => {
        const n = p.node;
        const isSel = n.id === selectedId;
        const hasKids = n.children.length > 0;
        const isOpen = expanded.has(n.id);

        if (n.kind === 'keyword') {
          const w = n.weight || 0;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              style={{ left: p.x, top: p.y, width: NODE_W, height: p.h }}
              className={`absolute flex items-center gap-2 px-2.5 rounded-lg border text-left text-xs transition ${
                isSel ? 'border-print ring-2 ring-rule-strong bg-paper-sheet' : 'border-rule bg-paper-sheet hover:border-rule-strong'
              } ${p.excluded ? 'opacity-45' : ''}`}
              title={`${n.title} • trọng số ${w.toFixed(2)}${n.keyword?.source ? ` • nguồn: ${n.keyword.source}` : ''}`}
            >
              <span className="h-1.5 w-10 shrink-0 rounded-full bg-paper-band overflow-hidden">
                <span className="block h-full bg-navy" style={{ width: `${Math.round(w * 100)}%`, opacity: 0.35 + w * 0.65 }} />
              </span>
              <span className={`truncate ${p.excluded ? 'line-through text-ink-faint' : 'text-ink-soft'}`}>{n.title}</span>
              <span className="ml-auto font-mono tabular-nums text-ink-faint">{w.toFixed(2)}</span>
            </button>
          );
        }

        const tone =
          n.kind === 'document' ? 'bg-cover text-white border-cover-deep' : n.kind === 'chapter' ? 'bg-paper-band border-rule-strong text-cover' : 'bg-paper-sheet border-rule text-ink';

        return (
          <div
            key={n.id}
            style={{ left: p.x, top: p.y, width: NODE_W, height: p.h }}
            className={`absolute rounded-xl border shadow-2xs transition ${tone} ${isSel ? 'ring-2 ring-rule-strong' : ''} ${p.excluded ? 'opacity-45' : ''}`}
          >
            <div className="flex h-full items-center gap-1.5 pl-1.5 pr-2.5">
              {hasKids ? (
                <button
                  type="button"
                  onClick={() => onToggle(n.id)}
                  className={`shrink-0 rounded p-0.5 ${n.kind === 'document' ? 'hover:bg-cover-deep' : 'hover:bg-paper-band'}`}
                  aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
                >
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <button type="button" onClick={() => onSelect(n.id)} className="min-w-0 flex-1 text-left">
                <div className={`truncate text-xs font-semibold ${p.excluded ? 'line-through' : ''}`}>{n.title}</div>
                <div
                  className={`flex items-center gap-1.5 text-[11px] ${
                    n.kind === 'document' ? 'text-white/70' : n.kind === 'chapter' ? 'text-print/80' : 'text-ink-faint'
                  }`}
                >
                  <span className="font-mono tabular-nums">{fmtSec(n.duration_sec)}</span>
                  {p.share !== undefined && (
                    <>
                      <span className="h-1 w-12 rounded-full bg-rule overflow-hidden">
                        <span className="block h-full bg-navy" style={{ width: `${Math.min(100, Math.round(p.share * 100))}%` }} />
                      </span>
                      <span className="tabular-nums">{Math.round(p.share * 100)}%</span>
                    </>
                  )}
                  {n.kind === 'page' && <span className="truncate">• {n.children.filter((c) => !c.excluded).length} kw</span>}
                </div>
              </button>
              {n.locked && <Lock className="w-3 h-3 shrink-0 text-pen" aria-label="Đã khoá" />}
              {n.excluded && <EyeOff className="w-3 h-3 shrink-0 text-ink-faint" aria-label="Đã tắt" />}
            </div>
          </div>
        );
      })}
    </div>
  );
};
