const businessProjectId = new URLSearchParams(window.location.search).get("project");
const businessNotes = document.querySelector("[data-business-notes]");
const businessNotesKey = `iwant-business-model-notes-${businessProjectId || "demo"}`;
const businessBlocks = [...document.querySelectorAll("[data-business-block]")];
const businessGeneratedDate = document.querySelector(".business-notes small");

const businessBlockConfig = [
  { key: "key_partners", selector: ".business-block--partners", icon: "🤝", label: "Partenaires clés" },
  { key: "key_activities", selector: ".business-block--activities", icon: "⚡", label: "Activités clés" },
  { key: "key_resources", selector: ".business-block--resources", icon: "🧊", label: "Ressources clés" },
  { key: "value_propositions", selector: ".business-block--value", icon: "💎", label: "Propositions de valeur" },
  { key: "customer_relationships", selector: ".business-block--relations", icon: "❤️", label: "Relations clients" },
  { key: "channels", selector: ".business-block--channels", icon: "➤", label: "Canaux" },
  { key: "customer_segments", selector: ".business-block--segments", icon: "👥", label: "Segments clients" },
  { key: "cost_structure", selector: ".business-block--costs", icon: "◔", label: "Structure des coûts" },
  { key: "revenue_streams", selector: ".business-block--revenue", icon: "💰", label: "Sources de revenus" },
];

const businessMetricConfig = {
  market_potential: document.querySelector(".business-metrics dl > div:nth-child(1) dd"),
  complexity: document.querySelector(".business-metrics dl > div:nth-child(2) dd"),
  initial_investment: document.querySelector(".business-metrics dl > div:nth-child(3) dd"),
  launch_time: document.querySelector(".business-metrics dl > div:nth-child(4) dd"),
  estimated_profitability: document.querySelector(".business-metrics dl > div:nth-child(5) dd"),
};

function getBusinessModelUrl() {
  if (!/^\d+$/.test(businessProjectId || "")) return null;
  return `/ai/projects/${businessProjectId}/business-model/`;
}

function notifyBusiness(message) {
  if (typeof showProjectStatus === "function") {
    showProjectStatus(message);
  }
}

function renderBusinessList(block, items) {
  const list = block?.querySelector("ul");
  if (!list) return;
  const safeItems = Array.isArray(items) && items.length > 0 ? items : ["Hypothèse à compléter."];

  list.replaceChildren(
    ...safeItems.map((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = String(item);
      return listItem;
    }),
  );
}

function renderBusinessBlock(config, items) {
  const block = document.querySelector(config.selector);
  if (!block) return;
  const title = block.querySelector("h3");
  if (title) {
    title.replaceChildren();
    const icon = document.createElement("span");
    icon.textContent = config.icon;
    title.append(icon, ` ${config.label}`);
  }
  renderBusinessList(block, items);
}

function metricClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("élev") || normalized.includes("elev")) return "business-metric business-metric--high";
  if (normalized.includes("faible")) return "business-metric business-metric--blue";
  if (normalized.includes("mois")) return "business-metric business-metric--violet";
  return "business-metric business-metric--medium";
}

function renderBusinessMetrics(metrics = {}) {
  Object.entries(businessMetricConfig).forEach(([key, element]) => {
    if (!element) return;
    const value = metrics[key] || element.textContent || "Moyen";
    element.textContent = value;
    element.className = metricClass(value);
  });
}

function getCurrentBusinessModelArtifact() {
  const canvas = {};
  businessBlockConfig.forEach((config) => {
    const block = document.querySelector(config.selector);
    canvas[config.key] = [...(block?.querySelectorAll("li") || [])]
      .map((item) => item.textContent.trim())
      .filter(Boolean);
  });

  const metrics = {};
  Object.entries(businessMetricConfig).forEach(([key, element]) => {
    metrics[key] = element?.textContent.trim() || "";
  });

  return {
    business_model_canvas: canvas,
    metrics,
  };
}

function renderBusinessModel(model) {
  const safeModel = model && typeof model === "object" ? model : {};
  const canvas = safeModel.business_model_canvas || {};

  businessBlockConfig.forEach((config) => {
    renderBusinessBlock(config, canvas[config.key]);
  });
  renderBusinessMetrics(safeModel.metrics || {});

  if (businessGeneratedDate) {
    const now = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());
    businessGeneratedDate.textContent = `Modèle généré le ${now}`;
  }
}

async function loadBusinessModel({ force = false } = {}) {
  const url = getBusinessModelUrl();
  if (!url) {
    notifyBusiness("Ouvrez un projet depuis Mes projets pour générer son Business Model.");
    return;
  }

  const button = document.querySelector("[data-business-regenerate]");
  const label = button?.querySelector("span");
  const initialLabel = label?.textContent || "Régénérer";
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(businessProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  if (button) button.disabled = true;
  if (label) label.textContent = force ? "Régénération..." : "Génération...";
  notifyBusiness(force ? "Régénération du Business Model..." : "Génération du Business Model...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        force,
        current_artifact: force ? getCurrentBusinessModelArtifact() : null,
      }),
    });
    const data = typeof readJsonResponse === "function"
      ? await readJsonResponse(response)
      : await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de générer le Business Model.");
    }

    renderBusinessModel(data.business_model || {});
    notifyBusiness(data.cached ? "Business Model chargé depuis le projet." : "Business Model généré avec l'IA.");
  } catch (error) {
    console.error("Business model generation error:", error);
    notifyBusiness(error.message);
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = initialLabel;
  }
}

try {
  if (businessNotes) businessNotes.value = localStorage.getItem(businessNotesKey) || "";
} catch {
  // The notes field remains usable when local storage is unavailable.
}

businessNotes?.addEventListener("input", () => {
  try {
    localStorage.setItem(businessNotesKey, businessNotes.value);
  } catch {
    notifyBusiness("La note reste visible pour cette session.");
  }
});

businessBlocks.forEach((block) => {
  block.addEventListener("click", () => {
    businessBlocks.forEach((item) => item.classList.toggle("is-selected", item === block));
    notifyBusiness(`${block.querySelector("h3")?.textContent.trim()} sélectionné.`);
  });

  block.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      block.click();
    }
  });
});

document.querySelector("[data-business-info]")?.addEventListener("click", () => {
  notifyBusiness("Le modèle présente les composantes essentielles de votre activité.");
});

document.querySelector("[data-business-regenerate]")?.addEventListener("click", () => {
  loadBusinessModel({ force: true });
});

loadBusinessModel();
