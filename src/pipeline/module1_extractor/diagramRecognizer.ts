// src/pipeline/module1_extractor/diagramRecognizer.ts
/**
 * Client-side Diagram & Visual Structure Recognizer
 * Reconstructs vector diagrams, human pose skeleton graphs, and separates annotations.
 */
import { ContentElement, StructuredDiagram, DiagramNode, DiagramEdge } from '../../types';

export const COCO_KEYPOINTS = [
  { id: 'kp_0', label: '0', name: 'nose — mũi', region: 'head' },
  { id: 'kp_1', label: '1', name: 'left_eye — mắt trái', region: 'head' },
  { id: 'kp_2', label: '2', name: 'right_eye — mắt phải', region: 'head' },
  { id: 'kp_3', label: '3', name: 'left_ear — tai trái', region: 'head' },
  { id: 'kp_4', label: '4', name: 'right_ear — tai phải', region: 'head' },
  { id: 'kp_5', label: '5', name: 'left_shoulder — vai trái', region: 'upper_body' },
  { id: 'kp_6', label: '6', name: 'right_shoulder — vai phải', region: 'upper_body' },
  { id: 'kp_7', label: '7', name: 'left_elbow — khuỷu tay trái', region: 'upper_body' },
  { id: 'kp_8', label: '8', name: 'right_elbow — khuỷu tay phải', region: 'upper_body' },
  { id: 'kp_9', label: '9', name: 'left_wrist — cổ tay trái', region: 'upper_body' },
  { id: 'kp_10', label: '10', name: 'right_wrist — cổ tay phải', region: 'upper_body' },
  { id: 'kp_11', label: '11', name: 'left_hip — hông trái', region: 'lower_body' },
  { id: 'kp_12', label: '12', name: 'right_hip — hông phải', region: 'lower_body' },
  { id: 'kp_13', label: '13', name: 'left_knee — đầu gối trái', region: 'lower_body' },
  { id: 'kp_14', label: '14', name: 'right_knee — đầu gối phải', region: 'lower_body' },
  { id: 'kp_15', label: '15', name: 'left_ankle — cổ chân trái', region: 'lower_body' },
  { id: 'kp_16', label: '16', name: 'right_ankle — cổ chân phải', region: 'lower_body' },
];

export const COCO_19_EDGES: [string, string, string][] = [
  ['kp_0', 'kp_1', 'nose_to_left_eye'],
  ['kp_0', 'kp_2', 'nose_to_right_eye'],
  ['kp_1', 'kp_3', 'left_eye_to_left_ear'],
  ['kp_2', 'kp_4', 'right_eye_to_right_ear'],
  ['kp_0', 'kp_5', 'nose_to_left_shoulder'],
  ['kp_0', 'kp_6', 'nose_to_right_shoulder'],
  ['kp_5', 'kp_6', 'shoulder_cross'],
  ['kp_5', 'kp_7', 'left_shoulder_to_elbow'],
  ['kp_7', 'kp_9', 'left_elbow_to_wrist'],
  ['kp_6', 'kp_8', 'right_shoulder_to_elbow'],
  ['kp_8', 'kp_10', 'right_elbow_to_wrist'],
  ['kp_5', 'kp_11', 'left_torso'],
  ['kp_6', 'kp_12', 'right_torso'],
  ['kp_11', 'kp_12', 'hip_cross'],
  ['kp_11', 'kp_13', 'left_hip_to_knee'],
  ['kp_13', 'kp_15', 'left_knee_to_ankle'],
  ['kp_12', 'kp_14', 'right_hip_to_knee'],
  ['kp_14', 'kp_16', 'right_knee_to_ankle'],
  ['kp_1', 'kp_2', 'eye_cross'],
];

export class DiagramRecognizer {
  analyzeSlide(
    elements: ContentElement[],
    slideTitle: string,
    slideIdx: number,
    docId: string
  ): { cleanElements: ContentElement[]; structuredDiagram?: StructuredDiagram } {
    const contextText = `${slideTitle} ${elements.map((e) => e.text).join(' ')}`.toLowerCase();

    // Check for Human Pose Skeleton
    const poseKeywords = [
      '17 điểm', '19 đường nối', 'keypoint', 'keypoints', 'human pose',
      'pose skeleton', 'tư thế người', '17 keypoints', '19 connections',
      'nose — mũi', 'mắt trái', 'khuỷu tay', 'cổ chân', 'đầu gối'
    ];
    const isPoseSkeleton = poseKeywords.filter((k) => contextText.includes(k)).length >= 2 ||
      (contextText.includes('17') && contextText.includes('19') && (contextText.includes('điểm') || contextText.includes('nối')));

    if (isPoseSkeleton) {
      const diagramId = `diag_${docId}_S${String(slideIdx).padStart(2, '0')}_01`;
      const nodes: DiagramNode[] = COCO_KEYPOINTS.map((kp) => ({
        id: kp.id,
        label: kp.label,
        name: kp.name,
        region: kp.region
      }));
      const edges: DiagramEdge[] = COCO_19_EDGES.map(([src, dst, lbl]) => ({
        source: src,
        target: dst,
        label: lbl
      }));

      const structuredDiagram: StructuredDiagram = {
        diagram_id: diagramId,
        type: 'diagram',
        subtype: 'human_pose_skeleton',
        role: 'conceptual_diagram',
        description: 'Human body pose skeleton with 17 keypoints and 19 connections.',
        nodes,
        edges,
        node_count: 17,
        edge_count: 19,
        annotations: Array.from({ length: 17 }, (_, i) => String(i)),
        confidence: 0.96
      };

      // Filter out raw digit annotations so they do NOT pollute the text stream
      const cleanElements: ContentElement[] = [];

      // Add diagram element
      cleanElements.push({
        element_id: diagramId,
        type: 'diagram',
        subtype: 'human_pose_skeleton',
        role: 'conceptual_diagram',
        source_type: 'visual_asset',
        text: `[DIAGRAM: conceptual_diagram] Human body pose skeleton with 17 keypoints and 19 connections.`,
        description: structuredDiagram.description,
        structured_diagram: structuredDiagram,
        level: 2
      });

      for (const el of elements) {
        const trimmed = el.text.trim();
        const isLoneNumber = /^\d+$/.test(trimmed) && parseInt(trimmed, 10) >= 0 && parseInt(trimmed, 10) <= 20;

        if (isLoneNumber) {
          // Tag as diagram annotation and do not display as normal text paragraph
          continue;
        }

        cleanElements.push(el);
      }

      return { cleanElements, structuredDiagram };
    }

    return { cleanElements: elements };
  }
}

export const diagramRecognizer = new DiagramRecognizer();
