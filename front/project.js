const projectThemes = ["green", "orange", "violet", "blue"];
const projectThemeChoices = document.querySelectorAll("[data-theme-choice]");
const projectMenuToggle = document.querySelector("[data-project-menu-toggle]");
const projectMenu = document.querySelector("[data-project-menu]");
const projectStatus = document.querySelector("[data-project-status]");
const projectPreferencesDialog = document.querySelector("[data-project-preferences-dialog]");
const projectLegalDialog = document.querySelector("[data-project-legal-dialog]");
const projectAvatar = document.querySelector("[data-user-avatar]");
const projectMain = document.querySelector("[data-project-main]");
const personaGrid = document.querySelector("[data-persona-grid]");
const personaLoading = document.querySelector("[data-persona-loading]");
const personaDetailSection = document.querySelector("[data-persona-detail-section]");
const personaDetail = document.querySelector("[data-persona-detail]");
const generatedTitle = document.querySelector("[data-generated-title]");
let personaCards = [];
let personaDetails = [];
let projectStatusTimer;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

function getCsrfToken() {
  const cookieToken = getCookie("csrftoken");
  if (cookieToken) return cookieToken;
  return document.querySelector("input[name='csrfmiddlewaretoken']")?.value || null;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  await response.text();

  if (response.status === 403 || response.status === 404) {
    throw new Error("Session expirée ou projet introuvable. Rechargez la page.");
  }

  throw new Error("Le serveur n'a pas renvoyé une réponse JSON.");
}

function setProjectTheme(theme) {
  if (!projectThemes.includes(theme)) return;

  document.documentElement.dataset.theme = theme;
  localStorage.setItem("iwant-theme", theme);
  projectThemeChoices.forEach((choice) => {
    choice.setAttribute("aria-pressed", String(choice.dataset.themeChoice === theme));
  });
}

function showProjectStatus(message) {
  if (!projectStatus) return;

  window.clearTimeout(projectStatusTimer);
  projectStatus.textContent = message;
  projectStatusTimer = window.setTimeout(() => {
    projectStatus.textContent = "";
  }, 3000);
}

function setPersonaLoading(isLoading, message = "") {
  if (personaLoading) {
    personaLoading.hidden = !isLoading && !message;
    personaLoading.textContent = message;
  }

  document.querySelector("[data-regenerate]")?.toggleAttribute("disabled", isLoading);
}

function asList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizePersona(persona, index) {
  const colors = ["green", "violet", "orange"];
  const safePersona = persona && typeof persona === "object" ? persona : {};

  return {
    id: String(safePersona.id || `persona_${index + 1}`),
    card_color: colors.includes(safePersona.card_color)
      ? safePersona.card_color
      : colors[index % colors.length],
    name: String(safePersona.name || `Persona ${index + 1}`),
    age: String(safePersona.age || ""),
    type: String(safePersona.type || "Profil utilisateur"),
    portrait: String(safePersona.portrait || "👤"),
    location: String(safePersona.location || ""),
    job: String(safePersona.job || ""),
    social_background: String(safePersona.social_background || ""),
    situation: String(safePersona.situation || ""),
    tech_level: String(safePersona.tech_level || safePersona.tech || ""),
    summary: String(safePersona.summary || ""),
    quote: String(safePersona.quote || ""),
    objectives: asList(safePersona.objectives),
    needs: asList(safePersona.needs),
    frustrations: asList(safePersona.frustrations),
    behaviors: asList(safePersona.behaviors),
    scenario: String(safePersona.scenario || ""),
    expectations: String(safePersona.expectations || ""),
  };
}

function getPersonaTitle(persona) {
  return [persona.name, persona.age].filter(Boolean).join(", ");
}

function createMetaItem(label, value) {
  const item = document.createElement("li");
  const labelElement = document.createElement("span");
  labelElement.setAttribute("aria-hidden", "true");
  labelElement.textContent = "•";
  item.append(labelElement, ` ${label} : ${value || "Non précisé"}`);
  return item;
}

