const swotProjectId = new URLSearchParams(window.location.search).get("project");
const hasSwotProject = /^\d+$/.test(swotProjectId || "");
const swotNotes = document.querySelector("[data-swot-notes]");
const swotNotesKey = `iwant-swot-notes-${swotProjectId || "demo"}`;
let swotQuadrants = [...document.querySelectorAll("[data-swot-quadrant]")];

const swotQuadrantConfig = [
  { key: "strengths", selector: ".swot-quadrant--strengths" },
  { key: "weaknesses", selector: ".swot-quadrant--weaknesses" },
  { key: "opportunities", selector: ".swot-quadrant--opportunities" },
  { key: "threats", selector: ".swot-quadrant--threats" },
];

function getSwotUrl() {
  if (!hasSwotProject) return null;
  return `/ai/projects/${swotProjectId}/swot/`;
}

function notifySwot(message) {
  if (typeof showProjectStatus === "function") {
    showProjectStatus(message);
  }
}

function asSwotList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function createSwotListItem(text, className = "") {
  const item = document.createElement("li");
  if (className) item.className = className;
  item.textContent = text;
  return item;
}

function renderSwotList(selector, items, placeholder = "") {
  const list = document.querySelector(selector)?.querySelector("ul");
  if (!list) return;

  const safeItems = asSwotList(items);
  if (safeItems.length === 0 && placeholder) {
    list.replaceChildren(createSwotListItem(placeholder, "swot-empty-state"));
    return;
  }

  list.replaceChildren(...safeItems.map((item) => createSwotListItem(item)));
}

function createAdviceItem(text, index) {
  const icons = ["💡", "♟", "⌛", "◎"];
  const item = document.createElement("li");
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = icons[index % icons.length];
  item.append(icon, text);
  return item;
}

function renderSwotAdvice(items, placeholder = "") {
  const list = document.querySelector(".swot-advice ul");
  if (!list) return;

  const safeItems = asSwotList(items);
  if (safeItems.length === 0 && placeholder) {
    list.replaceChildren(createAdviceItem(placeholder, 0));
    return;
  }

  list.replaceChildren(...safeItems.map(createAdviceItem));
}

function computeSwotScore(swot) {
  const strengths = asSwotList(swot.strengths).length;
  const weaknesses = asSwotList(swot.weaknesses).length;
  const opportunities = asSwotList(swot.opportunities).length;
  const threats = asSwotList(swot.threats).length;
  const total = strengths + weaknesses + opportunities + threats;
  if (!total) return null;

  return Math.max(
    35,
    Math.min(92, 50 + strengths * 4 + opportunities * 3 - weaknesses * 2 - threats * 2),
  );
}

function updateSwotSummary(swot, summary = {}) {
  const score = computeSwotScore(swot);
  const ring = document.querySelector(".swot-score-ring");
  const scoreValue = ring?.querySelector("strong");
  const scoreText = document.querySelector(".swot-score-content p");
  const aboutText = document.querySelector(".swot-about > p");

  if (ring && score !== null) {
    ring.setAttribute("aria-label", `Evaluation globale : ${score} pour cent`);
    ring.style.background = `conic-gradient(var(--project-accent) 0 ${score}%, rgba(255, 255, 255, 0.13) ${score}% 100%)`;
  }

  if (scoreValue) scoreValue.textContent = score === null ? "--" : `${score}%`;

  if (scoreText) {
    const priority = String(summary.priority_action || "Action à préciser").trim();
    const label = document.createElement("span");
    label.textContent = priority;
    scoreText.replaceChildren("Priorité", document.createElement("br"), label);
  }

  if (aboutText) {
    const mainStrength = String(summary.main_strength || "").trim();
    const mainRisk = String(summary.main_risk || "").trim();
    aboutText.textContent = [mainStrength, mainRisk].filter(Boolean).join(" Risque : ")
      || "Cette analyse SWOT a été générée à partir de la description de votre projet.";
  }
}

function setSwotLoading(message) {
  swotQuadrantConfig.forEach((config, index) => {
    renderSwotList(config.selector, [], index === 0 ? message : "");
  });
  renderSwotAdvice([], "Génération des recommandations...");
  updateSwotSummary({}, { priority_action: "Génération en cours" });
}

