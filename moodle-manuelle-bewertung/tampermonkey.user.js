// ==UserScript==
// @name         Moodle Quiz Manuelle Bewertung
// @namespace    kzn-bookmarklets
// @version      1.0.0
// @description  Bricht die zusammengefallenen Programm-Antworten zurück in Zeilen, zeigt sie in voller Höhe, legt je einen Copy-Button dazu und lässt die Fragetitel mitlaufen.
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
  const whenElement = (selector, callback) => {
    const found = () => document.querySelector(selector);
    if (found()) {
      callback(found());
      return;
    }
    if (document.readyState !== "loading") return;
    const observer = new MutationObserver(() => {
      const element = found();
      if (!element) return;
      observer.disconnect();
      callback(element);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", () => observer.disconnect(), { once: true });
  };
  const reportMode = () => new URL(window.location.href).searchParams.get("mode");
  const logBuild = (build2) => {
    console.log(`[kzn] ${build2.name} – ${build2.variant}, Commit ${build2.commit}`);
  };
  const withCommit = (title, build2) => `${title}
(${build2.name} – ${build2.variant}, Commit ${build2.commit})`;
  const css = "/* Styling für die manuelle Bewertung. Alles aussser dem Button und seinem\n * Wrapper hängt an dem Attribut, das das Script am <html> setzt, sobald\n * «Antworten formatieren» ausgelöst wurde – der Bericht sieht also unberührt\n * aus, bis es wirklich losgeht. */\n\n/* Der Positionierungskontext der Toolbar darunter. Mit :has() auf genau den\n * Container beschränkt, an den die Toolbar auch angehängt wurde, damit kein\n * anderes Element des Themes zum containing block für seine eigenen absolut\n * positionierten Kinder wird. */\ndiv.moove-container-fluid:has(> #kzn-grading-toolbar) {\n	position: relative;\n}\n\n/* Unser eigener Wrapper in diesem Container, der den Button in dessen rechte\n * obere Ecke hält. Aus dem Fluss genommen: im Fluss war er eine eigene\n * Flex-Zeile und machte den Container höher. Auf seinen Inhalt geschrumpft,\n * damit er nicht mehr von dem verdeckt, was darunter liegt, als der Button\n * selbst. */\n#kzn-grading-toolbar {\n	position: absolute;\n	top: 0;\n	right: 0;\n	/* Über dem Inhalt des Containers, aber deutlich unter den sticky Fragetiteln\n	 * weiter unten in dieser Datei. */\n	z-index: 1;\n	display: flex;\n	align-items: center;\n	/* Platz für das, was ein anderes Script neben uns anhängen mag. */\n	gap: 0.5rem;\n}\n\n#kzn-grading-format-button {\n	padding: 0.4rem 0.75rem;\n	font: 600 12px/1.2 system-ui, sans-serif;\n	color: #0f3d1b;\n	background-color: #d8efdd;\n	border: 1px solid #2e7d32;\n	border-radius: 6px;\n	cursor: pointer;\n	opacity: 0.85;\n}\n\n#kzn-grading-format-button:hover,\n#kzn-grading-format-button:focus {\n	opacity: 1;\n}\n\n/* Die Fragetitel des Bewertungsformulars. Bleiben beim Scrollen durch eine lange\n * Antwort im Blick, damit klar bleibt, welche Frage man liest.\n *\n * `top` hält Moodles fixe Navigationsleiste frei; der Wert ist nach Augenmass\n * gesetzt, also hier nachjustieren, falls die Titel hinter der Leiste\n * verschwinden oder darunter schweben. */\n[data-kzn-grading-formatted] form > div > h4 {\n	position: sticky;\n	top: 130px;\n	z-index: 9999;\n	background: lightgreen;\n	font-size: 10pt;\n}\n\n/* Positionierungskontext für den Copy-Button, der über seinem eigenen\n * Antwortfeld liegt. */\n[data-kzn-grading-formatted] .kzn-grading-response {\n	position: relative;\n	display: inline-block;\n	width: 100%;\n}\n\n[data-kzn-grading-formatted] .kzn-grading-copy {\n	position: absolute;\n	top: 5px;\n	right: 5px;\n	z-index: 10;\n}\n";
  const BUTTON_ID = "kzn-grading-format-button";
  const BUTTON_LABEL = "Antworten formatieren";
  const TOOLBAR_ID = "kzn-grading-toolbar";
  const CONTAINER_SELECTOR = "div.moove-container-fluid";
  const ROOT_ATTR = "data-kzn-grading-formatted";
  const PROCESSED_ATTR = "data-kzn-grading-processed";
  const STYLE_ID = "kzn-grading-format-style";
  const WRAPPER_CLASS = "kzn-grading-response";
  const COPY_CLASS = "kzn-grading-copy";
  const breakIntoLines = (text) => text.replace(/import random/g, "import random\n").replace(/import ([^*\n]+)/g, "import $1\n").replace(/import *\*/g, "import *\n").replace(/^([a-zA-Z_]\w* *= *\[.*?\])(?=[a-zA-Z_])/gm, "$1\n").replace(/(def *)/g, "\n$&").replace(/(return *[a-zA-Z_0-9]*)/g, "$1\n").replace(/ {2,}/g, "\n$&").replace(/((makeTurtle|mt) *\(\))/g, "\n$&\n").replace(/((hideTurtle|ht) *\(\))/g, "\n$&\n").replace(/\b(speed *\(.*\))\b/g, "\n$&\n").replace(/([)\]])([a-zA-Z0-9])/g, "$1\n$2");
  const lineCount = (text) => text.split("\n").length;
  const formatResponses = () => {
    const responses = document.querySelectorAll("textarea.qtype_essay_response");
    let formatted = 0;
    for (const textarea of responses) {
      if (textarea.hasAttribute(PROCESSED_ATTR)) continue;
      textarea.setAttribute(PROCESSED_ATTR, "");
      if (lineCount(textarea.value) <= 2) {
        textarea.value = breakIntoLines(textarea.value);
      }
      const wrapper = document.createElement("div");
      wrapper.className = WRAPPER_CLASS;
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = COPY_CLASS;
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", (event) => {
        event.preventDefault();
        navigator.clipboard.writeText(textarea.value);
        copyButton.textContent = "Kopiert!";
        setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 2e3);
      });
      textarea.parentNode.insertBefore(wrapper, textarea);
      wrapper.appendChild(textarea);
      wrapper.appendChild(copyButton);
      textarea.rows = Math.max(lineCount(textarea.value), 1);
      formatted++;
    }
    document.documentElement.setAttribute(ROOT_ATTR, "");
    return formatted;
  };
  function moodleManuelleBewertung(build2) {
    if (reportMode() !== "grading") {
      if (build2.variant === "bookmarklet") {
        window.alert(
          "Das ist keine manuelle Bewertung. Im Quiz auf «Manuelle Bewertung» gehen (mod/quiz/report.php?mode=grading) und dort nochmal klicken."
        );
      }
      return;
    }
    let button = null;
    const report = (formatted) => {
      if (!button) return;
      button.textContent = formatted === 1 ? "1 Antwort formatiert" : `${formatted} Antworten formatiert`;
      setTimeout(() => {
        button.textContent = BUTTON_LABEL;
      }, 2e3);
    };
    const addButton = (container) => {
      if (document.getElementById(TOOLBAR_ID)) return;
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.textContent = BUTTON_LABEL;
      button.title = withCommit(
        "Die zusammengefallenen Antworten zurück in Zeilen brechen, die Felder auf die nötige Höhe bringen und je einen Copy-Button dazulegen",
        build2
      );
      button.addEventListener("click", () => report(formatResponses()));
      const toolbar = document.createElement("div");
      toolbar.id = TOOLBAR_ID;
      toolbar.appendChild(button);
      container.appendChild(toolbar);
    };
    injectStyle(STYLE_ID, css);
    whenElement(CONTAINER_SELECTOR, addButton);
    if (build2.variant === "bookmarklet") report(formatResponses());
  }
  const build = { "name": "Moodle Manuelle Bewertung", "variant": "tampermonkey", "commit": "c9644f8" };
  logBuild(build);
  moodleManuelleBewertung(build);
})();
