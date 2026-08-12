const backlogRows = [...document.querySelectorAll("[data-backlog-row]")];
const backlogWorkspace = document.querySelector("[data-backlog-workspace]");
const backlogDetail = document.querySelector("[data-backlog-detail]");
const backlogList = document.querySelector("[data-backlog-list]");
const backlogVisibleCount = document.querySelector("[data-visible-count]");
const backlogEstimate = document.querySelector(".backlog-product-footer strong");
const backlogStatusFilters = [...document.querySelectorAll("[data-status-filter]")];
const backlogPriorityFilter = document.querySelector("[data-priority-filter]");
const backlogSortPoints = document.querySelector("[data-sort-points]");
const backlogNotes = document.querySelector("[data-backlog-notes]");
const backlogProjectId = new URLSearchParams(window.location.search).get("project") || "demo";
const backlogNotesKey = `iwant-backlog-notes-${backlogProjectId}`;
let backlogActiveStatus = "all";
let backlogActivePriority = "all";
let backlogSortDescending = false;
let backlogSelectedRow = backlogRows[0] || null;

const backlogCriteriaByEpic = {
  Authentification: [
    "L’utilisateur peut saisir son email",
    "L’utilisateur peut saisir son mot de passe",
    "L’utilisateur reçoit un email de confirmation",
    "Le compte est créé après confirmation",
    "L’utilisateur est connecté automatiquement",
  ],
  Recherche: [
    "La recherche accepte plusieurs mots-clés",
    "Les résultats pertinents apparaissent en premier",
    "Un état vide explique l’absence de résultat",
  ],
  Consultation: [
    "Le téléchargement démarre depuis la fiche",
    "Le fichier reste lisible hors connexion",
    "Le format du document est clairement indiqué",
  ],
  Communauté: [
    "L’utilisateur peut publier son avis",
    "Les contributions sont associées à leur auteur",
    "Le contenu inadapté peut être signalé",
  ],
  Collections: [
    "Une collection peut être créée et renommée",
    "Une fiche peut être ajoutée ou retirée",
    "Les collections restent accessibles depuis le profil",
  ],
  Profil: [
    "Les informations peuvent être mises à jour",
    "Les changements sont enregistrés immédiatement",
    "Les données privées restent protégées",
  ],
  Notifications: [
    "Les préférences de notification sont respectées",
    "Chaque notification ouvre le bon contenu",
    "L’utilisateur peut désactiver une catégorie",
  ],
  Partage: [
    "Un lien de partage est généré",
    "Le lien ouvre la bonne fiche",
    "Le partage respecte la visibilité de la fiche",
  ],
};

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
    showProjectStatus("La note reste visible pour cette session.");
  }
}

function renderBacklogCriteria(epic) {
  const list = document.querySelector("[data-criteria-list]");
  if (!list) return;
  const criteria = backlogCriteriaByEpic[epic] || backlogCriteriaByEpic.Authentification;
  list.replaceChildren(
    ...criteria.map((criterion) => {
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

  document.querySelector("[data-detail-id]").textContent = row.dataset.id;
  document.querySelector("[data-detail-title]").textContent = row.dataset.title;
  document.querySelector("[data-detail-points]").textContent = row.dataset.points;
  document.querySelector("[data-detail-status]").value = row.dataset.status;
  document.querySelector("[data-detail-epic]").value = row.dataset.epic;
  document.querySelector("[data-detail-assignee]").value = row.dataset.assignee;
  updateBacklogPriorityBadge(row.dataset.priority);
  renderBacklogCriteria(row.dataset.epic);

  const notes = readBacklogNotes();
  if (backlogNotes) backlogNotes.value = notes[row.dataset.id] || "";
  if (announce) showProjectStatus(`${row.dataset.id} affichée dans le panneau de détail.`);
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
    showProjectStatus(`Options de ${row.dataset.id} ouvertes.`);
  });
}

function updateBacklogSummary(visibleRows) {
  const totalPoints = visibleRows.reduce((total, row) => total + Number(row.dataset.points || 0), 0);
  if (backlogVisibleCount) backlogVisibleCount.textContent = `${visibleRows.length} élément${visibleRows.length > 1 ? "s" : ""}`;
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

backlogRows.forEach(bindBacklogRow);

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
  showProjectStatus(`Backlog trié par points ${backlogSortDescending ? "décroissants" : "croissants"}.`);
});

document.querySelector("[data-close-detail]")?.addEventListener("click", () => {
  backlogDetail.hidden = true;
  backlogWorkspace?.classList.add("is-detail-closed");
});

document.querySelector("[data-detail-status]")?.addEventListener("change", (event) => {
  if (!backlogSelectedRow) return;
  const status = event.target.value;
  const label = status === "todo" ? "À faire" : status === "progress" ? "En cours" : "Terminée";
  const badge = backlogSelectedRow.querySelector(".backlog-status");
  backlogSelectedRow.dataset.status = status;
  badge.textContent = label;
  badge.className = `backlog-status backlog-status--${status}`;
  document.querySelector("[data-detail-updated]").textContent = new Intl.DateTimeFormat("fr-FR").format(new Date());
  refreshBacklogTabs();
  applyBacklogFilters();
  showProjectStatus(`${backlogSelectedRow.dataset.id} est maintenant « ${label} ».`);
});

document.querySelector("[data-detail-epic]")?.addEventListener("change", (event) => {
  if (!backlogSelectedRow) return;
  backlogSelectedRow.dataset.epic = event.target.value;
  renderBacklogCriteria(event.target.value);
  showProjectStatus(`Épic de ${backlogSelectedRow.dataset.id} mis à jour.`);
});

document.querySelector("[data-detail-assignee]")?.addEventListener("change", (event) => {
  if (!backlogSelectedRow) return;
  backlogSelectedRow.dataset.assignee = event.target.value;
  showProjectStatus(`${backlogSelectedRow.dataset.id} assignée à ${event.target.value}.`);
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
  text.textContent = "Nouveau critère d’acceptation";
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
  showProjectStatus("La création d’une nouvelle user story est prête à être reliée au modèle.");
});

document.querySelector("[data-backlog-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("Le backlog est en cours de régénération.");
  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("Une nouvelle version du backlog a été générée.");
  }, 1100);
});

selectBacklogRow(backlogSelectedRow, { announce: false });
refreshBacklogTabs();
applyBacklogFilters();
