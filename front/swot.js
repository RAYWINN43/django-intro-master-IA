const swotProjectId = new URLSearchParams(window.location.search).get("project") || "demo";
const swotNotes = document.querySelector("[data-swot-notes]");
const swotNotesKey = `iwant-swot-notes-${swotProjectId}`;
const swotQuadrants = [...document.querySelectorAll("[data-swot-quadrant]")];

try {
  if (swotNotes) swotNotes.value = localStorage.getItem(swotNotesKey) || "";
} catch {
  // La zone de notes reste utilisable lorsque le stockage local est indisponible.
}

swotNotes?.addEventListener("input", () => {
  try {
    localStorage.setItem(swotNotesKey, swotNotes.value);
  } catch {
    showProjectStatus("La note reste visible pour cette session.");
  }
});

function selectSwotQuadrant(quadrant) {
  swotQuadrants.forEach((item) => item.classList.toggle("is-selected", item === quadrant));
  const title = quadrant.querySelector("h2")?.textContent.trim() || "Quadrant";
  showProjectStatus(`${title} sélectionné.`);
}

swotQuadrants.forEach((quadrant) => {
  quadrant.addEventListener("click", () => selectSwotQuadrant(quadrant));
  quadrant.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSwotQuadrant(quadrant);
    }
  });
});

document.querySelector("[data-swot-info]")?.addEventListener("click", () => {
  showProjectStatus("La matrice distingue les facteurs internes des facteurs externes au projet.");
});

document.querySelector("[data-swot-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("L’analyse SWOT est en cours de régénération.");

  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("L’analyse SWOT a été régénérée.");
  }, 1100);
});
