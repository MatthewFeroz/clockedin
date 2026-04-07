const params = new URLSearchParams(window.location.search);
const target = params.get("target");

if (target) {
  const targetLabel = document.getElementById("target-label");
  if (targetLabel) {
    targetLabel.textContent = target;
  }
}
