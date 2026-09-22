// app/static/app.js
/**
 * Frontend Application Controller for CLSG-IR Studio
 * Features:
 * - 1-Click Demo execution
 * - Real file upload (.pptx, .docx, .md)
 * - Multi-scene timeline navigation
 * - Speech synthesis with accurate pause timings
 * - 13 Canonical Visual Taxonomies rendering
 * - Multi-format export (JSON, Remotion, Manim, SSML)
 */

let CURRENT_SESSION = null;
let ACTIVE_SCENE_INDEX = 0;
let SPEECH_ACTIVE = false;
let SPEECH_UTTERANCE = null;
let TIMELINE_INTERVAL = null;

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  // Auto-run 1-Click CNN Demo on initial startup
  loadDemo();
});

function initEventListeners() {
  // Demo Button
  document.getElementById("btn-demo").addEventListener("click", () => {
    loadDemo();
  });

  // Upload Button Trigger
  const fileInput = document.getElementById("file-input");
  document.getElementById("btn-upload-trigger").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  });

  // Config Modal
  const modal = document.getElementById("config-modal");
  document.getElementById("btn-config").addEventListener("click", () => {
    modal.classList.remove("hidden");
  });
  document.getElementById("modal-close").addEventListener("click", () => {
    modal.classList.add("hidden");
  });
  document.getElementById("modal-save-run").addEventListener("click", () => {
    modal.classList.add("hidden");
    runCustomConfig();
  });

  // Export Dropdown
  const exportBtn = document.getElementById("btn-export-menu");
  const exportDropdown = document.getElementById("export-dropdown");
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    exportDropdown.classList.add("hidden");
  });

  document.getElementById("export-json").addEventListener("click", (e) => {
    e.preventDefault();
    triggerExport("clsg_json", "clsg_ir_verified.json");
  });
  document.getElementById("export-remotion").addEventListener("click", (e) => {
    e.preventDefault();
    triggerExport("remotion_props", "remotion_props.json");
  });
  document.getElementById("export-manim").addEventListener("click", (e) => {
    e.preventDefault();
    triggerExport("manim_code", "manim_scene.py");
  });
  document.getElementById("export-ssml").addEventListener("click", (e) => {
    e.preventDefault();
    triggerExport("ssml_bundle", "ssml_bundle.json");
  });

  // Workspace Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const targetId = `tab-${btn.getAttribute("data-tab")}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // Copy Buttons
  document.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const text = document.getElementById(targetId).textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "✓ Copied!";
        setTimeout(() => (btn.textContent = originalText), 1800);
      });
    });
  });

  // Audio Playback Controls
  document.getElementById("btn-audio-play").addEventListener("click", playSpokenNarration);
  document.getElementById("btn-audio-stop").addEventListener("click", stopSpokenNarration);
}

// --------------------------------------------------------------------------
// API Calls & Data Loaders
// --------------------------------------------------------------------------

async function loadDemo() {
  showLoadingState("Loading 1-Click CNN Demo...");
  try {
    const res = await fetch("/api/demo");
    const json = await res.json();
    if (json.success) {
      CURRENT_SESSION = json.data;
      ACTIVE_SCENE_INDEX = 0;
      renderAll();
    } else {
      alert("Failed to load demo: " + (json.detail || "Unknown error"));
    }
  } catch (err) {
    console.error("Demo load error:", err);
  }
}

async function uploadFile(file) {
  showLoadingState(`Extracting and blueprinting ${file.name}...`);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target_duration", document.getElementById("cfg-duration").value);
  formData.append("pacing", document.getElementById("cfg-pacing").value);
  formData.append("audience", document.getElementById("cfg-audience").value);
  formData.append("tone", document.getElementById("cfg-tone").value);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (json.success) {
      CURRENT_SESSION = json.data;
      ACTIVE_SCENE_INDEX = 0;
      renderAll();
    } else {
      alert("Pipeline error: " + (json.detail || "Failed to process file"));
    }
  } catch (err) {
    console.error("Upload error:", err);
  }
}

