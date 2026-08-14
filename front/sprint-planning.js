const sprintProjectId = new URLSearchParams(window.location.search).get("project");
const hasSprintProject = /^\d+$/.test(sprintProjectId || "");
const sprintTabs = [...document.querySelectorAll("[data-sprint-tab]")];
const sprintStoryBody = document.querySelector(".sprint-stories tbody");
const sprintTaskList = document.querySelector(".sprint-recent ul");
const sprintTeamList = document.querySelector(".sprint-team ul");
const sprintSummaryItems = [...document.querySelectorAll(".sprint-summary-chart li b")];
const sprintDonut = document.querySelector("[data-sprint-donut]");
let sprintStories = [];
let sprintTasks = [];
let currentSprintArtifact = null;

function getSprintUrl() {
  if (!hasSprintProject) return null;
  return `/ai/projects/${sprintProjectId}/sprint/`;
}

function notifySprint(message) {
  if (typeof showProjectStatus === "function") {
    showProjectStatus(message);
  }
}

function setSprintText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function asSprintList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function asPercent(value) {
  const percent = Number.parseInt(value, 10);
  if (Number.isNaN(percent)) return 0;
  return Math.min(Math.max(percent, 0), 100);
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("termin") || value.includes("done")) return "done";
  if (value.includes("cours") || value.includes("progress")) return "progress";
  return "todo";
}

function getPriorityClass(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.includes("haut") || value.includes("high") || value === "p0") return "high";
  if (value.includes("bas") || value.includes("low") || value === "p2") return "low";
  return "medium";
}

function getInitials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "?";
}

function createSprintEmptyRow(message) {
  const row = document.createElement("tr");
  row.className = "sprint-empty-row";
  const cell = document.createElement("td");
  cell.colSpan = 6;
  cell.textContent = message;
  row.append(cell);
  return row;
}

function createSprintEmptyItem(message) {
  const item = document.createElement("li");
  item.className = "sprint-empty-item";
  item.textContent = message;
  return item;
}

function setSprintLoading(message) {
  sprintStoryBody?.replaceChildren(createSprintEmptyRow(message));
  sprintTaskList?.replaceChildren(createSprintEmptyItem("Generation des taches..."));
  sprintTeamList?.replaceChildren(createSprintEmptyItem("Generation de l'equipe..."));
  sprintStories = [];
  sprintTasks = [];

  setSprintText("[data-sprint-title]", "Sprint 1");
  setSprintText("[data-sprint-state]", "Generation");
  setSprintText("[data-sprint-description]", message);
  setSprintText("[data-sprint-dates]", "Semaine 1 -> Semaine 2");
  setSprintText("[data-sprint-duration]", "2 semaines");
  setSprintText("[data-sprint-points]", "-");
  setSprintText("[data-sprint-planned]", "-");
  setSprintText("[data-sprint-progress]", "0");
  setSprintText("[data-sprint-stories]", "-");
  setSprintText("[data-sprint-tasks]", "-");
  setSprintText("[data-sprint-total]", "0");
  setSprintText("[data-sprint-donut-value]", "0%");
  setSprintText("[data-sprint-capacity]", "-");
  setSprintText("[data-sprint-load]", "-");
  setSprintText("[data-sprint-risk]", "-");
  setSprintText("[data-sprint-start]", "Semaine 1");
  setSprintText("[data-sprint-end]", "Semaine 2");
  document.querySelector("[data-sprint-progress-bar]")?.style.setProperty("width", "0%");
  if (sprintDonut) {
    sprintDonut.style.background = "conic-gradient(#67d369 0 0%, #f0ae31 0 0%, #5797e7 0 100%)";
  }
  sprintSummaryItems.forEach((item) => {
    item.textContent = "0 (0%)";
  });
}

