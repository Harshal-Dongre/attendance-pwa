// js/db.js
const db = {
  semesters: [],

  load() {
    const saved = localStorage.getItem("attendanceDB");
    if (saved) {
      try {
        this.semesters = JSON.parse(saved);
      } catch (e) {
        console.error("Database corruption detected, resetting.", e);
        this.semesters = [];
      }
    }
  },

  save() {
    localStorage.setItem("attendanceDB", JSON.stringify(this.semesters));
  },

  exportCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// Initialize right away
db.load();
