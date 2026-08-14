const backlogWorkspace = document.querySelector("[data-backlog-workspace]");
const backlogDetail = document.querySelector("[data-backlog-detail]");
const backlogList = document.querySelector("[data-backlog-list]");
const backlogVisibleCount = document.querySelector("[data-visible-count]");
const backlogEstimate = document.querySelector(".backlog-product-footer strong");
const backlogStatusFilters = [...document.querySelectorAll("[data-status-filter]")];
const backlogPriorityFilter = document.querySelector("[data-priority-filter]");
const backlogSortPoints = document.querySelector("[data-sort-points]");
const backlogNotes = document.querySelector("[data-backlog-notes]");
const backlogProjectId = new URLSearchParams(window.location.search).get("project");
const backlogNotesKey = `iwant-backlog-notes-${backlogProjectId || "demo"}`;
const hasBacklogProject = /^\d+$/.test(backlogProjectId || "");
let backlogRows = [...document.querySelectorAll("[data-backlog-row]")];
let backlogItemsById = new Map();
let backlogActiveStatus = "all";
let backlogActivePriority = "all";
let backlogSortDescending = false;
let backlogSelectedRow = backlogRows[0] || null;

function getBacklogUrl() {
  if (!hasBacklogProject) return null;
  return `/ai/projects/${backlogProjectId}/backlog/`;
}

function notifyBacklog(message) {
  if (typeof showProjectStatus === "function") {
    showProjectStatus(message);
  }
}

function statusSlug(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("cours") || value === "progress") return "progress";
  if (value.includes("termin") || value === "done") return "done";
  return "todo";
}

function statusLabel(slug) {
  if (slug === "progress") return "En cours";
  if (slug === "done") return "Terminée";
  return "À faire";
}

function normalizeBacklogItem(item, index) {
  const safeItem = item && typeof item === "object" ? item : {};
  const priority = ["P0", "P1", "P2"].includes(safeItem.priority)
    ? safeItem.priority
    : index < 2 ? "P0" : "P1";
  const story = String(safeItem.story || safeItem.title || `User story ${index + 1}`).trim();

  return {
    id: String(safeItem.id || `US-${index + 1}`),
    priority,
    title: String(safeItem.title || story).trim(),
    story,
    description: String(safeItem.description || "").trim(),
    points: Number(safeItem.points || 3),
    status: statusLabel(statusSlug(safeItem.status)),
    status_key: statusSlug(safeItem.status),
    epic: String(safeItem.epic || "Produit").trim(),
    assignee: String(safeItem.assignee || "Non assigné").trim(),
    acceptance_criteria: Array.isArray(safeItem.acceptance_criteria)
      ? safeItem.acceptance_criteria.map((criterion) => String(criterion).trim()).filter(Boolean)
      : [],
    notes: String(safeItem.notes || "").trim(),
  };
}

function getCurrentBacklogArtifact() {
  return backlogRows.map((row) => ({
    id: row.dataset.id,
    priority: row.dataset.priority,
    title: row.dataset.title,
    story: row.dataset.title,
    points: Number(row.dataset.points || 0),
    status: statusLabel(row.dataset.status),
    epic: row.dataset.epic,
    assignee: row.dataset.assignee,
  }));
}

function readBacklogNotes() {
  try {
    return JSON.parse(localStorage.getItem(backlogNotesKey) || "{}") || {};
  } catch {
    return {};
  }
}

function writeBacklogNotes(notes) {
  try {
    localStorage.setItem(backlogNotesKey, JSON.stringify(notes));
  } catch {
    notifyBacklog("La note reste visible pour cette session.");
  }
}

function setSelectValue(select, value) {
  if (!select) return;
  const exists = [...select.options].some((option) => option.value === value || option.textContent === value);
  if (!exists) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = value;
}

function renderBacklogCriteria(criteria) {
  const list = document.querySelector("[data-criteria-list]");
  if (!list) return;
  const safeCriteria = criteria.length > 0 ? criteria : ["Le système affiche clairement cette fonctionnalité."];

  list.replaceChildren(
    ...safeCriteria.map((criterion) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const text = document.createElement("span");
      button.type = "button";
      button.className = "is-checked";
      button.setAttribute("aria-pressed", "true");
      button.textContent = "✓";
      text.textContent = criterion;
      item.append(button, text);
      return item;
    }),
  );
}

