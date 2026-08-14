const sprintTabs = [...document.querySelectorAll("[data-sprint-tab]")];
const sprintStories = [...document.querySelectorAll("[data-sprint-story]")];
const sprintTasks = [...document.querySelectorAll("[data-sprint-task]")];

const sprintPlans = {
  1: {
    title: "Sprint 1",
    state: "En cours",
    description: "Mise en place des fondations de l’application et authentification",
    dates: "05/08/2025 → 19/08/2025",
    duration: "2 semaines",
    points: 34,
    planned: 34,
    progress: 65,
    stories: 6,
    tasks: 18,
    capacity: "40 pts",
    load: "85%",
    risk: "Moyen",
  },
  2: {
    title: "Sprint 2",
    state: "Planifié",
    description: "Recherche, filtres et organisation des fiches de révision",
    dates: "20/08/2025 → 03/09/2025",
    duration: "2 semaines",
    points: 29,
    planned: 32,
    progress: 28,
    stories: 5,
    tasks: 14,
    capacity: "38 pts",
    load: "76%",
    risk: "Faible",
  },
  3: {
    title: "Sprint 3",
    state: "Planifié",
    description: "Partage, commentaires et collaboration entre utilisateurs",
    dates: "04/09/2025 → 18/09/2025",
    duration: "2 semaines",
    points: 31,
    planned: 31,
    progress: 12,
    stories: 6,
    tasks: 16,
    capacity: "40 pts",
    load: "78%",
    risk: "Moyen",
  },
  4: {
    title: "Sprint 4",
    state: "À venir",
    description: "Notifications, profils et personnalisation de l’expérience",
    dates: "19/09/2025 → 03/10/2025",
    duration: "2 semaines",
    points: 26,
    planned: 30,
    progress: 0,
    stories: 5,
    tasks: 13,
    capacity: "36 pts",
    load: "72%",
    risk: "Faible",
  },
  5: {
    title: "Sprint 5",
    state: "À venir",
    description: "Optimisation, accessibilité et préparation de la mise en ligne",
    dates: "04/10/2025 → 18/10/2025",
    duration: "2 semaines",
    points: 24,
    planned: 28,
    progress: 0,
    stories: 4,
    tasks: 12,
    capacity: "35 pts",
    load: "69%",
    risk: "Faible",
  },
};

function setSprintText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function selectSprint(number, announce = true) {
  const sprint = sprintPlans[number];
  if (!sprint) return;

  sprintTabs.forEach((tab) => {
    const isSelected = tab.dataset.sprintTab === String(number);
    tab.classList.toggle("is-active", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });

  setSprintText("[data-sprint-title]", sprint.title);
  setSprintText("[data-sprint-state]", sprint.state);
  setSprintText("[data-sprint-description]", sprint.description);
  setSprintText("[data-sprint-dates]", sprint.dates);
  setSprintText("[data-sprint-duration]", sprint.duration);
  setSprintText("[data-sprint-points]", sprint.points);
  setSprintText("[data-sprint-planned]", sprint.planned);
  setSprintText("[data-sprint-progress]", sprint.progress);
  setSprintText("[data-sprint-stories]", sprint.stories);
  setSprintText("[data-sprint-tasks]", sprint.tasks);
  setSprintText("[data-sprint-total]", sprint.points);
  setSprintText("[data-sprint-donut-value]", `${sprint.progress}%`);
  setSprintText("[data-sprint-capacity]", sprint.capacity);
  setSprintText("[data-sprint-load]", sprint.load);
  setSprintText("[data-sprint-risk]", sprint.risk);

  const [start, end] = sprint.dates.split(" → ");
  setSprintText("[data-sprint-start]", start);
  setSprintText("[data-sprint-end]", end);

  const progressBar = document.querySelector("[data-sprint-progress-bar]");
  if (progressBar) progressBar.style.width = `${sprint.progress}%`;

  sprintStories.forEach((story) => story.classList.remove("is-selected"));
  if (announce) showProjectStatus(`${sprint.title} sélectionné.`);
}

sprintTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectSprint(tab.dataset.sprintTab));
});

sprintStories.forEach((story) => {
  const selectStory = () => {
    sprintStories.forEach((item) => item.classList.toggle("is-selected", item === story));
    showProjectStatus(`${story.dataset.sprintStory} sélectionnée.`);
  };

  story.addEventListener("click", selectStory);
  story.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectStory();
    }
  });
});

sprintTasks.forEach((task) => {
  const selectTask = () => {
    sprintTasks.forEach((item) => item.classList.toggle("is-selected", item === task));
    const taskName = task.querySelector("span")?.textContent.trim() || "Tâche";
    showProjectStatus(`Tâche « ${taskName} » sélectionnée.`);
  };

  task.addEventListener("click", selectTask);
  task.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTask();
    }
  });
});

document.querySelector("[data-sprint-regenerate]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  button.disabled = true;
  if (label) label.textContent = "Régénération...";
  showProjectStatus("Le Sprint Planning est en cours de régénération.");

  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = "Régénérer";
    showProjectStatus("Le Sprint Planning a été régénéré.");
  }, 1100);
});

document.querySelector("[data-sprint-add]")?.addEventListener("click", () => {
  showProjectStatus("Un nouveau sprint pourra être ajouté à la prochaine génération.");
});

document.querySelector("[data-sprint-add-story]")?.addEventListener("click", () => {
  showProjectStatus("Ajout d’une user story au sprint sélectionné.");
});

document.querySelector("[data-sprint-all-tasks]")?.addEventListener("click", () => {
  showProjectStatus("Toutes les tâches du sprint sont déjà affichées dans cette prévisualisation.");
});

document.querySelectorAll(".sprint-team button").forEach((button) => {
  button.addEventListener("click", () => {
    const member = button.closest("li")?.querySelector("strong")?.textContent.trim() || "ce membre";
    showProjectStatus(`Options de ${member}.`);
  });
});

selectSprint(1, false);
