const projectThemes = ["green", "orange", "violet", "blue"];
const projectThemeChoices = document.querySelectorAll("[data-theme-choice]");
const projectMenuToggle = document.querySelector("[data-project-menu-toggle]");
const projectMenu = document.querySelector("[data-project-menu]");
const projectStatus = document.querySelector("[data-project-status]");
const projectPreferencesDialog = document.querySelector("[data-project-preferences-dialog]");
const projectLegalDialog = document.querySelector("[data-project-legal-dialog]");
const projectPrompt = document.querySelector("[data-project-prompt]");
const projectAvatar = document.querySelector("[data-user-avatar]");
const projectAccountName = document.querySelector("[data-project-account-name]");
const projectMain = document.querySelector("[data-project-main]");
const personaGrid = document.querySelector("[data-persona-grid]");
const personaLoading = document.querySelector("[data-persona-loading]");
const personaDetailSection = document.querySelector("[data-persona-detail-section]");
const personaDetail = document.querySelector("[data-persona-detail]");
const generatedTitle = document.querySelector("[data-generated-title]");
let personaCards = [];
let personaDetails = [];
let projectStatusTimer;

async function loadProjectPrompt() {
  const projectId = new URLSearchParams(window.location.search).get("project");
  if (!projectPrompt || !/^\d+$/.test(projectId || "")) return;

  projectPrompt.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(`/ai/projects/${projectId}/`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;

    const data = await response.json();
    const prompt = data?.project?.prompt?.trim();
    if (prompt) projectPrompt.textContent = prompt;
  } catch {
    // Keep the static fallback when the page is previewed without Django.
  } finally {
    projectPrompt.removeAttribute("aria-busy");
  }
}

/*
const staticPersonaDetails = {
  lucas: {
    name: "Lucas, 20 ans",
    type: "Étudiant organisé",
    portrait: "🧑🏻‍🎓",
    quote: "“Je veux gagner du temps dans mes révisions et réussir mes examens.”",
    age: "20 ans",
    location: "Lyon, France",
    job: "Étudiant en licence",
    situation: "Célibataire",
    tech: "À l’aise avec le digital",
    objectives: [
      "Trouver des fiches de révision claires et fiables",
      "Gagner du temps dans ses révisions",
      "Réussir ses examens",
      "Partager ses propres fiches",
    ],
    needs: [
      "Une plateforme facile à utiliser",
      "Des fiches bien classées par matière",
      "Un accès rapide sur mobile",
      "Une communauté active",
    ],
    frustrations: [
      "Perdre du temps à chercher des fiches",
      "Fiches de mauvaise qualité ou incomplètes",
      "Informations mal organisées",
      "Pas assez de retours ou d’échanges",
    ],
    behaviors: [
      "Utilise principalement son smartphone",
      "Révise le soir et le week-end",
      "Consulte plusieurs sources avant de faire confiance",
      "Participe aux forums et groupes d’entraide",
    ],
    scenario:
      "Lucas a un examen dans 2 semaines. Il recherche des fiches sur un chapitre spécifique, enregistre celles qui l’aident, puis partage ses propres fiches pour aider d’autres étudiants.",
    expectations:
      "Facilité d’utilisation, fiabilité du contenu, accès rapide, reconnaissance de sa contribution.",
  },
  sarah: {
    name: "Sarah, 22 ans",
    type: "Étudiante engagée",
    portrait: "👩🏻‍💻",
    quote: "“Je veux apprendre avec les autres et contribuer à une communauté vraiment utile.”",
    age: "22 ans",
    location: "Paris, France",
    job: "Étudiante en master",
    situation: "Célibataire",
    tech: "Très à l’aise avec le digital",
    objectives: [
      "Collaborer avec d’autres étudiants",
      "Contribuer à des ressources de qualité",
      "Centraliser ses supports de cours",
      "Progresser grâce aux retours de la communauté",
    ],
    needs: [
      "Des outils de partage collaboratifs",
      "Des commentaires et évaluations utiles",
      "Un classement clair par thème",
      "Des notifications pertinentes",
    ],
    frustrations: [
      "Recevoir trop peu de retours sur ses contributions",
      "Trouver des contenus isolés ou redondants",
      "Ne pas pouvoir vérifier la fiabilité d’une fiche",
      "Utiliser des interfaces trop complexes",
    ],
    behaviors: [
      "Travaille surtout le soir sur son ordinateur",
      "Commente et évalue les ressources consultées",
      "Partage régulièrement ses propres synthèses",
      "Alterne entre ordinateur et smartphone",
    ],
    scenario:
      "Sarah prépare un projet de groupe. Elle rassemble les meilleures fiches, échange avec leurs auteurs et publie une synthèse enrichie pour toute sa promotion.",
    expectations:
      "Collaboration fluide, retours constructifs, contenus vérifiés et valorisation de ses contributions.",
  },
  thomas: {
    name: "Thomas, 24 ans",
    type: "Jeune actif",
    portrait: "🧑🏼‍💼",
    quote: "“Je veux retrouver rapidement mes connaissances et continuer à les partager après mes études.”",
    age: "24 ans",
    location: "Toulouse, France",
    job: "Ingénieur junior",
    situation: "En couple",
    tech: "Expert des outils numériques",
    objectives: [
      "Conserver ses anciennes ressources",
      "Actualiser ses connaissances techniques",
      "Aider les étudiants de sa filière",
      "Partager son expérience professionnelle",
    ],
    needs: [
      "Une recherche rapide et précise",
      "Des contenus accessibles sur tous ses appareils",
      "Un espace personnel bien organisé",
      "Des formats courts à consulter",
    ],
    frustrations: [
      "Manquer de temps pour chercher une information",
      "Retrouver des ressources devenues obsolètes",
      "Perdre ses documents entre plusieurs services",
      "Recevoir des notifications inutiles",
    ],
    behaviors: [
      "Consulte les contenus pendant ses trajets",
      "Enregistre les ressources pour plus tard",
      "Privilégie les synthèses courtes et fiables",
      "Répond aux questions liées à son domaine",
    ],
    scenario:
      "Thomas doit réviser une notion avant une réunion. Il retrouve une fiche enregistrée, la complète avec son expérience et la partage avec d’anciens camarades.",
    expectations:
      "Recherche efficace, synchronisation des ressources, contenus à jour et consultation rapide sur mobile.",
  },
};
*/
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

