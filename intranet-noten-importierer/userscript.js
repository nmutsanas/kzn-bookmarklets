(function() {
  "use strict";
  function openGradeImporter() {
    const gradeTable = $("#gba-grid");
    if (gradeTable.length === 0) {
      alert("Fehler: Die Notentabelle konnte auf dieser Seite nicht gefunden werden.");
      return;
    }
    const kendoGrid = gradeTable.data("kendoGrid");
    $("#grade-importer-ui").remove();
    const ui = $('<div id="grade-importer-ui"></div>').css({
      position: "fixed",
      top: "50px",
      right: "50px",
      width: "320px",
      background: "#ffffff",
      border: "1px solid #ccc",
      "z-index": "10000",
      padding: "20px",
      "border-radius": "8px"
    });
    ui.append('<h3 style="margin-top:0; color:#333;">Noten von Excel Importieren</h3>');
    ui.append(
      '<p style="font-size:12px; color:#666;"><b>Instructions:</b><br>1. Kopiere 3 Spalten aus Excel<br>(Nachname | Vorname | Note)<br>2. Unten einfügen.</p>'
    );
    const textArea = $(
      '<textarea id="grade-paste-area" placeholder="Excel-Daten hier einfügen..."></textarea>'
    ).css({
      height: "150px",
      "white-space": "pre"
    });
    ui.append(textArea);
    const select = $('<select id="grade-column-select"></select>').css({
      width: "100%",
      padding: "8px",
      "margin-bottom": "15px"
    });
    select.append('<option value="" disabled selected>-- Zielspalte wählen --</option>');
    gradeTable.find(".k-grid-header-wrap th[data-field]").each(function() {
      const field = $(this).attr("data-field");
      const title = $(this).attr("data-title") || $(this).text().trim();
      if (field && field.indexOf("g_") === 0) {
        select.append(`<option value="${field}">${title}</option>`);
      }
    });
    ui.append(
      '<label style="font-weight:bold; font-size:12px;">Zielspalte:</label>'
    );
    ui.append(select);
    const runBtn = $("<button>Import-Vorschau</button>").css({
      width: "100%",
      background: "#28a745",
      color: "white",
      "margin-bottom": "10px",
      "text-shadow": "none"
    });
    const $btnClose = $("<button>Schliessen</button>").css({
      width: "100%",
      "margin-left": "0"
    });
    ui.append(runBtn).append($btnClose);
    $("body").append(ui);
    $btnClose.on("click", () => {
      $("#grade-importer-ui").remove();
    });
    runBtn.on("click", () => {
      const textData = textArea.val();
      const targetColumn = select.val();
      if (!textData.trim()) {
        alert("Das Textfeld ist leer.");
        return;
      }
      if (!targetColumn) {
        alert("Bitte eine Zielspalte wählen.");
        return;
      }
      previewGrades(kendoGrid, textData, targetColumn);
    });
    const previewGrades = (grid, textData, targetColumn) => {
      const lines = textData.split(/\n/);
      const gridData = grid.dataSource.data();
      const changesToApply = [];
      let notFoundCount = 0;
      lines.forEach((line) => {
        line = line.trim();
        if (!line) return;
        line = line.replaceAll(/\t{2,}/g, "	");
        line = line.replaceAll(/ᵐ/g, "");
        let parts = line.split(/\t/);
        if (parts.length < 3) parts = line.split(/,|;/);
        console.log("Line ", line);
        console.log("Parts", JSON.stringify(parts));
        if (parts.length >= 3) {
          const pLastName = parts[0].trim().toLowerCase();
          const pFirstName = parts[1].trim().toLowerCase();
          const newGrade = parts[2].trim();
          const student = gridData.find((item) => {
            const gFirstName = (item.studentGivenName || "").trim().toLowerCase();
            const gLastName = (item.studentLastName || "").trim().toLowerCase();
            return gFirstName === pFirstName && gLastName === pLastName;
          });
          if (student) {
            const currentVal = student[targetColumn];
            const oldVal = student && typeof student === "object" && "grade" in student ? student.grade : currentVal && typeof currentVal === "object" && "grade" in currentVal ? currentVal.grade : currentVal;
            changesToApply.push({
              student,
              name: `${parts[1].trim()} ${parts[0].trim()}`,
              // first last
              oldValue: oldVal,
              newValue: newGrade,
              targetColumn
            });
          } else {
            notFoundCount++;
          }
        }
      });
      if (changesToApply.length === 0) {
        alert(`Keine passenden Schüler gefunden.
Nicht gefunden: ${notFoundCount}`);
        return;
      }
      showConfirmation(grid, changesToApply, notFoundCount);
    };
    const showConfirmation = (grid, changes, notFoundCount) => {
      $("#grade-confirm-ui").remove();
      const confirmUi = $('<div id="grade-confirm-ui"></div>').css({
        position: "fixed",
        top: "50px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "400px",
        "max-height": "80vh",
        background: "#ffffff",
        border: "2px solid limegreen",
        "z-index": "10001",
        padding: "20px",
        "border-radius": "8px",
        "box-shadow": "0 0 15px rgba(0,0,0,0.5)",
        "overflow-y": "auto"
      });
      confirmUi.append('<h3 style="margin-top:0;margin-bottom:4px;">Änderungen bestätigen</h3>');
      const listHtml = changes.map((item) => {
        let valString = `<b>${item.newValue}</b>`;
        if (item.oldValue && item.oldValue != item.newValue) {
          valString = `<span style="color:red; text-decoration:line-through">${item.oldValue}</span> &rarr; <span style="color:green; font-weight:bold">${item.newValue}</span>`;
        }
        return `<li style="margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:2px;">
                ${item.name}: ${valString}
              </li>`;
      }).join("");
      confirmUi.append(`<ul style="list-style:none; padding-left:0; font-size:13px;">${listHtml}</ul>`);
      if (notFoundCount > 0) {
        confirmUi.append(`<p style="color:red; font-size:12px;">Warnung: ${notFoundCount} Einträge wurden nicht gefunden.</p>`);
      }
      const btnContainer = $('<div style="margin-top:15px; display:flex; gap:10px;"></div>');
      const btnConfirm = $("<button>Bestätigen & Ausführen</button>").css({
        flex: 1,
        background: "#28a745",
        color: "white",
        "text-shadow": "none"
      });
      const btnCancel = $("<button>Abbrechen</button>").css({
        flex: 1,
        background: "#dc3545",
        color: "white",
        "text-shadow": "none"
      });
      btnContainer.append(btnConfirm).append(btnCancel);
      confirmUi.append(btnContainer);
      $("body").append(confirmUi);
      btnCancel.on("click", () => $("#grade-confirm-ui").remove());
      btnConfirm.on("click", () => {
        $("#grade-confirm-ui").remove();
        applyChanges(grid, changes);
      });
    };
    const applyChanges = (grid, changes) => {
      let successCount = 0;
      let notFoundCount = 0;
      changes.forEach((change) => {
        try {
          const student = change.student;
          const targetColumn = change.targetColumn;
          const gradeValue = change.newValue;
          const row = grid.tbody.find(`tr[data-uid='${student.uid}']`);
          let cell = row.find(`td[data-field='${targetColumn}']`);
          if (cell.length === 0) {
            cell = row.find("td[data-field='" + targetColumn + "_grade']");
          }
          if (cell.length > 0) {
            grid.editCell(cell);
            const $input = cell.find("input");
            if ($input.length > 0) {
              $input.val(gradeValue);
              $input.trigger("change");
              $input.trigger("blur");
              successCount++;
            } else {
              console.warn(
                `could not find input for ${change.name}`
              );
              notFoundCount++;
            }
            grid.closeCell();
          } else {
            notFoundCount++;
          }
        } catch (e) {
          console.error(`error processing ${change.name}: `, e);
          notFoundCount++;
        }
      });
      alert(
        `Import fertiggestellt.
Erfolgreiche Einträge: ${successCount}
Nicht gefunden/Übersprungen: ${notFoundCount}`
      );
    };
  }
  const logBuild = (build2) => {
    console.log(`[kzn] ${build2.name} – ${build2.variant}, Commit ${build2.commit}`);
  };
  const withCommit = (title, build2) => `${title}
(${build2.name} – ${build2.variant}, Commit ${build2.commit})`;
  const POLL_INTERVAL_MS = 500;
  const POLL_TIMEOUT_MS = 3e4;
  const addButton = ({ id, label, build: build2, run }) => {
    if (document.getElementById(id)) return;
    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.textContent = label;
    btn.title = withCommit(label, build2);
    Object.assign(btn.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      zIndex: "9999",
      padding: "8px 14px",
      background: "#28a745",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      font: "bold 13px sans-serif",
      textShadow: "none",
      boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
    });
    btn.addEventListener("click", () => run(build2));
    document.body.appendChild(btn);
  };
  const installLauncher = ({ id, label, readySelector, requiresJQuery = false, build: build2, run }) => {
    const isReady = () => {
      if (requiresJQuery && typeof window.$ !== "function") return false;
      return !readySelector || document.querySelector(readySelector) !== null;
    };
    if (isReady()) {
      addButton({ id, label, build: build2, run });
      return;
    }
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const poll = setInterval(() => {
      if (isReady()) {
        clearInterval(poll);
        addButton({ id, label, build: build2, run });
      } else if (Date.now() > deadline) {
        clearInterval(poll);
      }
    }, POLL_INTERVAL_MS);
  };
  const build = { "id": "intranet-noten-importierer", "name": "Noten-Importierer", "variant": "userscript", "commit": "c9644f8" };
  logBuild(build);
  installLauncher({ ...{ "id": "kzn-launcher-intranet-noten-importierer", "label": "Grade importer", "readySelector": "#gba-grid", "requiresJQuery": true }, build, run: openGradeImporter });
})();