function updateBacklogPriorityBadge(priority) {
  const badge = document.querySelector("[data-detail-priority]");
  if (!badge) return;
  badge.textContent = priority;
  badge.className = `backlog-priority backlog-priority--${priority.toLowerCase()}`;
}

function selectBacklogRow(row, { announce = true } = {}) {
  if (!row || !backlogDetail) return;
  backlogRows.forEach((item) => item.classList.toggle("is-selected", item === row));
  backlogSelectedRow = row;
  backlogWorkspace?.classList.remove("is-detail-closed");
  backlogDetail.hidden = false;

  const item = backlogItemsById.get(row.dataset.id) || {};
  document.querySelector("[data-detail-id]").textContent = row.dataset.id;
  document.querySelector("[data-detail-title]").textContent = row.dataset.title;
  document.querySelector("[data-detail-points]").textContent = row.dataset.points;
  setSelectValue(document.querySelector("[data-detail-status]"), row.dataset.status);
  setSelectValue(document.querySelector("[data-detail-epic]"), row.dataset.epic);
  setSelectValue(document.querySelector("[data-detail-assignee]"), row.dataset.assignee);
  updateBacklogPriorityBadge(row.dataset.priority);
  renderBacklogCriteria(item.acceptance_criteria || []);

  const notes = readBacklogNotes();
  if (backlogNotes) backlogNotes.value = notes[row.dataset.id] || item.notes || "";
  if (announce) notifyBacklog(`${row.dataset.id} affichée dans le panneau de détail.`);
}

function bindBacklogRow(row) {
  row.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    selectBacklogRow(row);
  });
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectBacklogRow(row);
    }
  });
  row.querySelector("button")?.addEventListener("click", () => {
    notifyBacklog(`Options de ${row.dataset.id} ouvertes.`);
  });
}

function createBacklogRow(item, index) {
  const normalizedItem = normalizeBacklogItem(item, index);
  backlogItemsById.set(normalizedItem.id, normalizedItem);

  const row = document.createElement("article");
  row.className = index === 0 ? "backlog-row is-selected" : "backlog-row";
  row.role = "row";
  row.tabIndex = 0;
  row.dataset.backlogRow = "";
  row.dataset.id = normalizedItem.id;
  row.dataset.priority = normalizedItem.priority;
  row.dataset.status = normalizedItem.status_key;
  row.dataset.points = String(normalizedItem.points);
  row.dataset.epic = normalizedItem.epic;
  row.dataset.assignee = normalizedItem.assignee;
  row.dataset.title = normalizedItem.story;

  const drag = document.createElement("span");
  drag.className = "backlog-drag";
  drag.setAttribute("aria-hidden", "true");
  drag.textContent = "⋮";

  const priority = document.createElement("span");
  priority.className = `backlog-priority backlog-priority--${normalizedItem.priority.toLowerCase()}`;
  priority.textContent = normalizedItem.priority;

  const id = document.createElement("strong");
  id.textContent = normalizedItem.id;

  const story = document.createElement("p");
  story.textContent = normalizedItem.story;

  const points = document.createElement("span");
  points.className = "backlog-points";
  points.textContent = String(normalizedItem.points);

  const status = document.createElement("span");
  status.className = `backlog-status backlog-status--${normalizedItem.status_key}`;
  status.textContent = normalizedItem.status;

  const options = document.createElement("button");
  options.type = "button";
  options.setAttribute("aria-label", `Options de ${normalizedItem.id}`);
  options.textContent = "⋮";

  row.append(drag, priority, id, story, points, status, options);
  bindBacklogRow(row);
  return row;
}

