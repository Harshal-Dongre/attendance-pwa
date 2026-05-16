// --- Database Core State (Loads from storage or defaults empty) ---
let db = JSON.parse(localStorage.getItem("attendance_db")) || { semesters: [] };

// Persistent User Configuration Defaults
let configs = JSON.parse(localStorage.getItem("attendance_config")) || {};

// Strict Initialization Fallback Layer (Guarantees no undefined limits)
if (configs.sortSemestersChronological === undefined) configs.sortSemestersChronological = true;
if (configs.sortSubjectsAlphabetical === undefined) configs.sortSubjectsAlphabetical = true;
if (configs.targetThreshold === undefined || isNaN(configs.targetThreshold)) configs.targetThreshold = 75;

function saveDatabase() {
  localStorage.setItem("attendance_db", JSON.stringify(db));
}
function saveConfigs() {
  localStorage.setItem("attendance_config", JSON.stringify(configs));
}

// --- High-Fidelity Chronological Term Evaluation Engine ---
function evaluateTermWeight(nameString) {
  const clean = nameString.trim().toUpperCase();
  const match = clean.match(/^(S|W|SUMMER|WINTER|MONSOON|AUTUMN)?\s*(\d{2,4})$/);
  if (!match) return 0;
  
  const termCode = match[1] || "";
  let year = parseInt(match[2]);
  if (year < 100) year += 2000; // Normalize 2-digit codes (e.g., 25 -> 2025)

  // Academic Term Weighting Matrix
  let termWeight = 0;
  if (termCode.startsWith("S")) termWeight = 1; // Spring / Summer
  if (termCode.startsWith("M") || termCode.startsWith("A")) termWeight = 2; // Monsoon / Autumn
  if (termCode.startsWith("W")) termWeight = 3; // Winter

  return (year * 10) + termWeight;
}

