const userStoryParams = new URLSearchParams(window.location.search);
const userStoryProjectId = userStoryParams.get("project");
const userStoryList = document.querySelector("[data-story-list]");
const userStoryTitle = document.querySelector("#stories-title");
const userStoryStorageKey = `iwant-user-stories-${userStoryProjectId || "demo"}`;
const hasUserStoryProject = /^\d+$/.test(userStoryProjectId || "");
let userStoryCards = [...document.querySelectorAll("[data-story-id]")];

function getUserStoriesUrl() {
  if (!hasUserStoryProject) return null;
  return `/ai/projects/${userStoryProjectId}/user-stories/`;
}

function notifyUserStories(message) {
  if (typeof showProjectStatus === "function") {
    showProjectStatus(message);
  }
}

function priorityClass(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.includes("haut")) return "high";
  if (value.includes("bas")) return "low";
  return "medium";
}

function normalizeStory(story, index) {
  const safeStory = story && typeof story === "object" ? story : {};
  const role = String(safeStory.role || "utilisateur").trim();
  const action = String(safeStory.action || "utiliser la fonctionnalité").trim();
  const benefit = String(safeStory.benefit || safeStory.purpose || "répondre à son besoin").trim();

  return {
    id: String(safeStory.id || `US-${index + 1}`),
    role,
    action,
    benefit,
    story: String(
      safeStory.story || `En tant que ${role}, je souhaite ${action} afin de ${benefit}.`,
    ),
    priority: String(safeStory.priority || "Moyenne"),
  };
}

function getStoryValues(card) {
  const benefit = card.querySelector("[data-story-purpose]")?.textContent.trim() || "";

  return {
    id: card.dataset.storyId,
    role: card.querySelector("[data-story-role]")?.textContent.trim() || "",
    action: card.querySelector("[data-story-action]")?.textContent.trim() || "",
    benefit: benefit.replace(/^Afin de\s+/i, "").replace(/\.$/, ""),
  };
}

function saveUserStories() {
  try {
    localStorage.setItem(userStoryStorageKey, JSON.stringify(userStoryCards.map(getStoryValues)));
  } catch {
    notifyUserStories("La modification est visible pour cette session.");
  }
}

function restoreUserStories() {
  try {
    const savedStories = JSON.parse(localStorage.getItem(userStoryStorageKey) || "[]");
    if (!Array.isArray(savedStories)) return;

    savedStories.forEach((savedStory) => {
      const card = userStoryCards.find((item) => item.dataset.storyId === String(savedStory.id));
      if (!card) return;
      const role = card.querySelector("[data-story-role]");
      const action = card.querySelector("[data-story-action]");
      const purpose = card.querySelector("[data-story-purpose]");
      if (role && savedStory.role) role.textContent = savedStory.role;
      if (action && savedStory.action) action.textContent = savedStory.action;
      if (purpose && savedStory.benefit) purpose.textContent = savedStory.benefit;
    });
  } catch {
    localStorage.removeItem(userStoryStorageKey);
  }
}

function setStoryEditing(card, editing) {
  const fields = card.querySelectorAll("[data-story-role], [data-story-action], [data-story-purpose]");
  const button = card.querySelector("[data-edit-story]");
  const label = button?.querySelector("span");

  card.classList.toggle("is-editing", editing);
  fields.forEach((field) => {
    field.contentEditable = String(editing);
    if (editing) field.dataset.originalValue = field.textContent.trim();
    else field.removeAttribute("contenteditable");
  });

  if (button) button.setAttribute("aria-pressed", String(editing));
  if (label) label.textContent = editing ? "Enregistrer" : "Modifier";
  if (editing) fields[0]?.focus();
}

function cancelStoryEditing(card) {
  card.querySelectorAll("[data-original-value]").forEach((field) => {
    field.textContent = field.dataset.originalValue;
  });
  setStoryEditing(card, false);
  notifyUserStories("Modification annulée.");
}

function bindUserStoryCard(card) {
  const editButton = card.querySelector("[data-edit-story]");
  editButton?.addEventListener("click", () => {
    const isEditing = card.classList.contains("is-editing");

    userStoryCards
      .filter((item) => item !== card && item.classList.contains("is-editing"))
      .forEach((item) => setStoryEditing(item, false));

    if (!isEditing) {
      setStoryEditing(card, true);
      notifyUserStories(`Modification de la user story ${card.dataset.storyId}.`);
      return;
    }

    const hasEmptyField = [...card.querySelectorAll("[contenteditable]")].some(
      (field) => !field.textContent.trim(),
    );
    if (hasEmptyField) {
      notifyUserStories("Tous les champs de la user story doivent être remplis.");
      return;
    }

    setStoryEditing(card, false);
    saveUserStories();
    notifyUserStories(`User story ${card.dataset.storyId} enregistrée.`);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && card.classList.contains("is-editing")) {
      event.preventDefault();
      cancelStoryEditing(card);
    }
  });
}

