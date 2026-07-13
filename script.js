/* ===================================================================
   X-Lens — interactions
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
  const links = Array.from(nav.querySelectorAll(".nav-links a"));
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
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

  /* ---------- hero video switcher ---------- */
  const heroVideo = document.getElementById("heroVideo");
  const heroVideoFrame = heroVideo && heroVideo.closest(".hero-video-frame");
  const heroVideoToggle = document.getElementById("heroVideoToggle");
  const heroVideoTag = document.getElementById("heroVideoTag");
  const heroVideoSwitcher = document.getElementById("heroVideoSwitcher");

  if (heroVideo && heroVideoFrame && heroVideoToggle && heroVideoSwitcher) {
    let heroUserPaused = false;
    let heroVisible = true;

    const setPausedState = () => {
      const paused = heroVideo.paused;
      heroVideoFrame.classList.toggle("paused", paused);
      heroVideoToggle.setAttribute("aria-label", paused ? "Play video" : "Pause video");
    };

    const playSelectedVideo = () => {
      if (document.hidden || !heroVisible || heroUserPaused) return;
      const playPromise = heroVideo.play();
      if (playPromise) playPromise.catch(setPausedState);
    };

    heroVideoToggle.addEventListener("click", () => {
      if (heroVideo.paused) {
        heroUserPaused = false;
        playSelectedVideo();
      } else {
        heroUserPaused = true;
        heroVideo.pause();
      }
    });

    heroVideoSwitcher.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.classList.contains("active")) return;
        heroVideoSwitcher.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        heroVideo.src = button.dataset.src;
        heroVideo.load();
        heroUserPaused = false;
        if (heroVideoTag) heroVideoTag.textContent = button.dataset.label;
        playSelectedVideo();
      });
    });

    heroVideo.addEventListener("play", setPausedState);
    heroVideo.addEventListener("pause", setPausedState);
    heroVideo.addEventListener("loadedmetadata", setPausedState);

    const heroObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      if (heroVisible) playSelectedVideo();
      else heroVideo.pause();
    }, { threshold: 0.05 });
    heroObserver.observe(heroVideoFrame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) heroVideo.pause();
      else playSelectedVideo();
    });

    setPausedState();
    playSelectedVideo();
  }

  /* ---------- pause below-the-fold videos when they are not visible ---------- */
  const viewportVideos = Array.from(document.querySelectorAll(".vla-video video"));
  if (viewportVideos.length) {
    const visibleVideos = new Set();
    const syncViewportVideo = (video) => {
      if (!document.hidden && visibleVideos.has(video)) {
        const promise = video.play();
        if (promise) promise.catch(() => {});
      } else {
        video.pause();
      }
    };
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleVideos.add(entry.target);
        else visibleVideos.delete(entry.target);
        syncViewportVideo(entry.target);
      });
    }, { threshold: 0.08 });
    viewportVideos.forEach((video) => videoObserver.observe(video));
    document.addEventListener("visibilitychange", () => {
      viewportVideos.forEach(syncViewportVideo);
    });
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

})();

