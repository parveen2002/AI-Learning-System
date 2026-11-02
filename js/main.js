/* ============================================
   AI-Learning System - Main JavaScript
   ============================================
   
   Main entry point. Initializes all modules
   and handles page-specific logic for index.html.
   ============================================ */

var LearnSphereMain = (function () {
  "use strict";

  var auth = LearnSphereAuth;

  // ==================================================
  // INITIALIZATION
  // ==================================================

  function init() {
    // Initialize modules
    LearnSphereTheme.init();
    LearnSphereNav.init();

    // Page-specific setup
    setupScrollAnimations();
    setupStatCounters();
  }

  // ==================================================
  // SCROLL ANIMATIONS
  // ==================================================

  function setupScrollAnimations() {
    var animatedElements = document.querySelectorAll("[data-animate]");
    if (!animatedElements.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("animated");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });

    // Also handle stagger-children
    var staggerGroups = document.querySelectorAll(".stagger-children");
    var staggerObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("animated");
            staggerObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    staggerGroups.forEach(function (el) {
      staggerObserver.observe(el);
    });
  }

  // ==================================================
  // ANIMATED STAT COUNTERS
  // ==================================================

  function setupStatCounters() {
    var counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(function (counter) {
      observer.observe(counter);
    });
  }

  function animateCounter(element) {
    var target = parseInt(element.getAttribute("data-count"), 10);
    var suffix = element.getAttribute("data-suffix") || "";
    var duration = 1500;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      element.textContent = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = target + suffix;
      }
    }

    requestAnimationFrame(step);
  }

  // ==================================================
  // RUN ON DOM READY
  // ==================================================

  document.addEventListener("DOMContentLoaded", init);

  return {
    init: init,
  };
})();
