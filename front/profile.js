const passwordForm = document.querySelector(".password-change-form");
const profileThemeChoices = document.querySelectorAll("[data-theme-choice]");
const allowedProfileThemes = ["green", "orange", "violet", "blue"];

function setProfileTheme(theme) {
  if (!allowedProfileThemes.includes(theme)) {
    return;
  }

  document.documentElement.dataset.theme = theme;
  localStorage.setItem("iwant-theme", theme);
  profileThemeChoices.forEach((choice) => {
    choice.setAttribute("aria-pressed", String(choice.dataset.themeChoice === theme));
  });
}

setProfileTheme(
  allowedProfileThemes.includes(document.documentElement.dataset.theme)
    ? document.documentElement.dataset.theme
    : "green",
);

profileThemeChoices.forEach((choice) => {
  choice.addEventListener("click", () => setProfileTheme(choice.dataset.themeChoice));
});

passwordForm?.addEventListener("submit", () => {
  const button = passwordForm.querySelector(".profile-button");

  if (button) {
    button.disabled = true;
    button.textContent = "Enregistrement...";
  }
});
