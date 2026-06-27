/* ===================================================================
   UniMVS — interactions
   =================================================================== */
(function () {
  "use strict";

  /* ---------- nav: scrolled state + mobile burger ---------- */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  window.addEventListener(
    "scroll",
    () => nav.classList.toggle("scrolled", window.scrollY > 24),
    { passive: true }
  );
  burger.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => nav.classList.remove("open"))
  );

  /* ---------- active nav link via scroll spy ---------- */
  const sections = ["overview", "abilities", "demo", "comparison", "citation"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const links = Array.from(nav.querySelectorAll(".nav-links a"));
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) =>
            l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id)
          );
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));

  /* ---------- reveal on scroll ---------- */
  const revObs = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    revObs.observe(el);
  });

  /* ---------- cursor glow (desktop only) ---------- */
  const glow = document.querySelector(".cursor-glow");
  if (window.matchMedia("(pointer:fine)").matches) {
    window.addEventListener("mousemove", (e) => {
      glow.style.opacity = "1";
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
    });
  }

  /* ---------- gallery (mock scenes) ---------- */
  const scenes = ["scene-orbit", "scene-splat", "scene-slam", "scene-flow"];
  const items = [
    ["The Colosseum", "6 views", "1.2M pts"],
    ["DTU · Scan 24", "49 views", "3.4M pts"],
    ["Tokyo Crossing", "video", "rolling"],
    ["Endoscope Run", "stereo", "metric"],
    ["Drone Swarm", "8 cams", "city"],
    ["Studio Capture", "fisheye×4", "0.8M pts"],
    ["Forest Trail", "video", "2.1M pts"],
    ["Warehouse SLAM", "12 views", "loop"],
    ["Thermal + RGB", "hetero", "fused"],
    ["Ancient Ruins", "32 views", "5.0M pts"],
    ["Indoor Apt", "rgbd", "metric"],
    ["Night Street", "low-light", "1.5M pts"],
  ];
  const gallery = document.getElementById("gallery");
  const viewerScene = document.getElementById("viewerScene");
  const viewerName = document.getElementById("viewerName");
  const viewerMeta = document.getElementById("viewerMeta");

  items.forEach(([name, a, b], i) => {
    const tile = document.createElement("button");
    tile.className = "gtile" + (i === 0 ? " active" : "");
    tile.innerHTML = `
      <div class="media-scene ${scenes[i % scenes.length]}"></div>
      <span class="gtile-badge">${a}</span>
      <span class="gtile-name">${name}</span>`;
    tile.addEventListener("click", () => {
      gallery.querySelectorAll(".gtile").forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      viewerScene.className = "media-scene " + scenes[i % scenes.length];
      viewerName.textContent = name;
      viewerMeta.textContent = `${a} · ${b}`;
    });
    gallery.appendChild(tile);
  });

  /* ---------- comparison slider ---------- */
  const range = document.getElementById("sliderRange");
  const after = document.getElementById("afterPane");
  const handle = document.getElementById("handle");
  if (range) {
    const apply = (v) => {
      after.style.clipPath = `inset(0 0 0 ${v}%)`;
      handle.style.left = v + "%";
    };
    range.addEventListener("input", (e) => apply(e.target.value));
    apply(50);
  }

  /* ---------- copy bibtex ---------- */
  const copyBtn = document.getElementById("copyBib");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = document.getElementById("bibText").innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        const r = document.createRange();
        r.selectNode(document.getElementById("bibText"));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(r);
        document.execCommand("copy");
        window.getSelection().removeAllRanges();
      }
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1600);
    });
  }

  /* ---------- mock play buttons ---------- */
  document.querySelectorAll(".play").forEach((btn) => {
    btn.addEventListener("click", function () {
      const tag = this.parentElement.querySelector(".media-tag");
      if (tag) tag.textContent = "▶ playing… (placeholder)";
      this.style.opacity = "0";
      this.style.pointerEvents = "none";
      setTimeout(() => {
        this.style.opacity = "1";
        this.style.pointerEvents = "auto";
        if (tag) tag.textContent = "0:42 · Teaser reel";
      }, 2400);
    });
  });
})();
