const root = document.documentElement;
const allowedThemes = ["green", "orange", "violet", "blue"];
const themeChoices = document.querySelectorAll("[data-theme-choice]");
const menuToggle = document.querySelector("[data-account-menu-toggle]");
const accountMenu = document.querySelector("[data-account-menu]");
const preferencesDialog = document.querySelector("[data-preferences-dialog]");
const legalDialog = document.querySelector("[data-legal-dialog]");
const projectSearch = document.querySelector("[data-project-search]");
const projectList = document.querySelector("[data-project-list]");
let projectItems = [...document.querySelectorAll("[data-project-item]")];
const projectListEmpty = document.querySelector("[data-project-list-empty]");
const projectSearchEmpty = document.querySelector("[data-project-search-empty]");
const ideaForm = document.querySelector("[data-idea-form]");
const ideaInput = document.querySelector("[data-project-idea]");
const formFeedback = document.querySelector("[data-form-feedback]");
const ideaWorkspace = document.querySelector(".idea-workspace");
const projectDetail = document.querySelector("[data-project-detail]");
const projectDetailTitle = document.querySelector("[data-project-detail-title]");
const projectDetailDate = document.querySelector("[data-project-detail-date]");
const projectDetailPrompt = document.querySelector("[data-project-detail-prompt]");
const projectDetailResponse = document.querySelector(
  "[data-project-detail-response]",
);
const projectType = document.querySelector("[data-project-type]");
const projectTypeInputs = document.querySelectorAll(
  '[data-project-type] input[name="project_type"]',
);

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

function getCsrfToken() {
  const cookieToken = getCookie("csrftoken");
  if (cookieToken) {
    return cookieToken;
  }

  const csrfInput = document.querySelector("input[name='csrfmiddlewaretoken']");
  return csrfInput?.value || null;
}

async function submitProjectIdea(message) {
  try {
    const csrfToken = getCsrfToken();
    const headers = {
      "Content-Type": "application/json",
    };

    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }

    const response = await fetch("/ai/ask/", {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({ message }),
    });

    if (response.redirected || response.status === 302) {
      console.warn("AI request redirected to login. Please authenticate first.");
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("AI error:", data.error || response.statusText);
      if (formFeedback) {
        formFeedback.textContent = data.error || "Une erreur s'est produite.";
      }
      return null;
    }

    console.log("AI answer:", data.answer);
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    if (formFeedback) {
      formFeedback.textContent = "Erreur de communication avec le service AI.";
    }
    return null;
  }
}

function setTheme(theme) {
  if (!allowedThemes.includes(theme)) {
    return;
  }

  root.dataset.theme = theme;
  localStorage.setItem("iwant-theme", theme);

  themeChoices.forEach((choice) => {
    choice.setAttribute(
      "aria-pressed",
      String(choice.dataset.themeChoice === theme),
    );
  });
}

setTheme(allowedThemes.includes(root.dataset.theme) ? root.dataset.theme : "green");

themeChoices.forEach((choice) => {
  choice.addEventListener("click", () => setTheme(choice.dataset.themeChoice));
});

function closeAccountMenu({ restoreFocus = false } = {}) {
  if (!menuToggle || !accountMenu) {
    return;
  }

  menuToggle.setAttribute("aria-expanded", "false");
  accountMenu.hidden = true;

  if (restoreFocus) {
    menuToggle.focus();
  }
}

function openAccountMenu() {
  if (!menuToggle || !accountMenu) {
    return;
  }

  menuToggle.setAttribute("aria-expanded", "true");
  accountMenu.hidden = false;
  accountMenu.querySelector("a, button")?.focus();
}

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

  if (isOpen) {
    closeAccountMenu();
  } else {
    openAccountMenu();
  }
});

accountMenu?.addEventListener("click", (event) => event.stopPropagation());

document.addEventListener("click", () => closeAccountMenu());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && accountMenu && !accountMenu.hidden) {
    closeAccountMenu({ restoreFocus: true });
  }
});

