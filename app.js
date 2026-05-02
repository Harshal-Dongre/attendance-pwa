// SAMPLE DATA (replace with CSV import later)
let students = Array.from({ length: 120 }, (_, i) => ({
  roll: 100 + i,
  name: "Student " + (i + 1),
  status: "present"
}));

const list = document.getElementById("list");

// render UI
function render() {
  list.innerHTML = "";

  students.forEach((s, index) => {
    const li = document.createElement("li");

    li.className = s.status;

    li.innerHTML = `
      <span>${s.roll} ${s.name}</span>
      <span>${s.status === "present" ? "✅" : "❌"}</span>
    `;

    li.onclick = () => {
      s.status = s.status === "present" ? "absent" : "present";
      save();
      render();
    };

    list.appendChild(li);
  });
}

// save locally
function save() {
  localStorage.setItem("attendance", JSON.stringify(students));
}

// load
function load() {
  const data = localStorage.getItem("attendance");
  if (data) students = JSON.parse(data);
}

// export CSV
document.getElementById("exportBtn").onclick = () => {
  let csv = "roll,name,status\n";

  students.forEach(s => {
    csv += `${s.roll},${s.name},${s.status}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();

  URL.revokeObjectURL(url);
};

// init
load();
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