function createPersonaCard(persona, index) {
  const card = document.createElement("article");
  card.className = `persona-card persona-card--${persona.card_color}`;
  card.dataset.personaCard = "";
  card.dataset.persona = persona.id;
  card.role = "button";
  card.tabIndex = 0;
  card.setAttribute("aria-pressed", "false");
  card.setAttribute("aria-label", `Afficher la fiche détaillée de ${persona.name}`);

  const indexElement = document.createElement("span");
  indexElement.className = "persona-index";
  indexElement.textContent = String(index + 1);

  const moreButton = document.createElement("button");
  moreButton.className = "persona-more";
  moreButton.type = "button";
  moreButton.setAttribute("aria-label", `Options de ${persona.name}`);
  moreButton.innerHTML = "<i></i><i></i><i></i>";
  moreButton.addEventListener("click", (event) => event.stopPropagation());

  const head = document.createElement("div");
  head.className = "persona-card-head";

  const portrait = document.createElement("div");
  portrait.className = "persona-portrait";
  portrait.setAttribute("aria-hidden", "true");
  portrait.textContent = persona.portrait;

  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = getPersonaTitle(persona);
  const type = document.createElement("p");
  type.textContent = persona.type;
  const meta = document.createElement("ul");
  meta.append(
    createMetaItem("Métier", persona.job),
    createMetaItem("Lieu", persona.location),
    createMetaItem("Milieu", persona.social_background),
  );
  copy.append(title, type, meta);
  head.append(portrait, copy);

  const summary = document.createElement("p");
  summary.className = "persona-summary";
  summary.textContent = persona.summary || persona.expectations || "Résumé à compléter.";

  card.append(indexElement, moreButton, head, summary);
  card.addEventListener("click", () => selectPersona(persona.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPersona(persona.id);
    }
  });

  return card;
}

function replacePersonaList(selector, items) {
  const list = document.querySelector(selector);
  if (!list) return;

  list.replaceChildren(
    ...items.map((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      return listItem;
    }),
  );
}

