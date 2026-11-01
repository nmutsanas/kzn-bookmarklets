(function() {
  "use strict";
  const injectStyle = (id, css2) => {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css2;
    (document.head ?? document.documentElement).appendChild(style);
  };
  const whenBody = (callback) => {
    if (document.body) {
      callback();
    } else {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    }
  };
  const logBuild = (build2) => {
    console.log(`[kzn] ${build2.name} – ${build2.variant}, Commit ${build2.commit}`);
  };
  const withCommit = (title, build2) => `${title}
(${build2.name} – ${build2.variant}, Commit ${build2.commit})`;
  const css = "/* Styling der switch-Links. Sie sitzen in Moodles Kursindex-Schublade und dürfen\n * nicht mit den Einträgen des Kurses selbst verwechselt werden: kleiner als ein\n * Quiz-Name, darunter eingerückt und blass, bis man darauf zeigt. */\n\n[data-kzn-quiz-switch] {\n	/* Etwa die Einrückung des Textes eines courseindex-item, damit der Link als\n	 * zum Quiz darüber gehörend gelesen wird. */\n	padding-left: 1.5rem;\n	line-height: 1.2;\n}\n\n[data-kzn-quiz-switch] > a {\n	font-size: 0.75rem;\n	font-style: italic;\n	opacity: 0.6;\n	text-decoration: none;\n}\n\n[data-kzn-quiz-switch] > a:hover,\n[data-kzn-quiz-switch] > a:focus {\n	opacity: 1;\n	text-decoration: underline;\n}\n";
  const MARKER_ATTR = "data-kzn-quiz-switch";
  const STYLE_ID = "kzn-quiz-switch-style";
  const QUIZ_LINK_SELECTOR = 'a.courseindex-link[href*="mod/quiz/view.php?id="]';
  function moodleSwitch(build2) {
    const here = new URL(window.location.href);
    let adding = false;
    const addSwitchLinks = () => {
      let added = 0;
      adding = true;
      try {
        for (const quizLink of document.querySelectorAll(QUIZ_LINK_SELECTOR)) {
          const item = quizLink.parentNode;
          if (!item || item.querySelector(`[${MARKER_ATTR}]`)) continue;
          const cmid = new URL(quizLink.href, window.location.href).searchParams.get("id");
          if (!cmid) continue;
          const target = new URL(here);
          target.searchParams.set("id", cmid);
          const row = document.createElement("div");
          row.setAttribute(MARKER_ATTR, "");
          const link = document.createElement("a");
          link.href = target.toString();
          link.textContent = "switch";
          link.title = withCommit(`Dieselbe Ansicht für «${quizLink.textContent.trim()}» öffnen`, build2);
          row.appendChild(link);
          item.appendChild(row);
          added++;
        }
      } finally {
        adding = false;
      }
      return added;
    };
    if (!here.searchParams.has("id")) {
      if (build2.variant === "bookmarklet") {
        window.alert(
          "Diese Seite hängt an keinem Quiz (kein «id» in der URL) – es gibt keine Ansicht, die sich auf ein anderes Quiz übertragen liesse."
        );
      }
      return;
    }
    injectStyle(STYLE_ID, css);
    whenBody(() => {
      const added = addSwitchLinks();
      const observer = new MutationObserver(() => {
        if (!adding) addSwitchLinks();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (added === 0 && build2.variant === "bookmarklet") {
        window.alert(
          "Keine Quizze im Kursindex gefunden. Ist die Kursindex-Schublade links geöffnet und der Abschnitt mit den Quizzen aufgeklappt?"
        );
      }
    });
  }
  const build = { "id": "moodle-switch", "name": "Moodle Switch", "variant": "userscript", "commit": "c9644f8" };
  logBuild(build);
  moodleSwitch(build);
})();
