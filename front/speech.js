const speechProjectId = new URLSearchParams(window.location.search).get("project");
const hasSpeechProject = /^\d+$/.test(speechProjectId || "");
const speechSectionsContainer = document.querySelector("[data-speech-sections]");
const speechScript = document.querySelector(".speech-script");
const speechCollapse = document.querySelector("[data-speech-collapse]");
const speechReadButton = document.querySelector("[data-speech-read]");
let speechSections = [...document.querySelectorAll("[data-speech-section]")];
let speechSlides = [...document.querySelectorAll("[data-speech-slide]")];
let speechIsReading = false;

function getSpeechUrl() {
  if (!hasSpeechProject) return null;
  return `/ai/projects/${speechProjectId}/speech/`;
}

function getSpeechSlidesUrl() {
  if (!hasSpeechProject) return null;
  return `/ai/projects/${speechProjectId}/speech/slides/`;
}

function notifySpeech(message) {
  if (typeof showProjectStatus === "function") {
    showProjectStatus(message);
  }
}

function asSpeechList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function selectSpeechItem(items, selectedItem, label) {
  items.forEach((item) => item.classList.toggle("is-selected", item === selectedItem));
  notifySpeech(label);
}

function appendSpeechTextWithBreaks(element, content) {
  String(content || "")
    .split(/\n+/)
    .filter(Boolean)
    .forEach((line, index) => {
      if (index > 0) element.append(document.createElement("br"));
      element.append(line);
    });
}

function updateSpeechMeta(duration, words) {
  const metaItems = document.querySelectorAll(".speech-script-meta > span");
  if (metaItems[0]) metaItems[0].textContent = `Durée estimée : ${duration || "-"}`;
  if (metaItems[1]) metaItems[1].textContent = `Mots : ${words || "-"}`;
}

function updateSpeechOverview(preview = {}) {
  const cards = document.querySelectorAll(".speech-overview-grid article strong");
  if (cards[0]) cards[0].textContent = preview.duration || "-";
  if (cards[1]) cards[1].textContent = preview.words ? `${preview.words} mots` : "-";
  if (cards[2]) cards[2].textContent = preview.sections ? `${preview.sections} sections` : "-";
}

function setSpeechLoading(message) {
  if (speechSectionsContainer) {
    const state = document.createElement("p");
    state.className = "speech-empty-state";
    state.textContent = message;
    speechSectionsContainer.replaceChildren(state);
  }

  const slidesList = document.querySelector(".speech-slides ol");
  if (slidesList) {
    const item = document.createElement("li");
    item.className = "speech-slide-empty";
    item.textContent = "Génération du plan de slides...";
    slidesList.replaceChildren(item);
  }

  const tipsList = document.querySelector(".speech-tips ul");
  if (tipsList) {
    const item = document.createElement("li");
    item.className = "speech-tip-empty";
    item.textContent = "Génération des conseils...";
    tipsList.replaceChildren(item);
  }

  speechSections = [];
  speechSlides = [];
  updateSpeechMeta("génération...", "-");
  updateSpeechOverview({ duration: "-", words: 0, sections: 0 });
}

function normalizeSpeechArtifact(artifact) {
  const safeArtifact = artifact && typeof artifact === "object" ? artifact : {};
  return {
    estimated_duration: String(safeArtifact.estimated_duration || "3:45 min"),
    word_count: Number(safeArtifact.word_count || 0),
    sections: Array.isArray(safeArtifact.sections) ? safeArtifact.sections : [],
    slide_plan: Array.isArray(safeArtifact.slide_plan) ? safeArtifact.slide_plan : [],
    presentation_tips: asSpeechList(safeArtifact.presentation_tips),
    quick_preview: safeArtifact.quick_preview && typeof safeArtifact.quick_preview === "object"
      ? safeArtifact.quick_preview
      : {},
  };
}