function selectPersona(personaId, { scroll = true, announce = true } = {}) {
  const persona = personaDetails.find((item) => item.id === personaId);
  if (!persona || !personaDetail || !personaDetailSection) return;

  personaCards.forEach((card) => {
    const isSelected = card.dataset.persona === personaId;
    card.classList.toggle("is-selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });

  personaDetail.dataset.persona = persona.id;
  personaDetail.dataset.personaColor = persona.card_color;
  document.querySelector("[data-detail-name]").textContent = getPersonaTitle(persona);
  document.querySelector("[data-detail-type]").textContent = persona.type;
  document.querySelector("[data-detail-portrait]").textContent = persona.portrait;
  document.querySelector("[data-detail-quote]").textContent = persona.quote;
  document.querySelector("[data-detail-age]").textContent = persona.age;
  document.querySelector("[data-detail-location]").textContent = persona.location;
  document.querySelector("[data-detail-job]").textContent = persona.job;
  document.querySelector("[data-detail-social-background]").textContent = persona.social_background;
  document.querySelector("[data-detail-situation]").textContent = persona.situation;
  document.querySelector("[data-detail-tech]").textContent = persona.tech_level;
  document.querySelector("[data-detail-scenario]").textContent = persona.scenario;
  document.querySelector("[data-detail-expectations]").textContent = persona.expectations;

  replacePersonaList("[data-detail-objectives]", persona.objectives);
  replacePersonaList("[data-detail-needs]", persona.needs);
  replacePersonaList("[data-detail-frustrations]", persona.frustrations);
  replacePersonaList("[data-detail-behaviors]", persona.behaviors);

  personaDetailSection.hidden = false;

  if (announce) showProjectStatus(`Fiche détaillée de ${persona.name} affichée.`);

  if (scroll && personaDetail.getBoundingClientRect().top > window.innerHeight * 0.72) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    personaDetail.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

function renderPersonas(personas) {
  personaDetails = personas.map(normalizePersona).slice(0, 3);

  if (generatedTitle) {
    generatedTitle.textContent = `Personas générés (${personaDetails.length})`;
  }

  if (!personaGrid || personaDetails.length === 0) {
    setPersonaLoading(false, "Aucun persona n'a été généré.");
    return;
  }

  personaGrid.replaceChildren(
    ...personaDetails.map((persona, index) => createPersonaCard(persona, index)),
  );
  personaCards = [...personaGrid.querySelectorAll("[data-persona-card]")];
  setPersonaLoading(false);
  selectPersona(personaDetails[0].id, { scroll: false, announce: false });
}

async function loadPersonas({ force = false } = {}) {
  const personasUrl = projectMain?.dataset.personasUrl;

  if (!personasUrl) {
    setPersonaLoading(false, "Ouvrez un projet depuis Mes projets pour générer ses personas.");
    document.querySelector("[data-regenerate]")?.setAttribute("disabled", "");
    return;
  }

  const csrfToken = getCsrfToken();
  const headers = { "Content-Type": "application/json" };
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  setPersonaLoading(true, force ? "Régénération des personas..." : "Génération des personas...");

  try {
    const response = await fetch(personasUrl, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({ force }),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Impossible de générer les personas.");
    }

    renderPersonas(data.personas || []);
    showProjectStatus(
      data.cached
        ? "Personas chargés depuis le projet."
        : "Personas générés avec l'IA.",
    );
  } catch (error) {
    console.error("Persona generation error:", error);
    setPersonaLoading(false, error.message);
    showProjectStatus(error.message);
  }
}

setProjectTheme(
  projectThemes.includes(document.documentElement.dataset.theme)
    ? document.documentElement.dataset.theme
    : "green",
);

projectThemeChoices.forEach((choice) => {
  choice.addEventListener("click", () => setProjectTheme(choice.dataset.themeChoice));
});

if (projectAvatar) {
  const avatarColors = ["#6cc46b", "#d06d4b", "#8c52ad", "#477dba", "#d7933e", "#3b9c92"];
  const username = projectAvatar.dataset.username || "IWant";
  const colorIndex = [...username].reduce((total, character) => {
    return total + character.codePointAt(0);
  }, 0) % avatarColors.length;

  projectAvatar.style.backgroundColor = avatarColors[colorIndex];
}

projectMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = projectMenuToggle.getAttribute("aria-expanded") === "true";
  projectMenuToggle.setAttribute("aria-expanded", String(!isOpen));
  if (projectMenu) projectMenu.hidden = isOpen;
});

projectMenu?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => {
  projectMenuToggle?.setAttribute("aria-expanded", "false");
  if (projectMenu) projectMenu.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    projectMenuToggle?.setAttribute("aria-expanded", "false");
    if (projectMenu) projectMenu.hidden = true;
    if (projectPreferencesDialog?.open) projectPreferencesDialog.close();
    if (projectLegalDialog?.open) projectLegalDialog.close();
  }
});

function openProjectDialog(dialog) {
  if (projectMenu) projectMenu.hidden = true;
  projectMenuToggle?.setAttribute("aria-expanded", "false");
  dialog?.showModal();
}

document
  .querySelector("[data-project-open-preferences]")
  ?.addEventListener("click", () => openProjectDialog(projectPreferencesDialog));

document
  .querySelector("[data-project-open-legal]")
  ?.addEventListener("click", () => openProjectDialog(projectLegalDialog));

document.querySelectorAll("[data-project-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog")?.close();
  });
});

document.querySelector("[data-regenerate]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  const initialLabel = label?.textContent || "Régénérer";

  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  await loadPersonas({ force: true });
  button.disabled = false;
  if (label) label.textContent = initialLabel;
});

function exportProject() {
  showProjectStatus("Préparation du projet pour l'export PDF...");
  window.setTimeout(() => window.print(), 240);
}

document.querySelector("[data-export-project]")?.addEventListener("click", exportProject);
document.querySelector("[data-export-section]")?.addEventListener("click", exportProject);

document.querySelectorAll(".project-nav-item:not(.is-active)").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    showProjectStatus(`${item.textContent.trim()} sera disponible dès sa génération.`);
  });
});

loadPersonas();
