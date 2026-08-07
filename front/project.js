const projectThemes = ["green", "orange", "violet", "blue"];
const projectThemeChoices = document.querySelectorAll("[data-theme-choice]");
const projectMenuToggle = document.querySelector("[data-project-menu-toggle]");
const projectMenu = document.querySelector("[data-project-menu]");
const projectStatus = document.querySelector("[data-project-status]");
const projectLegalDialog = document.querySelector("[data-project-legal-dialog]");
const personaCards = document.querySelectorAll("[data-persona-card]");
const personaDetail = document.querySelector("[data-persona-detail]");
let projectStatusTimer;

const personaDetails = {
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
  }, 2600);
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
  const persona = personaDetails[personaId];
  if (!persona || !personaDetail) return;

  personaCards.forEach((card) => {
    const isSelected = card.dataset.persona === personaId;
    card.classList.toggle("is-selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });

  personaDetail.dataset.persona = personaId;
  document.querySelector("[data-detail-name]").textContent = persona.name;
  document.querySelector("[data-detail-type]").textContent = persona.type;
  document.querySelector("[data-detail-portrait]").textContent = persona.portrait;
  document.querySelector("[data-detail-quote]").textContent = persona.quote;
  document.querySelector("[data-detail-age]").textContent = persona.age;
  document.querySelector("[data-detail-location]").textContent = persona.location;
  document.querySelector("[data-detail-job]").textContent = persona.job;
  document.querySelector("[data-detail-situation]").textContent = persona.situation;
  document.querySelector("[data-detail-tech]").textContent = persona.tech;
  document.querySelector("[data-detail-scenario]").textContent = persona.scenario;
  document.querySelector("[data-detail-expectations]").textContent = persona.expectations;

  replacePersonaList("[data-detail-objectives]", persona.objectives);
  replacePersonaList("[data-detail-needs]", persona.needs);
  replacePersonaList("[data-detail-frustrations]", persona.frustrations);
  replacePersonaList("[data-detail-behaviors]", persona.behaviors);

  if (announce) showProjectStatus(`Fiche détaillée de ${persona.name.split(",")[0]} affichée.`);

  if (scroll && personaDetail.getBoundingClientRect().top > window.innerHeight * 0.72) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    personaDetail.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

personaCards.forEach((card) => {
  card.addEventListener("click", () => selectPersona(card.dataset.persona));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPersona(card.dataset.persona);
    }
  });
});

document.querySelectorAll(".persona-more").forEach((button) => {
  button.addEventListener("click", (event) => event.stopPropagation());
});

selectPersona("lucas", { scroll: false, announce: false });

setProjectTheme(
  projectThemes.includes(document.documentElement.dataset.theme)
    ? document.documentElement.dataset.theme
    : "green",
);

projectThemeChoices.forEach((choice) => {
  choice.addEventListener("click", () => setProjectTheme(choice.dataset.themeChoice));
});

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
    if (projectLegalDialog?.open) projectLegalDialog.close();
  }
});

document.querySelector("[data-project-open-legal]")?.addEventListener("click", () => {
  projectMenu.hidden = true;
  projectMenuToggle?.setAttribute("aria-expanded", "false");
  projectLegalDialog?.showModal();
});

document.querySelector("[data-project-close-dialog]")?.addEventListener("click", () => {
  projectLegalDialog?.close();
});

document.querySelector("[data-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("Les personas sont en cours de régénération.");

  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("Les personas ont été régénérés.");
  }, 1100);
});

function exportProject() {
  showProjectStatus("Préparation du projet pour l’export PDF...");
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
