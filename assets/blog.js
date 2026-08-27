/* Shared behaviour for the blog index and article pages.
   Dr. Usha Sri Bollineni, DDS - Comfort Dental, Overland Park KS */
(function () {
  "use strict";

  /* ---- 1. Reveal elements as they scroll into view ---- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i, 6) * 70) + "ms";
      obs.observe(el);
    });
  }

  /* ---- 2. Reading progress bar (article pages) ---- */
  function initProgress() {
    var bar = document.getElementById("progress");
    if (!bar) return;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop || document.body.scrollTop) / max * 100 : 0;
      bar.style.width = pct.toFixed(2) + "%";
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---- 3. Back to top button ---- */
  function initBackTop() {
    var btn = document.querySelector(".back-top");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("show", window.scrollY > 520);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---- 4. FAQ accordions ---- */
  function initFaq() {
    document.querySelectorAll(".qa > button").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        var row = btn.parentElement;
        var isOpen = row.classList.contains("open");
        row.classList.toggle("open", !isOpen);
        btn.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  }

  /* ---- 5. Blog index: live search + category filter ---- */
  function initFilters() {
    var grid = document.getElementById("postGrid");
    if (!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    var search = document.getElementById("postSearch");
    var count = document.getElementById("resultCount");
    var empty = document.getElementById("noResults");
    var activeCat = "all";

    function apply() {
      var q = (search && search.value || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var cat = (card.dataset.category || "").toLowerCase();
        var hay = (card.dataset.search || card.textContent || "").toLowerCase();
        var okCat = activeCat === "all" || cat === activeCat;
        var okText = !q || hay.indexOf(q) !== -1;
        var visible = okCat && okText;
        card.style.display = visible ? "" : "none";
        if (visible) { shown++; card.classList.add("in"); }
      });
      if (count) {
        count.textContent = shown === 1
          ? "Showing 1 article"
          : "Showing " + shown + " articles";
      }
      if (empty) empty.classList.toggle("show", shown === 0);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        activeCat = (chip.dataset.filter || "all").toLowerCase();
        apply();
      });
    });

    if (search) {
      var t;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(apply, 130);
      });
    }
    apply();
  }

  /* ---- 6. Newsletter form: friendly demo confirmation ---- */
  function initNewsletter() {
    document.querySelectorAll("form[data-demo]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var note = form.parentElement.querySelector(".note");
        if (note) note.textContent = "Thanks! Sign-up is not connected yet, so please call the office to be added.";
        form.reset();
      });
    });
  }

  /* ---- 7. Estimate + display reading time ---- */
  function initReadTime() {
    var slot = document.getElementById("readTime");
    var prose = document.querySelector(".prose");
    if (!slot || !prose) return;
    var words = prose.textContent.trim().split(/\s+/).length;
    slot.textContent = Math.max(1, Math.round(words / 220)) + " min read";
  }

  /* ---- 8. Footer year ---- */
  function initYear() {
    document.querySelectorAll(".js-year").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  function boot() {
    initReveal();
    initProgress();
    initBackTop();
    initFaq();
    initFilters();
    initNewsletter();
    initReadTime();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