function createSpeechSection(section, index) {
  const safeSection = section && typeof section === "object" ? section : {};
  const title = String(safeSection.title || `Section ${index + 1}`);
  const emoji = String(safeSection.emoji || "🎤");
  const timeRange = String(safeSection.time_range || "");

  const article = document.createElement("article");
  article.className = "speech-section";
  article.tabIndex = 0;
  article.dataset.speechSection = "";

  const drag = document.createElement("span");
  drag.className = "speech-drag";
  drag.setAttribute("aria-hidden", "true");
  drag.textContent = "⠿";

  const copy = document.createElement("div");
  copy.className = "speech-section-copy";

  const heading = document.createElement("div");
  heading.className = "speech-section-heading";

  const headingTitle = document.createElement("h3");
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = emoji;
  headingTitle.append(icon, ` ${index + 1}. ${title}`);

  const time = document.createElement("span");
  time.className = "speech-time";
  time.textContent = timeRange || "-";

  heading.append(headingTitle, time);

  const content = document.createElement("p");
  appendSpeechTextWithBreaks(content, safeSection.content || "Contenu à compléter.");
  copy.append(heading, content);

  const more = document.createElement("button");
  more.className = "speech-more";
  more.type = "button";
  more.setAttribute("aria-label", `Options de ${title}`);
  more.textContent = "⋮";
  more.addEventListener("click", () => {
    notifySpeech(`Options de ${title}.`);
  });

  article.append(drag, copy, more);
  return article;
}

function createSpeechSlide(slide, index) {
  const safeSlide = slide && typeof slide === "object" ? slide : {};
  const item = document.createElement("li");
  item.tabIndex = 0;
  item.dataset.speechSlide = "";

  const number = document.createElement("span");
  number.textContent = String(index + 1);
  const title = document.createElement("p");
  title.textContent = String(safeSlide.title || `Slide ${index + 1}`);
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▧";

  item.append(number, title, icon);
  return item;
}

function renderSpeechTips(tips) {
  const list = document.querySelector(".speech-tips ul");
  if (!list) return;

  const safeTips = asSpeechList(tips);
  if (!safeTips.length) {
    const item = document.createElement("li");
    item.className = "speech-tip-empty";
    item.textContent = "Aucun conseil généré.";
    list.replaceChildren(item);
    return;
  }

  list.replaceChildren(
    ...safeTips.map((tip) => {
      const item = document.createElement("li");
      item.textContent = tip;
      return item;
    }),
  );
}

function bindSpeechSections() {
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
}

function bindSpeechSlides() {
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
}

function renderSpeechArtifact(artifact) {
  const speech = normalizeSpeechArtifact(artifact);

  if (speechSectionsContainer) {
    speechSectionsContainer.replaceChildren(
      ...speech.sections.map((section, index) => createSpeechSection(section, index)),
    );
  }

  const slidesList = document.querySelector(".speech-slides ol");
  if (slidesList) {
    slidesList.replaceChildren(
      ...speech.slide_plan.map((slide, index) => createSpeechSlide(slide, index)),
    );
  }

  speechSections = [...document.querySelectorAll("[data-speech-section]")];
  speechSlides = [...document.querySelectorAll("[data-speech-slide]")];
  bindSpeechSections();
  bindSpeechSlides();
  renderSpeechTips(speech.presentation_tips);
  updateSpeechMeta(speech.estimated_duration, speech.word_count || "-");
  updateSpeechOverview({
    duration: speech.quick_preview.duration || speech.estimated_duration,
    words: speech.quick_preview.words || speech.word_count,
    sections: speech.quick_preview.sections || speech.sections.length,
  });
}

function getCurrentSpeechArtifact() {
  return {
    sections: speechSections.map((section, index) => ({
      id: index + 1,
      title: section.querySelector("h3")?.textContent.trim() || "",
      time_range: section.querySelector(".speech-time")?.textContent.trim() || "",
      content: section.querySelector(".speech-section-copy")?.innerText.trim() || "",
    })),
    slide_plan: speechSlides.map((slide, index) => ({
      id: index + 1,
      title: slide.querySelector("p")?.textContent.trim() || "",
    })),
  };
}

