const ideaForm = document.querySelector("[data-idea-form]");
const ideaInput = document.querySelector("[data-project-idea]");
const formFeedback = document.querySelector("[data-form-feedback]");
const projectType = document.querySelector("[data-project-type]");
const projectTypeInputs = document.querySelectorAll(
  '[data-project-type] input[name="project_type"]',
);

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

  if (isDeleting) {
    characterIndex -= 1;
  } else {
    characterIndex += 1;
  }

  ideaInput.placeholder = currentPhrase.slice(0, Math.max(0, characterIndex));
  ideaInput.dataset.placeholderAnimating = "true";

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
  ideaInput.dataset.placeholderAnimating = "false";
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

if (ideaForm && ideaInput && formFeedback) {
  ideaForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!ideaInput.value.trim()) {
      formFeedback.textContent = "Décrivez d’abord votre idée pour continuer.";
      ideaInput.focus();
      return;
    }

    formFeedback.textContent =
      "Votre idée est prête. Connectez-vous pour lancer sa génération.";
  });
}