function normalizeSwotArtifact(artifact) {
  const safeArtifact = artifact && typeof artifact === "object" ? artifact : {};
  return {
    swot: safeArtifact.swot && typeof safeArtifact.swot === "object" ? safeArtifact.swot : {},
    recommendations: asSwotList(safeArtifact.recommendations),
    summary: safeArtifact.summary && typeof safeArtifact.summary === "object"
      ? safeArtifact.summary
      : {},
  };
}

function renderSwotArtifact(artifact) {
  const normalized = normalizeSwotArtifact(artifact);

  swotQuadrantConfig.forEach((config) => {
    renderSwotList(
      config.selector,
      normalized.swot[config.key],
      "Aucun point généré pour cette rubrique.",
    );
  });
  renderSwotAdvice(normalized.recommendations, "Aucune recommandation générée.");
  updateSwotSummary(normalized.swot, normalized.summary);
}

function getCurrentSwotArtifact() {
  const swot = {};
  swotQuadrantConfig.forEach((config) => {
    swot[config.key] = [
      ...(document.querySelector(config.selector)?.querySelectorAll("li") || []),
    ]
      .map((item) => item.textContent.trim())
      .filter(Boolean);
  });

  const recommendations = [...(document.querySelectorAll(".swot-advice li") || [])]
    .map((item) => item.textContent.trim())
    .filter(Boolean);

  return { swot, recommendations };
}

async function loadSwot({ force = false } = {}) {
  const url = getSwotUrl();
  if (!url) {
    notifySwot("Ouvrez un projet depuis Mes projets pour générer son analyse SWOT.");
    return;
  }

  const button = document.querySelector("[data-swot-regenerate]");
  const label = button?.querySelector("span");
  const initialLabel = label?.textContent || "Régénérer";
  const currentArtifact = force ? getCurrentSwotArtifact() : null;
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(swotProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  if (button) button.disabled = true;
  if (label) label.textContent = force ? "Régénération..." : "Génération...";
  setSwotLoading(force ? "Régénération de l'analyse SWOT..." : "Génération de l'analyse SWOT...");
  notifySwot(force ? "Régénération de l'analyse SWOT..." : "Génération de l'analyse SWOT...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        force,
        current_artifact: currentArtifact,
      }),
    });
    const data = typeof readJsonResponse === "function"
      ? await readJsonResponse(response)
      : await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de générer l'analyse SWOT.");
    }

    renderSwotArtifact(data.swot || {});
    notifySwot(data.cached ? "SWOT chargée depuis le projet." : "SWOT générée avec l'IA.");
  } catch (error) {
    console.error("SWOT generation error:", error);
    setSwotLoading(error.message);
    notifySwot(error.message);
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = initialLabel;
  }
}

try {
  if (swotNotes) swotNotes.value = localStorage.getItem(swotNotesKey) || "";
} catch {
  // La zone de notes reste utilisable lorsque le stockage local est indisponible.
}

swotNotes?.addEventListener("input", () => {
  try {
    localStorage.setItem(swotNotesKey, swotNotes.value);
  } catch {
    notifySwot("La note reste visible pour cette session.");
  }
});

function selectSwotQuadrant(quadrant) {
  swotQuadrants.forEach((item) => item.classList.toggle("is-selected", item === quadrant));
  const title = quadrant.querySelector("h2")?.textContent.trim() || "Quadrant";
  notifySwot(`${title} sélectionné.`);
}

swotQuadrants.forEach((quadrant) => {
  quadrant.addEventListener("click", () => selectSwotQuadrant(quadrant));
  quadrant.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSwotQuadrant(quadrant);
    }
  });
});

document.querySelector("[data-swot-info]")?.addEventListener("click", () => {
  notifySwot("La matrice distingue les facteurs internes des facteurs externes au projet.");
});

document.querySelector("[data-swot-regenerate]")?.addEventListener("click", () => {
  loadSwot({ force: true });
});

if (hasSwotProject) {
  setSwotLoading("Génération de l'analyse SWOT...");
}
loadSwot();
