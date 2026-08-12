const userStoryParams = new URLSearchParams(window.location.search);
const userStoryProjectId = userStoryParams.get("project");
const userStoryCards = [...document.querySelectorAll("[data-story-id]")];
const userStoryStorageKey = `iwant-user-stories-${userStoryProjectId || "demo"}`;

function getStoryValues(card) {
  return {
    id: card.dataset.storyId,
    role: card.querySelector("[data-story-role]")?.textContent.trim() || "",
    action: card.querySelector("[data-story-action]")?.textContent.trim() || "",
    purpose: card.querySelector("[data-story-purpose]")?.textContent.trim() || "",
  };
}

function saveUserStories() {
  try {
    localStorage.setItem(userStoryStorageKey, JSON.stringify(userStoryCards.map(getStoryValues)));
  } catch {
    showProjectStatus("La modification est visible pour cette session.");
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
      if (purpose && savedStory.purpose) purpose.textContent = savedStory.purpose;
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
  showProjectStatus("Modification annulée.");
}

userStoryCards.forEach((card) => {
  const editButton = card.querySelector("[data-edit-story]");
  editButton?.addEventListener("click", () => {
    const isEditing = card.classList.contains("is-editing");

    userStoryCards
      .filter((item) => item !== card && item.classList.contains("is-editing"))
      .forEach((item) => setStoryEditing(item, false));

    if (!isEditing) {
      setStoryEditing(card, true);
      showProjectStatus(`Modification de la user story ${card.dataset.storyId}.`);
      return;
    }

    const hasEmptyField = [...card.querySelectorAll("[contenteditable]")].some(
      (field) => !field.textContent.trim(),
    );
    if (hasEmptyField) {
      showProjectStatus("Tous les champs de la user story doivent être remplis.");
      return;
    }

    setStoryEditing(card, false);
    saveUserStories();
    showProjectStatus(`User story ${card.dataset.storyId} enregistrée.`);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && card.classList.contains("is-editing")) {
      event.preventDefault();
      cancelStoryEditing(card);
    }
  });
});

document.querySelector("[data-story-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("Les user stories sont en cours de régénération.");

  window.setTimeout(() => {
    const firstVersion = document.querySelector("[data-version-list] .story-version");
    const versionTitle = firstVersion?.querySelector("h3");
    const versionDate = firstVersion?.querySelector("p");
    const now = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());

    if (versionTitle) versionTitle.textContent = "Version 4";
    if (versionDate) versionDate.textContent = `Générée le ${now}`;
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("Une nouvelle version des user stories a été générée.");
  }, 1100);
});

document.querySelectorAll("[data-view-version]").forEach((button) => {
  button.addEventListener("click", () => {
    const version = button.closest(".story-version")?.querySelector("h3")?.textContent || "Cette version";
    showProjectStatus(`${version} est affichée dans la liste.`);
  });
});

restoreUserStories();
