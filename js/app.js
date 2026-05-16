// --- Database State Engine (Loads from localStorage or defaults) ---
let db = JSON.parse(localStorage.getItem("attendance_db")) || {
  semesters: [
    {
      name: "S26",
      subjects: [
        {
          name: "Thermo",
          students: [
            { id: "2026CHE001", short: "01", name: "Amit Sharma" },
            { id: "2026CHE002", short: "02", name: "Priya Patel" },
            { id: "2026CHE003", short: "03", name: "Rohan Verma" }
          ],
          lectures: [
            {
              date: "12-May",
              time: "10:00 AM",
              attendance: [
                { id: "2026CHE001", short: "01", name: "Amit Sharma", status: "present" },
                { id: "2026CHE002", short: "02", name: "Priya Patel", status: "absent" },
                { id: "2026CHE003", short: "03", name: "Rohan Verma", status: "present" }
              ]
            }
          ]
        }
      ]
    }
  ]
};

function saveDatabase() {
  localStorage.setItem("attendance_db", JSON.stringify(db));
}

// --- System Presentation Controller Routing ---
const ui = {
  currentSemIdx: null,
  currentSubIdx: null,
  currentLecIdx: null,
  activeSubView: 'lectures',

  clearViewContext() {
    document.querySelectorAll(".view-panel").forEach(p => p.style.display = "none");
    document.getElementById("dynamicActionsBar").innerHTML = "";
    document.getElementById("subjectExportWrapper").innerHTML = "";
    document.getElementById("lectureExportWrapper").innerHTML = "";
  },

  showSemesterView() {
    this.clearViewContext();
    this.currentSemIdx = null;
    this.currentSubIdx = null;
    this.currentLecIdx = null;

    document.getElementById("appTitle").innerText = "Semesters";
    
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

    const actionsBar = document.getElementById("dynamicActionsBar");
    actionsBar.innerHTML = `
      <button class="btn btn-secondary" onclick="ui.showSemesterView()">← Back to Semesters</button>
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
    document.getElementById("appTitle").innerText = `Subject: ${sub.name}`;

    const actionsBar = document.getElementById("dynamicActionsBar");
    actionsBar.innerHTML = `
      <button class="btn btn-secondary" onclick="ui.showSubjectView(${this.currentSemIdx})">← Back to Subjects</button>
      <button class="btn btn-primary" onclick="actions.addAutomatedLecture()">+ Take Attendance</button>
    `;

    document.getElementById("lectureView").style.display = "block";
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
      <button class="btn btn-secondary" onclick="ui.showLectureView(${this.currentSubIdx})">← Back to Lectures</button>
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

  // --- Render Core Execution ---
  renderSemesters() {
    const list = document.getElementById("semesterList");
    list.innerHTML = "";
    db.semesters.forEach((sem, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${sem.name}</h3>
        <p>${sem.subjects?.length || 0} Subjects Registered</p>
        <button class="btn btn-secondary" style="width: 100%; min-height: 44px;" onclick="ui.showSubjectView(${i})">Open Semester</button>
      `;
      list.appendChild(card);
    });
  },

  renderSubjects() {
    const list = document.getElementById("subjectList");
    list.innerHTML = db.semesters[this.currentSemIdx].subjects.length === 0 ? "<p class='card'>No subjects listed yet.</p>" : "";
    db.semesters[this.currentSemIdx].subjects.forEach((sub, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${sub.name}</h3>
        <p>${sub.students?.length || 0} Registered Students | ${sub.lectures?.length || 0} Sessions Run</p>
        <button class="btn btn-secondary" style="width: 100%; min-height: 44px;" onclick="ui.showLectureView(${i})">Manage Attendance</button>
      `;
      list.appendChild(card);
    });
  },

  renderLectures() {
    const list = document.getElementById("lectureListView");
    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    list.innerHTML = sub.lectures.length === 0 ? "<p class='card'>No historical records found for this course.</p>" : "";
    
    sub.lectures.forEach((lec, i) => {
      let pCount = lec.attendance.filter(a => a.status === 'present').length;
      let aCount = lec.attendance.filter(a => a.status === 'absent').length;

      const item = document.createElement("div");
      item.className = "lecture-item";
      item.innerHTML = `
        <div>
          <strong>${lec.date}</strong> <span style="color: var(--secondary); margin-left:8px;">${lec.time}</span>
          <div style="font-size:0.8rem; margin-top:4px; font-weight:600;">
            <span style="color: var(--present-text);">P: ${pCount}</span> | 
            <span style="color: var(--absent-text);">A: ${aCount}</span>
          </div>
        </div>
        <button class="btn btn-secondary" onclick="ui.showAttendanceView(${i})">Edit</button>
      `;
      list.appendChild(item);
    });
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
        if (navigator.vibrate) navigator.vibrate(30);
      };
      const clearPeek = () => { peekBox.style.display = "none"; };

      row.onmouseenter = firePeek;
      row.onmouseleave = clearPeek;
      row.ontouchstart = () => { holdTimer = setTimeout(firePeek, 350); };
      row.ontouchend = () => { clearTimeout(holdTimer); setTimeout(clearPeek, 600); };
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
    container.innerHTML = sub.students.length === 0 ? "<p class='card'>No students loaded onto the subject roster matrix yet.</p>" : "";
    
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
    target.innerHTML = `<button class="btn btn-primary btn-large-action" onclick="ui.openRosterModal()">Modify / Import Roster Student List</button>`;
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
  addSemester() {
    const title = prompt("Enter Semester Designation:");
    if (!title) return;
    db.semesters.push({ name: title, subjects: [] });
    saveDatabase();
    ui.renderSemesters();
  },

  addSubject(semIdx) {
    const title = prompt("Enter Subject Nomenclature:");
    if (!title) return;
    db.semesters[semIdx].subjects.push({ name: title, students: [], lectures: [] });
    saveDatabase();
    ui.renderSubjects();
  },

  // --- AUTOMATED CALCULATION TARGET ---
  addAutomatedLecture() {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    if (sub.students.length === 0) {
      alert("Cannot construct session logs without loaded roster data arrays. Open 'Registered Students' to populate.");
      return;
    }

    // Capture automated real-time local environment instances
    const now = new Date();
    const computedDate = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }); // "16-May"
    const computedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });   // "05:15 PM"

    const baseAttendance = sub.students.map(s => ({ id: s.id, short: s.short, name: s.name, status: "present" }));
    sub.lectures.push({ date: computedDate, time: computedTime, attendance: baseAttendance });
    
    saveDatabase();
    ui.showAttendanceView(sub.lectures.length - 1);
  },

  // --- ROSTER MANAGEMENT TRANSACTION LOGIC ---
  addIndividualStudent() {
    const idInput = document.getElementById("newStudentId").value.trim();
    const nameInput = document.getElementById("newStudentName").value.trim();
    
    if (!idInput || !nameInput) return alert("Verify all registration string cells are populated.");
    
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    const extractedShort = idInput.slice(-2); // Fallback indexing logic checks trailing decimals
    
    sub.students.push({ id: idInput, short: extractedShort, name: nameInput });
    
    // Auto-update historical live logs if structure changes mid-run
    sub.lectures.forEach(l => {
      l.attendance.push({ id: idInput, short: extractedShort, name: nameInput, status: "present" });
    });

    saveDatabase();
    ui.renderRoster();
    ui.closeRosterModal();
  },

  removeStudent(idx) {
    if (!confirm("Are you certain you want to drop this record? This action will remove them from all historical records in this subject.")) return;
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
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

        // Verification check preventing string index duplication collisions
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
      alert(`Successfully merged ${acceptedRecords} structured rows into tracking array layers.`);
    } else {
      alert("No distinct new structured rows could be processed from the input data.");
    }
  },

  // --- Dynamic Core File System Exports ---
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
    if (!sub.lectures || sub.lectures.length === 0) return alert("No historical data arrays accessible.");

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

    this.triggerDownload(csv, `${sub.name}_Semester_Matrix.csv`);
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