function normalizeSprintArtifact(artifact) {
  const safeArtifact = artifact && typeof artifact === "object" ? artifact : {};
  const sprint = safeArtifact.sprint && typeof safeArtifact.sprint === "object"
    ? safeArtifact.sprint
    : safeArtifact;

  return {
    sprint: {
      name: String(sprint.name || "Sprint 1"),
      status: String(sprint.status || "En cours"),
      goal: String(sprint.goal || "Objectif du Sprint 1."),
      duration: String(sprint.duration || "2 semaines"),
      start_label: String(sprint.start_label || "Semaine 1"),
      end_label: String(sprint.end_label || "Semaine 2"),
      team_capacity_points: Number.parseInt(sprint.team_capacity_points, 10) || 40,
      forecast_load_percent: asPercent(sprint.forecast_load_percent || 85),
      risk: String(sprint.risk || "Moyen"),
      total_points: Number.parseInt(sprint.total_points, 10) || 0,
      planned_points: Number.parseInt(sprint.planned_points, 10) || 0,
      progress_percent: asPercent(sprint.progress_percent),
      user_stories: asSprintList(sprint.user_stories),
      tasks: asSprintList(sprint.tasks),
      team: asSprintList(sprint.team),
    },
    summary: safeArtifact.summary && typeof safeArtifact.summary === "object"
      ? safeArtifact.summary
      : {},
  };
}

function createStoryRow(story, index) {
  const safeStory = story && typeof story === "object" ? story : {};
  const progress = asPercent(safeStory.progress_percent);
  const priority = String(safeStory.priority || "Moyenne");
  const status = String(safeStory.status || "A faire");
  const row = document.createElement("tr");
  row.tabIndex = 0;
  row.dataset.sprintStory = safeStory.id || `US-${index + 1}`;

  const idCell = document.createElement("td");
  idCell.textContent = safeStory.id || `US-${index + 1}`;
  const storyCell = document.createElement("td");
  storyCell.textContent = safeStory.story || "User story a completer.";
  const pointsCell = document.createElement("td");
  pointsCell.textContent = String(safeStory.points || 3);

  const priorityCell = document.createElement("td");
  const priorityBadge = document.createElement("span");
  priorityBadge.className = `sprint-priority sprint-priority--${getPriorityClass(priority)}`;
  priorityBadge.textContent = priority;
  priorityCell.append(priorityBadge);

  const statusCell = document.createElement("td");
  const statusBadge = document.createElement("span");
  statusBadge.className = `sprint-status sprint-status--${getStatusClass(status)}`;
  statusBadge.textContent = status;
  statusCell.append(statusBadge);

  const progressCell = document.createElement("td");
  const progressTrack = document.createElement("span");
  progressTrack.className = "story-progress";
  const progressBar = document.createElement("i");
  progressBar.style.width = `${progress}%`;
  progressTrack.append(progressBar);
  const progressValue = document.createElement("b");
  progressValue.textContent = `${progress}%`;
  progressCell.append(progressTrack, progressValue);

  row.append(idCell, storyCell, pointsCell, priorityCell, statusCell, progressCell);
  return row;
}

function createTaskItem(task) {
  const safeTask = task && typeof task === "object" ? task : {};
  const status = String(safeTask.status || "A faire");
  const item = document.createElement("li");
  item.tabIndex = 0;
  item.dataset.sprintTask = "";

  const icon = document.createElement("i");
  icon.textContent = getStatusClass(status) === "done" ? "✓" : "•";
  const label = document.createElement("span");
  label.textContent = safeTask.label || "Tache a completer";
  const badge = document.createElement("b");
  badge.className = `is-${getStatusClass(status)}`;
  badge.textContent = status;
  const more = document.createElement("small");
  more.textContent = "⋮";

  item.append(icon, label, badge, more);
  return item;
}

