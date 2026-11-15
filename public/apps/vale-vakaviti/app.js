(() => {
  "use strict";

  const parts = window.NAISEMA_VALE_PARTS || [];
  const byId = Object.fromEntries(parts.map(part => [part.id, part]));
  const $ = id => document.getElementById(id);
  const studyUrl = "https://repository.kulib.kyoto-u.ac.jp/dspace/bitstream/2433/173637/1/JDR_8%281%29_18.pdf#page=6";
  const groupNames = {base: "The base", frame: "Posts and beams", roof: "The roof", research: "Research lead"};
  const history = [];
  const notesKey = "naisema-vale-vakaviti-field-notes-v2";
  const legacyNotesKey = "naisema-vale-vakaviti-field-notes-v1";
  const builderNotesKey = "naisema-vale-vakaviti-builder-inquiry-v1";
  let notes = {};
  try {
    const stored = JSON.parse(localStorage.getItem(notesKey) || localStorage.getItem(legacyNotesKey) || "{}");
    notes = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch { notes = {}; }
  let pinnedId = "yavu";
  let activeId = "yavu";
  let currentFilter = "all";

  function navigate(id, push = true) {
    if (!byId[id]) return;
    if (push && pinnedId !== id) history.push(pinnedId);
    pinnedId = id;
    show(id);
    document.querySelector(".detail-panel").scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start"});
  }

  function richText(target, value) {
    target.replaceChildren();
    const pattern = /\[\[([a-z0-9_]+)\]\]/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      target.append(document.createTextNode(value.slice(cursor, match.index)));
      const linked = byId[match[1]];
      if (linked) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "part-link";
        button.lang = "fj";
        button.textContent = linked.name;
        button.setAttribute("aria-label", `Explore ${linked.name}`);
        button.addEventListener("click", () => navigate(linked.id));
        target.append(button);
      } else {
        target.append(document.createTextNode(match[0]));
      }
      cursor = pattern.lastIndex;
    }
    target.append(document.createTextNode(value.slice(cursor)));
  }

  function renderSources(part) {
    const list = $("sourceList");
    list.replaceChildren();
    for (const source of part.sources) {
      const li = document.createElement("li");
      if (source.startsWith("Cautata study")) {
        const a = document.createElement("a");
        a.href = studyUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = source;
        li.append(a);
      } else {
        li.textContent = source;
      }
      list.append(li);
    }
  }

  function positionZoom(part) {
    const zoom = $("zoomImage");
    const panel = zoom.parentElement;
    const pointer = $("zoomPointer");
    if (!part.point) {
      panel.classList.add("unmapped");
      pointer.hidden = true;
      zoom.style.backgroundSize = "contain";
      zoom.style.backgroundPosition = "50% 50%";
      zoom.setAttribute("aria-label", "Full house image; this term's location is under review");
      $("zoomHint").textContent = "Position on this image under review";
      return;
    }
    panel.classList.remove("unmapped");
    const locationOpen = Boolean(part.provisional && !part.pointLocated);
    const zoomScale = part.zoomScale || (locationOpen ? 1.45 : 2.2);
    zoom.style.backgroundSize = `auto ${zoomScale * 100}%`;
    const width = zoom.clientWidth;
    const height = zoom.clientHeight;
    const imageHeight = height * zoomScale;
    const imageWidth = imageHeight * (1514 / 1039);
    const clamp = value => Math.max(0, Math.min(1, value));
    const alignment = (viewport, image, target) => {
      const difference = viewport - image;
      return Math.abs(difference) < 0.001 ? 0.5 : clamp((viewport / 2 - target * image) / difference);
    };
    const zoomPoint = part.zoomPoint || part.point;
    const x = alignment(width, imageWidth, zoomPoint[0] / 100);
    const y = alignment(height, imageHeight, zoomPoint[1] / 100);
    zoom.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
    const markerX = (width - imageWidth) * x + part.point[0] / 100 * imageWidth;
    const markerY = (height - imageHeight) * y + part.point[1] / 100 * imageHeight;
    pointer.hidden = false;
    pointer.dataset.group = part.group;
    pointer.classList.toggle("provisional", locationOpen);
    pointer.classList.toggle("located-point", Boolean(part.pointLocated));
    pointer.classList.toggle("label-below", markerY < 56);
    pointer.classList.toggle("label-left", markerX > width * 0.65);
    pointer.classList.toggle("label-right", markerX < width * 0.35);
    pointer.style.left = `${markerX}px`;
    pointer.style.top = `${markerY}px`;
    $("zoomPointerLabel").textContent = locationOpen ? `${part.name} · area to check` : part.name;
    zoom.setAttribute("aria-label", locationOpen ? `Research area for ${part.name} marked in the close-up; exact timber unconfirmed` : `${part.name} marked in the close-up of the selected house image`);
    $("zoomHint").textContent = locationOpen ? `? Area to check · ${part.name}` : `Marked in close-up · ${part.name}`;
  }

  function show(id) {
    const part = byId[id];
    if (!part) return;
    activeId = id;
    $("groupName").textContent = groupNames[part.group] || "Explore";
    $("detailTitle").textContent = part.name;
    $("english").textContent = part.english || "";
    $("english").hidden = !part.english;
    $("confidence").textContent = part.confidence;
    richText($("seeText"), part.see);
    richText($("knowText"), part.know);
    richText($("questionText"), part.question);
    renderSources(part);
    const savedNote = notes[id];
    const note = typeof savedNote === "string" ? {notice: savedNote} : savedNote || {};
    $("noticeText").value = note.notice || "";
    $("ownQuestionText").value = note.question || "";
    $("checkText").value = note.check || "";
    $("noteStatus").textContent = "Notes stay on this device.";

    const related = $("relatedParts");
    related.replaceChildren();
    for (const linkedId of part.related) {
      const linked = byId[linkedId];
      if (!linked) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.lang = "fj";
      button.textContent = `${linked.name} →`;
      button.addEventListener("click", () => navigate(linkedId));
      related.append(button);
    }

    positionZoom(part);

    for (const button of document.querySelectorAll("[data-part]")) {
      const isActive = button.dataset.part === id;
      button.classList.toggle("active", isActive);
      if (button.classList.contains("hotspot")) button.setAttribute("aria-pressed", String(isActive));
    }
    $("backPart").hidden = history.length === 0;
  }

  function renderHotspots() {
    const container = $("hotspots");
    for (const part of parts.filter(item => item.point)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.dataset.part = part.id;
      button.dataset.group = part.group;
      if (part.provisional && !part.pointLocated) button.classList.add("provisional");
      if (part.pointLocated) button.classList.add("located-point");
      if (part.point[0] > 72) button.classList.add("tip-left");
      button.style.left = `${part.point[0]}%`;
      button.style.top = `${part.point[1]}%`;
      button.setAttribute("aria-label", part.pointLocated ? `Explore ${part.name}, ${part.pointDescription || "selected feature on the image"}` : part.provisional ? `Research pointer for ${part.name}; location unconfirmed` : `Explore ${part.name}`);
      button.setAttribute("aria-pressed", "false");
      const tip = document.createElement("span");
      tip.className = "hotspot-tip";
      tip.lang = "fj";
      tip.textContent = part.provisional && !part.pointLocated ? `${part.name} · area to check` : part.name;
      button.append(tip);
      button.addEventListener("pointerenter", event => {if (event.pointerType !== "touch") show(part.id);});
      button.addEventListener("pointerleave", () => show(pinnedId));
      button.addEventListener("focus", () => show(part.id));
      button.addEventListener("click", () => navigate(part.id, true));
      container.append(button);
    }
  }

  function renderLibrary() {
    const list = $("partList");
    for (const part of parts) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "part-item";
      button.dataset.part = part.id;
      button.dataset.group = part.group;
      const name = document.createElement("strong");
      name.lang = "fj";
      name.textContent = part.name;
      const gloss = document.createElement("small");
      gloss.textContent = part.english || "";
      const tag = document.createElement("span");
      tag.className = "item-tag";
      tag.textContent = part.pointLocated ? "Visible feature selected" : part.provisional ? "Location to confirm" : part.point ? groupNames[part.group] : "Location to review";
      button.append(name);
      if (part.english) button.append(gloss);
      button.append(tag);
      button.addEventListener("click", () => navigate(part.id));
      list.append(button);
    }
  }

  function setFilter(filter) {
    currentFilter = filter;
    for (const button of document.querySelectorAll(".filters button")) button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    for (const button of $("partList").children) button.hidden = filter !== "all" && button.dataset.group !== filter;
  }

  if (!parts.length) return;
  renderHotspots();
  renderLibrary();
  $("mappedCount").textContent = String(parts.filter(part => part.point).length);
  $("researchCount").textContent = String(parts.filter(part => part.provisional).length);
  $("toggleNames").addEventListener("click", () => {
    const pressed = $("toggleNames").getAttribute("aria-pressed") === "true";
    $("toggleNames").setAttribute("aria-pressed", String(!pressed));
    $("toggleNames").textContent = pressed ? "Show names on the image" : "Hide names on the image";
    $("hotspots").classList.toggle("show-all", !pressed);
  });
  $("backPart").addEventListener("click", () => {
    const previous = history.pop();
    if (previous) {pinnedId = previous; show(previous);}
  });
  document.querySelectorAll(".filters button").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter)));
  document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.open)));
  for (const fieldId of ["noticeText", "ownQuestionText", "checkText"]) {
    $(fieldId).addEventListener("input", () => {
      notes[activeId] = {
        notice: $("noticeText").value,
        question: $("ownQuestionText").value,
        check: $("checkText").value
      };
      try {
        localStorage.setItem(notesKey, JSON.stringify(notes));
        $("noteStatus").textContent = "Saved on this device.";
      } catch {
        $("noteStatus").textContent = "Saved for this session only.";
      }
    });
  }
  const builderFieldIds = ["builderStart", "builderChange", "builderCheck"];
  let builderNotes = {};
  try {
    const stored = JSON.parse(localStorage.getItem(builderNotesKey) || "{}");
    builderNotes = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch { builderNotes = {}; }
  for (const fieldId of builderFieldIds) {
    const field = $(fieldId);
    field.value = typeof builderNotes[fieldId] === "string" ? builderNotes[fieldId] : "";
    field.addEventListener("input", () => {
      builderNotes[fieldId] = field.value;
      try {
        localStorage.setItem(builderNotesKey, JSON.stringify(builderNotes));
        $("builderStatus").textContent = "Saved on this device.";
      } catch {
        $("builderStatus").textContent = "Saved for this session only.";
      }
    });
  }
  window.addEventListener("resize", () => positionZoom(byId[activeId]));
  setFilter(currentFilter);
  show(pinnedId);
})();