// --- Presentation Controller Router Context ---
const ui = {
  currentSemIdx: null,
  currentSubIdx: null,
  currentLecIdx: null,
  activeSubView: 'lectures',

  clearViewContext() {
    document.querySelectorAll(".view-panel").forEach(p => p.style.display = "none");
    document.getElementById("dynamicActionsBar").innerHTML = "";
    document.getElementById("sortingToggleContainer").innerHTML = "";
    document.getElementById("subjectAnalyticsPanel").innerHTML = "";
    document.getElementById("subjectExportWrapper").innerHTML = "";
    document.getElementById("lectureExportWrapper").innerHTML = "";
  },

  showSemesterView() {
    this.clearViewContext();
    this.currentSemIdx = null;
    this.currentSubIdx = null;
    this.currentLecIdx = null;

    document.getElementById("appTitle").innerText = "Semesters";
    
    // Sort Toggle Placement
    const sortToggle = document.getElementById("sortingToggleContainer");
    sortToggle.innerHTML = `
      <button class="sort-toggle-btn" onclick="actions.toggleSemesterSort()">
        Sort: ${configs.sortSemestersChronological ? "Newest First" : "Oldest First"}
      </button>
    `;

    const actionsBar = document.getElementById("dynamicActionsBar");
    actionsBar.innerHTML = `<button class="btn btn-primary" onclick="actions.addSemester()">+ Add Semester</button>`;

    document.getElementById("semesterView").style.display = "block";
    this.renderSemesters();
  },

  showSubjectView(semIdx) {
    this.clearViewContext();
    this.currentSemIdx = semIdx;
    this.currentSubIdx = null;
    this.currentLecIdx = null;

    const sem = db.semesters[semIdx];
    document.getElementById("appTitle").innerText = `Semester: ${sem.name}`;

    const sortToggle = document.getElementById("sortingToggleContainer");
    sortToggle.innerHTML = `
      <button class="sort-toggle-btn" onclick="actions.toggleSubjectSort()">
        Sort: ${configs.sortSubjectsAlphabetical ? "A-Z" : "Manual Order"}
      </button>
    `;

    const actionsBar = document.getElementById("dynamicActionsBar");
    actionsBar.innerHTML = `
      <button class="btn btn-secondary" onclick="ui.showSemesterView()">← Back</button>
      <button class="btn btn-primary" onclick="actions.addSubject(${semIdx})">+ Add Subject</button>
    `;

    document.getElementById("subjectView").style.display = "block";
    this.renderSubjects();
  },

  showLectureView(subIdx) {
    this.clearViewContext();
    this.currentSubIdx = subIdx;
    this.currentLecIdx = null;

    const sub = db.semesters[this.currentSemIdx].subjects[subIdx];
    document.getElementById("appTitle").innerText = `${sub.name}`;

    const actionsBar = document.getElementById("dynamicActionsBar");
    actionsBar.innerHTML = `
      <button class="btn btn-secondary" onclick="ui.showSubjectView(${this.currentSemIdx})">← Back</button>
      <button class="btn btn-primary" onclick="actions.addAutomatedLecture()">+ Take Attendance</button>
    `;

    document.getElementById("lectureView").style.display = "block";
    this.renderSubjectAnalytics(sub);
    this.switchSubView(this.activeSubView);
  },

  showAttendanceView(lecIdx) {
    this.clearViewContext();
    this.currentLecIdx = lecIdx;

    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    const lec = sub.lectures[lecIdx];
    document.getElementById("appTitle").innerText = `${sub.name} - ${lec.date}`;

    const actionsBar = document.getElementById("dynamicActionsBar");
    actionsBar.innerHTML = `
      <button class="btn btn-secondary" onclick="ui.showLectureView(${this.currentSubIdx})">← Back</button>
      <button class="btn btn-primary" onclick="ui.showLectureView(${this.currentSubIdx})">Done ✓</button>
    `;

    document.getElementById("attendanceView").style.display = "block";
    this.renderAttendance();
    this.renderLectureExportOptions();
  },

  switchSubView(viewType) {
    this.activeSubView = viewType;
    document.getElementById("lectureListView").style.display = "none";
    document.getElementById("studentRosterView").style.display = "none";
    document.getElementById("tabLectures").classList.remove("active");
    document.getElementById("tabStudents").classList.remove("active");

    if (viewType === 'lectures') {
      document.getElementById("tabLectures").classList.add("active");
      document.getElementById("lectureListView").style.display = "flex";
      this.renderLectures();
      this.renderSubjectExportOptions();
    } else {
      document.getElementById("tabStudents").classList.add("active");
      document.getElementById("studentRosterView").style.display = "flex";
      this.renderRoster();
      this.renderRosterManagementOptions();
    }
  },

  // --- Upgraded Analytical Rendering Subsystem (With Click-to-Expand & 5% Interval Stepper Slider) ---
  renderSubjectAnalytics(sub) {
    const target = document.getElementById("subjectAnalyticsPanel");
    if (!sub.lectures || sub.lectures.length === 0 || sub.students.length === 0) {
      target.innerHTML = "";
      return;
    }

    let totalPossibleInstances = sub.students.length * sub.lectures.length;
    let totalPresentInstances = 0;

    sub.lectures.forEach(l => {
      totalPresentInstances += l.attendance.filter(a => a.status === 'present').length;
    });

    let generalAttendanceAvg = Math.round((totalPresentInstances / totalPossibleInstances) * 100);

    // Ensure state calculations use normalized numerical types
    let currentLimit = parseInt(configs.targetThreshold) || 75;

    // Filter out exactly who is under the user-defined dynamic threshold
    let flaggedStudents = [];
    sub.students.forEach(s => {
      let studentPCount = 0;
      sub.lectures.forEach(l => {
        let rec = l.attendance.find(a => a.id === s.id);
        if (rec && rec.status === 'present') studentPCount++;
      });
      
      let percentage = Math.round((studentPCount / sub.lectures.length) * 100);
      if (percentage < currentLimit) {
        flaggedStudents.push({
          id: s.id,
          short: s.short,
          name: s.name,
          pct: percentage,
          countString: `(${studentPCount}/${sub.lectures.length})`
        });
      }
    });

    // Generate rows for the flagged students if any exist
    let rosterRowsHtml = "";
    if (flaggedStudents.length === 0) {
      rosterRowsHtml = `<div style="padding: 16px 10px; font-size: 0.8rem; color: var(--secondary); text-align: center;">All students clear of the ${currentLimit}% baseline! 🎉</div>`;
    } else {
      // Sort lowest attendance first so problem cases track right to the top
      flaggedStudents.sort((a, b) => a.pct - b.pct);
      
      flaggedStudents.forEach(fs => {
        rosterRowsHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 4px; border-bottom: 1px solid var(--border); font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <strong style="color: #ef4444; font-size: 1.1rem; min-width: 28px;">${fs.short}</strong>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <div style="font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fs.name}</div>
                <div style="font-size: 0.7rem; color: var(--secondary); font-family: monospace;">${fs.id}</div>
              </div>
            </div>
            <div style="text-align: right; font-weight: 800; color: #ef4444; margin-left: 8px;">
              <span>${fs.pct}%</span>
              <div style="font-size: 0.65rem; color: var(--secondary); font-weight: 600;">${fs.countString}</div>
            </div>
          </div>
        `;
      });
    }

    // Render layout block containing standard cards alongside the integrated interval selector wheel
    target.innerHTML = `
      <div class="analytics-box" style="padding-bottom: ${flaggedStudents.length > 0 ? '10px' : '14px'};">
        <h4>Subject Metrics Snapshot</h4>
        <div class="analytics-grid">
          <div class="analytic-metric">
            <div>Class Average</div>
            <div>${generalAttendanceAvg}%</div>
          </div>
          <div class="analytic-metric" id="shortAttendanceTriggerCard" style="cursor: pointer; position: relative; border-color: ${flaggedStudents.length > 0 ? '#fca5a5' : 'var(--border)'}; background: ${flaggedStudents.length > 0 ? '#fff5f5' : 'var(--surface)'};" onclick="actions.toggleShortAttendanceDrawer()">
            <div>Short Attendance (<span id="liveMetricHeaderTitleThreshold">${currentLimit}%</span>)</div>
            <div style="color: ${flaggedStudents.length > 0 ? '#ef4444' : 'var(--primary)'}; display: flex; align-items: center; justify-content: space-between;">
              <span>${flaggedStudents.length} Students</span>
              <span id="drawerChevronIndicator" style="font-size: 0.75rem; transform: rotate(0deg); transition: transform 0.2s ease; color: var(--secondary); margin-left: 4px;">▼</span>
            </div>
          </div>
        </div>

        <!-- Interactive Drawer Content Slot -->
        <div id="shortAttendanceDrawer" style="display: none; margin-top: 14px; padding-top: 6px; border-top: 1px dashed var(--border); max-height: 280px; overflow-y: auto; -webkit-overflow-scrolling: touch;">
          
          <!-- Smooth Horizontal 5% Step Interval Selection Slider Module -->
          <div style="background: var(--surface); padding: 8px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 0.7rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.5px;">Adjust Target Baseline:</span>
              <strong style="font-size: 0.85rem; color: var(--primary); font-family: monospace; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;" id="sliderDisplayReadout">${currentLimit}%</strong>
            </div>
            <input type="range" min="50" max="95" step="5" value="${currentLimit}" style="width: 100%; height: 6px; cursor: pointer; accent-color: var(--primary);" oninput="actions.handleThresholdSliderAdjustment(this.value)">
            <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--secondary); font-weight: 700; padding: 0 2px; margin-top: 2px;">
              <span>50%</span><span>60%</span><span>70%</span><span style="color: var(--primary);">75%</span><span>80%</span><span>90%</span><span>95%</span>
            </div>
          </div>

          <div style="font-size: 0.7rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Flagged Student List</div>
          <div id="drawerDynamicRosterTargetZone">${rosterRowsHtml}</div>
        </div>
      </div>
    `;
  },

  // --- Pipeline UI Content Generation passes ---
  renderSemesters() {
    const list = document.getElementById("semesterList");
    list.innerHTML = db.semesters.length === 0 ? "<p class='card'>No semesters defined.</p>" : "";

    let structuralMap = db.semesters.map((sem, originalIdx) => ({ sem, originalIdx }));

    structuralMap.sort((a, b) => {
      let weightA = evaluateTermWeight(a.sem.name);
      let weightB = evaluateTermWeight(b.sem.name);
      return configs.sortSemestersChronological ? (weightB - weightA) : (weightA - weightB);
    });

    structuralMap.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header-flex">
          <h3>${item.sem.name}</h3>
          <button class="btn-danger" style="padding:4px 8px;" onclick="actions.deleteSemester(${item.originalIdx})">Delete</button>
        </div>
        <p>${item.sem.subjects?.length || 0} Course Subjects</p>
        <button class="btn btn-secondary" style="width: 100%; min-height: 40px;" onclick="ui.showSubjectView(${item.originalIdx})">Open Semester</button>
      `;
      list.appendChild(card);
    });
  },

  renderSubjects() {
    const list = document.getElementById("subjectList");
    const sem = db.semesters[this.currentSemIdx];
    list.innerHTML = sem.subjects.length === 0 ? "<p class='card'>No course subjects defined.</p>" : "";

    let structuralMap = sem.subjects.map((sub, originalIdx) => ({ sub, originalIdx }));

    if (configs.sortSubjectsAlphabetical) {
      structuralMap.sort((a, b) => a.sub.name.localeCompare(b.sub.name, undefined, {sensitivity: 'base'}));
    }

    structuralMap.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header-flex">
          <h3>${item.sub.name}</h3>
          <button class="btn-danger" style="padding:4px 8px;" onclick="actions.deleteSubject(${item.originalIdx})">Delete</button>
        </div>
        <p>${item.sub.students?.length || 0} Registered Roster | ${item.sub.lectures?.length || 0} Classes Run</p>
        <button class="btn btn-secondary" style="width: 100%; min-height: 40px;" onclick="ui.showLectureView(${item.originalIdx})">Manage Course</button>
      `;
      list.appendChild(card);
    });
  },

  renderLectures() {
    const list = document.getElementById("lectureListView");
    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    list.innerHTML = sub.lectures.length === 0 ? "<p class='card'>No session records found.</p>" : "";
    
    for (let i = sub.lectures.length - 1; i >= 0; i--) {
      const lec = sub.lectures[i];
      let pCount = lec.attendance.filter(a => a.status === 'present').length;
      let aCount = lec.attendance.filter(a => a.status === 'absent').length;

      const item = document.createElement("div");
      item.className = "lecture-item";
      item.innerHTML = `
        <div>
          <strong>${lec.date}</strong> <span style="color: var(--secondary); margin-left:6px; font-size:0.8rem;">${lec.time}</span>
          <div style="font-size:0.75rem; margin-top:4px; font-weight:700;">
            <span style="color: var(--present-text);">P: ${pCount}</span> | 
            <span style="color: var(--absent-text);">A: ${aCount}</span>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" style="min-height:36px; padding:0 12px; font-size:0.8rem;" onclick="ui.showAttendanceView(${i})">Edit</button>
          <button class="btn-danger" style="padding:0 8px;" onclick="actions.deleteLecture(${i})">Delete</button>
        </div>
      `;
      list.appendChild(item);
    }
  },

  renderAttendance() {
    const list = document.getElementById("attendanceList");
    const lec = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx].lectures[this.currentLecIdx];
    list.innerHTML = "";

    this.updateLiveStatsContext(lec);

    lec.attendance.forEach((student) => {
      const row = document.createElement("div");
      row.className = `attendance-row ${student.status}`;
      row.innerHTML = `<div class="short-id-trigger">${student.short}</div>`;

      let holdTimer;
      const peekBox = document.getElementById("topPeekPanel");

      row.onclick = () => {
        student.status = student.status === 'present' ? 'absent' : 'present';
        row.className = `attendance-row ${student.status}`;
        this.updateLiveStatsContext(lec);
        saveDatabase();
      };

      const firePeek = () => {
        peekBox.innerHTML = `<span class="peek-name">${student.name}</span><span class="peek-roll">${student.id}</span>`;
        peekBox.style.display = "flex";
      };
      const clearPeek = () => { peekBox.style.display = "none"; };

      row.onmouseenter = firePeek;
      row.onmouseleave = clearPeek;
      row.ontouchstart = () => { holdTimer = setTimeout(firePeek, 300); };
      row.ontouchend = () => { clearTimeout(holdTimer); setTimeout(clearPeek, 500); };
      row.ontouchmove = () => { clearTimeout(holdTimer); };

      list.appendChild(row);
    });
  },

  updateLiveStatsContext(lec) {
    const p = lec.attendance.filter(a => a.status === 'present').length;
    const a = lec.attendance.filter(a => a.status === 'absent').length;
    document.getElementById("liveAttendanceStats").innerHTML = `
      <span class="stat-p">PRESENT: ${p}</span>
      <span class="stat-a">ABSENT: ${a}</span>
      <span style="color: var(--secondary)">TOTAL: ${lec.attendance.length}</span>
    `;
  },

  renderRoster() {
    const container = document.getElementById("studentRosterView");
    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    container.innerHTML = sub.students.length === 0 ? "<p class='card'>No students registered onto subject matrices.</p>" : "";
    
    sub.students.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `
        <strong>${s.short}</strong>
        <span>${s.id}</span>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.name}</span>
        <button class="btn-danger" onclick="actions.removeStudent(${idx})">Drop</button>
      `;
      container.appendChild(row);
    });
  },

  renderSubjectExportOptions() {
    const target = document.getElementById("subjectExportWrapper");
    target.className = "action-box-wrapper";
    target.innerHTML = `<button class="btn btn-secondary btn-large-action" onclick="actions.exportSubjectCSV()">Download Subject Matrix CSV</button>`;
  },

  renderRosterManagementOptions() {
    const target = document.getElementById("subjectExportWrapper");
    target.className = "action-box-wrapper";
    target.innerHTML = `<button class="btn btn-primary btn-large-action" onclick="ui.openRosterModal()">Import / Edit Roster List</button>`;
  },

  renderLectureExportOptions() {
    const target = document.getElementById("lectureExportWrapper");
    target.className = "action-box-wrapper";
    target.innerHTML = `<button class="btn btn-secondary btn-large-action" onclick="actions.exportLectureCSV()">Download Single Day CSV</button>`;
  },

  openRosterModal() {
    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    document.getElementById("modalRosterTitle").innerText = `${sub.name}: Manage Roster`;
    document.getElementById("rosterModal").style.display = "flex";
  },
  
  closeRosterModal() {
    document.getElementById("rosterModal").style.display = "none";
    document.getElementById("rawRosterInput").value = "";
    document.getElementById("csvFileInput").value = "";
    document.getElementById("newStudentId").value = "";
    document.getElementById("newStudentName").value = "";
  }
};

// --- Execution Transaction Engine ---
const actions = {
  // --- Sorting Toggles Engine ---
  toggleSemesterSort() {
    configs.sortSemestersChronological = !configs.sortSemestersChronological;
    saveConfigs();
    ui.showSemesterView();
  },

  toggleSubjectSort() {
    configs.sortSubjectsAlphabetical = !configs.sortSubjectsAlphabetical;
    saveConfigs();
    ui.showSubjectView(ui.currentSemIdx);
  },

  // --- Real-Time Drag Slider Calculation Callback Engine ---
  handleThresholdSliderAdjustment(val) {
    const numericVal = parseInt(val);
    configs.targetThreshold = numericVal;
    saveConfigs();

    // Dynamically mirror configuration value edits onto text elements inside UI frames
    const readout = document.getElementById("sliderDisplayReadout");
    const headerTitle = document.getElementById("liveMetricHeaderTitleThreshold");
    if (readout) readout.innerText = `${numericVal}%`;
    if (headerTitle) headerTitle.innerText = `${numericVal}%`;

    // Recalculate and re-render only the internal list frame to dodge total view reloads
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    let flaggedStudents = [];
    
    sub.students.forEach(s => {
      let studentPCount = 0;
      sub.lectures.forEach(l => {
        let rec = l.attendance.find(a => a.id === s.id);
        if (rec && rec.status === 'present') studentPCount++;
      });
      let percentage = Math.round((studentPCount / sub.lectures.length) * 100);
      if (percentage < numericVal) {
        flaggedStudents.push({
          id: s.id, short: s.short, name: s.name, pct: percentage,
          countString: `(${studentPCount}/${sub.lectures.length})`
        });
      }
    });

    let targetCard = document.getElementById("shortAttendanceTriggerCard");
    let innerMetricText = targetCard?.querySelector("div:nth-child(2) span");
    if (innerMetricText) innerMetricText.innerText = `${flaggedStudents.length} Students`;

    let rosterRowsHtml = "";
    if (flaggedStudents.length === 0) {
      rosterRowsHtml = `<div style="padding: 16px 10px; font-size: 0.8rem; color: var(--secondary); text-align: center;">All students clear of the ${numericVal}% baseline! 🎉</div>`;
    } else {
      flaggedStudents.sort((a, b) => a.pct - b.pct);
      flaggedStudents.forEach(fs => {
        rosterRowsHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 4px; border-bottom: 1px solid var(--border); font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <strong style="color: #ef4444; font-size: 1.1rem; min-width: 28px;">${fs.short}</strong>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <div style="font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fs.name}</div>
                <div style="font-size: 0.7rem; color: var(--secondary); font-family: monospace;">${fs.id}</div>
              </div>
            </div>
            <div style="text-align: right; font-weight: 800; color: #ef4444; margin-left: 8px;">
              <span>${fs.pct}%</span>
              <div style="font-size: 0.65rem; color: var(--secondary); font-weight: 600;">${fs.countString}</div>
            </div>
          </div>
        `;
      });
    }
    const zone = document.getElementById("drawerDynamicRosterTargetZone");
    if (zone) zone.innerHTML = rosterRowsHtml;
  },

  // --- Toggle Drawer Display View state ---
  toggleShortAttendanceDrawer() {
    const drawer = document.getElementById("shortAttendanceDrawer");
    const chevron = document.getElementById("drawerChevronIndicator");
    if (!drawer) return;

    if (drawer.style.display === "none") {
      drawer.style.display = "block";
      if (chevron) chevron.style.transform = "rotate(180deg)";
    } else {
      drawer.style.display = "none";
      if (chevron) chevron.style.transform = "rotate(0deg)";
    }
  },

  // --- Destruction Confirmation Modules ---
  deleteSemester(idx) {
    const semName = db.semesters[idx].name;
    const confirmation = confirm(`CRITICAL WARNING:\nAre you sure you want to delete Semester "${semName}"?\n\nThis will permanently purge all subjects, student rosters, and historical attendance metrics inside it. This action cannot be undone.`);
    if (!confirmation) return;

    db.semesters.splice(idx, 1);
    saveDatabase();
    ui.showSemesterView();
  },

  deleteSubject(idx) {
    const subName = db.semesters[ui.currentSemIdx].subjects[idx].name;
    const confirmation = confirm(`CRITICAL WARNING:\nAre you sure you want to delete Course Subject "${subName}"?\n\nThis will permanently clear its entire student roster register and all stored lecture logs. This action cannot be undone.`);
    if (!confirmation) return;

    db.semesters[ui.currentSemIdx].subjects.splice(idx, 1);
    saveDatabase();
    ui.showSubjectView(ui.currentSemIdx);
  },

  deleteLecture(idx) {
    const lecDate = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx].lectures[idx].date;
    const confirmation = confirm(`WARNING:\nAre you sure you want to permanently delete the attendance record for session: ${lecDate}?\n\nThis structural history will be lost.`);
    if (!confirmation) return;

    db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx].lectures.splice(idx, 1);
    saveDatabase();
    ui.showLectureView(ui.currentSubIdx);
  },

  // --- Roster Mutation Core Logic ---
  addSemester() {
    const title = prompt("Enter Semester Designation (e.g., S26):");
    if (!title) return;
    db.semesters.push({ name: title, subjects: [] });
    saveDatabase();
    ui.showSemesterView();
  },

  addSubject(semIdx) {
    const title = prompt("Enter Subject Name:");
    if (!title) return;
    db.semesters[semIdx].subjects.push({ name: title, students: [], lectures: [] });
    saveDatabase();
    ui.showSubjectView(semIdx);
  },

  addAutomatedLecture() {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    if (sub.students.length === 0) {
      alert("Cannot construct session records without a loaded roster. Click 'Registered Roster' tab to populate.");
      return;
    }

    const now = new Date();
    const computedDate = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const computedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const baseAttendance = sub.students.map(s => ({ id: s.id, short: s.short, name: s.name, status: "present" }));
    sub.lectures.push({ date: computedDate, time: computedTime, attendance: baseAttendance });
    
    saveDatabase();
    ui.showAttendanceView(sub.lectures.length - 1);
  },

  bulkMarkAll(targetStatus) {
    const lec = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx].lectures[ui.currentLecIdx];
    lec.attendance.forEach(student => {
      student.status = targetStatus;
    });
    saveDatabase();
    ui.renderAttendance();
  },

  addIndividualStudent() {
    const idInput = document.getElementById("newStudentId").value.trim();
    const nameInput = document.getElementById("newStudentName").value.trim();
    if (!idInput || !nameInput) return alert("Verify all string values are populated.");
    
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    const extractedShort = idInput.slice(-2);
    
    sub.students.push({ id: idInput, short: extractedShort, name: nameInput });
    sub.lectures.forEach(l => {
      l.attendance.push({ id: idInput, short: extractedShort, name: nameInput, status: "present" });
    });

    saveDatabase();
    ui.renderRoster();
    ui.closeRosterModal();
  },

  removeStudent(idx) {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    const studentName = sub.students[idx].name;
    if (!confirm(`Are you sure you want to drop "${studentName}"?\n\nThis removes them from the roster and all previous class registers.`)) return;
    
    const targetedId = sub.students[idx].id;
    sub.students.splice(idx, 1);
    sub.lectures.forEach(l => {
      l.attendance = l.attendance.filter(a => a.id !== targetedId);
    });

    saveDatabase();
    ui.renderRoster();
  },

  processRawTextImport() {
    const lines = document.getElementById("rawRosterInput").value.split("\n");
    this.parseRosterRows(lines);
  },

  handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = evt.target.result.split(/\r?\n/);
      this.parseRosterRows(lines);
    };
    reader.readAsText(file);
  },

  parseRosterRows(rowArrays) {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    let acceptedRecords = 0;

    rowArrays.forEach(row => {
      if (!row.trim()) return;
      const cells = row.split(",");
      if (cells.length >= 2) {
        const fullId = cells[0].trim().replace(/["']/g, "");
        const fullName = cells[1].trim().replace(/["']/g, "");
        const shortId = fullId.slice(-2);

        if (!sub.students.some(s => s.id === fullId)) {
          sub.students.push({ id: fullId, short: shortId, name: fullName });
          sub.lectures.forEach(l => {
            l.attendance.push({ id: fullId, short: shortId, name: fullName, status: "present" });
          });
          acceptedRecords++;
        }
      }
    });

    if (acceptedRecords > 0) {
      saveDatabase();
      ui.renderRoster();
      ui.closeRosterModal();
      alert(`Successfully merged ${acceptedRecords} rows into the student register context.`);
    } else {
      alert("No distinct new rows could be mapped from input structures.");
    }
  },

  exportLectureCSV() {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    const lec = sub.lectures[ui.currentLecIdx];
    
    let csv = "Roll No,Student Name,Attendance Status\n";
    lec.attendance.forEach(row => {
      csv += `"${row.id}","${row.name}","${row.status.toUpperCase()}"\n`;
    });

    this.triggerDownload(csv, `${sub.name}_Report_${lec.date}.csv`);
  },

  exportSubjectCSV() {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    if (!sub.lectures || sub.lectures.length === 0) return alert("No evaluation metrics exist to generate data maps.");

    let headerLine = "Roll No,Student Name";
    sub.lectures.forEach(l => { headerLine += `,"${l.date}"`; });
    let csv = headerLine + "\n";

    sub.students.forEach(student => {
      let dataLine = `"${student.id}","${student.name}"`;
      sub.lectures.forEach(l => {
        const matchingRecord = l.attendance.find(a => a.id === student.id);
        dataLine += `,"${matchingRecord ? matchingRecord.status.toUpperCase() : 'N/A'}"`;
      });
      csv += dataLine + "\n";
    });

    this.triggerDownload(csv, `${sub.name}_Full_Semester_Matrix.csv`);
  },

  triggerDownload(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.setAttribute("download", filename);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
};

window.onload = () => { ui.showSemesterView(); };