function createTeamItem(member, index) {
  const safeMember = member && typeof member === "object" ? member : {};
  const name = safeMember.name || `Membre ${index + 1}`;
  const item = document.createElement("li");
  const avatar = document.createElement("span");
  avatar.className = `team-avatar team-avatar--${["emma", "lucas", "sarah"][index % 3]}`;
  avatar.textContent = getInitials(name);
  const copy = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = name;
  const role = document.createElement("small");
  role.textContent = safeMember.role || "Equipe projet";
  copy.append(strong, role);
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Options de ${name}`);
  button.textContent = "⋮";
  item.append(avatar, copy, button);
  return item;
}

function updateSprintSummary(stories, summary = {}) {
  const computed = { done: 0, in_progress: 0, todo: 0 };
  stories.forEach((story) => {
    const className = getStatusClass(story.status);
    if (className === "done") computed.done += 1;
    else if (className === "progress") computed.in_progress += 1;
    else computed.todo += 1;
  });

  const done = Number.parseInt(summary.done, 10) || computed.done;
  const inProgress = Number.parseInt(summary.in_progress, 10) || computed.in_progress;
  const todo = Number.parseInt(summary.todo, 10) || computed.todo;
  const total = done + inProgress + todo || stories.length || 1;
  const donePercent = Math.round((done / total) * 100);
  const progressPercent = Math.round((inProgress / total) * 100);
  const todoPercent = Math.max(0, 100 - donePercent - progressPercent);
  const values = [
    `${done} (${donePercent}%)`,
    `${inProgress} (${progressPercent}%)`,
    `${todo} (${todoPercent}%)`,
  ];

  sprintSummaryItems.forEach((item, index) => {
    item.textContent = values[index] || "0 (0%)";
  });

  if (sprintDonut) {
    const progressEnd = donePercent + progressPercent;
    sprintDonut.style.background = `conic-gradient(#67d369 0 ${donePercent}%, #f0ae31 ${donePercent}% ${progressEnd}%, #5797e7 ${progressEnd}% 100%)`;
  }
}

function bindSprintStories() {
  sprintStories.forEach((story) => {
    const selectStory = () => {
      sprintStories.forEach((item) => item.classList.toggle("is-selected", item === story));
      notifySprint(`${story.dataset.sprintStory} selectionnee.`);
    };

    story.addEventListener("click", selectStory);
    story.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectStory();
      }
    });
  });
}

function bindSprintTasks() {
  sprintTasks.forEach((task) => {
    const selectTask = () => {
      sprintTasks.forEach((item) => item.classList.toggle("is-selected", item === task));
      const taskName = task.querySelector("span")?.textContent.trim() || "Tache";
      notifySprint(`Tache "${taskName}" selectionnee.`);
    };

    task.addEventListener("click", selectTask);
    task.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTask();
      }
    });
  });
}

function bindSprintTeam() {
  document.querySelectorAll(".sprint-team button").forEach((button) => {
    button.addEventListener("click", () => {
      const member = button.closest("li")?.querySelector("strong")?.textContent.trim() || "ce membre";
      notifySprint(`Options de ${member}.`);
    });
  });
}