function openDialog(dialog) {
  closeAccountMenu();

  if (dialog?.showModal) {
    dialog.showModal();
  }
}

document
  .querySelector("[data-open-preferences]")
  ?.addEventListener("click", () => openDialog(preferencesDialog));
document
  .querySelector("[data-open-legal]")
  ?.addEventListener("click", () => openDialog(legalDialog));

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (clickedBackdrop) {
      dialog.close();
    }
  });
});

function filterProjects() {
  const query = projectSearch?.value.trim().toLocaleLowerCase("fr") || "";
  let visibleProjects = 0;

  projectItems.forEach((item) => {
    const projectName = (item.dataset.projectName || item.textContent)
      .trim()
      .toLocaleLowerCase("fr");
    const isVisible = projectName.includes(query);

    item.hidden = !isVisible;
    visibleProjects += Number(isVisible);
  });

  if (projectSearchEmpty) {
    projectSearchEmpty.hidden =
      !query || visibleProjects > 0 || projectItems.length === 0;
  }

  if (projectListEmpty) {
    projectListEmpty.hidden = projectItems.length > 0;
  }
}

projectSearch?.addEventListener("input", filterProjects);

function formatProjectDate(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

function getProjectTitle(prompt) {
  const title = prompt.replace(/\s+/g, " ").trim();
  return title.length > 68 ? `${title.slice(0, 65)}...` : title;
}

function setActiveProject(projectId) {
  projectItems.forEach((item) => {
    const isActive = item.dataset.projectId === String(projectId);
    item.classList.toggle("is-active", isActive);
    item.querySelector("button")?.setAttribute("aria-current", String(isActive));
  });
}

function showProjectDetails(project) {
  if (
    !projectDetail ||
    !projectDetailTitle ||
    !projectDetailDate ||
    !projectDetailPrompt ||
    !projectDetailResponse ||
    !ideaWorkspace
  ) {
    return;
  }

  projectDetailTitle.textContent = getProjectTitle(project.prompt);
  projectDetailDate.textContent = formatProjectDate(project.created_at, {
    dateStyle: "long",
    timeStyle: "short",
  });
  projectDetailDate.dateTime = project.created_at;
  projectDetailPrompt.textContent = project.prompt;
  projectDetailResponse.textContent = project.response_text;
  ideaWorkspace.hidden = true;
  projectDetail.hidden = false;
  setActiveProject(project.id);
  projectDetail.scrollTop = 0;
}

function closeProjectDetails() {
  if (!projectDetail || !ideaWorkspace) {
    return;
  }

  projectDetail.hidden = true;
  ideaWorkspace.hidden = false;
  setActiveProject(null);
  ideaInput?.focus();
}

document
  .querySelector("[data-close-project-detail]")
  ?.addEventListener("click", closeProjectDetails);

async function loadProjectDetails(item) {
  const button = item.querySelector("button");
  button?.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(item.dataset.projectUrl, {
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error("Project unavailable");
    }

    const data = await response.json();
    showProjectDetails(data.project);
  } catch (error) {
    console.error("Project loading error:", error);
    if (formFeedback) {
      formFeedback.textContent = "Impossible d'ouvrir ce projet.";
    }
  } finally {
    button?.removeAttribute("aria-busy");
  }
}

projectList?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-project-item]");
  if (item) {
    loadProjectDetails(item);
  }
});

