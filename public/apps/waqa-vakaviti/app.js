(() => {
  "use strict";
  const terms = window.NAISEMA_DRUA_TERMS || {};
  const scenes = window.NAISEMA_DRUA_SCENES || [];
  const $ = id => document.getElementById(id);
  const discovered = new Set();
  const notesKey = "naisema-drua-inquiry-notes-v2";
  let scene = scenes[0];
  let activeMarker = null;
  let notes = {};
  try {
    const saved = JSON.parse(localStorage.getItem(notesKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) notes = saved;
  } catch { notes = {}; }

  function renderSources(term) {
    const list = $("sourceList");
    list.replaceChildren();
    for (const source of term.sources) {
      const li = document.createElement("li");
      if (source.url) {
        const a = document.createElement("a");
        a.href = source.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = source.label;
        li.append(a);
      } else li.textContent = source.label;
      list.append(li);
    }
  }

  function positionZoom(marker) {
    if (!marker || !scene) return;
    const panel = $("zoomPanel");
    const zoom = $("zoomImage");
    const pointer = $("zoomPointer");
    const scale = scene.id === "model" || scene.id === "steering" ? 2.15 : 1.8;
    const width = panel.clientWidth;
    const height = panel.clientHeight;
    const imageHeight = height * scale;
    const imageWidth = imageHeight * scene.width / scene.height;
    const clamp = value => Math.max(0, Math.min(1, value));
    const align = (viewport, image, target) => {
      const diff = viewport - image;
      return Math.abs(diff) < .001 ? .5 : clamp((viewport / 2 - target * image) / diff);
    };
    const px = marker.point[0] / 100;
    const py = marker.point[1] / 100;
    const x = align(width, imageWidth, px);
    const y = align(height, imageHeight, py);
    zoom.style.backgroundSize = `auto ${scale * 100}%`;
    zoom.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
    pointer.style.left = `${(width - imageWidth) * x + px * imageWidth}px`;
    pointer.style.top = `${(height - imageHeight) * y + py * imageHeight}px`;
    pointer.hidden = false;
    zoom.setAttribute("aria-label", `Close-up of the selected ${terms[marker.term].name} point in ${scene.title.toLowerCase()}`);
    $("zoomHint").textContent = `Marked in close-up · ${terms[marker.term].name}`;
  }

  function selectPart(marker) {
    const term = terms[marker.term];
    if (!term) return;
    activeMarker = marker;
    discovered.add(marker.term);
    $("progress").textContent = `${discovered.size} of ${Object.keys(terms).length} names explored`;
    $("groupName").textContent = term.group;
    $("detailTitle").textContent = term.name;
    $("english").textContent = term.english || "";
    $("sourceBadge").textContent = scene.kind;
    $("sourceBadge").hidden = false;
    $("partContent").hidden = false;
    $("seeText").textContent = term.see;
    $("knowText").textContent = term.know;
    $("questionText").textContent = term.question;
    renderSources(term);
    const saved = notes[marker.term] || {};
    $("noticeText").value = typeof saved.notice === "string" ? saved.notice : "";
    $("ownQuestionText").value = typeof saved.question === "string" ? saved.question : "";
    $("checkText").value = typeof saved.check === "string" ? saved.check : "";
    $("noteStatus").textContent = "Notes stay on this device.";
    for (const button of $("hotspots").children) {
      const selected = button.dataset.term === marker.term && button.dataset.point === marker.point.join(",");
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
      if (selected) button.setAttribute("aria-label", `Explore ${term.name}`);
    }
    positionZoom(marker);
    if (window.matchMedia("(max-width: 850px)").matches) {
      $("detailPanel").scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start"});
    }
  }

  function renderHotspots() {
    const container = $("hotspots");
    container.replaceChildren();
    scene.marks.forEach((marker, index) => {
      const term = terms[marker.term];
      if (!term) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      if (marker.point[1] < 12) button.classList.add("at-top");
      if (marker.point[0] > 65) button.classList.add("at-right");
      button.dataset.term = marker.term;
      button.dataset.point = marker.point.join(",");
      button.style.left = `${marker.point[0]}%`;
      button.style.top = `${marker.point[1]}%`;
      button.setAttribute("aria-label", `Explore point ${index + 1} of ${scene.marks.length} in ${scene.title.toLowerCase()}`);
      button.setAttribute("aria-pressed", "false");
      const name = document.createElement("span");
      name.className = "hotspot-name";
      name.lang = "fj";
      name.textContent = term.name;
      button.append(name);
      button.addEventListener("click", () => selectPart(marker));
      container.append(button);
    });
  }

  function resetDetails() {
    activeMarker = null;
    $("groupName").textContent = "Begin with a question";
    $("detailTitle").textContent = "Choose a point";
    $("english").textContent = "Which visible feature might this ring mark?";
    $("partContent").hidden = true;
    $("sourceBadge").hidden = true;
    $("zoomPointer").hidden = true;
    $("zoomImage").setAttribute("aria-label", "Close-up will appear after a ring is selected");
    $("zoomHint").textContent = "Choose a ring to see it close up";
    $("zoomImage").style.backgroundSize = "cover";
    $("zoomImage").style.backgroundPosition = "center";
  }

  function chooseScene(id) {
    const next = scenes.find(item => item.id === id);
    if (!next) return;
    scene = next;
    $("sceneImage").src = scene.src;
    $("sceneImage").alt = scene.alt;
    $("sceneImage").width = scene.width;
    $("sceneImage").height = scene.height;
    $("sceneKind").textContent = scene.kind;
    $("sceneCaption").textContent = scene.id === "model" || scene.id === "steering"
      ? "Supplied reference model · original collection and creator attribution still being checked."
      : "Concept diagram drawn from source descriptions · check every join and route with a builder or sailor.";
    $("zoomImage").style.backgroundImage = `url("${scene.src}")`;
    for (const button of $("sceneButtons").children) {
      if (!button.dataset.scene) continue;
      const selected = button.dataset.scene === id;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("selected", selected);
    }
    resetDetails();
    renderHotspots();
  }

  if (!scenes.length) return;
  for (const item of scenes) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.scene = item.id;
    button.textContent = item.title;
    button.addEventListener("click", () => chooseScene(item.id));
    $("sceneButtons").append(button);
  }
  const languageButton = document.createElement("button");
  languageButton.type = "button";
  languageButton.className = "language-toggle";
  languageButton.textContent = "Language activities";
  languageButton.setAttribute("aria-controls", "languageLab");
  languageButton.setAttribute("aria-expanded", "false");
  languageButton.addEventListener("click", () => {
    const panel = $("languageLab");
    panel.hidden = !panel.hidden;
    languageButton.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) panel.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start"});
  });
  $("sceneButtons").append(languageButton);
  $("closeLanguage").addEventListener("click", () => {
    $("languageLab").hidden = true;
    languageButton.setAttribute("aria-expanded", "false");
    languageButton.focus();
  });
  for (const button of document.querySelectorAll(".waqa-part-link")) {
    button.addEventListener("click", () => {
      const targetScene = scenes.find(item => item.id === button.dataset.scene);
      const marker = targetScene?.marks.find(item => item.term === button.dataset.openPart);
      if (!marker) return;
      chooseScene(targetScene.id);
      selectPart(marker);
      if (!window.matchMedia("(max-width: 850px)").matches) {
        $("explore").scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start"});
      }
    });
  }
  $("progress").textContent = `0 of ${Object.keys(terms).length} names explored`;
  chooseScene(scenes[0].id);
  $("backToImage").addEventListener("click", () => $("explore").scrollIntoView({behavior:"smooth",block:"start"}));
  for (const fieldId of ["noticeText", "ownQuestionText", "checkText"]) {
    $(fieldId).addEventListener("input", () => {
      if (!activeMarker) return;
      notes[activeMarker.term] = {notice:$("noticeText").value,question:$("ownQuestionText").value,check:$("checkText").value};
      try {
        localStorage.setItem(notesKey, JSON.stringify(notes));
        $("noteStatus").textContent = "Saved on this device.";
      } catch { $("noteStatus").textContent = "Saved for this session only."; }
    });
  }
  window.addEventListener("resize", () => positionZoom(activeMarker));
})();