function setUserStoriesLoading(message) {
  if (userStoryTitle) userStoryTitle.textContent = "User Stories générées";
  if (!userStoryList) return;

  const state = document.createElement("p");
  state.className = "story-empty-state";
  state.textContent = message;
  userStoryList.replaceChildren(state);
  userStoryCards = [];
}

function createStoryCard(story, index) {
  const normalizedStory = normalizeStory(story, index);
  const card = document.createElement("article");
  card.className = "story-card";
  card.dataset.storyId = normalizedStory.id;

  const indexElement = document.createElement("span");
  indexElement.className = "story-index";
  indexElement.textContent = String(index + 1);

  const copy = document.createElement("div");
  copy.className = "story-copy";

  const roleLine = document.createElement("p");
  roleLine.append("En tant que ");
  const role = document.createElement("strong");
  role.dataset.storyRole = "";
  role.textContent = normalizedStory.role;
  roleLine.append(role);

  const actionLine = document.createElement("p");
  actionLine.append("Je souhaite ");
  const action = document.createElement("strong");
  action.dataset.storyAction = "";
  action.textContent = normalizedStory.action;
  actionLine.append(action);

  const benefit = document.createElement("p");
  benefit.className = "story-purpose";
  benefit.dataset.storyPurpose = "";
  benefit.textContent = `Afin de ${normalizedStory.benefit}.`;

  copy.append(roleLine, actionLine, benefit);

  const controls = document.createElement("div");
  controls.className = "story-controls";

  const priority = document.createElement("span");
  priority.className = `story-priority story-priority--${priorityClass(normalizedStory.priority)}`;
  priority.textContent = `Priorité : ${normalizedStory.priority}`;

  const editButton = document.createElement("button");
  editButton.className = "story-edit";
  editButton.type = "button";
  editButton.dataset.editStory = "";
  editButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" /><path d="m13.8 6.7 3.5 3.5" /></svg><span>Modifier</span>';

  controls.append(priority, editButton);
  card.append(indexElement, copy, controls);
  bindUserStoryCard(card);
  return card;
}

function updateUserStoryVersion(cached) {
  if (cached) return;
  const firstVersion = document.querySelector("[data-version-list] .story-version");
  const versionTitle = firstVersion?.querySelector("h3");
  const versionDate = firstVersion?.querySelector("p");
  const now = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  if (versionTitle) versionTitle.textContent = "Version actuelle";
  if (versionDate) versionDate.textContent = `Générée le ${now}`;
}

function renderUserStories(stories, { clearSavedEdits = false, cached = false } = {}) {
  const normalizedStories = stories.map(normalizeStory).slice(0, 8);
  if (!userStoryList || normalizedStories.length === 0) {
    notifyUserStories("Aucune user story n'a été générée.");
    return;
  }

  if (clearSavedEdits) {
    localStorage.removeItem(userStoryStorageKey);
  }

  userStoryList.replaceChildren(
    ...normalizedStories.map((story, index) => createStoryCard(story, index)),
  );
  userStoryCards = [...userStoryList.querySelectorAll("[data-story-id]")];
  if (!clearSavedEdits) restoreUserStories();
  if (userStoryTitle) userStoryTitle.textContent = `User Stories générées (${normalizedStories.length})`;
  updateUserStoryVersion(cached);
}

async function loadUserStories({ force = false } = {}) {
  const url = getUserStoriesUrl();
  if (!url) {
    notifyUserStories("Ouvrez un projet depuis Mes projets pour générer ses user stories.");
    return;
  }

  const button = document.querySelector("[data-story-regenerate]");
  const label = button?.querySelector("span");
  const initialLabel = label?.textContent || "Régénérer";
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(userStoryProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  if (button) button.disabled = true;
  if (label) label.textContent = force ? "Régénération..." : "Génération...";
  const currentArtifact = force ? userStoryCards.map(getStoryValues) : null;
  setUserStoriesLoading(force ? "Régénération des user stories..." : "Génération des user stories...");
  notifyUserStories(force ? "Régénération des user stories..." : "Génération des user stories...");

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
      throw new Error(data.error || "Impossible de générer les user stories.");
    }

    renderUserStories(data.user_stories || [], {
      clearSavedEdits: force,
      cached: data.cached,
    });
    notifyUserStories(
      data.cached
        ? "User stories chargées depuis le projet."
        : "User stories générées avec l'IA.",
    );
  } catch (error) {
    console.error("User story generation error:", error);
    setUserStoriesLoading(error.message);
    notifyUserStories(error.message);
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = initialLabel;
  }
}

document.querySelector("[data-story-regenerate]")?.addEventListener("click", () => {
  loadUserStories({ force: true });
});

document.querySelectorAll("[data-view-version]").forEach((button) => {
  button.addEventListener("click", () => {
    const version = button.closest(".story-version")?.querySelector("h3")?.textContent || "Cette version";
    notifyUserStories(`${version} est affichée dans la liste.`);
  });
});

if (hasUserStoryProject) {
  setUserStoriesLoading("Génération des user stories...");
} else {
  userStoryCards.forEach(bindUserStoryCard);
  restoreUserStories();
}
loadUserStories();