function createProjectListItem(project) {
  const item = document.createElement("li");
  item.className = "project-item";
  item.dataset.projectItem = "";
  item.dataset.projectId = project.id;
  item.dataset.projectName = project.prompt;
  item.dataset.projectUrl = project.detail_url;

  const button = document.createElement("button");
  button.type = "button";

  const copy = document.createElement("span");
  copy.className = "project-item-copy";

  const title = document.createElement("span");
  title.className = "project-item-title";
  title.textContent = getProjectTitle(project.prompt);

  const date = document.createElement("time");
  date.dateTime = project.created_at;
  date.textContent = formatProjectDate(project.created_at, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M9 5l7 7-7 7");
  svg.append(path);

  copy.append(title, date);
  button.append(copy, svg);
  item.append(button);
  return item;
}

function addProjectToList(project) {
  if (!projectList) {
    return;
  }

  const existingItem = projectItems.find(
    (item) => item.dataset.projectId === String(project.id),
  );
  if (existingItem) {
    return;
  }

  projectList.prepend(createProjectListItem(project));
  projectItems = [...projectList.querySelectorAll("[data-project-item]")];
  filterProjects();
}

const avatar = document.querySelector("[data-user-avatar]");
if (avatar) {
  const avatarColors = ["#6cc46b", "#d06d4b", "#8c52ad", "#477dba", "#d7933e", "#3b9c92"];
  const username = avatar.dataset.username || "IWant";
  const colorIndex = [...username].reduce((total, character) => {
    return total + character.codePointAt(0);
  }, 0) % avatarColors.length;

  avatar.style.backgroundColor = avatarColors[colorIndex];
}

const placeholderPhrases = [
  "Que voulez-vous concevoir aujourd'hui ?",
  "Quelle application avez-vous en tête ?",
];
let placeholderTimer;
let phraseIndex = 0;
let characterIndex = 0;
let isDeleting = false;
let placeholderAnimationStopped = false;

function schedulePlaceholderAnimation(delay) {
  window.clearTimeout(placeholderTimer);
  placeholderTimer = window.setTimeout(animatePlaceholder, delay);
}

function animatePlaceholder() {
  if (!ideaInput || placeholderAnimationStopped) {
    return;
  }

  const currentPhrase = placeholderPhrases[phraseIndex];
  characterIndex += isDeleting ? -1 : 1;
  ideaInput.placeholder = currentPhrase.slice(0, Math.max(0, characterIndex));

  if (!isDeleting && characterIndex === currentPhrase.length) {
    isDeleting = true;
    schedulePlaceholderAnimation(1500);
    return;
  }

  if (isDeleting && characterIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % placeholderPhrases.length;
    schedulePlaceholderAnimation(320);
    return;
  }

  schedulePlaceholderAnimation(isDeleting ? 24 : 48);
}

function stopPlaceholderAnimation() {
  if (!ideaInput || placeholderAnimationStopped) {
    return;
  }

  placeholderAnimationStopped = true;
  window.clearTimeout(placeholderTimer);
  ideaInput.placeholder = "";
}

if (ideaForm && ideaInput && formFeedback) {
  ideaForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!ideaInput.value.trim()) {
      formFeedback.textContent = "Décrivez d’abord votre idée pour continuer.";
      ideaInput.focus();
      return;
    }

    formFeedback.textContent = "Envoi de votre idée au service AI...";
    const submitButton = ideaForm.querySelector("button[type='submit']");
    submitButton?.setAttribute("disabled", "");

    const data = await submitProjectIdea(ideaInput.value.trim());
    submitButton?.removeAttribute("disabled");

    if (data?.project) {
      addProjectToList(data.project);
      showProjectDetails(data.project);
      ideaInput.value = "";
      formFeedback.textContent = "";
    }
  });
}

if (ideaInput) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (reduceMotion.matches) {
    ideaInput.placeholder = placeholderPhrases[0];
  } else {
    ideaInput.placeholder = "";
    schedulePlaceholderAnimation(420);
  }

  ideaInput.addEventListener("pointerdown", stopPlaceholderAnimation, { once: true });
  ideaInput.addEventListener("focus", stopPlaceholderAnimation, { once: true });
  ideaInput.addEventListener("input", () => {
    stopPlaceholderAnimation();

    if (formFeedback?.textContent) {
      formFeedback.textContent = "";
    }
  });
}

projectTypeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (projectType && input.checked) {
      projectType.dataset.selected = input.value;
    }
  });
});
