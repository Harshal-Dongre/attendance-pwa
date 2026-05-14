// js/ui.js
const ui = {
  currentSemIdx: null,
  currentSubIdx: null,
  currentLecIdx: null,
  activeSubView: 'subjects', // 'subjects', 'lectures', 'students', 'attendance'

  showSemesterView() {
    this.currentSemIdx = null;
    this.currentSubIdx = null;
    this.currentLecIdx = null;
    
    document.getElementById("appTitle").innerText = "Semesters";
    document.getElementById("semesterView").style.display = "block";
    document.getElementById("detailView").style.display = "none";
    document.getElementById("subjectTabs").style.display = "none";
    
    this.renderSemesters();
  },

  showSubjectView(semIdx) {
    this.currentSemIdx = semIdx;
    this.currentSubIdx = null;
    this.currentLecIdx = null;
    this.activeSubView = 'subjects';

    const sem = db.semesters[semIdx];
    document.getElementById("appTitle").innerText = sem.name;
    document.getElementById("semesterView").style.display = "none";
    document.getElementById("detailView").style.display = "block";
    document.getElementById("subjectTabs").style.display = "none";

    this.switchSubView('subjects');
  },

  showLectureView(subIdx) {
    this.currentSubIdx = subIdx;
    this.currentLecIdx = null;
    this.activeSubView = 'lectures';

    const sem = db.semesters[this.currentSemIdx];
    const sub = sem.subjects[subIdx];
    document.getElementById("appTitle").innerText = `${sem.name} → ${sub.name}`;
    document.getElementById("subjectTabs").style.display = "flex";

    this.switchSubView('lectures');
  },

  showAttendanceView(lecIdx) {
    this.currentLecIdx = lecIdx;
    this.activeSubView = 'attendance';
    
    const sem = db.semesters[this.currentSemIdx];
    const sub = sem.subjects[this.currentSubIdx];
    const lec = sub.lectures[lecIdx];
    
    document.getElementById("appTitle").innerText = `${sub.name} Attendance (${lec.date})`;
    document.getElementById("subjectTabs").style.display = "none";
    
    this.switchSubView('attendance');
  },

  switchSubView(viewType) {
    // Hide all sub views
    ['subjectListView', 'lectureListView', 'attendanceView', 'studentRosterView'].forEach(id => {
      document.getElementById(id).style.display = "none";
    });

    // Reset Tabs look
    document.getElementById("tabLectures").classList.remove("active");
    document.getElementById("tabStudents").classList.remove("active");

    if (viewType === 'subjects') {
      document.getElementById("subjectListView").style.display = "block";
      this.renderSubjects();
    } else if (viewType === 'lectures') {
      document.getElementById("tabLectures").classList.add("active");
      document.getElementById("lectureListView").style.display = "block";
      this.renderLectures();
    } else if (viewType === 'students') {
      document.getElementById("tabStudents").classList.add("active");
      document.getElementById("studentRosterView").style.display = "block";
      this.renderRoster();
    } else if (viewType === 'attendance') {
      document.getElementById("attendanceView").style.display = "block";
      this.renderAttendance();
    }
  },

  renderSemesters() {
    const list = document.getElementById("semesterList");
    list.innerHTML = db.semesters.length === 0 ? "<p>No semesters created yet.</p>" : "";

    db.semesters.forEach((sem, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${sem.name}</h3>
        <p>${sem.subjects ? sem.subjects.length : 0} Subjects</p>
        <div class="card-actions">
          <button class="btn btn-action" onclick="ui.showSubjectView(${i})">Open</button>
          <button class="btn btn-action btn-csv" onclick="actions.exportSemester(${i})">Export CSV</button>
        </div>
      `;
      list.appendChild(card);
    });
  },

  renderSubjects() {
    const list = document.getElementById("subjectList");
    const sem = db.semesters[this.currentSemIdx];
    list.innerHTML = (!sem.subjects || sem.subjects.length === 0) ? "<p>No subjects in this semester.</p>" : "";

    sem.subjects?.forEach((sub, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${sub.name}</h3>
        <p>${sub.students ? sub.students.length : 0} Registered Students</p>
        <p>${sub.lectures ? sub.lectures.length : 0} Lectures Run</p>
        <div class="card-actions">
          <button class="btn btn-action" onclick="ui.showLectureView(${i})">Manage</button>
        </div>
      `;
      list.appendChild(card);
    });
  },

  renderLectures() {
    const list = document.getElementById("lectureList");
    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    list.innerHTML = (!sub.lectures || sub.lectures.length === 0) ? "<p class='placeholder-text'>No lectures tracked yet.</p>" : "";

    sub.lectures?.forEach((lec, i) => {
      const item = document.createElement("div");
      item.className = "lecture-item";
      item.innerHTML = `
        <div>
          <strong>${lec.date}</strong> <span class="time-stamp">${lec.time}</span>
        </div>
        <button class="btn btn-action" onclick="ui.showAttendanceView(${i})">View/Edit Attendance</button>
      `;
      list.appendChild(item);
    });

    // Handle export visibility logic dynamically
    const expBtn = document.getElementById("exportSubjectBtn");
    if(sub.lectures && sub.lectures.length > 0) {
      expBtn.style.display = "inline-block";
      expBtn.onclick = () => actions.exportSubject(this.currentSubIdx);
    } else {
      expBtn.style.display = "none";
    }
  },

  renderAttendance() {
    const list = document.getElementById("attendanceList");
    const lec = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx].lectures[this.currentLecIdx];
    list.innerHTML = "";

    lec.attendance.forEach((student, i) => {
      const row = document.createElement("div");
      row.className = `attendance-row ${student.status}`;
      
      row.innerHTML = `
        <div class="short-id-trigger">${student.short}</div>
        <div class="student-peek-panel" id="peek-${i}">
          <strong>${student.name}</strong><br/>
          <span>ID: ${student.id}</span>
        </div>
      `;

      // --- Interaction Handler 1: Tap to toggle attendance ---
      row.onclick = (e) => {
        actions.toggleAttendanceStatus(i);
      };

      // --- Interaction Handler 2: Desktop Mouse Hover Peek ---
      const peekPanel = row.querySelector(`#peek-${i}`);
      row.onmouseenter = () => { peekPanel.style.display = 'block'; };
      row.onmouseleave = () => { peekPanel.style.display = 'none'; };

      // --- Interaction Handler 3: Mobile Long-Press Hold Peek ---
      let holdTimer;
      row.ontouchstart = (e) => {
        holdTimer = setTimeout(() => {
          peekPanel.style.display = 'block';
          // Fire a slight vibration if the device supports it
          if (navigator.vibrate) navigator.vibrate(40); 
        }, 500); // 500ms holding window triggers details display
      };

      row.ontouchend = () => {
        clearTimeout(holdTimer);
        // Add a slight delay before closing so they can actually read it
        setTimeout(() => { peekPanel.style.display = 'none'; }, 800);
      };
      
      row.ontouchmove = () => {
        clearTimeout(holdTimer);
      };

      list.appendChild(row);
    });

    document.getElementById("exportLectureBtn").onclick = () => actions.exportLecture(this.currentLecIdx);
  },

  renderRoster() {
    const container = document.getElementById("studentRosterList");
    const sub = db.semesters[this.currentSemIdx].subjects[this.currentSubIdx];
    container.innerHTML = (!sub.students || sub.students.length === 0) ? "<p class='placeholder-text'>Roster empty. Upload a CSV or add students manually.</p>" : "";

    sub.students?.forEach(s => {
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `<span><strong>${s.short}</strong></span> <span>${s.id}</span> <span>${s.name}</span>`;
      container.appendChild(row);
    });
  }
};
