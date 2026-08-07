const accountPage = document.querySelector("[data-account-page]");
const accountHeader = document.querySelector("[data-account-header]");
const panels = document.querySelectorAll("[data-account-panel]");
const switchButtons = document.querySelectorAll("[data-switch-account]");
const signupForm = document.querySelector("[data-signup-form]");
const loginForm = document.querySelector("[data-login-form]");

function getInitialMode() {
  const hashMode = window.location.hash.replace("#", "");

  if (hashMode === "inscription") {
    return "inscription";
  }

  return accountPage?.dataset.initialMode === "inscription"
    ? "inscription"
    : "connexion";
}

function showAccountMode(mode) {
  if (!accountPage) {
    return;
  }

  accountPage.dataset.mode = mode;

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== mode;
  });

  if (accountHeader) {
    accountHeader.hidden = mode !== "inscription";
  }

  if (window.location.hash !== `#${mode}`) {
    window.location.hash = mode;
  }
}

switchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showAccountMode(button.dataset.switchAccount);
  });
});

window.addEventListener("hashchange", () => {
  showAccountMode(getInitialMode());
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

    if (confirmation) {
      confirmation.setCustomValidity("");
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", () => {
    const button = loginForm.querySelector(".login-button");

    if (button) {
      button.disabled = true;
      button.textContent = "Connexion";
    }
  });
}

showAccountMode(getInitialMode());
