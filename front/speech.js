const speechSections = [...document.querySelectorAll("[data-speech-section]")];
const speechSlides = [...document.querySelectorAll("[data-speech-slide]")];
const speechScript = document.querySelector(".speech-script");
const speechCollapse = document.querySelector("[data-speech-collapse]");
const speechReadButton = document.querySelector("[data-speech-read]");
let speechIsReading = false;

function selectSpeechItem(items, selectedItem, label) {
  items.forEach((item) => item.classList.toggle("is-selected", item === selectedItem));
  showProjectStatus(label);
}

speechSections.forEach((section) => {
  section.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    const title = section.querySelector("h3")?.textContent.trim() || "Section";
    selectSpeechItem(speechSections, section, `${title} sélectionnée.`);
  });

  section.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      section.click();
    }
  });
});

document.querySelectorAll(".speech-more").forEach((button) => {
  button.addEventListener("click", () => {
    const title = button.closest(".speech-section")?.querySelector("h3")?.textContent.trim();
    showProjectStatus(`Options de ${title || "la section"}.`);
  });
});

speechSlides.forEach((slide) => {
  const selectSlide = () => {
    const name = slide.querySelector("p")?.textContent.trim() || "Slide";
    selectSpeechItem(speechSlides, slide, `Slide « ${name} » sélectionnée.`);
  };

  slide.addEventListener("click", selectSlide);
  slide.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSlide();
    }
  });
});

speechCollapse?.addEventListener("click", () => {
  const isCollapsed = speechScript?.classList.toggle("is-collapsed") || false;
  speechCollapse.setAttribute("aria-expanded", String(!isCollapsed));
  speechCollapse.setAttribute("aria-label", isCollapsed ? "Déployer le speech" : "Réduire le speech");
});

document.querySelector("[data-speech-info]")?.addEventListener("click", () => {
  showProjectStatus("Le speech dure environ 3 minutes et 45 secondes et se compose de 6 sections.");
});

document.querySelector("[data-speech-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("Le speech est en cours de régénération.");

  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("Le speech a été régénéré.");
  }, 1100);
});

document.querySelector("[data-speech-generate-slides]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const originalContent = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "<span aria-hidden=\"true\">⋯</span> Génération...";

  window.setTimeout(() => {
    button.disabled = false;
    button.innerHTML = originalContent;
    button.classList.add("is-active");
    showProjectStatus("Le plan de slides est prêt à être exporté.");
  }, 900);
});

function resetSpeechReading() {
  speechIsReading = false;
  speechReadButton?.classList.remove("is-active");
  if (speechReadButton) speechReadButton.innerHTML = "<span aria-hidden=\"true\">♩</span> Lecture du speech";
}

speechReadButton?.addEventListener("click", () => {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showProjectStatus("La lecture vocale n’est pas disponible dans ce navigateur.");
    return;
  }

  if (speechIsReading) {
    window.speechSynthesis.cancel();
    resetSpeechReading();
    showProjectStatus("Lecture du speech arrêtée.");
    return;
  }

  const content = speechSections
    .map((section) => section.querySelector(".speech-section-copy")?.innerText.trim())
    .filter(Boolean)
    .join(". ");
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = "fr-FR";
  utterance.rate = 0.98;
  utterance.addEventListener("end", resetSpeechReading, { once: true });
  utterance.addEventListener("error", resetSpeechReading, { once: true });

  speechIsReading = true;
  speechReadButton.classList.add("is-active");
  speechReadButton.innerHTML = "<span aria-hidden=\"true\">■</span> Arrêter la lecture";
  window.speechSynthesis.speak(utterance);
  showProjectStatus("Lecture du speech en cours.");
});

window.addEventListener("beforeunload", () => window.speechSynthesis?.cancel());
