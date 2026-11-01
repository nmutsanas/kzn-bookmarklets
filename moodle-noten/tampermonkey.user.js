// ==UserScript==
// @name         Moodle Quiz Noten
// @namespace    kzn-bookmarklets
// @version      1.0.0
// @description  Zeigt in der Quiz-Auswertung zu jeder Punktzahl die Note auf der 1–6-Skala, mit überschreibbarer maximaler Punktzahl.
// @author       KZN FS Informatik
// @match        https://moodle.kzn.ch/mod/quiz/report.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
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
  const css = "/* Ein Tooltip an jeder Punktzahl der Bewertungsspalte mit der Note, die sie\n * ergibt, und ein Button in der Spaltenüberschrift, der das Maximum\n * überschreibt, gegen das gerechnet wird.\n *\n * Grün, solange dieses Maximum das ist, das die Spaltenüberschrift selbst\n * ausweist, orange sobald eine handeingetragene Überschreibung an seine Stelle\n * getreten ist – siehe die Regel am Ende der Datei. */\n\n/* Positionierungskontext der Tooltips, mit :has() auf die Zellen beschränkt, die\n * wirklich einen bekommen haben: keine andere Zelle des Berichts soll zum\n * containing block für ihre eigenen absolut positionierten Kinder werden. */\ntd.cell:has(> [data-kzn-grade-scale]) {\n	position: relative;\n}\n\n[data-kzn-grade-scale] {\n	display: none;\n	position: absolute;\n	/* Zentriert über der eigenen Zelle. */\n	bottom: 100%;\n	left: 50%;\n	transform: translateX(-50%);\n	/* Über dem sticky Tabellenkopf, unter dem die obersten Zeilen sonst\n	 * verschwinden. */\n	z-index: 1000;\n	padding: 2px 5px;\n	font: 600 12px/1.3 system-ui, sans-serif;\n	/* Die Note ist kurz; eine schmale Spalte darf sie nie umbrechen. */\n	white-space: nowrap;\n	color: #0f3d1b;\n	background-color: #d8efdd;\n	border: 1px solid #2e7d32;\n	border-radius: 3px;\n	box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.2);\n}\n\n/* Hover hier und nicht mit Listenern im Script: der Tooltip ist ein Kind der\n * Zelle, das kann CSS allein. */\ntd.cell:hover > [data-kzn-grade-scale] {\n	display: block;\n}\n\n/* Zeigt das aktuell benutzte Maximum, inline nach der Spaltenbezeichnung. */\n#kzn-grade-scale-max {\n	margin-left: 0.4em;\n	padding: 0 0.3em;\n	font: 600 11px/1.4 system-ui, sans-serif;\n	vertical-align: middle;\n	color: #0f3d1b;\n	background-color: #d8efdd;\n	border: 1px solid #2e7d32;\n	border-radius: 3px;\n	cursor: pointer;\n}\n\n/* Das benutzte Maximum ist nicht das, das die Spaltenüberschrift ausweist, die\n * Noten auf dem Schirm sind also nicht die, die dieser Bericht nahelegt. Die\n * Tooltips und der Button, der dazu geführt hat, sagen das. */\n[data-kzn-grade-scale-override] [data-kzn-grade-scale],\n[data-kzn-grade-scale-override] #kzn-grade-scale-max {\n	color: #4a2600;\n	background-color: #ffe0b2;\n	border-color: #e65100;\n}\n";
  const CELL_SELECTOR = "td.cell.c8";
  const HEADER_SELECTOR = "th.c8";
  const TOOLTIP_ATTR = "data-kzn-grade-scale";
  const OVERRIDE_ATTR = "data-kzn-grade-scale-override";
  const BUTTON_ID = "kzn-grade-scale-max";
  const STYLE_ID = "kzn-grade-scale-style";
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
      for (const extra of label.querySelectorAll(`.accesshide, .commands, #${BUTTON_ID}`)) {
        extra.remove();
      }
      const match = label.textContent.match(/\/\s*(\d+(?:[.,]\d+)?)/);
      return match ? parseNumber(match[1]) : null;
    };
    const addTooltips = () => {
      const cells = Array.from(document.querySelectorAll(CELL_SELECTOR));
      const table = cells.length > 0 ? cells[0].closest("table") : null;
      const header = (table ?? document).querySelector(HEADER_SELECTOR);
      const statedMax = headerMax(header);
      const storedMax = readStoredMax();
      let maxPoints = storedMax !== null ? storedMax : statedMax;
      const entries = [];
      let button = null;
      const usable = () => maxPoints !== null && maxPoints > 0;
      const buildTooltips = () => {
        if (!usable() || entries.length > 0) return;
        for (const cell of cells) {
          if (cell.querySelector(`[${TOOLTIP_ATTR}]`)) continue;
          const score = cell.querySelector("a, span.average");
          if (!score) continue;
          const points = parseNumber(score.innerText);
          if (points === null) continue;
          const tooltip = document.createElement("div");
          tooltip.setAttribute(TOOLTIP_ATTR, "");
          cell.appendChild(tooltip);
          entries.push({ tooltip, points });
        }
      };
      const render = () => {
        buildTooltips();
        if (usable()) {
          for (const { tooltip, points } of entries) {
            tooltip.textContent = (points / maxPoints * 5 + 1).toFixed(2);
          }
        } else {
          for (const { tooltip } of entries) tooltip.remove();
          entries.length = 0;
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
      button = addButton();
      render();
    };
    injectStyle(STYLE_ID, css);
    whenDocumentParsed(addTooltips);
  }
  const build = { "name": "Moodle Noten", "variant": "tampermonkey", "commit": "c9644f8" };
  logBuild(build);
  moodleNoten(build);
})();