function updateBacklogSummary(visibleRows) {
  const totalPoints = visibleRows.reduce((total, row) => total + Number(row.dataset.points || 0), 0);
  if (backlogVisibleCount) {
    backlogVisibleCount.textContent = `${visibleRows.length} élément${visibleRows.length > 1 ? "s" : ""}`;
  }
  if (backlogEstimate) backlogEstimate.textContent = `Estimation totale : ${totalPoints} pts`;
}

function applyBacklogFilters() {
  const visibleRows = backlogRows.filter((row) => {
    const matchesStatus = backlogActiveStatus === "all" || row.dataset.status === backlogActiveStatus;
    const matchesPriority = backlogActivePriority === "all" || row.dataset.priority === backlogActivePriority;
    row.hidden = !(matchesStatus && matchesPriority);
    return !row.hidden;
  });

  updateBacklogSummary(visibleRows);
  if (backlogSelectedRow?.hidden && visibleRows[0]) selectBacklogRow(visibleRows[0], { announce: false });
}

function refreshBacklogTabs() {
  const counts = backlogRows.reduce(
    (result, row) => {
      result.all += 1;
      result[row.dataset.status] += 1;
      return result;
    },
    { all: 0, todo: 0, progress: 0, done: 0 },
  );
  const labels = { all: "Tout", todo: "À faire", progress: "En cours", done: "Terminée" };
  backlogStatusFilters.forEach((button) => {
    const status = button.dataset.statusFilter;
    button.textContent = `${labels[status]} (${counts[status]})`;
  });
}

function renderBacklogItems(items) {
  const normalizedItems = items.map(normalizeBacklogItem).slice(0, 12);
  if (!backlogList || normalizedItems.length === 0) {
    notifyBacklog("Aucun élément de backlog n'a été généré.");
    return;
  }

  backlogItemsById = new Map();
  backlogList.replaceChildren(
    ...normalizedItems.map((item, index) => createBacklogRow(item, index)),
  );
  backlogRows = [...backlogList.querySelectorAll("[data-backlog-row]")];
  backlogSelectedRow = backlogRows[0] || null;
  refreshBacklogTabs();
  applyBacklogFilters();
  selectBacklogRow(backlogSelectedRow, { announce: false });
}

function setBacklogLoading(message) {
  if (backlogList) {
    const state = document.createElement("p");
    state.className = "backlog-empty-state";
    state.textContent = message;
    backlogList.replaceChildren(state);
  }

  backlogRows = [];
  backlogItemsById = new Map();
  backlogSelectedRow = null;
  refreshBacklogTabs();
  updateBacklogSummary([]);
  if (backlogDetail) backlogDetail.hidden = true;
  backlogWorkspace?.classList.add("is-detail-closed");
}

async function loadBacklog({ force = false } = {}) {
  const url = getBacklogUrl();
  if (!url) {
    notifyBacklog("Ouvrez un projet depuis Mes projets pour générer son backlog.");
    return;
  }

  const button = document.querySelector("[data-backlog-regenerate]");
  const label = button?.querySelector("span");
  const initialLabel = label?.textContent || "Régénérer";
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(backlogProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  if (button) button.disabled = true;
  if (label) label.textContent = force ? "Régénération..." : "Génération...";
  const currentArtifact = force ? getCurrentBacklogArtifact() : null;
  setBacklogLoading(force ? "Régénération du backlog..." : "Génération du backlog...");
  notifyBacklog(force ? "Régénération du backlog..." : "Génération du backlog...");

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
      throw new Error(data.error || "Impossible de générer le backlog.");
    }

    renderBacklogItems(data.backlog || []);
    notifyBacklog(data.cached ? "Backlog chargé depuis le projet." : "Backlog généré avec l'IA.");
  } catch (error) {
    console.error("Backlog generation error:", error);
    setBacklogLoading(error.message);
    notifyBacklog(error.message);
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = initialLabel;
  }
}

backlogStatusFilters.forEach((button) => {
  button.addEventListener("click", () => {
    backlogActiveStatus = button.dataset.statusFilter;
    backlogStatusFilters.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    applyBacklogFilters();
  });
});