function getCurrentSpeechForSlides() {
  return {
    sections: speechSections.map((section, index) => {
      const title = section.querySelector("h3")?.textContent.trim() || `Slide ${index + 1}`;
      return {
        id: index + 1,
        title: title.replace(/^\S*\s*\d+\.\s*/, "").trim() || title,
        time_range: section.querySelector(".speech-time")?.textContent.trim() || "",
        content: section.querySelector(".speech-section-copy > p")?.innerText.trim() || "",
      };
    }),
  };
}

async function downloadSpeechSlides(button) {
  const url = getSpeechSlidesUrl();
  if (!url) {
    notifySpeech("Ouvrez un projet depuis Mes projets pour generer les slides.");
    return;
  }

  const originalContent = button.innerHTML;
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(speechProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  button.disabled = true;
  button.innerHTML = "<span aria-hidden=\"true\">...</span> Generation...";
  notifySpeech("Generation du PowerPoint...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({ speech: getCurrentSpeechForSlides() }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };
      throw new Error(payload.error || "Impossible de generer les slides.");
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `speech-project-${speechProjectId}.pptx`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    button.classList.add("is-active");
    notifySpeech("PowerPoint genere et telecharge.");
  } catch (error) {
    console.error("Speech slides generation error:", error);
    notifySpeech(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

async function loadSpeech({ force = false } = {}) {
  const url = getSpeechUrl();
  if (!url) {
    notifySpeech("Ouvrez un projet depuis Mes projets pour générer son speech.");
    return;
  }

  const button = document.querySelector("[data-speech-regenerate]");
  const label = button?.querySelector("span");
  const initialLabel = label?.textContent || "Régénérer";
  const currentArtifact = force ? getCurrentSpeechArtifact() : null;
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(speechProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  if (button) button.disabled = true;
  if (label) label.textContent = force ? "Régénération..." : "Génération...";
  setSpeechLoading(force ? "Régénération du speech..." : "Génération du speech...");
  notifySpeech(force ? "Régénération du speech..." : "Génération du speech...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        force,
        current_artifact: currentArtifact,
      }),
    });
    const data = typeof readJsonResponse === "function"
      ? await readJsonResponse(response)
      : await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de générer le speech.");
    }

    renderSpeechArtifact(data.speech || {});
    notifySpeech(data.cached ? "Speech chargé depuis le projet." : "Speech généré avec l'IA.");
  } catch (error) {
    console.error("Speech generation error:", error);
    setSpeechLoading(error.message);
    notifySpeech(error.message);
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = initialLabel;
  }
}

speechCollapse?.addEventListener("click", () => {
  const isCollapsed = speechScript?.classList.toggle("is-collapsed") || false;
  speechCollapse.setAttribute("aria-expanded", String(!isCollapsed));
  speechCollapse.setAttribute("aria-label", isCollapsed ? "Déployer le speech" : "Réduire le speech");
});

document.querySelector("[data-speech-info]")?.addEventListener("click", () => {
  notifySpeech("Le speech est généré avec une durée, un nombre de mots et 6 sections.");
});

document.querySelector("[data-speech-regenerate]")?.addEventListener("click", () => {
  loadSpeech({ force: true });
});

document.querySelector("[data-speech-generate-slides]")?.addEventListener("click", (event) => {
  downloadSpeechSlides(event.currentTarget);
});

function resetSpeechReading() {
  speechIsReading = false;
  speechReadButton?.classList.remove("is-active");
  if (speechReadButton) speechReadButton.innerHTML = "<span aria-hidden=\"true\">♩</span> Lecture du speech";
}

speechReadButton?.addEventListener("click", () => {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    notifySpeech("La lecture vocale n'est pas disponible dans ce navigateur.");
    return;
  }

  if (speechIsReading) {
    window.speechSynthesis.cancel();
    resetSpeechReading();
    notifySpeech("Lecture du speech arrêtée.");
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
  notifySpeech("Lecture du speech en cours.");
});

if (hasSpeechProject) {
  setSpeechLoading("Génération du speech...");
}

bindSpeechSections();
bindSpeechSlides();
loadSpeech();

window.addEventListener("beforeunload", () => window.speechSynthesis?.cancel());
