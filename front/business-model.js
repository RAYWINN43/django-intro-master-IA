const businessProjectId = new URLSearchParams(window.location.search).get("project") || "demo";
const businessNotes = document.querySelector("[data-business-notes]");
const businessNotesKey = `iwant-business-model-notes-${businessProjectId}`;
const businessBlocks = [...document.querySelectorAll("[data-business-block]")];

try {
  if (businessNotes) businessNotes.value = localStorage.getItem(businessNotesKey) || "";
} catch {
  // The notes field remains usable when local storage is unavailable.
}

businessNotes?.addEventListener("input", () => {
  try {
    localStorage.setItem(businessNotesKey, businessNotes.value);
  } catch {
    showProjectStatus("La note reste visible pour cette session.");
  }
});

businessBlocks.forEach((block) => {
  block.addEventListener("click", () => {
    businessBlocks.forEach((item) => item.classList.toggle("is-selected", item === block));
    showProjectStatus(`${block.querySelector("h3")?.textContent.trim()} sélectionné.`);
  });

  block.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      block.click();
    }
  });
});

document.querySelector("[data-business-info]")?.addEventListener("click", () => {
  showProjectStatus("Le modèle présente les neuf composantes essentielles de votre activité.");
});

document.querySelector("[data-business-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("Le Business Model est en cours de régénération.");

  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("Le Business Model a été régénéré.");
  }, 1100);
});