async function runCustomConfig() {
  if (!CURRENT_SESSION) return;
  showLoadingState("Re-running pipeline with updated configuration...");
  const payload = {
    filename: CURRENT_SESSION.document_tree.source_filename,
    config: {
      learner: {
        target_audience: document.getElementById("cfg-audience").value,
        tone: document.getElementById("cfg-tone").value,
      },
      presentation: {
        target_duration_sec: parseInt(document.getElementById("cfg-duration").value, 10),
        pacing: document.getElementById("cfg-pacing").value,
        baseline_wpm: document.getElementById("cfg-pacing").value === "slow" ? 120 : (document.getElementById("cfg-pacing").value === "fast" ? 160 : 140),
        visual_density: "balanced",
      },
    },
  };

  try {
    const res = await fetch("/api/run-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      CURRENT_SESSION = json.data;
      ACTIVE_SCENE_INDEX = 0;
      renderAll();
    }
  } catch (err) {
    console.error("Re-run error:", err);
  }
}

function triggerExport(formatType, filename) {
  if (!CURRENT_SESSION) return;
  const irId = CURRENT_SESSION.verified_ir.ir_id;
  const url = `/api/export/${irId}/${formatType}`;
  
  fetch(url)
    .then((r) => (formatType === "manim_code" ? r.text() : r.json()))
    .then((data) => {
      const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    })
    .catch((err) => alert("Export failed: " + err));
}

function showLoadingState(msg) {
  document.getElementById("studio-scene-title").textContent = msg;
  document.getElementById("studio-scene-goal").textContent = "Executing deterministic pipeline stages...";
}

// --------------------------------------------------------------------------
// UI Renderers
// --------------------------------------------------------------------------

function renderAll() {
  if (!CURRENT_SESSION) return;
  stopSpokenNarration();

  const ir = CURRENT_SESSION.verified_ir;
  const doc = CURRENT_SESSION.document_tree;
  const guard = CURRENT_SESSION.quality_report;

  // 1. Header & Meta
  document.getElementById("doc-filename").textContent = doc.source_filename;
  document.getElementById("doc-extract-time").textContent = `${doc.extraction_time_ms}ms`;
  document.getElementById("scene-count-pill").textContent = `${ir.total_scenes} Scenes`;

  // 2. Left Scene List
  renderSceneList(ir.scenes);

  // 3. Center Workspace
  renderActiveScene();

  // 4. Right Guard & Metrics
  renderGuardMetrics(guard, ir);

  // 5. Execution Trace Logs
  renderTraceLogs(CURRENT_SESSION.trace_logs);

  // 6. JSON & SSML Tabs
  document.getElementById("json-code-block").textContent = JSON.stringify(ir, null, 2);
}