/* ---------- benchmark radar charts ---------- */
(function () {
  "use strict";

  const metrics = ["Params", "Scale AbsRel", "AbsRel", "RMSE", "δ₁", "τ₁.₀₃", "FPS"];
  const lowerIsBetter = [true, true, true, true, false, false, false];
  const tables = {
    KITTI360: {
      "UniDepthv2-Small": [0.03, 0.1597, 0.2597, 7.4067, 0.6931, 0.1803, 7],
      "UniDepthv2-Large": [0.35, 0.1787, 0.2718, 8.0432, 0.7091, 0.1860, 5],
      "Metric3Dv2-Giant": [1.38, 0.1598, 0.2258, 6.2469, 0.6865, 0.1434, 4],
      DepthAnyCamera: [0.06, 0.1453, 0.2165, 4.3103, 0.6742, 0.1307, 8],
      UniDAC: [0.36, 0.1176, 0.2413, 4.4671, 0.6967, 0.1251, 6],
      Ours: [0.04, 0.0955, 0.2110, 4.1961, 0.6959, 0.1436, 41],
    },
    ETH3D: {
      VGGT: [1.26, null, 0.0184, 0.4073, 0.9974, 0.8693, 15],
      "VGGT-Omega": [1.14, null, 0.0055, 0.1465, 0.9994, 0.8693, 12],
      "DA3-Small": [0.03, null, 0.0454, 0.7438, 0.9501, 0.5502, 41],
      "DA3-Giant": [1.36, null, 0.0113, 0.2081, 0.9989, 0.9073, 11],
      MapAnything: [1.23, 0.1410, 0.0228, 0.3743, 0.9992, 0.7800, 13],
      Ours: [0.04, 0.1217, 0.0445, 0.6991, 0.9723, 0.5552, 39],
    },
    "OmniScene-Full": {
      MapAnything: [1.23, 0.3701, 0.1746, 2.1834, 0.7357, 0.1647, 5],
      DepthAnyCamera: [0.06, 0.2571, 0.2066, 2.3981, 0.7653, 0.2411, 1],
      UniDAC: [0.36, 0.2506, 0.1368, 2.6125, 0.8156, 0.2511, 1],
      Ours: [0.04, 0.1181, 0.1021, 1.5993, 0.8982, 0.3724, 22],
    },
  };
  const shortNames = {
    "UniDepthv2-Small": "UniD-S",
    "UniDepthv2-Large": "UniD-L",
    "Metric3Dv2-Giant": "M3D-G",
    DepthAnyCamera: "DAC",
    "DA3-Small": "DA3-S",
    "DA3-Giant": "DA3-G",
  };
  const competitorColors = ["#67e8f9", "#8b5cf6", "#38bdf8", "#c084fc", "#2dd4bf", "#94a3b8"];
  const svgNS = "http://www.w3.org/2000/svg";

  function normalize(dataset, rows) {
    const names = Object.keys(rows);
    const scores = Object.fromEntries(names.map((name) => [name, Array(metrics.length).fill(0)]));
    metrics.forEach((_, metricIndex) => {
      const valid = names.map((name) => rows[name][metricIndex]).filter((value) => value !== null);
      const best = lowerIsBetter[metricIndex] ? Math.min(...valid) : Math.max(...valid);
      names.forEach((name) => {
        const value = rows[name][metricIndex];
        scores[name][metricIndex] = value === null ? 0 :
          (lowerIsBetter[metricIndex] ? best / value : value / best) * 100;
      });
    });

    const deltaValues = names.map((name) => rows[name][4]);
    const deltaMin = Math.min(...deltaValues);
    const deltaMax = Math.max(...deltaValues);
    names.forEach((name) => {
      scores[name][4] = 45 + ((rows[name][4] - deltaMin) / (deltaMax - deltaMin)) * 55;
    });

    const gammas = dataset === "KITTI360" ? { 0: 0.45 } : dataset === "ETH3D" ?
      { 0: 0.45, 2: 0.12, 3: 0.12, 4: 0.30, 5: 0.40 } : {};
    Object.entries(gammas).forEach(([index, gamma]) => {
      names.forEach((name) => {
        scores[name][index] = Math.pow(Math.max(0, Math.min(100, scores[name][index])) / 100, gamma) * 100;
      });
    });
    return scores;
  }

  function point(index, value, radius = 105) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / metrics.length;
    const scaled = radius * (value / 100);
    return [180 + Math.cos(angle) * scaled, 150 + Math.sin(angle) * scaled];
  }

  function polygonPoints(values, radius) {
    return values.map((value, index) => point(index, value, radius).join(",")).join(" ");
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(svgNS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function formatValue(metricIndex, value) {
    if (value === null) return "n/a";
    if (metricIndex === 0) return `${value.toFixed(2)}B`;
    if (metricIndex === 6) return `${Math.round(value)} FPS`;
    return value.toFixed(4);
  }

  function renderRadar(card) {
    const dataset = card.dataset.radar;
    const rows = tables[dataset];
    const scores = normalize(dataset, rows);
    const chart = card.querySelector(".radar-chart");
    const legend = card.querySelector(".radar-legend");
    const svg = svgElement("svg", { viewBox: "0 0 360 300", "aria-hidden": "true" });
    const safeId = dataset.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const defs = svgElement("defs");
    const gradient = svgElement("linearGradient", { id: `radar-fill-${safeId}`, x1: "0", y1: "0", x2: "1", y2: "1" });
    gradient.append(svgElement("stop", { offset: "0%", "stop-color": "#d946ef" }));
    gradient.append(svgElement("stop", { offset: "100%", "stop-color": "#f59e0b" }));
    const glow = svgElement("filter", { id: `radar-glow-${safeId}`, x: "-50%", y: "-50%", width: "200%", height: "200%" });
    glow.append(svgElement("feGaussianBlur", { stdDeviation: "3", result: "blur" }));
    const merge = svgElement("feMerge");
    merge.append(svgElement("feMergeNode", { in: "blur" }), svgElement("feMergeNode", { in: "SourceGraphic" }));
    glow.append(merge);
    defs.append(gradient, glow);
    svg.append(defs);

    [20, 40, 60, 80, 100].forEach((level) => {
      svg.append(svgElement("polygon", {
        points: polygonPoints(Array(metrics.length).fill(level), 105),
        class: `radar-ring${level === 100 ? " radar-ring-outer" : ""}`,
      }));
    });
    metrics.forEach((metric, index) => {
      const end = point(index, 100);
      svg.append(svgElement("line", { x1: 180, y1: 150, x2: end[0], y2: end[1], class: "radar-spoke" }));
      const labelPoint = point(index, 100, 128);
      const label = svgElement("text", {
        x: labelPoint[0], y: labelPoint[1], class: "radar-axis-label",
        "text-anchor": labelPoint[0] < 165 ? "end" : labelPoint[0] > 195 ? "start" : "middle",
      });
      const words = metric === "Scale AbsRel" ? ["Scale", "AbsRel ↓"] :
        [metric + (index < 4 ? " ↓" : " ↑")];
      words.forEach((word, wordIndex) => {
        const tspan = svgElement("tspan", { x: labelPoint[0], dy: wordIndex ? "11" : "0" });
        tspan.textContent = word;
        label.append(tspan);
      });
      svg.append(label);
    });

    const names = Object.keys(rows);
    names.forEach((name, methodIndex) => {
      const ours = name === "Ours";
      const color = ours ? "#f472b6" : competitorColors[methodIndex % competitorColors.length];
      const group = svgElement("g", { class: `radar-series${ours ? " radar-series-ours" : ""}`, "data-series": name });
      group.style.setProperty("--series-color", color);
      group.append(svgElement("polygon", {
        points: polygonPoints(scores[name]), class: "radar-area",
        fill: ours ? `url(#radar-fill-${safeId})` : color,
      }));
      group.append(svgElement("polygon", {
        points: polygonPoints(scores[name]), class: "radar-outline",
        stroke: ours ? "#fb7185" : color,
        filter: ours ? `url(#radar-glow-${safeId})` : "none",
      }));
      group.append(svgElement("polygon", {
        points: polygonPoints(scores[name]), class: "radar-hit",
      }));
      scores[name].forEach((value, metricIndex) => {
        const [cx, cy] = point(metricIndex, value);
        const marker = svgElement("circle", { cx, cy, r: ours ? 3.1 : 2.15, class: "radar-point", fill: color });
        const title = svgElement("title");
        title.textContent = `${name} · ${metrics[metricIndex]}: ${formatValue(metricIndex, rows[name][metricIndex])}`;
        marker.append(title);
        group.append(marker);
      });
      svg.append(group);

      const button = document.createElement("button");
      button.type = "button";
      button.className = `radar-legend-item${ours ? " ours" : ""}`;
      button.dataset.series = name;
      button.title = name;
      button.style.setProperty("--series-color", color);
      button.innerHTML = `<span></span>${shortNames[name] || name}`;
      legend.append(button);
    });

    const setActive = (name) => {
      let activeSeries = null;
      card.querySelectorAll(".radar-series").forEach((series) => {
        series.classList.toggle("is-muted", Boolean(name) && series.dataset.series !== name);
        series.classList.toggle("is-active", series.dataset.series === name);
        if (series.dataset.series === name) activeSeries = series;
      });
      if (activeSeries) activeSeries.parentNode.append(activeSeries);
      card.querySelectorAll(".radar-legend-item").forEach((item) => {
        item.classList.toggle("is-muted", Boolean(name) && item.dataset.series !== name);
        item.classList.toggle("is-active", item.dataset.series === name);
      });
    };
    let pinnedSeries = "";
    chart.addEventListener("pointerover", (event) => {
      const series = event.target.closest(".radar-series");
      setActive(series ? series.dataset.series : pinnedSeries);
    });
    chart.addEventListener("pointerleave", () => setActive(pinnedSeries));
    legend.addEventListener("pointerover", (event) => {
      const item = event.target.closest(".radar-legend-item");
      if (item) setActive(item.dataset.series);
    });
    legend.addEventListener("pointerleave", () => setActive(pinnedSeries));
    legend.addEventListener("focusin", (event) => {
      const item = event.target.closest(".radar-legend-item");
      if (item) setActive(item.dataset.series);
    });
    legend.addEventListener("focusout", () => setActive(pinnedSeries));
    legend.addEventListener("click", (event) => {
      const item = event.target.closest(".radar-legend-item");
      if (!item) return;
      pinnedSeries = pinnedSeries === item.dataset.series ? "" : item.dataset.series;
      setActive(pinnedSeries);
    });

    chart.append(svg);
  }

  document.querySelectorAll(".radar-card").forEach(renderRadar);
})();