function renderSprintArtifact(artifact) {
  currentSprintArtifact = normalizeSprintArtifact(artifact);
  const { sprint, summary } = currentSprintArtifact;
  const stories = asSprintList(sprint.user_stories);
  const tasks = asSprintList(sprint.tasks);
  const team = asSprintList(sprint.team);
  const totalPoints = sprint.total_points || stories.reduce((sum, story) => {
    return sum + (Number.parseInt(story.points, 10) || 0);
  }, 0);
  const plannedPoints = sprint.planned_points || totalPoints;
  const progress = asPercent(sprint.progress_percent);

  setSprintText("[data-sprint-title]", sprint.name);
  setSprintText("[data-sprint-state]", sprint.status);
  setSprintText("[data-sprint-description]", sprint.goal);
  setSprintText("[data-sprint-dates]", `${sprint.start_label} -> ${sprint.end_label}`);
  setSprintText("[data-sprint-duration]", sprint.duration);
  setSprintText("[data-sprint-points]", totalPoints);
  setSprintText("[data-sprint-planned]", plannedPoints);
  setSprintText("[data-sprint-progress]", progress);
  setSprintText("[data-sprint-stories]", stories.length);
  setSprintText("[data-sprint-tasks]", tasks.length);
  setSprintText("[data-sprint-total]", totalPoints);
  setSprintText("[data-sprint-donut-value]", `${progress}%`);
  setSprintText("[data-sprint-capacity]", `${sprint.team_capacity_points} pts`);
  setSprintText("[data-sprint-load]", `${sprint.forecast_load_percent}%`);
  setSprintText("[data-sprint-risk]", sprint.risk);
  setSprintText("[data-sprint-start]", sprint.start_label);
  setSprintText("[data-sprint-end]", sprint.end_label);
  document.querySelector("[data-sprint-progress-bar]")?.style.setProperty("width", `${progress}%`);

  if (sprintStoryBody) {
    sprintStoryBody.replaceChildren(
      ...(stories.length
        ? stories.map((story, index) => createStoryRow(story, index))
        : [createSprintEmptyRow("Aucune user story generee.")]),
    );
  }

  if (sprintTaskList) {
    sprintTaskList.replaceChildren(
      ...(tasks.length
        ? tasks.map((task) => createTaskItem(task))
        : [createSprintEmptyItem("Aucune tache generee.")]),
    );
  }

  if (sprintTeamList) {
    sprintTeamList.replaceChildren(
      ...(team.length
        ? team.map((member, index) => createTeamItem(member, index))
        : [createSprintEmptyItem("Aucune equipe generee.")]),
    );
  }

  sprintStories = [...document.querySelectorAll("[data-sprint-story]")];
  sprintTasks = [...document.querySelectorAll("[data-sprint-task]")];
  updateSprintSummary(stories, summary);
  bindSprintStories();
  bindSprintTasks();
  bindSprintTeam();
}

async function loadSprint({ force = false } = {}) {
  const url = getSprintUrl();
  if (!url) {
    notifySprint("Ouvrez un projet depuis Mes projets pour generer son sprint.");
    return;
  }

  const button = document.querySelector("[data-sprint-regenerate]");
  const label = button?.querySelector("span");
  const initialLabel = label?.textContent || "Regenerer";
  const headers = { "Content-Type": "application/json" };
  const csrfToken = typeof ensureCsrfToken === "function"
    ? await ensureCsrfToken(sprintProjectId)
    : null;
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  if (button) button.disabled = true;
  if (label) label.textContent = force ? "Regeneration..." : "Generation...";
  setSprintLoading(force ? "Regeneration du Sprint Planning..." : "Generation du Sprint Planning...");
  notifySprint(force ? "Regeneration du Sprint Planning..." : "Generation du Sprint Planning...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        force,
        current_artifact: force ? currentSprintArtifact : null,
      }),
    });
    const data = typeof readJsonResponse === "function"
      ? await readJsonResponse(response)
      : await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de generer le Sprint Planning.");
    }

    renderSprintArtifact(data.sprint || {});
    notifySprint(data.cached ? "Sprint charge depuis le projet." : "Sprint genere avec l'IA.");
  } catch (error) {
    console.error("Sprint generation error:", error);
    setSprintLoading(error.message);
    notifySprint(error.message);
  } finally {
    if (button) button.disabled = false;
    if (label) label.textContent = initialLabel;
  }
}

document.querySelector("[data-sprint-regenerate]")?.addEventListener("click", () => {
  loadSprint({ force: true });
});

document.querySelector("[data-sprint-add-story]")?.addEventListener("click", () => {
  notifySprint("Ajout manuel non disponible dans cette version.");
});

document.querySelector("[data-sprint-all-tasks]")?.addEventListener("click", () => {
  notifySprint("Les taches principales du Sprint 1 sont deja affichees.");
});

if (hasSprintProject) {
  setSprintLoading("Generation du Sprint Planning...");
}

loadSprint();