function renderSceneList(scenes) {
  const container = document.getElementById("scene-list");
  container.innerHTML = "";

  scenes.forEach((scene, idx) => {
    const card = document.createElement("div");
    card.className = `scene-card ${idx === ACTIVE_SCENE_INDEX ? "active" : ""}`;
    card.addEventListener("click", () => {
      ACTIVE_SCENE_INDEX = idx;
      document.querySelectorAll(".scene-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      renderActiveScene();
    });

    card.innerHTML = `
      <div class="scene-card-top">
        <span class="scene-id-tag">SCENE ${scene.order}</span>
        <span class="role-badge">${scene.pedagogical_function}</span>
      </div>
      <div class="scene-card-title">${scene.title}</div>
      <div class="scene-card-bottom">
        <span>⏱️ ${scene.scene_duration_sec}s</span>
        <span>📝 ${scene.word_count} words</span>
        <span>🎨 ${scene.visual_cues.length} cues</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderActiveScene() {
  if (!CURRENT_SESSION) return;
  const scenes = CURRENT_SESSION.verified_ir.scenes;
  const scene = scenes[ACTIVE_SCENE_INDEX];
  if (!scene) return;

  // Active scene summary pills
  document.getElementById("active-scene-role").textContent = scene.pedagogical_function;
  document.getElementById("active-scene-bloom").textContent = `Function: ${scene.pedagogical_function.toUpperCase()}`;
  document.getElementById("active-scene-time").textContent = `⏱️ ${scene.scene_duration_sec}s / ${scene.word_count} words`;

  // Scene Title & Goal
  document.getElementById("studio-scene-title").textContent = scene.title;
  const bpSection = CURRENT_SESSION.blueprint.sections.find((s) => s.section_id === scene.section_id);
  document.getElementById("studio-scene-goal").textContent = bpSection ? bpSection.instructional_goal : "";

  // Narration with Prosody Pause Pills
  renderNarrationWithPauses(scene.prosody_plan);

  // Visual Intent Cues
  renderVisualCues(scene.visual_cues);

  // SSML Inspector Tab
  document.getElementById("ssml-code-block").textContent = scene.prosody_plan.ssml_full;
}

function renderNarrationWithPauses(prosodyPlan) {
  const display = document.getElementById("script-display");
  display.innerHTML = "";

  prosodyPlan.sentences.forEach((sent) => {
    const sentSpan = document.createElement("span");
    sentSpan.className = "sentence-span";

    let words = sent.text.split(" ");
    let pauseMap = {};
    sent.pauses.forEach((p) => {
      pauseMap[p.word_index] = p;
    });

    words.forEach((word, wIdx) => {
      const wSpan = document.createElement("span");
      wSpan.textContent = word + " ";
      sentSpan.appendChild(wSpan);

      if (pauseMap[wIdx]) {
        const p = pauseMap[wIdx];
        const pill = document.createElement("span");
        let cls = "micro";
        if (p.pause_type.includes("Emphasis")) cls = "emphasis";
        else if (p.pause_type.includes("Cognitive")) cls = "cognitive";
        else if (p.pause_type.includes("Transition")) cls = "transition";

        pill.className = `pause-pill ${cls}`;
        pill.title = `${p.pause_type}: ${p.justification}`;
        pill.textContent = `[${cls.toUpperCase()}: ${p.duration_ms}ms]`;
        sentSpan.appendChild(pill);
      }
    });

    display.appendChild(sentSpan);
    display.appendChild(document.createTextNode(" "));
  });
}

function renderVisualCues(cues) {
  const grid = document.getElementById("visual-cue-grid");
  document.getElementById("visual-count-pill").textContent = `${cues.length} Cues`;
  grid.innerHTML = "";

  if (cues.length === 0) {
    grid.innerHTML = `<div class="cue-desc" style="color: #64748b;">No visual triggers for this scene.</div>`;
    return;
  }

  cues.forEach((cue) => {
    const card = document.createElement("div");
    card.className = "visual-cue-card";
    card.innerHTML = `
      <div class="cue-top-row">
        <span class="cue-time-badge">⏱️ ${cue.trigger_timestamp_sec}s</span>
        <span class="cue-tax-badge">${cue.taxonomy_type}</span>
        <span class="cue-action-badge">${cue.action}</span>
      </div>
      <div class="cue-target-row">
        Target: <span class="cue-target-val">${cue.element_target}</span>
      </div>
      <div class="cue-desc">${cue.visual_description}</div>
      <div class="cue-justification">
        <b>Instructional Necessity:</b> ${cue.necessity_justification}
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderGuardMetrics(guard, ir) {
  // Status
  const statusEl = document.getElementById("guard-overall-status");
  statusEl.textContent = `${guard.overall_status} (${Math.round(guard.overall_quality_score * 100)}%)`;
  statusEl.className = `status-pill ${guard.overall_status === "PASSED" ? "status-passed" : ""}`;

  // DAR-P
  document.getElementById("metric-darp-val").textContent = `${guard.duration_error_pct}% Err`;
  document.getElementById("darp-target").textContent = `${guard.target_duration_sec}s`;
  document.getElementById("darp-actual").textContent = `${guard.actual_duration_sec}s`;
  const darpWidth = Math.max(10, Math.min(100, 100 - guard.duration_error_pct));
  document.getElementById("bar-darp").style.width = `${darpWidth}%`;

  // Taxonomy
  document.getElementById("metric-tax-val").textContent = `${Math.round(guard.taxonomy_validity_score * 100)}% Strict`;

  // Necessity
  document.getElementById("metric-nec-val").textContent = `${Math.round(guard.visual_necessity_score * 100)}%`;

  // Grounding
  document.getElementById("metric-ground-val").textContent = `${Math.round(guard.factual_consistency_score * 100)}%`;
}

function renderTraceLogs(logs) {
  const container = document.getElementById("trace-logs");
  container.innerHTML = "";
  if (!logs) return;

  const totalRuntime = logs.reduce((sum, l) => sum + (l.duration_sec || 0), 0);
  document.getElementById("trace-runtime").textContent = `Total: ${totalRuntime.toFixed(3)}s`;

  logs.forEach((log) => {
    const item = document.createElement("div");
    item.className = "trace-item";
    item.innerHTML = `
      <div class="trace-item-top">
        <span class="trace-stage">${log.stage}</span>
        <span class="trace-time">${log.duration_sec}s</span>
      </div>
      <div class="trace-detail">${JSON.stringify(log.details)}</div>
    `;
    container.appendChild(item);
  });
}

// --------------------------------------------------------------------------
// Web Speech Audio Synthesizer with Accurate Pause Timing
// --------------------------------------------------------------------------

function playSpokenNarration() {
  if (!CURRENT_SESSION) return;
  const scenes = CURRENT_SESSION.verified_ir.scenes;
  const scene = scenes[ACTIVE_SCENE_INDEX];
  if (!scene) return;

  stopSpokenNarration();
  SPEECH_ACTIVE = true;
  document.getElementById("btn-audio-play").disabled = true;
  document.getElementById("btn-audio-stop").disabled = false;

  let currentElapsed = 0;
  const totalDuration = scene.scene_duration_sec;
  const timerEl = document.getElementById("audio-timer");

  TIMELINE_INTERVAL = setInterval(() => {
    currentElapsed += 0.5;
    if (currentElapsed > totalDuration) {
      stopSpokenNarration();
    } else {
      const curM = String(Math.floor(currentElapsed / 60)).padStart(2, "0");
      const curS = String(Math.floor(currentElapsed % 60)).padStart(2, "0");
      const totM = String(Math.floor(totalDuration / 60)).padStart(2, "0");
      const totS = String(Math.floor(totalDuration % 60)).padStart(2, "0");
      timerEl.textContent = `${curM}:${curS} / ${totM}:${totS}`;
    }
  }, 500);

  // Play sentences sequentially using browser speech synthesis
  playSentenceQueue(scene.prosody_plan.sentences, 0);
}

function playSentenceQueue(sentences, idx) {
  if (!SPEECH_ACTIVE || idx >= sentences.length) {
    stopSpokenNarration();
    return;
  }

  const sent = sentences[idx];
  if (!("speechSynthesis" in window)) {
    // If browser lacks speech synthesis, timeline scrubber continues smoothly
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sent.text);
  utterance.rate = sent.rate === "slow" ? 0.9 : 1.05;
  utterance.pitch = sent.pitch === "high" ? 1.1 : 1.0;
  SPEECH_UTTERANCE = utterance;

  utterance.onend = () => {
    // Determine post-sentence pause (Cognitive or Transition)
    const lastPause = sent.pauses[sent.pauses.length - 1];
    const pauseMs = lastPause ? lastPause.duration_ms : 600;
    setTimeout(() => {
      if (SPEECH_ACTIVE) {
        playSentenceQueue(sentences, idx + 1);
      }
    }, pauseMs);
  };

  utterance.onerror = () => {
    playSentenceQueue(sentences, idx + 1);
  };

  window.speechSynthesis.speak(utterance);
}

function stopSpokenNarration() {
  SPEECH_ACTIVE = false;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (TIMELINE_INTERVAL) {
    clearInterval(TIMELINE_INTERVAL);
    TIMELINE_INTERVAL = null;
  }
  const btnPlay = document.getElementById("btn-audio-play");
  const btnStop = document.getElementById("btn-audio-stop");
  if (btnPlay) btnPlay.disabled = false;
  if (btnStop) btnStop.disabled = true;
}
