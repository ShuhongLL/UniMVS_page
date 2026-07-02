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

  /* ---------- hero video switcher ---------- */
  const heroVideo = document.getElementById("heroVideo");
  const heroVideoFrame = heroVideo && heroVideo.closest(".hero-video-frame");
  const heroVideoToggle = document.getElementById("heroVideoToggle");
  const heroVideoTag = document.getElementById("heroVideoTag");
  const heroVideoSwitcher = document.getElementById("heroVideoSwitcher");

  if (heroVideo && heroVideoFrame && heroVideoToggle && heroVideoSwitcher) {
    const setPausedState = () => {
      const paused = heroVideo.paused;
      heroVideoFrame.classList.toggle("paused", paused);
      heroVideoToggle.setAttribute("aria-label", paused ? "Play video" : "Pause video");
    };

    const playSelectedVideo = () => {
      const playPromise = heroVideo.play();
      if (playPromise) playPromise.catch(setPausedState);
    };

    heroVideoToggle.addEventListener("click", () => {
      if (heroVideo.paused) {
        playSelectedVideo();
      } else {
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
        if (heroVideoTag) heroVideoTag.textContent = button.dataset.label;
        playSelectedVideo();
      });
    });

    heroVideo.addEventListener("play", setPausedState);
    heroVideo.addEventListener("pause", setPausedState);
    heroVideo.addEventListener("loadedmetadata", setPausedState);
    setPausedState();
    playSelectedVideo();
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
