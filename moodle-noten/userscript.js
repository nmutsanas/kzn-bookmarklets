(function() {
  "use strict";
  const injectStyle = (id, css2) => {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css2;
    (document.head ?? document.documentElement).appendChild(style);
  };
  const whenDocumentParsed = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  };
  const reportMode = () => new URL(window.location.href).searchParams.get("mode");
  const quizCmid = () => new URL(window.location.href).searchParams.get("id");
  const parseNumber = (text) => {
    const normalised = text.includes(",") && !text.includes(".") ? text.replace(",", ".") : text;
    const match = normalised.match(/-?\d+(?:\.\d+)?/);
    if (match === null) return null;
    const value = parseFloat(match[0]);
    return Number.isFinite(value) ? value : null;
  };
  const logBuild = (build2) => {
    console.log(`[kzn] ${build2.name} – ${build2.variant}, Commit ${build2.commit}`);
  };
  const withCommit = (title, build2) => `${title}
(${build2.name} – ${build2.variant}, Commit ${build2.commit})`;
  const css = '/* Neben jeder Punktzahl der Bewertungsspalte die Note, die sie ergibt, in der\n * Kopfzeile die Durchschnittsnote und die Aufgabenprozente, und ein Button mit\n * dem Maximum, gegen das gerechnet wird.\n *\n * Noten sind grün ab 4.00 und rot darunter (data-kzn-grade-pass setzt das\n * Script). Der Button ist blau, solange das Maximum das der Spaltenüberschrift\n * ist, und weiss mit dunkelblauem Rand bei einer Überschreibung. */\n\n/* Die Note steht sichtbar direkt hinter der Punktzahl in derselben Zelle. */\n[data-kzn-grade-scale] {\n	display: inline-block;\n	margin-left: 0.4em;\n	padding: 0 0.3em;\n	font: 600 11px/1.4 system-ui, sans-serif;\n	vertical-align: middle;\n	/* Punkte und Note gehören auf eine Zeile; eine schmale Spalte darf sie nicht\n	 * trennen. */\n	white-space: nowrap;\n	border-radius: 3px;\n}\n\n/* Zeigt das aktuell benutzte Maximum, inline nach der Spaltenbezeichnung. */\n#kzn-grade-scale-max {\n	margin-left: 0.4em;\n	padding: 0 0.3em;\n	font: 600 11px/1.4 system-ui, sans-serif;\n	vertical-align: middle;\n	color: #0d2a4d;\n	background-color: #d6e6f8;\n	border: 1px solid #1f5fa8;\n	border-radius: 3px;\n	cursor: pointer;\n}\n\n/* Das benutzte Maximum ist nicht das, das die Spaltenüberschrift ausweist: die\n * Noten auf dem Schirm sind also nicht die, die dieser Bericht nahelegt. */\n[data-kzn-grade-scale-override] #kzn-grade-scale-max {\n	color: #0d2a4d;\n	background-color: #fff;\n	border-color: #0d2a4d;\n}\n\n/* Kennzahlen in der Kopfzeile, sichtbar ohne Hover. */\n[data-kzn-grade-scale-badge] {\n	display: inline-block;\n	margin-left: 0.4em;\n	padding: 0 0.3em;\n	font: 600 11px/1.4 system-ui, sans-serif;\n	vertical-align: middle;\n	white-space: nowrap;\n	border-radius: 3px;\n}\n\n[data-kzn-grade-scale-badge][hidden] {\n	display: none;\n}\n\n[data-kzn-grade-scale-badge="average"] {\n	/* Der Tooltip (title) ist der zweite Teil der Auskunft. */\n	cursor: help;\n}\n\n/* Auf eine eigene Zeile unter «F 4 /4.00», damit die schmale Spalte nicht\n * breiter wird. */\n[data-kzn-grade-scale-badge="question"] {\n	display: table;\n	margin: 2px 0 0;\n}\n\n/* Jede Note – neben den Punkten, Durchschnitt, Aufgaben – rot unter 4.00, … */\n[data-kzn-grade-scale],\n[data-kzn-grade-scale-badge] {\n	color: #5c0f0f;\n	background-color: #f8d7d7;\n	border: 1px solid #c62828;\n}\n\n/* … und grün ab 4.00. */\n[data-kzn-grade-scale][data-kzn-grade-pass],\n[data-kzn-grade-scale-badge][data-kzn-grade-pass] {\n	color: #0f3d1b;\n	background-color: #d8efdd;\n	border-color: #2e7d32;\n}\n';
  const CELL_SELECTOR = "td.cell.c8";
  const HEADER_SELECTOR = "th.c8";
  const GRADE_ATTR = "data-kzn-grade-scale";
  const PASS_ATTR = "data-kzn-grade-pass";
  const OVERRIDE_ATTR = "data-kzn-grade-scale-override";
  const BUTTON_ID = "kzn-grade-scale-max";
  const STYLE_ID = "kzn-grade-scale-style";
  const BADGE_ATTR = "data-kzn-grade-scale-badge";
  const QUESTION_HEADER_SELECTOR = 'th:has(a[data-sortby^="qsgrade"])';
  const STORAGE_PREFIX = "_userscript.quiz-max-points.";
  function moodleNoten(build2) {
    if (reportMode() !== "overview") {
      if (build2.variant === "bookmarklet") {
        window.alert(
          "Das ist keine Quiz-Auswertung. Im Quiz auf «Ergebnisse» gehen (mod/quiz/report.php?mode=overview) und dort nochmal klicken."
        );
      }
      return;
    }
    const examId = quizCmid();
    if (!examId) return;
    const formatPoints = (points) => points.toFixed(2);
    const grade = (fraction) => fraction * 5 + 1;
    const showGrade = (element, value, prefix = "") => {
      const text = value.toFixed(2);
      element.textContent = prefix + text;
      element.toggleAttribute(PASS_ATTR, parseFloat(text) >= 4);
    };
    const readStoredMax = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + examId);
        return raw === null ? null : parseNumber(raw);
      } catch (error) {
        return null;
      }
    };
    const storeMax = (points) => {
      try {
        if (points === null) {
          window.localStorage.removeItem(STORAGE_PREFIX + examId);
        } else {
          window.localStorage.setItem(STORAGE_PREFIX + examId, String(points));
        }
      } catch (error) {
      }
    };
    const headerMax = (header) => {
      if (!header) return null;
      const label = header.cloneNode(true);
      for (const extra of label.querySelectorAll(
        `.accesshide, .commands, #${BUTTON_ID}, [${BADGE_ATTR}]`
      )) {
        extra.remove();
      }
      const match = label.textContent.match(/\/\s*(\d+(?:[.,]\d+)?)/);
      return match ? parseNumber(match[1]) : null;
    };
    const addGrades = () => {
      const cells = Array.from(document.querySelectorAll(CELL_SELECTOR));
      const table = cells.length > 0 ? cells[0].closest("table") : null;
      const header = (table ?? document).querySelector(HEADER_SELECTOR);
      const averageRows = cells.filter((cell) => cell.querySelector("span.average")).map((cell) => cell.closest("tr"));
      const averageRow = averageRows.length > 0 ? averageRows[averageRows.length - 1] : null;
      const averageIn = (columnClass) => {
        const average = averageRow?.querySelector(`td.${columnClass} span.average`);
        return average ? parseNumber(average.innerText) : null;
      };
      const statedMax = headerMax(header);
      const storedMax = readStoredMax();
      let maxPoints = storedMax !== null ? storedMax : statedMax;
      const entries = [];
      let button = null;
      let averageBadge = null;
      const averagePoints = averageIn("c8");
      const usable = () => maxPoints !== null && maxPoints > 0;
      const buildGrades = () => {
        if (!usable() || entries.length > 0) return;
        for (const cell of cells) {
          if (cell.querySelector(`[${GRADE_ATTR}]`)) continue;
          const score = cell.querySelector("a, span.average");
          if (!score) continue;
          const points = parseNumber(score.innerText);
          if (points === null) continue;
          const mark = document.createElement("span");
          mark.setAttribute(GRADE_ATTR, "");
          score.insertAdjacentElement("afterend", mark);
          entries.push({ mark, points });
        }
      };
      const render = () => {
        buildGrades();
        if (usable()) {
          for (const { mark, points } of entries) showGrade(mark, grade(points / maxPoints));
        } else {
          for (const { mark } of entries) mark.remove();
          entries.length = 0;
        }
        if (averageBadge) {
          if (usable() && averagePoints !== null) {
            averageBadge.hidden = false;
            showGrade(averageBadge, grade(averagePoints / maxPoints), "Ø ");
            averageBadge.title = withCommit(
              `Durchschnittsnote: ${formatPoints(averagePoints)} / ${formatPoints(maxPoints)} * 5 + 1 (Gesamtdurchschnitt der Punkte unten in der Tabelle)`,
              build2
            );
          } else {
            averageBadge.hidden = true;
          }
        }
        document.documentElement.toggleAttribute(OVERRIDE_ATTR, usable() && maxPoints !== statedMax);
        if (button) {
          button.textContent = usable() ? formatPoints(maxPoints) : "max?";
          button.title = withCommit(
            usable() ? `Note = Punkte / ${formatPoints(maxPoints)} * 5 + 1` + (maxPoints === statedMax ? "" : " – überschreibt die Spaltenüberschrift") + ". Klicken zum Ändern." : "Kein Maximum in der Spaltenüberschrift gefunden. Klicken, um eines einzugeben.",
            build2
          );
        }
      };
      const askForMax = () => {
        const fallback = statedMax === null ? "leer, um sie wieder zu löschen" : `leer für die ${formatPoints(statedMax)} aus der Spaltenüberschrift`;
        const answer = window.prompt(
          `Maximale Punktzahl dieser Prüfung (${fallback}):`,
          usable() ? formatPoints(maxPoints) : ""
        );
        if (answer === null) return;
        if (answer.trim() === "") {
          maxPoints = statedMax;
          storeMax(null);
          render();
          return;
        }
        const points = parseNumber(answer);
        if (points === null || points <= 0) {
          window.alert("Bitte eine gültige Punktzahl eingeben.");
          return;
        }
        maxPoints = points;
        storeMax(points);
        render();
      };
      const addButton = () => {
        if (!header || document.getElementById(BUTTON_ID)) return null;
        const element = document.createElement("button");
        element.id = BUTTON_ID;
        element.type = "button";
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          askForMax();
        });
        const label = header.querySelector("a");
        if (label) {
          label.insertAdjacentElement("afterend", element);
        } else {
          header.appendChild(element);
        }
        return element;
      };
      const addAverageBadge = () => {
        if (!header || averagePoints === null) return null;
        if (header.querySelector(`[${BADGE_ATTR}="average"]`)) return null;
        const element = document.createElement("span");
        element.setAttribute(BADGE_ATTR, "average");
        const anchor = button ?? header.querySelector("a");
        if (anchor) {
          anchor.insertAdjacentElement("afterend", element);
        } else {
          header.appendChild(element);
        }
        return element;
      };
      const addQuestionBadges = () => {
        if (!table || !averageRow) return;
        for (const questionHeader of table.querySelectorAll(QUESTION_HEADER_SELECTOR)) {
          if (questionHeader.querySelector(`[${BADGE_ATTR}]`)) continue;
          const columnClass = Array.from(questionHeader.classList).find((name) => /^c\d+$/.test(name));
          if (!columnClass) continue;
          const questionMax = headerMax(questionHeader);
          const questionAverage = averageIn(columnClass);
          if (questionMax === null || questionMax <= 0 || questionAverage === null) continue;
          const fraction = questionAverage / questionMax;
          const badge = document.createElement("span");
          badge.setAttribute(BADGE_ATTR, "question");
          showGrade(badge, grade(fraction), `${Math.round(fraction * 100)}%|`);
          const label = questionHeader.querySelector("a");
          if (label) {
            label.insertAdjacentElement("afterend", badge);
          } else {
            questionHeader.appendChild(badge);
          }
        }
      };
      button = addButton();
      averageBadge = addAverageBadge();
      addQuestionBadges();
      render();
    };
    injectStyle(STYLE_ID, css);
    whenDocumentParsed(addGrades);
  }
  const build = { "name": "Moodle Noten", "variant": "userscript", "commit": "cf76039" };
  logBuild(build);
  moodleNoten(build);
})();
