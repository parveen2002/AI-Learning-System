/* ============================================
   AI-Learning System - Lessons Page Module
   ============================================
   Handles lesson viewing, navigation, completion
   tracking, and syllabus on the lesson page.
   ============================================ */

var LearnSphereLessons = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var auth = LearnSphereAuth;
  var currentCourseId = null;
  var currentLessonId = null;
  var course = null;
  var lessons = [];
  var allLessonsFlat = [];
  var quizzes = [];
  var quizForLessonCache = {};

  // ==================================================
  // INIT
  // ==================================================

  function init(coursesJson, lessonsJson, quizzesJson) {
    api.initCourseData(coursesJson, lessonsJson);
    quizzes = quizzesJson || [];
    quizForLessonCache = {};

    if (!auth.isLoggedIn()) {
      var current = window.location.href;
      window.location.href =
        "login.html" + (current ? "?redirect=" + encodeURIComponent(current) : "");
      return;
    }

    var params = getQueryParams();
    currentCourseId = parseInt(params.courseId, 10);
    currentLessonId = params.lessonId || null;

    if (!currentCourseId) {
      showError("No course specified.");
      return;
    }

    course = api.getCourseById(currentCourseId);
    if (!course) {
      showError("Course not found.");
      return;
    }

    lessons = api.getLessonsByCourse(currentCourseId);
    allLessonsFlat = flattenLessons(lessons);

    if (!currentLessonId && allLessonsFlat.length > 0) {
      // Check progress for last lesson
      var progress = api.getCourseProgress(currentCourseId);
      currentLessonId = progress && progress.lastLessonId
        ? progress.lastLessonId
        : allLessonsFlat[0].lessonId;
    }

    renderSyllabus();
    renderSidebarQuizzes();
    renderLesson();
    updateProgress();
    setupMobileSyllabus();
    setupTutorLink();
    setupLessonBookmark();
  }

  // ==================================================
  // INIT for course-details page
  // ==================================================

  function initDetails(coursesJson, lessonsJson, quizzesJson) {
    api.initCourseData(coursesJson, lessonsJson);
    quizzes = quizzesJson || [];
    quizForLessonCache = {};

    var params = getQueryParams();
    currentCourseId = parseInt(params.id, 10);

    if (!currentCourseId) return;

    course = api.getCourseById(currentCourseId);
    if (!course) return;

    lessons = api.getLessonsByCourse(currentCourseId);
    allLessonsFlat = flattenLessons(lessons);

    renderDetails();
    renderSyllabusDetails();
    renderQuizzesDetails();
    renderRecommended();
    setupDetailsActions();
    setupMobileSyllabus();
    setupTutorLink("detailAskTutorBtn");
  }

  // ==================================================
  // QUERY PARAMS
  // ==================================================

  function getQueryParams() {
    var params = {};
    var qs = window.location.search.substring(1);
    if (!qs) return params;
    var pairs = qs.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split("=");
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    }
    // Accept both ?courseId=..&lessonId=.. and ?course=..&lesson=..
    if ((params.courseId === undefined || params.courseId === "") && params.course !== undefined) {
      params.courseId = params.course;
    }
    if ((params.lessonId === undefined || params.lessonId === "") && params.lesson !== undefined) {
      params.lessonId = params.lesson;
    }
    return params;
  }

  function setupTutorLink(btnId) {
    var btn = document.getElementById(btnId || "lessonAskTutorBtn");
    if (!btn || !currentCourseId) return;
    var href = "ai-tutor.html?course=" + currentCourseId;
    if (currentLessonId) href += "&lesson=" + currentLessonId;
    btn.href = href;
  }

  // ==================================================
  // FLATTEN LESSONS
  // ==================================================

  function flattenLessons(modules) {
    var flat = [];
    for (var m = 0; m < modules.length; m++) {
      var mod = modules[m];
      for (var l = 0; l < mod.lessons.length; l++) {
        flat.push({
          moduleId: mod.id,
          moduleTitle: mod.title,
          lessonId: mod.lessons[l].id,
          title: mod.lessons[l].title,
          type: mod.lessons[l].type,
          duration: mod.lessons[l].duration,
        });
      }
    }
    return flat;
  }

  // ==================================================
  // QUIZ CONNECTION HELPERS
  // ==================================================

  function getQuizForLesson(courseId, lessonId) {
    var key = courseId + "_" + lessonId;
    if (quizForLessonCache.hasOwnProperty(key)) return quizForLessonCache[key];
    var match = null;
    for (var i = 0; i < quizzes.length; i++) {
      var qq = quizzes[i];
      if (qq.course_id === courseId && qq.lesson_id === lessonId) {
        match = qq;
        break;
      }
    }
    quizForLessonCache[key] = match;
    return match;
  }

  function quizUrl(courseId, lessonId, quizId) {
    return "quiz.html?course=" + courseId + "&lesson=" + lessonId + "&quiz=" + quizId;
  }

  function getCourseQuizzes(courseId) {
    var list = [];
    for (var i = 0; i < quizzes.length; i++) {
      if (quizzes[i].course_id === courseId) list.push(quizzes[i]);
    }
    return list;
  }

  function getQuizLessonTitle(quiz) {
    if (!quiz) return "";
    for (var i = 0; i < allLessonsFlat.length; i++) {
      if (allLessonsFlat[i].lessonId === quiz.lesson_id) return allLessonsFlat[i].title;
    }
    if (course && course.curriculum) {
      for (var m = 0; m < course.curriculum.length; m++) {
        var modLessons = course.curriculum[m].lessons || [];
        for (var l = 0; l < modLessons.length; l++) {
          if (modLessons[l].id === quiz.lesson_id) return modLessons[l].title;
        }
      }
    }
    return "";
  }

  function getQuizBestScore(quiz) {
    if (!quiz || !api.getQuizBestScore) return null;
    return api.getQuizBestScore(quiz.quiz_id);
  }

  function quizAttemptLabel(quiz) {
    var attempts = api.getQuizAttempts ? api.getQuizAttempts(quiz.quiz_id) : [];
    return attempts && attempts.length ? "Retake Quiz" : "Start Quiz";
  }

  // ==================================================
  // COURSE QUIZZES (lesson page sidebar)
  // ==================================================

  function renderSidebarQuizzes() {
    var panel = document.getElementById("lessonQuizPanel");
    var container = document.getElementById("lessonQuizList");
    if (!panel || !container) return;

    var courseQuizzes = getCourseQuizzes(currentCourseId);
    if (!courseQuizzes.length) {
      panel.style.display = "none";
      return;
    }

    var linkedQuiz = currentLessonId ? getQuizForLesson(currentCourseId, currentLessonId) : null;
    var html = "";

    for (var i = 0; i < courseQuizzes.length; i++) {
      var quiz = courseQuizzes[i];
      var best = getQuizBestScore(quiz);
      var isActive = linkedQuiz && linkedQuiz.quiz_id === quiz.quiz_id;
      var meta = quiz.questions.length + " questions &middot; " + quiz.time_limit + " min";
      if (best !== null) meta += " &middot; Best " + best + "%";

      html += '<a class="sidebar-quiz-item' + (isActive ? " active" : "") + '"';
      html += ' href="' + quizUrl(currentCourseId, quiz.lesson_id, quiz.quiz_id) + '">';
      html += '  <span class="sidebar-quiz-icon">&#128221;</span>';
      html += '  <span class="sidebar-quiz-copy">';
      html += '    <span class="sidebar-quiz-title">' + escapeHtml(quiz.title) + "</span>";
      html += '    <span class="sidebar-quiz-meta">' + meta + "</span>";
      html += "  </span>";
      html += '  <span class="sidebar-quiz-arrow" aria-hidden="true">&#8594;</span>';
      html += "</a>";
    }

    container.innerHTML = html;
    var countEl = document.getElementById("lessonQuizCount");
    if (countEl) countEl.textContent = courseQuizzes.length;
  }

  // ==================================================
  // COURSE QUIZZES (course details page)
  // ==================================================

  function renderQuizzesDetails() {
    var section = document.getElementById("courseQuizSection");
    var container = document.getElementById("detailQuizzes");
    if (!section || !container) return;

    var courseQuizzes = getCourseQuizzes(currentCourseId);
    if (!courseQuizzes.length) {
      section.style.display = "none";
      return;
    }

    var html = "";
    for (var i = 0; i < courseQuizzes.length; i++) {
      var quiz = courseQuizzes[i];
      var best = getQuizBestScore(quiz);
      var lessonTitle = getQuizLessonTitle(quiz);
      var meta = lessonTitle ? escapeHtml(lessonTitle) + " &middot; " : "";
      meta += quiz.questions.length + " questions &middot; " + quiz.time_limit + " min";

      html += '<article class="course-quiz-card">';
      html += '  <div class="course-quiz-icon">&#128221;</div>';
      html += '  <div class="course-quiz-body">';
      html += '    <div class="course-quiz-meta">' + meta + "</div>";
      html += '    <h3 class="course-quiz-title">' + escapeHtml(quiz.title) + "</h3>";
      html += '    <p class="course-quiz-desc">' + escapeHtml(quiz.description || "") + "</p>";
      html += '    <div class="course-quiz-footer">';
      html += '      <span class="course-quiz-badge">Pass: ' + (quiz.passing_score || 60) + "%</span>";
      html += '      <span class="course-quiz-best">' + (best !== null ? "Best score: " + best + "%" : "Not attempted yet") + "</span>";
      html += "    </div>";
      html += "  </div>";
      html += '  <a class="btn btn-primary course-quiz-action" href="' + quizUrl(currentCourseId, quiz.lesson_id, quiz.quiz_id) + '">';
      html += "    " + quizAttemptLabel(quiz) + " &#8594;";
      html += "  </a>";
      html += "</article>";
    }

    container.innerHTML = html;
    var countEl = document.getElementById("detailQuizCount");
    if (countEl) {
      countEl.textContent = courseQuizzes.length + (courseQuizzes.length === 1 ? " quiz" : " quizzes");
    }
    section.style.display = "block";
  }

  // ==================================================
  // RENDER SYLLABUS (lesson page sidebar)
  // ==================================================

  function renderSyllabus() {
    var container = document.getElementById("syllabusList");
    if (!container) return;

    var progress = api.getCourseProgress(currentCourseId);
    var completed = progress ? progress.completedLessons : [];

    var html = "";
    for (var m = 0; m < lessons.length; m++) {
      var mod = lessons[m];
      var isExpanded = false;
      for (var l = 0; l < mod.lessons.length; l++) {
        if (mod.lessons[l].id === currentLessonId) isExpanded = true;
      }

      html += '<div class="syllabus-module">';
      html += '  <div class="syllabus-module-header" data-toggle="mod-' + mod.id + '">';
      html += '    <span class="syllabus-module-title">' + mod.title + "</span>";
      html += '    <span class="syllabus-module-chevron">' + (isExpanded ? "&#9650;" : "&#9660;") + "</span>";
      html += "  </div>";
      html += '  <div class="syllabus-module-body' + (isExpanded ? " open" : "") + '" id="mod-' + mod.id + '">';

      for (var l = 0; l < mod.lessons.length; l++) {
        var lesson = mod.lessons[l];
        var isActive = lesson.id === currentLessonId;
        var isComplete = completed.indexOf(lesson.id) !== -1;
        var typeIcon = getTypeIcon(lesson.type);
        var linkedQuiz = getQuizForLesson(currentCourseId, lesson.id);
        var directQuizLink = linkedQuiz && lesson.type === "quiz";
        var lessonHref = directQuizLink
          ? quizUrl(currentCourseId, lesson.id, linkedQuiz.quiz_id)
          : "lesson.html?courseId=" + currentCourseId + "&lessonId=" + lesson.id;

        html += '<a class="syllabus-lesson' + (isActive ? " active" : "") + (isComplete ? " completed" : "") + '"';
        html += ' href="' + lessonHref + '">';
        html += '  <span class="syllabus-lesson-status">' + (isComplete ? "&#10003;" : typeIcon) + "</span>";
        html += '  <span class="syllabus-lesson-info">';
        html += '    <span class="syllabus-lesson-title">' + lesson.title + "</span>";
        html += '    <span class="syllabus-lesson-meta">' + lesson.type + " &middot; " + lesson.duration + "</span>";
        html += "  </span>";
        if (linkedQuiz) html += '  <span class="syllabus-lesson-chip">Quiz</span>';
        html += "</a>";
      }

      html += "  </div>";
      html += "</div>";
    }

    container.innerHTML = html;
    setupSyllabusToggles();
  }

  // ==================================================
  // RENDER LESSON CONTENT
  // ==================================================

  function renderLesson() {
    var container = document.getElementById("lessonContent");
    if (!container || !currentLessonId) return;

    var lessonData = api.getLessonById(currentCourseId, currentLessonId);
    if (!lessonData) {
      container.innerHTML = '<div class="lesson-not-found">Lesson not found.</div>';
      return;
    }

    // Update page title
    document.title = lessonData.title + " - AI-Learning System";

    // Update breadcrumb
    var breadcrumb = document.getElementById("lessonBreadcrumb");
    if (breadcrumb) {
      breadcrumb.innerHTML =
        '<a href="../index.html">Home</a> &rsaquo; ' +
        '<a href="courses.html">Courses</a> &rsaquo; ' +
        '<a href="course-details.html?id=' + currentCourseId + '">' + (course ? course.title : "Course") + "</a> &rsaquo; " +
        '<span>' + lessonData.title + "</span>";
    }

    // Update lesson title in header
    var titleEl = document.getElementById("lessonTitle");
    if (titleEl) titleEl.textContent = lessonData.title;

    var metaEl = document.getElementById("lessonMeta");
    if (metaEl) metaEl.innerHTML = lessonData.type + " &middot; " + lessonData.duration;

    var html = "";

    if (lessonData.type === "video") {
      html = renderVideoLesson(lessonData);
    } else if (lessonData.type === "reading") {
      html = renderReadingLesson(lessonData);
    } else if (lessonData.type === "practice") {
      html = renderPracticeLesson(lessonData);
    } else if (lessonData.type === "quiz") {
      html = renderQuizLesson(lessonData);
    }

    container.innerHTML = html;

    // Setup practice interactions
    if (lessonData.type === "practice") {
      setupPracticeInteractions();
    }

    // Setup Take Quiz footer button
    setupQuizEntry(lessonData);

    // For quiz-type lessons, the quiz itself is the primary action.
    // Hide the generic "Mark as Complete" button so the footer reads:
    // Previous | Take Quiz | Next
    if (lessonData.type === "quiz" && getQuizForLesson(currentCourseId, lessonData.lessonId)) {
      var mcBtn = document.getElementById("markCompleteBtn");
      if (mcBtn) mcBtn.style.display = "none";
      var tqBtn = document.getElementById("takeQuizBtn");
      if (tqBtn) tqBtn.style.display = "inline-flex";
    }

    // Setup mark complete button
    setupMarkComplete(lessonData.lessonId);
  }

  function renderVideoLesson(lesson) {
    var c = lesson.content || {};
    var html = '<div class="lesson-video-area">';
    html += '  <div class="lesson-video-player">';
    html += '    <div class="video-placeholder">';
    html += '      <div class="video-placeholder-icon">&#9654;</div>';
    html += '      <p>Video Player</p>';
    html += '      <p class="video-placeholder-sub">' + (c.description || "") + "</p>";
    html += "    </div>";
    html += "  </div>";
    html += "</div>";
    html += '<div class="lesson-text-area">';
    html += '  <h2>' + lesson.title + "</h2>";
    html += '  <p class="lesson-description">' + (c.description || "") + "</p>";
    if (c.transcript) {
      html += '  <div class="lesson-transcript">';
      html += "    <h4>Transcript</h4>";
      html += "    <p>" + c.transcript + "</p>";
      html += "  </div>";
    }
    html += "</div>";
    return html;
  }

  function renderReadingLesson(lesson) {
    var c = lesson.content || {};
    var html = '<div class="lesson-reading-area">';
    html += '  <h2>' + (c.heading || lesson.title) + "</h2>";

    if (c.sections) {
      for (var i = 0; i < c.sections.length; i++) {
        var sec = c.sections[i];
        html += '  <h3 class="reading-section-title">' + sec.title + "</h3>";
        if (sec.text) {
          html += '  <p class="reading-section-text">' + sec.text + "</p>";
        }
        if (sec.code) {
          html += '  <pre class="reading-code"><code>' + escapeHtml(sec.code) + "</code></pre>";
        }
      }
    }
    html += "</div>";
    return html;
  }

  function renderPracticeLesson(lesson) {
    var c = lesson.content || {};
    var html = '<div class="lesson-practice-area">';
    html += '  <h2>Practice Problems</h2>';
    html += '  <p class="practice-intro">Apply what you have learned by solving these problems.</p>';

    if (c.problems) {
      for (var i = 0; i < c.problems.length; i++) {
        var p = c.problems[i];
        html += '<div class="practice-problem">';
        html += '  <div class="practice-problem-header">Problem ' + (i + 1) + "</div>";
        html += '  <p class="practice-question">' + p.question + "</p>";
        html += '  <div class="practice-actions">';
        html += '    <button class="btn btn-secondary btn-sm hint-btn" data-idx="' + i + '">Show Hint</button>';
        html += '    <button class="btn btn-secondary btn-sm solution-btn" data-idx="' + i + '">Show Solution</button>';
        html += "  </div>";
        html += '  <div class="practice-hint" id="hint-' + i + '">' + p.hint + "</div>";
        html += '  <div class="practice-solution" id="sol-' + i + '">' + p.solution + "</div>";
        html += "</div>";
      }
    }
    html += "</div>";
    return html;
  }

  function renderQuizLesson(lesson) {
    var quiz = getQuizForLesson(currentCourseId, lesson.lessonId);
    var html = '<div class="lesson-quiz-area">';

    if (quiz) {
      var attempts = api.getQuizAttempts ? api.getQuizAttempts(quiz.quiz_id) : [];
      html += '  <div class="quiz-placeholder">';
      html += '    <div class="quiz-placeholder-icon">&#128221;</div>';
      html += '    <h3>' + escapeHtml(quiz.title) + "</h3>";
      html += '    <p class="quiz-placeholder-sub">' + (quiz.description ? escapeHtml(quiz.description) : "Test your understanding of this topic.") + "</p>";
      html += "    <div class=\"quiz-placeholder-meta\">";
      html += '      <span>&#128196; ' + quiz.questions.length + " questions</span>";
      html += '      <span>&#9202; ' + quiz.time_limit + " minutes</span>";
      html += '      <span>&#9989; Pass: ' + (quiz.passing_score || 60) + "%</span>";
      html += "    </div>";
      if (attempts && attempts.length) {
        html += '    <p class="quiz-placeholder-best">Best Score: ' + (api.getQuizBestScore ? api.getQuizBestScore(quiz.quiz_id) : "&mdash;") + "% &middot; Attempts: " + attempts.length + "</p>";
      } else {
        html += '    <p class="quiz-placeholder-best">You have not taken this quiz yet.</p>';
      }
      html += '    <a class="btn btn-primary" href="' + quizUrl(currentCourseId, lesson.lessonId, quiz.quiz_id) + '">&#128221; ' + (attempts && attempts.length ? "Retake Quiz" : "Start Quiz") + " &#8594;</a>";
      html += "  </div>";
    } else {
      html += '  <div class="quiz-placeholder">';
      html += '    <div class="quiz-placeholder-icon">&#128221;</div>';
      html += "    <h3>No quiz available</h3>";
      html += "    <p>This lesson does not have a quiz yet. Review the material and check back later.</p>";
      html += "  </div>";
    }

    html += "</div>";
    return html;
  }

  // ==================================================
  // QUIZ ENTRY (footer "Take Quiz" button)
  // ==================================================

  function setupQuizEntry(lessonData) {
    var btn = document.getElementById("takeQuizBtn");
    if (!btn) return;

    var linkedQuiz = getQuizForLesson(currentCourseId, lessonData.lessonId);
    if (!linkedQuiz) {
      btn.style.display = "none";
      return;
    }

    btn.href = quizUrl(currentCourseId, lessonData.lessonId, linkedQuiz.quiz_id);
    var attempts = api.getQuizAttempts ? api.getQuizAttempts(linkedQuiz.quiz_id) : [];
    btn.innerHTML = attempts && attempts.length ? "&#128221; Retake Quiz &#8594;" : "&#128221; Take Quiz &#8594;";
  }

  // ==================================================
  // SETUP PRACTICE INTERACTIONS
  // ==================================================

  function setupPracticeInteractions() {
    var hintBtns = document.querySelectorAll(".hint-btn");
    var solBtns = document.querySelectorAll(".solution-btn");

    hintBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = btn.getAttribute("data-idx");
        var el = document.getElementById("hint-" + idx);
        if (el) el.classList.toggle("show");
      });
    });

    solBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = btn.getAttribute("data-idx");
        var el = document.getElementById("sol-" + idx);
        if (el) el.classList.toggle("show");
      });
    });
  }

  // ==================================================
  // MARK LESSON COMPLETE
  // ==================================================

  function setupMarkComplete(lessonId) {
    var btn = document.getElementById("markCompleteBtn");
    if (!btn) return;

    // Check if already complete
    if (api.isLessonComplete(currentCourseId, lessonId)) {
      btn.textContent = "Completed";
      btn.disabled = true;
      btn.classList.add("completed");
    }

    btn.addEventListener("click", function () {
      var result = api.markLessonComplete(currentCourseId, lessonId);
      if (result.success) {
        btn.textContent = "Completed";
        btn.disabled = true;
        btn.classList.add("completed");
        updateProgress();
        renderSyllabus();
        revealQuizEntry();
      }
    });
  }

  // Show the Take Quiz button after completing a non-quiz lesson that
  // has a linked quiz, so the student flows: lesson -> quiz.
  function revealQuizEntry() {
    var quizBtn = document.getElementById("takeQuizBtn");
    if (!quizBtn) return;
    if (quizBtn.getAttribute("href") && quizBtn.getAttribute("href") !== "#") {
      quizBtn.style.display = "inline-flex";
    }
  }

  // ==================================================
  // UPDATE PROGRESS
  // ==================================================

  function updateProgress() {
    var progress = api.getCourseProgress(currentCourseId);
    if (!progress) return;

    var pctEl = document.getElementById("lessonProgressPct");
    var countEl = document.getElementById("lessonProgressCount");
    var barFill = document.getElementById("lessonProgressFill");

    if (pctEl) pctEl.textContent = progress.progressPercentage + "%";
    if (countEl) countEl.textContent = progress.completedCount + " of " + progress.totalCount + " lessons";
    if (barFill) barFill.style.width = progress.progressPercentage + "%";
  }

  // ==================================================
  // SYLLABUS TOGGLES
  // ==================================================

  function setupSyllabusToggles() {
    var headers = document.querySelectorAll(".syllabus-module-header");
    headers.forEach(function (header) {
      header.addEventListener("click", function () {
        var targetId = header.getAttribute("data-toggle");
        var body = document.getElementById(targetId);
        var chevron = header.querySelector(".syllabus-module-chevron");
        if (body) {
          body.classList.toggle("open");
          if (chevron) {
            chevron.innerHTML = body.classList.contains("open") ? "&#9650;" : "&#9660;";
          }
        }
      });
    });
  }

  // ==================================================
  // MOBILE SYLLABUS DRAWER
  // ==================================================

  function setupMobileSyllabus() {
    var toggle = document.getElementById("syllabusToggle");
    var sidebar = document.getElementById("syllabusSidebar");
    var overlay = document.getElementById("syllabusOverlay");

    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("show");
    });

    if (overlay) {
      overlay.addEventListener("click", function () {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
      });
    }
  }

  // ==================================================
  // COURSE DETAILS PAGE
  // ==================================================

  function renderDetails() {
    if (!course) return;

    document.title = course.title + " - AI-Learning System";

    // Header info
    var titleEl = document.getElementById("detailTitle");
    var descEl = document.getElementById("detailDescription");
    var catEl = document.getElementById("detailCategory");
    var diffEl = document.getElementById("detailDifficulty");
    var ratingEl = document.getElementById("detailRating");
    var studentsEl = document.getElementById("detailStudents");
    var durationEl = document.getElementById("detailDuration");
    var lessonsEl = document.getElementById("detailLessons");
    var instructorEl = document.getElementById("detailInstructor");
    var formatEl = document.getElementById("detailFormat");
    var outcomesEl = document.getElementById("detailOutcomes");
    var breadcrumbEl = document.getElementById("detailBreadcrumb");

    if (titleEl) titleEl.textContent = course.title;
    if (descEl) descEl.textContent = course.description;
    if (catEl) catEl.textContent = course.category;
    if (diffEl) {
      diffEl.textContent = course.level;
      diffEl.className = "course-card-difficulty " + (course.level || "").toLowerCase();
    }
    if (ratingEl) ratingEl.innerHTML = "&#9733; " + course.rating;
    if (studentsEl) studentsEl.textContent = course.students.toLocaleString() + " students";
    if (durationEl) durationEl.textContent = course.duration;
    if (lessonsEl) lessonsEl.textContent = course.lessonsCount + " lessons";
    if (instructorEl) instructorEl.textContent = course.instructor;
    if (formatEl) formatEl.textContent = course.category;
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML =
        '<a href="../index.html">Home</a> &rsaquo; <a href="courses.html">Courses</a> &rsaquo; <span>' + course.title + "</span>";
    }

    // Learning outcomes
    if (outcomesEl && course.learningOutcomes) {
      var outHtml = "";
      for (var i = 0; i < course.learningOutcomes.length; i++) {
        outHtml += '<li class="outcome-item"><span class="outcome-check">&#10003;</span> ' + course.learningOutcomes[i] + "</li>";
      }
      outcomesEl.innerHTML = outHtml;
    }

    // Sidebar extras
    var diff2 = document.getElementById("detailDifficulty2");
    var dur2 = document.getElementById("detailDuration2");
    var lessons2 = document.getElementById("detailLessons2");
    if (diff2) diff2.textContent = course.level;
    if (dur2) dur2.textContent = course.duration;
    if (lessons2) lessons2.textContent = course.lessonsCount + " lessons";

    // Progress bar
    var progress = api.getCourseProgress(course.id);
    var progressSection = document.getElementById("detailProgressSection");
    if (progress && progressSection) {
      progressSection.style.display = "block";
      var pctEl2 = document.getElementById("detailProgressPct");
      var countEl2 = document.getElementById("detailProgressCount");
      var barFill2 = document.getElementById("detailProgressFill");
      if (pctEl2) pctEl2.textContent = progress.progressPercentage + "%";
      if (countEl2) countEl2.textContent = progress.completedCount + " of " + progress.totalCount + " lessons completed";
      if (barFill2) barFill2.style.width = progress.progressPercentage + "%";
    }
  }

  function renderSyllabusDetails() {
    var container = document.getElementById("detailSyllabus");
    if (!container || !lessons.length) return;

    var progress = api.getCourseProgress(currentCourseId);
    var completed = progress ? progress.completedLessons : [];

    var html = "";
    for (var m = 0; m < lessons.length; m++) {
      var mod = lessons[m];
      html += '<div class="syllabus-module">';
      html += '  <div class="syllabus-module-header" data-toggle="det-mod-' + mod.id + '">';
      html += '    <span class="syllabus-module-title">Module ' + (m + 1) + ": " + mod.title + "</span>";
      html += '    <span class="syllabus-module-chevron">&#9660;</span>';
      html += "  </div>";
      html += '  <div class="syllabus-module-body" id="det-mod-' + mod.id + '">';

      for (var l = 0; l < mod.lessons.length; l++) {
        var lesson = mod.lessons[l];
        var isComplete = completed.indexOf(lesson.id) !== -1;
        var typeIcon = getTypeIcon(lesson.type);
        var linkedQuiz = getQuizForLesson(currentCourseId, lesson.id);
        var directQuizLink = linkedQuiz && lesson.type === "quiz";
        var rowHref = directQuizLink
          ? quizUrl(currentCourseId, lesson.id, linkedQuiz.quiz_id)
          : "lesson.html?courseId=" + currentCourseId + "&lessonId=" + lesson.id;

        html += '<a class="syllabus-lesson' + (linkedQuiz ? " has-quiz" : "") + '" href="' + rowHref + '">';
        html += '  <span class="syllabus-lesson-status">' + (isComplete ? "&#10003;" : typeIcon) + "</span>";
        html += '  <span class="syllabus-lesson-info">';
        html += '    <span class="syllabus-lesson-title">' + lesson.title + "</span>";
        html += '    <span class="syllabus-lesson-meta">' + lesson.type + " &middot; " + lesson.duration + "</span>";
        html += "  </span>";
        html += (linkedQuiz ? '  <span class="syllabus-lesson-chip">Quiz</span>' : "");
        html += "</a>";
      }

      html += "  </div>";
      html += "</div>";
    }

    container.innerHTML = html;

    // Toggle handlers
    var headers = container.querySelectorAll(".syllabus-module-header");
    headers.forEach(function (header) {
      header.addEventListener("click", function () {
        var targetId = header.getAttribute("data-toggle");
        var body = document.getElementById(targetId);
        var chevron = header.querySelector(".syllabus-module-chevron");
        if (body) {
          body.classList.toggle("open");
          if (chevron) {
            chevron.innerHTML = body.classList.contains("open") ? "&#9650;" : "&#9660;";
          }
        }
      });
    });
  }

  function renderRecommended() {
    var container = document.getElementById("detailRecommended");
    if (!container || !currentCourseId) return;

    var recs = api.getRecommendedCourses(currentCourseId);
    if (!recs.length) {
      container.parentElement.style.display = "none";
      return;
    }

    var html = "";
    for (var i = 0; i < recs.length; i++) {
      var c = recs[i];
      var thumbColor = getThumbColor(c.thumbnail);
      html += '<a href="course-details.html?id=' + c.id + '" class="rec-card">';
      html += '  <div class="rec-card-thumb" style="background:' + thumbColor + ';">';
      html += '    <span>' + getThumbIcon(c.thumbnail) + "</span>";
      html += "  </div>";
      html += '  <div class="rec-card-body">';
      html += '    <h4 class="rec-card-title">' + c.title + "</h4>";
      html += '    <div class="rec-card-meta">';
      html += "      <span>&#9733; " + c.rating + "</span>";
      html += "      <span>" + c.level + "</span>";
      html += "    </div>";
      html += "  </div>";
      html += "</a>";
    }
    container.innerHTML = html;
  }

  function setupDetailsActions() {
    // Start/Continue course button
    var actionBtn = document.getElementById("detailActionBtn");
    if (actionBtn) {
      var progress = api.getCourseProgress(currentCourseId);
      if (progress) {
        actionBtn.textContent = "Continue Learning";
        actionBtn.href = "lesson.html?courseId=" + currentCourseId;
      } else {
        actionBtn.addEventListener("click", function (e) {
          e.preventDefault();
          api.startCourse(currentCourseId);
          window.location.href = "lesson.html?courseId=" + currentCourseId;
        });
      }
    }

    // Bookmark button
    var bookmarkBtn = document.getElementById("detailBookmarkBtn");
    if (bookmarkBtn) {
      var isBookmarked = api.isBookmarked(currentCourseId);
      updateBookmarkBtn(bookmarkBtn, isBookmarked);

      bookmarkBtn.addEventListener("click", function () {
        var result = api.bookmarkCourse(currentCourseId);
        updateBookmarkBtn(bookmarkBtn, result.bookmarked);
      });
    }

    // Personalized Path link (show only if enrolled)
    var pathBtn = document.getElementById("detailPathBtn");
    if (pathBtn) {
      var progress = api.getCourseProgress(currentCourseId);
      if (progress) {
        pathBtn.href = "learning-path.html?course=" + currentCourseId;
        pathBtn.style.display = "inline-flex";
      }
    }
  }

  function updateBookmarkBtn(btn, bookmarked) {
    if (bookmarked) {
      btn.innerHTML = "&#9733; Bookmarked";
      btn.classList.add("bookmarked");
    } else {
      btn.innerHTML = "&#9734; Bookmark";
      btn.classList.remove("bookmarked");
    }
  }

  // ==================================================
  // LESSON PAGE BOOKMARK
  // ==================================================

  var lessonBookmarkToastTimer = null;

  function lessonBookmarkToast(message) {
    var node = document.getElementById("lessonBookmarkToast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    if (lessonBookmarkToastTimer) clearTimeout(lessonBookmarkToastTimer);
    lessonBookmarkToastTimer = setTimeout(function () {
      node.classList.remove("show");
    }, 2600);
  }

  function updateLessonBookmarkBtn(btn, bookmarked) {
    if (!btn) return;
    if (bookmarked) {
      btn.innerHTML = "&#9733; Saved";
      btn.classList.add("bookmarked");
    } else {
      btn.innerHTML = "&#9734; Save";
      btn.classList.remove("bookmarked");
    }
  }

  function setupLessonBookmark() {
    var btn = document.getElementById("lessonBookmarkBtn");
    if (!btn || currentLessonId === null || currentLessonId === undefined) return;

    var itemId = "lesson-" + currentCourseId + "-" + currentLessonId;
    updateLessonBookmarkBtn(btn, api.isBookmarked(itemId, "lesson"));

    btn.addEventListener("click", function () {
      var bookmark = {
        id: itemId,
        type: "lesson",
        courseId: currentCourseId,
        lessonId: currentLessonId,
      };
      var result = api.toggleBookmark(bookmark);
      if (!result || !result.success) {
        lessonBookmarkToast("Could not update bookmark.");
        return;
      }
      updateLessonBookmarkBtn(btn, result.bookmarked);
      if (result.bookmarked) {
        lessonBookmarkToast("Lesson saved to bookmarks.");
      } else {
        lessonBookmarkToast("Removed from bookmarks.");
      }
    });
  }

  // ==================================================
  // HELPERS
  // ==================================================

  function getTypeIcon(type) {
    var map = {
      video: "&#9654;",
      reading: "&#128214;",
      practice: "&#9997;",
      quiz: "&#128221;",
    };
    return map[type] || "&#128214;";
  }

  function getThumbColor(key) {
    var map = {
      dsa: "linear-gradient(135deg,#2563EB,#0891B2)",
      python: "linear-gradient(135deg,#059669,#06B6D4)",
      webdev: "linear-gradient(135deg,#2563EB,#7C3AED)",
      dbms: "linear-gradient(135deg,#D97706,#EA580C)",
      ai: "linear-gradient(135deg,#7C3AED,#2563EB)",
      excel: "linear-gradient(135deg,#059669,#10B981)",
      testing: "linear-gradient(135deg,#DC2626,#F59E0B)",
      java: "linear-gradient(135deg,#DC2626,#2563EB)",
    };
    return map[key] || "linear-gradient(135deg,#2563EB,#06B6D4)";
  }

  function getThumbIcon(key) {
    var map = {
      dsa: "&#128218;",
      python: "&#128013;",
      webdev: "&#127760;",
      dbms: "&#128451;",
      ai: "&#129302;",
      excel: "&#128202;",
      testing: "&#9989;",
      java: "&#9749;",
    };
    return map[key] || "&#128218;";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showError(msg) {
    var el = document.getElementById("lessonContent") || document.getElementById("detailTitle");
    if (el) el.innerHTML = '<div class="lesson-not-found"><p>' + msg + '</p><a href="courses.html" class="btn btn-primary" style="margin-top:1rem;">Browse Courses</a></div>';
  }

  // ==================================================
  // PUBLIC
  // ==================================================

  return {
    init: init,
    initDetails: initDetails,
  };
})();