backlogPriorityFilter?.addEventListener("click", () => {
  const priorities = ["all", "P0", "P1", "P2"];
  backlogActivePriority = priorities[(priorities.indexOf(backlogActivePriority) + 1) % priorities.length];
  backlogPriorityFilter.querySelector("span").textContent = backlogActivePriority === "all" ? "Filtrer" : backlogActivePriority;
  backlogPriorityFilter.setAttribute("aria-expanded", String(backlogActivePriority !== "all"));
  applyBacklogFilters();
});

backlogSortPoints?.addEventListener("click", () => {
  backlogSortDescending = !backlogSortDescending;
  backlogSortPoints.setAttribute("aria-pressed", String(backlogSortDescending));
  [...backlogRows]
    .sort((a, b) => {
      const difference = Number(a.dataset.points) - Number(b.dataset.points);
      return backlogSortDescending ? -difference : difference;
    })
    .forEach((row) => backlogList?.append(row));
  notifyBacklog(`Backlog trié par points ${backlogSortDescending ? "décroissants" : "croissants"}.`);
});

document.querySelector("[data-close-detail]")?.addEventListener("click", () => {
  backlogDetail.hidden = true;
  backlogWorkspace?.classList.add("is-detail-closed");
});

document.querySelector("[data-detail-status]")?.addEventListener("change", (event) => {
  if (!backlogSelectedRow) return;
  const status = event.target.value;
  const label = statusLabel(status);
  const badge = backlogSelectedRow.querySelector(".backlog-status");
  backlogSelectedRow.dataset.status = status;
  badge.textContent = label;
  badge.className = `backlog-status backlog-status--${status}`;
  document.querySelector("[data-detail-updated]").textContent = new Intl.DateTimeFormat("fr-FR").format(new Date());
  refreshBacklogTabs();
  applyBacklogFilters();
  notifyBacklog(`${backlogSelectedRow.dataset.id} est maintenant « ${label} ».`);
});

document.querySelector("[data-detail-epic]")?.addEventListener("change", (event) => {
  if (!backlogSelectedRow) return;
  backlogSelectedRow.dataset.epic = event.target.value;
  notifyBacklog(`Épic de ${backlogSelectedRow.dataset.id} mis à jour.`);
});

document.querySelector("[data-detail-assignee]")?.addEventListener("change", (event) => {
  if (!backlogSelectedRow) return;
  backlogSelectedRow.dataset.assignee = event.target.value;
  notifyBacklog(`${backlogSelectedRow.dataset.id} assignée à ${event.target.value}.`);
});

document.querySelector("[data-criteria-list]")?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const checked = !button.classList.contains("is-checked");
  button.classList.toggle("is-checked", checked);
  button.setAttribute("aria-pressed", String(checked));
});

document.querySelector("[data-add-criterion]")?.addEventListener("click", () => {
  const list = document.querySelector("[data-criteria-list]");
  const item = document.createElement("li");
  const button = document.createElement("button");
  const text = document.createElement("span");
  button.type = "button";
  button.textContent = "✓";
  button.setAttribute("aria-pressed", "false");
  text.contentEditable = "true";
  text.textContent = "Nouveau critère d'acceptation";
  item.append(button, text);
  list?.append(item);
  text.focus();
});

backlogNotes?.addEventListener("input", () => {
  if (!backlogSelectedRow) return;
  const notes = readBacklogNotes();
  notes[backlogSelectedRow.dataset.id] = backlogNotes.value;
  writeBacklogNotes(notes);
});

document.querySelector("[data-add-story]")?.addEventListener("click", () => {
  notifyBacklog("La création d'une nouvelle user story est prête à être reliée au modèle.");
});

document.querySelector("[data-backlog-regenerate]")?.addEventListener("click", () => {
  loadBacklog({ force: true });
});

if (hasBacklogProject) {
  setBacklogLoading("Génération du backlog...");
} else {
  backlogRows.forEach((row) => {
    backlogItemsById.set(row.dataset.id, {
      acceptance_criteria: [],
      notes: "",
    });
    bindBacklogRow(row);
  });
  selectBacklogRow(backlogSelectedRow, { announce: false });
  refreshBacklogTabs();
  applyBacklogFilters();
}
loadBacklog();
