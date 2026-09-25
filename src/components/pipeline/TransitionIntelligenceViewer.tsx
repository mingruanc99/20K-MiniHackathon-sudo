// src/components/pipeline/TransitionIntelligenceViewer.tsx
/**
 * ============================================================================
 * TRANSITION INTELLIGENCE VIEWER
 * ============================================================================
 * Studio component for inspecting the Transition Intelligence Layer output.
 *
 * Shows:
 *   - Flow diagram: all sections linked by typed transitions
 *   - Per-transition panel: relationship, bridge text, quality scores
 *   - Quality heatmap: color-coded by overall score
 *   - Anti-pattern audit: detected slide-centric phrases
 *   - Live bridge text preview: before/after comparison
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  LectureTransitionMap,
  TransitionIR,
  TransitionQualityMetrics,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_COLORS,
  getQualityColor,
} from '../../types/transitionIR';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA (demo when no real pipeline output available)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TRANSITION_MAP: LectureTransitionMap = {
  map_id: 'tmap_demo_001',
  blueprint_id: 'bp_pose_estimation',
  document_id: 'doc_pose_est',
  total_transitions: 4,
  average_transition_quality: 0.84,
  average_bridge_coherence: 0.81,
  average_human_flow: 0.87,
  average_slide_dependency: 0.03,
  weak_transitions: [],
  created_at: new Date().toISOString(),
  transitions: [
    {
      transition_id: 'tr_01_02',
      from_section_id: 'sec_01',
      to_section_id: 'sec_02',
      from_concept_label: 'Object Detection',
      to_concept_label: 'Bounding Box',
      relationship: 'WholeToComponent',
      bridge_reason: 'Object Detection is the parent task; Bounding Box is the output representation it produces.',
      learner_question: 'What exactly does object detection output for each detected person?',
      strategy: 'zoom_transition',
      closing_sentence_a: 'Object detection tells us that a person exists in the frame. But it does not yet tell us precisely where — or in what form that location is encoded.',
      opening_sentence_b: 'That encoding is the bounding box — four numbers that draw a rectangle around each detected object.',
      bridge_text: 'Object detection tells us that a person exists in the frame. But it does not yet tell us precisely where — or in what form that location is encoded. That encoding is the bounding box — four numbers that draw a rectangle around each detected object.',
      slide_centric_phrases_detected: [],
      generation_method: 'hybrid',
      quality: {
        transition_quality_score: 0.88,
        bridge_coherence_score: 0.85,
        concept_continuity_score: 0.90,
        human_lecture_flow_score: 0.91,
        slide_dependency_score: 0.0,
        overall: 0.887,
      },
    },
    {
      transition_id: 'tr_02_03',
      from_section_id: 'sec_02',
      to_section_id: 'sec_03',
      from_concept_label: 'Bounding Box',
      to_concept_label: 'Pose Representation',
      relationship: 'LimitationToSolution',
      bridge_reason: 'Bounding boxes provide location but not posture information. Pose representation fills this gap.',
      learner_question: 'We know where the person is — but how is their body actually arranged?',
      strategy: 'gap_bridge',
      closing_sentence_a: 'Bounding boxes tell us where a person is. However, location alone is not enough — we still do not know how the person\'s body is arranged.',
      opening_sentence_b: 'To capture that information, we need something richer than a box. This is where pose representation becomes essential.',
      bridge_text: 'Bounding boxes tell us where a person is. However, location alone is not enough — we still do not know how the person\'s body is arranged. To capture that information, we need something richer than a box. This is where pose representation becomes essential.',
      slide_centric_phrases_detected: [],
      generation_method: 'hybrid',
      quality: {
        transition_quality_score: 0.92,
        bridge_coherence_score: 0.89,
        concept_continuity_score: 0.93,
        human_lecture_flow_score: 0.95,
        slide_dependency_score: 0.0,
        overall: 0.920,
      },
    },
    {
      transition_id: 'tr_03_04',
      from_section_id: 'sec_03',
      to_section_id: 'sec_04',
      from_concept_label: 'Pose Representation',
      to_concept_label: '17 Keypoints',
      relationship: 'AbstractToConcreteInstance',
      bridge_reason: 'Pose representation is the abstract concept; the 17-keypoint schema is the concrete implementation.',
      learner_question: 'How exactly is pose encoded as numbers the computer can process?',
      strategy: 'gap_bridge',
      closing_sentence_a: 'Pose is the abstract idea — a way of encoding body structure. But the computer needs something concrete. How, exactly, do we represent a human body as numbers?',
      opening_sentence_b: 'The answer is a set of 17 keypoints — each one a specific body joint, encoded as an (x, y) coordinate plus a confidence score.',
      bridge_text: 'Pose is the abstract idea — a way of encoding body structure. But the computer needs something concrete. How, exactly, do we represent a human body as numbers? The answer is a set of 17 keypoints — each one a specific body joint, encoded as an (x, y) coordinate plus a confidence score.',
      slide_centric_phrases_detected: [],
      generation_method: 'hybrid',
      quality: {
        transition_quality_score: 0.86,
        bridge_coherence_score: 0.84,
        concept_continuity_score: 0.88,
        human_lecture_flow_score: 0.90,
        slide_dependency_score: 0.0,
        overall: 0.866,
      },
    },
    {
      transition_id: 'tr_04_05',
      from_section_id: 'sec_04',
      to_section_id: 'sec_05',
      from_concept_label: '17 Keypoints',
      to_concept_label: 'Skeleton Graph',
      relationship: 'ComponentToWhole',
      bridge_reason: 'Individual keypoints are meaningless in isolation. The skeleton graph shows how they connect into a coherent body structure.',
      learner_question: '17 separate points — how do they become a meaningful body?',
      strategy: 'zoom_transition',
      closing_sentence_a: 'Seventeen keypoints, each encoding a joint. But seventeen isolated coordinates do not yet form a body — they are just floating numbers.',
      opening_sentence_b: 'The skeleton graph connects them. It defines which points are adjacent, which joints form a limb, and which connections give the pose its human shape.',
      bridge_text: 'Seventeen keypoints, each encoding a joint. But seventeen isolated coordinates do not yet form a body — they are just floating numbers. The skeleton graph connects them. It defines which points are adjacent, which joints form a limb, and which connections give the pose its human shape.',
      slide_centric_phrases_detected: [],
      generation_method: 'hybrid',
      quality: {
        transition_quality_score: 0.90,
        bridge_coherence_score: 0.87,
        concept_continuity_score: 0.91,
        human_lecture_flow_score: 0.93,
        slide_dependency_score: 0.0,
        overall: 0.899,
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function QualityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#dfe6da' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, background: '#2c5a47', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: '100%',
          transform: `scaleX(${value})`,
          transformOrigin: 'left',
          background: color,
          borderRadius: 2,
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
    </div>
  );
}

function QualityMetricsPanel({ quality }: { quality: TransitionQualityMetrics }) {
  return (
    <div style={{ padding: '12px 16px', background: '#173f35', borderRadius: 8, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Quality Metrics
      </div>
      <QualityBar label="Transition Quality" value={quality.transition_quality_score} color={getQualityColor(quality.transition_quality_score)} />
      <QualityBar label="Bridge Coherence" value={quality.bridge_coherence_score} color={getQualityColor(quality.bridge_coherence_score)} />
      <QualityBar label="Concept Continuity" value={quality.concept_continuity_score} color={getQualityColor(quality.concept_continuity_score)} />
      <QualityBar label="Human Lecture Flow" value={quality.human_lecture_flow_score} color={getQualityColor(quality.human_lecture_flow_score)} />
      <QualityBar
        label="Slide Dependency (↓ lower = better)"
        value={quality.slide_dependency_score}
        color={quality.slide_dependency_score < 0.2 ? '#8fd3a8' : '#f0a39b'}
      />
      {quality.overall !== undefined && (
        <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid #2c5a47',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e9eee4' }}>Overall Score</span>
          <span style={{
            fontSize: 18,
            fontWeight: 800,
            color: getQualityColor(quality.overall),
          }}>{(quality.overall * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function TransitionCard({
  transition,
  isSelected,
  onClick,
}: {
  transition: TransitionIR;
  isSelected: boolean;
  onClick: () => void;
}) {
  const relColor = RELATIONSHIP_COLORS[transition.relationship] ?? '#c9d6ca';
  const qualColor = getQualityColor(transition.quality?.overall ?? 0);
  const overall = transition.quality?.overall ?? 0;

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        padding: '14px 16px',
        borderRadius: 10,
        border: `1px solid ${isSelected ? relColor : '#2c5a47'}`,
        background: isSelected ? 'rgba(17,24,39,0.9)' : 'rgba(17,24,39,0.5)',
        marginBottom: 10,
        transition: 'all 0.2s ease',
        transform: isSelected ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: relColor,
              background: `${relColor}22`,
              padding: '2px 8px',
              borderRadius: 4,
              border: `1px solid ${relColor}44`,
            }}>
              {RELATIONSHIP_LABELS[transition.relationship]}
            </span>
            <span style={{
              fontSize: 10,
              color: '#c9d6ca',
              background: '#2c5a47',
              padding: '2px 6px',
              borderRadius: 4,
            }}>
              {transition.strategy.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f7f2' }}>
              {transition.from_concept_label}
            </span>
            <span style={{ color: relColor, fontSize: 14 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f7f2' }}>
              {transition.to_concept_label}
            </span>
          </div>
        </div>
        <div style={{
          fontSize: 15,
          fontWeight: 800,
          color: qualColor,
          minWidth: 42,
          textAlign: 'right',
        }}>
          {(overall * 100).toFixed(0)}%
        </div>
      </div>

      {/* Learner Question */}
      <div style={{
        fontSize: 11,
        fontStyle: 'italic',
        color: '#dfe6da',
        borderLeft: `2px solid ${relColor}`,
        paddingLeft: 8,
        marginBottom: isSelected ? 12 : 0,
      }}>
        "{transition.learner_question}"
      </div>

      {/* Expanded detail */}
      {isSelected && (
        <div style={{ marginTop: 12 }}>
          {/* Bridge Reason */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Why this transition exists
            </div>
            <p style={{ fontSize: 12, color: '#dfe6da', margin: 0, lineHeight: 1.6 }}>
              {transition.bridge_reason}
            </p>
          </div>

          {/* Before / After */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Bridge Text (spoken)
            </div>
            <div style={{ background: '#10302a', borderRadius: 8, padding: '10px 14px', border: '1px solid #2c5a47' }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#e6d9a8', fontWeight: 700 }}>CLOSES section "{transition.from_concept_label}":</span>
                <p style={{ fontSize: 12, color: '#e9eee4', margin: '4px 0 0 0', lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{transition.closing_sentence_a}"
                </p>
              </div>
              <div style={{ height: 1, background: '#2c5a47', margin: '8px 0' }} />
              <div>
                <span style={{ fontSize: 10, color: '#8fd3a8', fontWeight: 700 }}>OPENS section "{transition.to_concept_label}":</span>
                <p style={{ fontSize: 12, color: '#e9eee4', margin: '4px 0 0 0', lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{transition.opening_sentence_b}"
                </p>
              </div>
            </div>
          </div>

          {/* Anti-pattern audit */}
          {transition.slide_centric_phrases_detected.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#8fd3a8',
              background: '#8fd3a811', padding: '6px 10px', borderRadius: 6,
              border: '1px solid #8fd3a833', marginBottom: 12,
            }}>
              <span>✓</span> No slide-centric phrases detected
            </div>
          ) : (
            <div style={{
              fontSize: 11, color: '#f0a39b',
              background: '#f0a39b11', padding: '6px 10px', borderRadius: 6,
              border: '1px solid #f0a39b33', marginBottom: 12,
            }}>
              ⚠ Slide-centric phrases detected: {transition.slide_centric_phrases_detected.join(', ')}
            </div>
          )}

          {/* Quality Metrics */}
          {transition.quality && <QualityMetricsPanel quality={transition.quality} />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW DIAGRAM
// ─────────────────────────────────────────────────────────────────────────────

function FlowDiagram({
  map,
  selectedId,
  onSelect,
}: {
  map: LectureTransitionMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Collect unique section labels
  const nodes: { id: string; label: string }[] = [];
  const seenIds = new Set<string>();
  for (const tr of map.transitions) {
    if (!seenIds.has(tr.from_section_id)) {
      nodes.push({ id: tr.from_section_id, label: tr.from_concept_label });
      seenIds.add(tr.from_section_id);
    }
    if (!seenIds.has(tr.to_section_id)) {
      nodes.push({ id: tr.to_section_id, label: tr.to_concept_label });
      seenIds.add(tr.to_section_id);
    }
  }

  return (
    <div style={{
      overflowX: 'auto',
      padding: '16px 0',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        minWidth: 'max-content',
        padding: '0 16px',
      }}>
        {nodes.map((node, idx) => {
          // Find transition TO this node
          const trToThis = map.transitions.find(t => t.to_section_id === node.id);
          const trFromThis = map.transitions.find(t => t.from_section_id === node.id);
          const isSelected = trToThis?.transition_id === selectedId || trFromThis?.transition_id === selectedId;

          return (
            <React.Fragment key={node.id}>
              {/* Node */}
              <div
                onClick={() => trToThis && onSelect(trToThis.transition_id)}
                style={{
                  cursor: trToThis ? 'pointer' : 'default',
                  minWidth: 110,
                  padding: '10px 14px',
                  background: isSelected ? 'rgba(59,130,246,0.15)' : '#173f35',
                  border: `2px solid ${isSelected ? '#e6d9a8' : '#2c5a47'}`,
                  borderRadius: 10,
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f5f7f2', lineHeight: 1.3 }}>
                  {node.label}
                </div>
                <div style={{ fontSize: 10, color: '#c9d6ca', marginTop: 3 }}>
                  Section {idx + 1}
                </div>
              </div>

              {/* Edge with transition info */}
              {idx < nodes.length - 1 && (() => {
                const tr = map.transitions[idx];
                if (!tr) return null;
                const relColor = RELATIONSHIP_COLORS[tr.relationship] ?? '#c9d6ca';
                const isEdgeSelected = tr.transition_id === selectedId;
                return (
                  <div
                    onClick={() => onSelect(tr.transition_id)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 100,
                      padding: '0 4px',
                    }}
                  >
                    {/* Relationship label */}
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: isEdgeSelected ? relColor : '#93aa98',
                      background: isEdgeSelected ? `${relColor}22` : 'transparent',
                      padding: '2px 6px',
                      borderRadius: 4,
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      border: isEdgeSelected ? `1px solid ${relColor}44` : '1px solid transparent',
                      transition: 'all 0.2s ease',
                    }}>
                      {RELATIONSHIP_LABELS[tr.relationship]?.split(' ')[0] ?? tr.relationship}
                    </div>
                    {/* Arrow line */}
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <div style={{ flex: 1, height: 2, background: isEdgeSelected ? relColor : '#2c5a47', transition: 'background 0.2s ease' }} />
                      <span style={{ color: isEdgeSelected ? relColor : '#557a69', fontSize: 14, transition: 'color 0.2s ease' }}>▶</span>
                    </div>
                    {/* Quality score */}
                    <div style={{
                      fontSize: 9,
                      color: getQualityColor(tr.quality?.overall ?? 0),
                      marginTop: 4,
                      fontWeight: 700,
                    }}>
                      {tr.quality ? `${(tr.quality.overall! * 100).toFixed(0)}%` : '–'}
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE STATS
// ─────────────────────────────────────────────────────────────────────────────

function AggregateStats({ map }: { map: LectureTransitionMap }) {
  const stats = [
    { label: 'Avg Transition Quality', value: map.average_transition_quality, icon: '◈' },
    { label: 'Avg Bridge Coherence', value: map.average_bridge_coherence, icon: '⬡' },
    { label: 'Avg Human Flow', value: map.average_human_flow, icon: '◉' },
    { label: 'Slide Dependency', value: map.average_slide_dependency, icon: '⊘', invert: true },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
      {stats.map(s => {
        const color = s.invert
          ? (s.value < 0.1 ? '#8fd3a8' : s.value < 0.3 ? '#e6d9a8' : '#f0a39b')
          : getQualityColor(s.value);
        return (
          <div key={s.label} style={{
            background: '#173f35',
            border: '1px solid #2c5a47',
            borderRadius: 10,
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, color, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{(s.value * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 10, color: '#c9d6ca', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BEFORE / AFTER DEMO PANEL
// ─────────────────────────────────────────────────────────────────────────────

function BeforeAfterDemo() {
  const [showAfter, setShowAfter] = useState(false);

  const before = `"... 17 keypoints tell us what a person is doing.

Let's move on to:
A bounding box is 4 numbers.
A pose is 51 numbers."`;

  const after = `"Seventeen keypoints, each encoding a joint. But seventeen isolated coordinates do not yet form a body — they are just floating numbers.

The skeleton graph connects them. It defines which points are adjacent, which joints form a limb, and which connections give the pose its human shape."`;

  return (
    <div style={{
      background: '#10302a',
      border: '1px solid #2c5a47',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f5f7f2' }}>
          🎬 Before / After Demo
        </div>
        <div style={{ display: 'flex', gap: 0, background: '#173f35', borderRadius: 8, padding: 3, border: '1px solid #2c5a47' }}>
          <button
            onClick={() => setShowAfter(false)}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: !showAfter ? '#f0a39b' : 'transparent',
              color: !showAfter ? '#fff' : '#c9d6ca',
              transition: 'all 0.2s ease',
            }}
          >
            BEFORE TIL
          </button>
          <button
            onClick={() => setShowAfter(true)}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: showAfter ? '#8fd3a8' : 'transparent',
              color: showAfter ? '#fff' : '#c9d6ca',
              transition: 'all 0.2s ease',
            }}
          >
            AFTER TIL
          </button>
        </div>
      </div>

      <div style={{
        fontFamily: "'Georgia', serif",
        fontSize: 13,
        lineHeight: 1.8,
        color: showAfter ? '#e9eee4' : '#dfe6da',
        whiteSpace: 'pre-line',
        padding: '12px 16px',
        background: showAfter ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
        borderRadius: 8,
        border: `1px solid ${showAfter ? '#8fd3a833' : '#f0a39b33'}`,
        transition: 'all 0.3s ease',
        minHeight: 100,
      }}>
        {showAfter ? after : before}
      </div>

      {showAfter && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#8fd3a8' }}>
          ✓ Idea-to-idea flow • No slide titles injected • Curiosity gap plants naturally • Bridge answers from previous concept
        </div>
      )}
      {!showAfter && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#f0a39b' }}>
          ✗ "Let's move on to" detected • Slide title injected directly • No semantic bridge • Hard cut between sections
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface TransitionIntelligenceViewerProps {
  transitionMap?: LectureTransitionMap;
}

export default function TransitionIntelligenceViewer({
  transitionMap,
}: TransitionIntelligenceViewerProps) {
  const map = transitionMap ?? MOCK_TRANSITION_MAP;
  const [selectedId, setSelectedId] = useState<string | null>(map.transitions[1]?.transition_id ?? null);

  const selectedTransition = useMemo(
    () => map.transitions.find(t => t.transition_id === selectedId) ?? null,
    [map, selectedId]
  );

  return (
    <div style={{
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: '#f5f7f2',
      padding: '20px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #e6d9a8, #557a69)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>⬡</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fbfcf9' }}>
              Transition Intelligence Layer
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: '#c9d6ca' }}>
              {map.total_transitions} transitions • Moves between ideas, not slides
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate stats */}
      <AggregateStats map={map} />

      {/* Before / After Demo */}
      <BeforeAfterDemo />

      {/* Flow Diagram */}
      <div style={{
        background: '#10302a',
        border: '1px solid #2c5a47',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Concept Flow Diagram — Click an arrow to inspect
        </div>
        <FlowDiagram map={map} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Two-column layout: list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left: transition list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            All Transitions ({map.total_transitions})
          </div>
          {map.transitions.map(tr => (
            <TransitionCard
              key={tr.transition_id}
              transition={tr}
              isSelected={selectedId === tr.transition_id}
              onClick={() => setSelectedId(tr.transition_id === selectedId ? null : tr.transition_id)}
            />
          ))}
        </div>

        {/* Right: selected detail */}
        <div>
          {selectedTransition ? (
            <div style={{
              position: 'sticky',
              top: 20,
              background: '#10302a',
              border: `1px solid ${RELATIONSHIP_COLORS[selectedTransition.relationship] ?? '#2c5a47'}`,
              borderRadius: 12,
              padding: '16px 20px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Transition Detail
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#f5f7f2', marginBottom: 12 }}>
                {selectedTransition.from_concept_label}
                <span style={{ color: RELATIONSHIP_COLORS[selectedTransition.relationship] ?? '#c9d6ca', margin: '0 6px' }}>→</span>
                {selectedTransition.to_concept_label}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#c9d6ca', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Implicit Learner Question</div>
                <div style={{
                  fontSize: 13,
                  fontStyle: 'italic',
                  color: '#e9eee4',
                  borderLeft: '1px solid #557a69',
                  paddingLeft: 10,
                  lineHeight: 1.6,
                }}>
                  "{selectedTransition.learner_question}"
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#e6d9a8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Closing (ends Section A)</div>
                <div style={{
                  fontSize: 12,
                  color: '#e9eee4',
                  background: '#173f35',
                  padding: '10px 14px',
                  borderRadius: 8,
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                }}>
                  "{selectedTransition.closing_sentence_a}"
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8fd3a8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Opening (begins Section B)</div>
                <div style={{
                  fontSize: 12,
                  color: '#e9eee4',
                  background: '#173f35',
                  padding: '10px 14px',
                  borderRadius: 8,
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                }}>
                  "{selectedTransition.opening_sentence_b}"
                </div>
              </div>

              {selectedTransition.quality && (
                <QualityMetricsPanel quality={selectedTransition.quality} />
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: '#93aa98',
              fontSize: 13,
              border: '1px dashed #2c5a47',
              borderRadius: 12,
            }}>
              Select a transition to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
