// Vosa's quizzes work without this script: each answer is in a disclosure. With it, choosing an
// option says at once whether it was right, and opens the explanation when it was.
document.addEventListener("click", (event) => {
  const option = event.target instanceof Element ? event.target.closest(".vosa-quiz-option") : null;
  if (!option) return;
  const card = option.closest(".vosa-quiz-card");
  if (!card) return;
  const right = option.dataset.correct === "true";
  for (const other of card.querySelectorAll(".vosa-quiz-option")) other.removeAttribute("aria-pressed");
  option.setAttribute("aria-pressed", "true");
  option.classList.toggle("is-right", right);
  option.classList.toggle("is-wrong", !right);
  const feedback = card.querySelector(".vosa-quiz-feedback");
  if (feedback) feedback.textContent = right ? "Yes. Read why below." : card.dataset.hint || "Not quite. Try another.";
  const answer = card.querySelector(".vosa-quiz-answer");
  if (right && answer) answer.open = true;
});
