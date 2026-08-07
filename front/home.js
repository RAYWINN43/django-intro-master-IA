const root = document.documentElement;
const allowedThemes = ["green", "orange", "violet", "blue"];
const themeChoices = document.querySelectorAll("[data-theme-choice]");
const menuToggle = document.querySelector("[data-account-menu-toggle]");
const accountMenu = document.querySelector("[data-account-menu]");
const preferencesDialog = document.querySelector("[data-preferences-dialog]");
const legalDialog = document.querySelector("[data-legal-dialog]");
const projectSearch = document.querySelector("[data-project-search]");
const projectItems = [...document.querySelectorAll("[data-project-item]")];
const projectSearchEmpty = document.querySelector("[data-project-search-empty]");
const ideaForm = document.querySelector("[data-idea-form]");
const ideaInput = document.querySelector("[data-project-idea]");
const formFeedback = document.querySelector("[data-form-feedback]");
const projectType = document.querySelector("[data-project-type]");
const projectTypeInputs = document.querySelectorAll(
  '[data-project-type] input[name="project_type"]',
);

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

if (projectSearch) {
  projectSearch.addEventListener("input", () => {
    const query = projectSearch.value.trim().toLocaleLowerCase("fr");
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
      projectSearchEmpty.hidden = !query || visibleProjects > 0 || projectItems.length === 0;
    }
  });
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

ideaForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!ideaInput?.value.trim()) {
    if (formFeedback) {
      formFeedback.textContent = "Décrivez d’abord votre idée pour continuer.";
    }
    ideaInput?.focus();
    return;
  }

  if (formFeedback) {
    formFeedback.textContent = "Votre idée est prête à être transformée en projet.";
  }
});
