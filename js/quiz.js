/* ============================================
   AI-Learning System - Quiz Module
   ============================================

   Handles the quiz interface (quiz.html) and
   the quiz result page (quiz-result.html).

   Data flow:
   quiz.js -> api.js -> JSON + LocalStorage
   (Future: api.js -> Flask REST API -> MySQL)

   Authentication:
   Uses the existing LearnSphereAuth module.
   ============================================ */

var LearnSphereQuiz = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var auth = LearnSphereAuth;

  var basePath = "";

  var state = {
    quiz: null,
    course: null,
    questions: [],
    current: 0,
    answers: {},
    timeLimit: 0,
    timeRemaining: 0,
    timerId: null,
    submitted: false,
  };

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/") !== -1) return "..";
    return ".";
  }

  function getQueryParams() {
    var params = {};
    var qs = window.location.search.substring(1);
    if (!qs) return params;
    var pairs = qs.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split("=");
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    }
    return params;
  }

  function requireLogin() {
    basePath = detectBasePath();
    if (auth.isLoggedIn()) return true;
    var current = window.location.href;
    window.location.href =
      basePath + "/pages/login.html" + (current ? "?redirect=" + encodeURIComponent(current) : "");
    return false;
  }

  function getLessonTitle(course, lessonId) {
    if (!course || !course.curriculum) return "";
    for (var m = 0; m < course.curriculum.length; m++) {
      var mod = course.curriculum[m];
      for (var l = 0; l < (mod.lessons || []).length; l++) {
        if (mod.lessons[l].id === lessonId) return mod.lessons[l].title;
      }
    }
    return "";
  }

  function flattenLessons(course) {
    var flat = [];
    if (!course || !course.curriculum) return flat;
    for (var m = 0; m < course.curriculum.length; m++) {
      var mod = course.curriculum[m];
      for (var l = 0; l < (mod.lessons || []).length; l++) {
        flat.push(mod.lessons[l]);
      }
    }
    return flat;
  }

  function buildQuizUrl(courseId, lessonId, quizId) {
    return (
      "quiz.html?course=" + courseId + "&lesson=" + lessonId + "&quiz=" + quizId
    );
  }

  // ==================================================
  // TOASTS
  // ==================================================

  function showToast(message, type) {
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "info");
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("show");
    }, 10);
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // ==================================================
  // ERROR STATES
  // ==================================================

  function showPageError(containerId, title, message, backHref, backLabel) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.style.display = "block";

    var content = document.getElementById(
      containerId === "quizError" ? "quizContent" : "quizResultContent"
    );
    if (content) content.style.display = "none";

    container.innerHTML =
      '<div class="quiz-error-icon">&#128275;</div>' +
      "<h2>" + title + "</h2>" +
      "<p>" + message + "</p>" +
      (backHref
        ? '<a href="' + backHref + '" class="btn btn-primary">' + (backLabel || "Back to Course") + "</a>"
        : "");
  }

  function showFatalError() {
    var quizErr = document.getElementById("quizError");
    if (quizErr) {
      showPageError("quizError", "Unable to load quiz", "The quiz data could not be loaded. Please try again later.", "../pages/courses.html", "Back to Courses");
      return;
    }
    var resultErr = document.getElementById("quizResultError");
    if (resultErr) {
      showPageError("quizResultError", "Unable to load result", "The quiz result could not be loaded. Please try again later.", "../pages/courses.html", "Back to Courses");
    }
  }

  // ==================================================
  // QUIZ PAGE
  // ==================================================

  function initQuiz(quizzesJson, coursesJson) {
    api.initQuizData(quizzesJson);
    basePath = detectBasePath();

    if (!requireLogin()) return;

    var params = getQueryParams();
    var quizId = params.quiz;

    if (!quizId) {
      showPageError("quizError", "Quiz not found", "No quiz was specified in the URL.", "courses.html", "Browse Courses");
      return;
    }

    var quiz = api.getQuiz(quizId);
    if (!quiz) {
      showPageError("quizError", "Quiz not found", "The quiz you are looking for does not exist.", "courses.html", "Browse Courses");
      return;
    }

    var course = api.getCourseById(quiz.course_id);
    if (!course) {
      showPageError("quizError", "Course not found", "The course connected to this quiz is unavailable.", "courses.html", "Browse Courses");
      return;
    }

    if (!quiz.questions || !quiz.questions.length) {
      showPageError("quizError", "No questions available", "This quiz does not have any questions yet.", "course-details.html?id=" + course.id, "Back to Course");
      return;
    }

    state.quiz = quiz;
    state.course = course;
    state.questions = quiz.questions;
    state.current = 0;
    state.answers = {};
    state.submitted = false;

    document.title = quiz.title + " - AI-Learning System";

    renderHeader();
    renderBreadcrumb();
    renderMeta();
    renderDots();
    renderQuestion(0);

    document.getElementById("quizContent").style.display = "block";

    startTimer(quiz.time_limit || 10);
    setupNav();
    setupOptions();
  }

  function renderHeader() {
    setText("quizCourseName", state.course.title);
    setText("quizTitle", state.quiz.title);
    setText("quizDescription", state.quiz.description || "");
  }

  function renderBreadcrumb() {
    var container = document.getElementById("quizBreadcrumb");
    if (!container) return;
    var lessonTitle = getLessonTitle(state.course, state.quiz.lesson_id);
    container.innerHTML =
      '<a href="../index.html">Home</a> &rsaquo; ' +
      '<a href="courses.html">Courses</a> &rsaquo; ' +
      '<a href="course-details.html?id=' + state.course.id + '">' + state.course.title + "</a>" +
      (lessonTitle ? " &rsaquo; <a href='lesson.html?courseId=" + state.course.id + "&lessonId=" + state.quiz.lesson_id + "'>" + lessonTitle + "</a>" : "") +
      " &rsaquo; <span>Quiz</span>";
  }

  function renderMeta() {
    setText("quizQuestionCounter", "Question 1 of " + state.questions.length);
    setText("quizAnsweredInfo", "0 of " + state.questions.length + " answered");
  }

  function renderDots() {
    var container = document.getElementById("quizDots");
    if (!container) return;
    var html = "";
    for (var i = 0; i < state.questions.length; i++) {
      var q = state.questions[i];
      var cls = "quiz-dot";
      if (state.answers[q.question_id]) cls += " answered";
      if (i === state.current) cls += " current";
      html +=
        '<button type="button" class="' + cls + '" data-index="' + i + '" aria-label="Go to question ' + (i + 1) + '" ' +
        (state.answers[q.question_id] ? 'title="Answered"' : 'title="Not answered"') + ">" +
        (i + 1) +
        (state.answers[q.question_id] ? '<span class="quiz-dot-check">&#10003;</span>' : "") +
        "</button>";
    }
    container.innerHTML = html;

    var dots = container.querySelectorAll(".quiz-dot");
    for (var d = 0; d < dots.length; d++) {
      dots[d].addEventListener("click", function () {
        var idx = parseInt(this.getAttribute("data-index"), 10);
        if (idx !== state.current) renderQuestion(idx);
      });
    }
  }

  function renderQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    state.current = index;

    var q = state.questions[index];

    setText("quizQuestionCounter", "Question " + (index + 1) + " of " + state.questions.length);
    setText("quizQuestionText", q.question);

    // Options
    var optionsHtml = "";
    var letters = ["A", "B", "C", "D"];
    for (var i = 0; i < q.options.length; i++) {
      var letter = letters[i];
      var checked = state.answers[q.question_id] === letter;
      optionsHtml +=
        '<label class="quiz-option' + (checked ? " selected" : "") + '">' +
        '  <input type="radio" class="quiz-option-input" name="quiz-q" value="' + letter + '"' + (checked ? " checked" : "") + ">" +
        '  <span class="quiz-option-letter">' + letter + "</span>" +
        '  <span class="quiz-option-text">' + escapeHtml(q.options[i]) + "</span>" +
        "</label>";
    }
    document.getElementById("quizOptions").innerHTML = optionsHtml;

    renderDots();

    // Prev / Next / Submit visibility
    var prevBtn = document.getElementById("quizPrevBtn");
    var nextBtn = document.getElementById("quizNextBtn");
    var submitBtn = document.getElementById("quizSubmitBtn");

    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.style.display = index === state.questions.length - 1 ? "none" : "inline-flex";
    if (submitBtn) submitBtn.style.display = index === state.questions.length - 1 ? "inline-flex" : "none";

    var titleEl = document.getElementById("quizQuestionCounter");
    if (titleEl) titleEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setupOptions() {
    var container = document.getElementById("quizOptions");
    if (!container) return;

    container.addEventListener("change", function (e) {
      if (e.target && e.target.classList.contains("quiz-option-input")) {
        var q = state.questions[state.current];
        var value = e.target.value;
        state.answers[q.question_id] = value;
        updateControlStates(q.question_id);
        renderDots();
      }
    });
  }

  function updateControlStates(qid) {
    // Update selected state on the current question's options
    var options = document.querySelectorAll("#quizOptions .quiz-option");
    var selected = state.answers[qid];
    for (var i = 0; i < options.length; i++) {
      var input = options[i].querySelector(".quiz-option-input");
      if (input.value === selected) {
        options[i].classList.add("selected");
      } else {
        options[i].classList.remove("selected");
      }
    }

    // Update answered counter
    var count = 0;
    for (var j = 0; j < state.questions.length; j++) {
      if (state.answers[state.questions[j].question_id]) count++;
    }
    setText("quizAnsweredInfo", count + " of " + state.questions.length + " answered");

    // Update progress bar
    var fill = document.getElementById("quizProgressFill");
    if (fill) fill.style.width = Math.round((count / state.questions.length) * 100) + "%";
  }

  function setupNav() {
    var prevBtn = document.getElementById("quizPrevBtn");
    var nextBtn = document.getElementById("quizNextBtn");
    var submitBtn = document.getElementById("quizSubmitBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (state.current > 0) renderQuestion(state.current - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (state.current < state.questions.length - 1) renderQuestion(state.current + 1);
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        submitQuiz("manual");
      });
    }
  }

  // ==================================================
  // TIMER
  // ==================================================

  function startTimer(minutes) {
    state.timeLimit = Math.max(1, Math.round(minutes || 10)) * 60;
    state.timeRemaining = state.timeLimit;
    stopTimer();
    updateTimerDisplay();
    state.timerId = setInterval(function () {
      state.timeRemaining--;
      updateTimerDisplay();
      if (state.timeRemaining <= 0) {
        stopTimer();
        submitQuiz("timer");
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function updateTimerDisplay() {
    var el = document.getElementById("quizTimer");
    if (!el) return;
    var m = Math.floor(state.timeRemaining / 60);
    var s = state.timeRemaining % 60;
    el.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    if (state.timeRemaining <= 60) {
      el.classList.add("timer-warning");
    } else {
      el.classList.remove("timer-warning");
    }
  }

  // ==================================================
  // SUBMIT
  // ==================================================

  function submitQuiz(reason) {
    if (state.submitted) return;
    var unanswered = [];

    for (var i = 0; i < state.questions.length; i++) {
      var q = state.questions[i];
      if (!state.answers[q.question_id]) unanswered.push(i + 1);
    }

    if (unanswered.length > 0 && reason !== "timer") {
      showUnansweredNote(unanswered);
      return;
    }

    state.submitted = true;
    stopTimer();

    var correct = 0;
    var wrong = 0;
    var notAnswered = 0;
    var reviewAnswers = [];

    for (var j = 0; j < state.questions.length; j++) {
      var qq = state.questions[j];
      var selected = state.answers[qq.question_id] || null;
      var isCorrect = selected !== null && selected === qq.correct_answer;
      var isWrong = selected !== null && selected !== qq.correct_answer;

      if (isCorrect) correct++;
      else if (isWrong) wrong++;
      else notAnswered++;

      reviewAnswers.push({
        question_id: qq.question_id,
        question: qq.question,
        options: qq.options,
        selected: selected,
        correct_answer: qq.correct_answer,
        explanation: qq.explanation,
        isCorrect: isCorrect,
        isWrong: isWrong,
        notAnswered: !selected,
      });
    }

    var total = state.questions.length;
    var score = Math.round((correct / total) * 100);
    var passingScore = state.quiz.passing_score || 60;
    var passed = score >= passingScore;

    var result = {
      quiz_id: state.quiz.quiz_id,
      course_id: state.quiz.course_id,
      lesson_id: state.quiz.lesson_id,
      score: score,
      correct: correct,
      wrong: wrong,
      unanswered: notAnswered,
      total: total,
      passed: passed,
      answers: reviewAnswers,
    };

    var record = api.submitQuizResult(result);

    showToast("Quiz submitted successfully", "success");

    setTimeout(function () {
      var ts = record && record.completed_at ? Date.parse(record.completed_at) : "";
      window.location.href =
        "quiz-result.html?quiz=" + state.quiz.quiz_id + (ts ? "&attempt=" + ts : "");
    }, 1200);
  }

  function showUnansweredNote(unansweredNumbers) {
    var note = document.getElementById("quizUnansweredNote");
    if (!note) return;
    var label = unansweredNumbers.length === 1 ? "question" : "questions";
    note.style.display = "block";
    note.innerHTML =
      '<span class="quiz-unanswered-icon">&#9888;</span>' +
      "<strong>Please answer all questions before submitting.</strong> " +
      "You still have " + unansweredNumbers.length + " unanswered " + label + ": " +
      unansweredNumbers.map(function (n) { return "Question " + n; }).join(", ") + ".";
    note.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function () { note.style.display = "none"; }, 6000);
  }

  // ==================================================
  // RESULT PAGE
  // ==================================================

  function initResult(quizzesJson, coursesJson) {
    api.initQuizData(quizzesJson);
    basePath = detectBasePath();

    if (!requireLogin()) return;

    var params = getQueryParams();
    var quizId = params.quiz;

    if (!quizId) {
      showPageError("quizResultError", "Result not found", "No quiz was specified in the URL.", "courses.html", "Browse Courses");
      return;
    }

    var quiz = api.getQuiz(quizId);
    if (!quiz) {
      showPageError("quizResultError", "Quiz not found", "The quiz you are looking for does not exist.", "courses.html", "Browse Courses");
      return;
    }

    var course = api.getCourseById(quiz.course_id);
    var result = params.attempt
      ? api.getQuizResultByTime(quizId, parseInt(params.attempt, 10))
      : api.getQuizResult(quizId);

    if (!result) {
      showPageError("quizResultError", "Result not found", "You have not attempted this quiz yet.", "quiz.html?course=" + quiz.course_id + "&lesson=" + quiz.lesson_id + "&quiz=" + quiz.quiz_id, "Take Quiz");
      return;
    }

    renderResult(quiz, course, result);
  }

  function renderResult(quiz, course, result) {
    document.title = "Quiz Result - AI-Learning System";

    setText("quizResultCourse", course ? course.title : "");
    setText("quizResultTitle", quiz.title);

    var best = api.getQuizBestScore(quiz.quiz_id);
    var bestHtml = best !== null ? "Best Score: " + best + "%" : "Best Score: --";
    setText("quizResultBest", bestHtml);

    // Breadcrumb
    var bc = document.getElementById("quizResultBreadcrumb");
    if (bc) {
      bc.innerHTML =
        '<a href="../index.html">Home</a> &rsaquo; ' +
        '<a href="courses.html">Courses</a> &rsaquo; ' +
        (course ? '<a href="course-details.html?id=' + course.id + '">' + course.title + "</a> &rsaquo; " : "") +
        "<span>Quiz Result</span>";
    }

    // Score
    setText("quizResultScore", result.score + "%");

    var badge = document.getElementById("quizResultBadge");
    var icon = document.getElementById("quizResultIcon");
    var msg = document.getElementById("quizResultMessage");
    var hero = document.querySelector(".quiz-result-hero");

    if (result.passed) {
      badge.textContent = "PASSED";
      badge.className = "quiz-result-badge passed";
      icon.textContent = "&#10003;";
      icon.className = "quiz-result-icon passed";
      if (hero) hero.classList.remove("failed");
      if (result.score >= 90) msg.textContent = "Outstanding work! You scored " + result.score + "%.";
      else msg.textContent = "Great job! You passed the quiz with " + result.score + "%.";
    } else {
      badge.textContent = "TRY AGAIN";
      badge.className = "quiz-result-badge failed";
      icon.textContent = "&#10007;";
      icon.className = "quiz-result-icon failed";
      if (hero) hero.classList.add("failed");
      msg.textContent = "Keep practicing and try again. You scored " + result.score + "%.";
    }

    // Stats
    setText("quizStatCorrect", result.correct);
    setText("quizStatWrong", result.wrong);
    setText("quizStatUnanswered", result.unanswered);
    setText("quizStatTotal", result.total);

    // Actions
    var retryBtn = document.getElementById("quizRetryBtn");
    var continueBtn = document.getElementById("quizContinueBtn");
    var backBtn = document.getElementById("quizBackCourseBtn");

    var retryUrl = buildQuizUrl(quiz.course_id, quiz.lesson_id, quiz.quiz_id);
    if (retryBtn) retryBtn.href = retryUrl;

    var next = nextLessonPath(course, quiz.lesson_id);
    if (continueBtn) {
      if (next) {
        continueBtn.href = next;
        continueBtn.textContent = "Continue Learning &#8594;";
        continueBtn.innerHTML = "Continue Learning &#8594;";
      } else {
        continueBtn.href = "course-details.html?id=" + quiz.course_id;
        continueBtn.textContent = "Continue Learning";
      }
    }

    if (backBtn) backBtn.href = "course-details.html?id=" + quiz.course_id;

    var tutorBtn = document.getElementById("quizAskTutorBtn");
    if (tutorBtn) {
      tutorBtn.href = "ai-tutor.html?course=" + quiz.course_id + "&lesson=" + quiz.lesson_id;
    }

    renderRecommendation(result);

    var reviewToggle = document.getElementById("quizReviewToggle");
    if (reviewToggle) {
      reviewToggle.addEventListener("click", function () {
        var review = document.getElementById("quizReview");
        var expanded = review.style.display !== "none";
        review.style.display = expanded ? "none" : "block";
        this.setAttribute("aria-expanded", expanded ? "false" : "true");
        this.textContent = expanded ? "Show Answer Review" : "Hide Answer Review";
      });
    }

    // Review
    renderReview(result);

    document.getElementById("quizResultContent").style.display = "block";
  }

  // ==================================================
  // PERSONALIZED RECOMMENDATION (rule-based prototype)
  // ==================================================
  // Maps quiz performance to a simple next-step message.
  // Architecture note: this will later be superseded by the
  // recommendation engine (quiz performance -> engine -> path).

  function renderRecommendation(result) {
    var box = document.getElementById("quizRecommendation");
    if (!box || !result) return;

    var score = result.score;
    var title, message, icon;

    if (score >= 80) {
      title = "You're ready for the next topic";
      message = "Strong performance! Keep this momentum and move on to the next lesson or module in the course.";
      icon = "&#127919;";
    } else if (score >= 50) {
      title = "Review this topic before moving ahead";
      message = "Solid attempt. Review the questions you missed below, then retake the quiz to solidify the material.";
      icon = "&#128221;";
    } else {
      title = "We recommend revising this topic";
      message = "Take some time to revisit the lesson and its key concepts, then retake this quiz to build confidence.";
      icon = "&#128218;";
    }

    box.style.display = "flex";
    var iconEl = document.getElementById("quizRecIcon");
    if (iconEl) iconEl.innerHTML = icon;
    setText("quizRecTitle", title);
    setText("quizRecMessage", message);
  }

  function renderReview(result) {
    var container = document.getElementById("quizReview");
    if (!container) return;

    var letters = ["A", "B", "C", "D"];
    var html = "";

    var usedAnswers = {};
    for (var a = 0; a < (result.answers || []).length; a++) {
      usedAnswers[result.answers[a].question_id] = result.answers[a];
    }

    var questions = api.getQuiz(result.quiz_id).questions;

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var ans = usedAnswers[q.question_id];
      var selected = ans ? ans.selected : null;
      var isCorrect = ans ? ans.isCorrect : false;
      var isWrong = ans ? ans.isWrong : false;
      var notAnswered = ans ? ans.notAnswered : true;
      var cls = notAnswered ? "unanswered" : isCorrect ? "correct" : "wrong";

      html += '<div class="quiz-review-item ' + cls + '">';
      html += '  <div class="quiz-review-status">';
      html +=
        notAnswered
          ? '<span class="quiz-review-tag unanswered">Not Answered</span>'
          : isCorrect
            ? '<span class="quiz-review-tag correct">Correct</span>'
            : '<span class="quiz-review-tag wrong">Incorrect</span>';
      html += "  </div>";
      html += '  <h3 class="quiz-review-question">' + (i + 1) + ". " + q.question + "</h3>";
      html += '  <div class="quiz-review-options">';
      for (var o = 0; o < q.options.length; o++) {
        var optCls = "quiz-review-option";
        if (letters[o] === q.correct_answer) optCls += " is-correct";
        if (selected === letters[o] && selected !== q.correct_answer) optCls += " is-wrong";
        if (selected === letters[o] && selected === q.correct_answer) optCls += " is-selected-correct";
        if (selected === letters[o] && notAnswered) optCls = "quiz-review-option is-selected-not-answered";
        html += '    <div class="' + optCls + '">' +
          '<span class="quiz-review-option-letter">' + letters[o] + "</span>" +
          '<span>' + escapeHtml(q.options[o]) + "</span>" +
          (selected === letters[o] ? '<span class="quiz-review-you">Your answer</span>' : "") +
          (letters[o] === q.correct_answer ? '<span class="quiz-review-right">Correct answer</span>' : "") +
          "</div>";
      }
      html += "  </div>";
      html += '  <div class="quiz-review-answer-line">';
      if (selected) {
        html += "    <p>Your answer: <strong>" + selected + "</strong></p>";
      } else {
        html += '    <p>Your answer: <strong class="text-warning">Not answered</strong></p>';
      }
      html += "    <p>Correct answer: <strong>" + q.correct_answer + "</strong></p>";
      html += "  </div>";
      if (q.explanation) {
        html += '  <div class="quiz-review-explanation">';
        html += '    <strong>Explanation:</strong>';
        html += "    <p>" + q.explanation + "</p>";
        html += "  </div>";
      }
      html += "</div>";
    }

    container.innerHTML = html;
  }

  function nextLessonPath(course, lessonId) {
    if (!course) return null;
    var flat = flattenLessons(course);
    for (var i = 0; i < flat.length; i++) {
      if (flat[i].id === lessonId) {
        if (i < flat.length - 1) {
          return "lesson.html?courseId=" + course.id + "&lessonId=" + flat[i + 1].id;
        }
        return null;
      }
    }
    return null;
  }

  // ==================================================
  // HELPERS
  // ==================================================

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    initQuiz: initQuiz,
    initResult: initResult,
    showFatalError: showFatalError,
  };
})();