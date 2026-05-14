// js/app.js
const actions = {
  addSemester() {
    const name = prompt("Enter Semester designation (e.g., Spring 2026, W25):");
    if (!name || !name.trim()) return;

    db.semesters.push({ name: name.trim(), subjects: [] });
    db.save();
    ui.renderSemesters();
  },

  addSubject() {
    const name = prompt("Enter Subject name:");
    if (!name || !name.trim()) return;

    const sem = db.semesters[ui.currentSemIdx];
    sem.subjects = sem.subjects || [];
    sem.subjects.push({ name: name.trim(), students: [], lectures: [] });
    
    db.save();
    ui.renderSubjects();
  },

  addLecture() {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    if (!sub.students || sub.students.length === 0) {
      alert("Cannot create a lecture without registered students. Please upload a student roster first.");
      ui.switchSubView('students');
      return;
    }

    const today = new Date();
    const lecture = {
      date: today.toLocaleDateString(),
      time: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attendance: sub.students.map(s => ({
        id: s.id,
        name: s.name,
        short: s.short,
        status: "present"
      }))
    };

    sub.lectures = sub.lectures || [];
    sub.lectures.push(lecture);
    db.save();
    
    // Auto shift view straight into changing attendance for convenience
    ui.showAttendanceView(sub.lectures.length - 1);
  },

  toggleAttendanceStatus(studentIdx) {
    const lec = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx].lectures[ui.currentLecIdx];
    const currentStatus = lec.attendance[studentIdx].status;
    lec.attendance[studentIdx].status = currentStatus === "present" ? "absent" : "present";
    
    db.save();
    ui.renderAttendance();
  },

  uploadStudentCSV() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = e => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        const lines = ev.target.result.replace(/\r/g, "").split("\n");
        const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
        sub.students = sub.students || [];

        lines.forEach((line, index) => {
          if (index === 0 && line.toLowerCase().includes("roll")) return; // Skip headers dynamically
          if (!line.trim()) return;

          const parts = line.split(",").map(cell => cell.trim());
          if (parts.length < 2) return;

          const roll = parts[0];
          const name = parts.slice(1).join(" "); // handles names that contain commas safely

          if (!sub.students.some(s => s.id === roll)) {
            sub.students.push({
              id: roll,
              short: roll.slice(-3),
              name: name
            });
          }
        });

        db.save();
        ui.renderRoster();
      };
      reader.readAsText(file);
    };
    input.click();
  },

  addStudentManual() {
    const roll = prompt("Enter Student Roll ID:");
    const name = prompt("Enter Full Student Name:");
    if (!roll || !name) return;

    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    sub.students = sub.students || [];

    if (sub.students.some(s => s.id === roll.trim())) {
      alert("A student with this ID already exists!");
      return;
    }

    sub.students.push({
      id: roll.trim(),
      short: roll.trim().slice(-3),
      name: name.trim()
    });

    db.save();
    ui.renderRoster();
  },

  // ==========================================
  //          UNIFIED CSV EXPORT SUITE
  // ==========================================

  /**
   * 1. SINGLE LECTURE EXPORT (Vertical list)
   */
  exportLecture(lecIdx) {
    const sub = db.semesters[ui.currentSemIdx].subjects[ui.currentSubIdx];
    const lec = sub.lectures[lecIdx];
    
    let csv = "Short ID,Roll Number,Name,Status\n";
    lec.attendance.forEach(s => {
      csv += `"${s.short}","${s.id}","${s.name}","${s.status.toUpperCase()}"\n`;
    });

    db.exportCSV(csv, `${sub.name}_Lecture_${lec.date.replace(/\//g, "-")}.csv`);
  },

  /**
   * 2. SINGLE SUBJECT EXPORT (Matrix / Pivot Format)
   */
  exportSubject(subIdx) {
    const sub = db.semesters[ui.currentSemIdx].subjects[subIdx];
    
    if (!sub.lectures || sub.lectures.length === 0) {
      alert("No lectures recorded yet for this subject to export.");
      return;
    }

    const lectureHeaders = sub.lectures.map(lec => `${lec.date} (${lec.time})`);
    let csv = `Subject,Roll Number,Short ID,Student Name,${lectureHeaders.join(",")}\n`;

    let studentRoster = sub.students || [];
    if (studentRoster.length === 0) {
      const uniqueStudents = new Map();
      sub.lectures.forEach(lec => {
        lec.attendance.forEach(att => uniqueStudents.set(att.id, att));
      });
      studentRoster = Array.from(uniqueStudents.values());
    }

    studentRoster.forEach(student => {
      let row = `"${sub.name}","${student.id}","${student.short}","${student.name}"`;

      sub.lectures.forEach(lec => {
        const record = lec.attendance.find(att => att.id === student.id);
        const status = record ? (record.status === "present" ? "P" : "A") : "N/A";
        row += `,${status}`;
      });

      csv += row + "\n";
    });

    db.exportCSV(csv, `${sub.name}_Matrix_Attendance.csv`);
  },

  /**
   * 3. FULL SEMESTER EXPORT (Matrix / Pivot Format)
   */
  exportSemester(semIdx) {
    const sem = db.semesters[semIdx];
    if (!sem.subjects || sem.subjects.length === 0) {
      alert("No subjects found in this semester.");
      return;
    }

    const allLectureKeys = new Set();
    sem.subjects.forEach(sub => {
      sub.lectures?.forEach(lec => {
        allLectureKeys.add(`${lec.date} (${lec.time})`);
      });
    });

    const globalLectureHeaders = Array.from(allLectureKeys).sort();

    if (globalLectureHeaders.length === 0) {
      alert("No lecture data recorded anywhere in this semester yet.");
      return;
    }

    let csv = `Subject,Roll Number,Short ID,Student Name,${globalLectureHeaders.join(",")}\n`;

    sem.subjects.forEach(sub => {
      let studentRoster = sub.students || [];
      
      if (studentRoster.length === 0 && sub.lectures) {
        const uniqueStudents = new Map();
        sub.lectures.forEach(lec => {
          lec.attendance.forEach(att => uniqueStudents.set(att.id, att));
        });
        studentRoster = Array.from(uniqueStudents.values());
      }

      studentRoster.forEach(student => {
        let row = `"${sub.name}","${student.id}","${student.short}","${student.name}"`;

        globalLectureHeaders.forEach(headerStr => {
          let status = "-"; 

          const matchingLecture = sub.lectures?.find(lec => `${lec.date} (${lec.time})` === headerStr);
          if (matchingLecture) {
            const record = matchingLecture.attendance.find(att => att.id === student.id);
            status = record ? (record.status === "present" ? "P" : "A") : "N/A";
          }

          row += `,${status}`;
        });

        csv += row + "\n";
      });
    });

    db.exportCSV(csv, `${sem.name}_Semester_Matrix.csv`);
  }
}; // <-- Properly closes the main actions object

// Initial App Entry Trigger
window.onload = () => {
  ui.showSemesterView();
};
