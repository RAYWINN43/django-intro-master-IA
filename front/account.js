const accountPage = document.querySelector("[data-account-page]");
const panels = document.querySelectorAll("[data-account-panel]");
const stories = document.querySelectorAll("[data-account-story]");
const switchButtons = document.querySelectorAll("[data-switch-account]");
const signupForm = document.querySelector("[data-signup-form]");
const loginForm = document.querySelector("[data-login-form]");
const passwordToggles = document.querySelectorAll("[data-password-toggle]");
const allowedThemes = ["green", "orange", "violet", "blue"];

function restoreTheme() {
  const storedTheme = localStorage.getItem("iwant-theme");

  if (allowedThemes.includes(storedTheme)) {
    document.documentElement.dataset.theme = storedTheme;
  }
}

function getInitialMode() {
  const hashMode = window.location.hash.replace("#", "");

  if (hashMode === "inscription" || hashMode === "connexion") {
    return hashMode;
  }

  return accountPage?.dataset.initialMode === "inscription"
    ? "inscription"
    : "connexion";
}

function showAccountMode(mode, shouldFocus = false) {
  if (!accountPage) {
    return;
  }

  const nextMode = mode === "inscription" ? "inscription" : "connexion";
  accountPage.dataset.mode = nextMode;
  document.title = `${nextMode === "inscription" ? "Inscription" : "Connexion"} — IWant`;

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== nextMode;
  });

  stories.forEach((story) => {
    story.hidden = story.dataset.accountStory !== nextMode;
  });

  if (window.location.hash !== `#${nextMode}`) {
    history.replaceState(null, "", `#${nextMode}`);
  }

  if (shouldFocus) {
    const activePanel = document.querySelector(`[data-account-panel="${nextMode}"]`);
    requestAnimationFrame(() => activePanel?.querySelector("input")?.focus());
  }
}

switchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showAccountMode(button.dataset.switchAccount, true);
  });
});

window.addEventListener("hashchange", () => {
  showAccountMode(getInitialMode());
});

passwordToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.passwordToggle);

    if (!input) {
      return;
    }

    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    toggle.setAttribute("aria-pressed", String(!isVisible));
    toggle.setAttribute(
      "aria-label",
      isVisible ? "Afficher le mot de passe" : "Masquer le mot de passe",
    );
    input.focus({ preventScroll: true });
  });
});

if (signupForm) {
  signupForm.addEventListener("submit", (event) => {
    const password = signupForm.querySelector("#password");
    const confirmation = signupForm.querySelector("#password-confirm");

    if (password && confirmation && password.value !== confirmation.value) {
      event.preventDefault();
      confirmation.setCustomValidity("Les mots de passe ne correspondent pas.");
      confirmation.reportValidity();
      return;
    }

    confirmation?.setCustomValidity("");
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", () => {
    const button = loginForm.querySelector(".login-button");

    if (button) {
      button.disabled = true;
      button.querySelector("span").textContent = "Connexion…";
    }
  });
}

restoreTheme();
showAccountMode(getInitialMode());
