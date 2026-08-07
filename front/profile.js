const passwordForm = document.querySelector(".password-change-form");

passwordForm?.addEventListener("submit", () => {
  const button = passwordForm.querySelector(".profile-button");

  if (button) {
    button.disabled = true;
    button.textContent = "Enregistrement...";
  }
});
