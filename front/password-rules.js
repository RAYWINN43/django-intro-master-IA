const passwordChecks = {
  length: (password) => password.length >= 12,
  digit: (password) => /\d/.test(password),
  case: (password) => /[A-Z]/.test(password) && /[a-z]/.test(password),
  special: (password) => /[^A-Za-z0-9]/.test(password),
};

document.querySelectorAll("[data-password-input]").forEach((input) => {
  const form = input.closest("form");
  const rules = form?.querySelector("[data-password-rules]");

  if (!rules) {
    return;
  }

  const updatePasswordRules = () => {
    const password = input.value;

    rules.querySelectorAll("[data-password-rule]").forEach((rule) => {
      const isValid = passwordChecks[rule.dataset.passwordRule]?.(password);
      rule.classList.toggle("is-valid", Boolean(isValid));
    });
  };

  input.addEventListener("input", updatePasswordRules);
  updatePasswordRules();
});
