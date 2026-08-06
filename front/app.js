const startButton = document.querySelector(".start-button");

if (startButton) {
  startButton.addEventListener("click", () => {
    const target = startButton.dataset.target;

    if (target) {
      window.location.href = target;
    }
  });
}