function applyProjectAvatar(username, initial) {
  if (!projectAvatar) return;

  const safeUsername = username || projectAvatar.dataset.username || "IWant";
  const safeInitial = initial || safeUsername.slice(0, 1).toUpperCase() || "?";
  const avatarColors = ["#6cc46b", "#d06d4b", "#8c52ad", "#477dba", "#d7933e", "#3b9c92"];
  const colorIndex = [...safeUsername].reduce((total, character) => {
    return total + character.codePointAt(0);
  }, 0) % avatarColors.length;

  projectAvatar.dataset.username = safeUsername;
  projectAvatar.textContent = safeInitial;
  projectAvatar.setAttribute("aria-label", `Voir le profil de ${safeUsername}`);
  projectAvatar.style.backgroundColor = avatarColors[colorIndex];
}

async function loadProjectAccount() {
  try {
    const response = await fetch("/me/", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;

    const user = await response.json();
    if (projectAccountName && user.username) {
      projectAccountName.textContent = user.username;
    }
    applyProjectAvatar(user.username, user.initial);
  } catch {
    applyProjectAvatar();
  }
}

async function ensureCsrfToken(projectId) {
  const existingToken = getCsrfToken();
  if (existingToken) return existingToken;
  if (!/^\d+$/.test(String(projectId || ""))) return null;

  try {
    await fetch(`/ai/projects/${projectId}/`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch {
    // The next POST will surface the real error if the session is unavailable.
  }

  return getCsrfToken();
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

  const csrfToken = await ensureCsrfToken(projectMain?.dataset.projectId);
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

applyProjectAvatar();

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

document.querySelectorAll("[data-project-page]").forEach((item) => {
  const target = new URL(item.getAttribute("href"), window.location.href);
  target.search = window.location.search;
  item.href = target.href;
});

document.querySelectorAll(".project-nav-item:not(.is-active):not([data-project-page])").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    showProjectStatus(`${item.textContent.trim()} sera disponible dès sa génération.`);
  });
});

loadProjectAccount();
loadProjectPrompt();
loadPersonas();
