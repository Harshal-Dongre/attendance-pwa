{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // SAMPLE DATA (replace with CSV import later)\
let students = Array.from(\{ length: 120 \}, (_, i) => (\{\
  roll: 100 + i,\
  name: "Student " + (i + 1),\
  status: "present"\
\}));\
\
const list = document.getElementById("list");\
\
// render UI\
function render() \{\
  list.innerHTML = "";\
\
  students.forEach((s, index) => \{\
    const li = document.createElement("li");\
\
    li.className = s.status;\
\
    li.innerHTML = `\
      <span>$\{s.roll\} $\{s.name\}</span>\
      <span>$\{s.status === "present" ? "\uc0\u55357 \u57314 " : "\u55357 \u56628 "\}</span>\
    `;\
\
    li.onclick = () => \{\
      s.status = s.status === "present" ? "absent" : "present";\
      save();\
      render();\
    \};\
\
    list.appendChild(li);\
  \});\
\}\
\
// save locally\
function save() \{\
  localStorage.setItem("attendance", JSON.stringify(students));\
\}\
\
// load\
function load() \{\
  const data = localStorage.getItem("attendance");\
  if (data) students = JSON.parse(data);\
\}\
\
// export CSV\
document.getElementById("exportBtn").onclick = () => \{\
  let csv = "roll,name,status\\n";\
\
  students.forEach(s => \{\
    csv += `$\{s.roll\},$\{s.name\},$\{s.status\}\\n`;\
  \});\
\
  const blob = new Blob([csv], \{ type: "text/csv" \});\
  const url = URL.createObjectURL(blob);\
\
  const a = document.createElement("a");\
  a.href = url;\
  a.download = "attendance.csv";\
  a.click();\
\
  URL.revokeObjectURL(url);\
\};\
\
// init\
load();\
render();}


if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}