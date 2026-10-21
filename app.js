import { generateSchedule, evaluate, toMinutes } from "./scheduler.js";

const STORAGE_KEY = "sinavplan-v1";
const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const ALL_TIMES = ["09:00", "11:00", "13:00", "15:00"];
const demoCourses = [
  { id: "c1", name: "Veri Yapıları", group: "Bilgisayar Müh. 2", teacher: "Dr. Ayşe Demir", students: 68, duration: 90 },
  { id: "c2", name: "Ayrık Matematik", group: "Bilgisayar Müh. 2", teacher: "Dr. Mehmet Kaya", students: 72, duration: 90 },
  { id: "c3", name: "İşletim Sistemleri", group: "Bilgisayar Müh. 3", teacher: "Dr. Selin Yılmaz", students: 56, duration: 90 },
  { id: "c4", name: "Veritabanı Sistemleri", group: "Bilgisayar Müh. 3", teacher: "Dr. Ayşe Demir", students: 61, duration: 90 },
  { id: "c5", name: "Algoritma Analizi", group: "Bilgisayar Müh. 2", teacher: "Dr. Murat Şahin", students: 74, duration: 120 },
  { id: "c6", name: "Yazılım Mühendisliği", group: "Bilgisayar Müh. 3", teacher: "Dr. Mehmet Kaya", students: 48, duration: 90 },
  { id: "c7", name: "Elektrik Devreleri", group: "Elektrik-Elektronik 2", teacher: "Dr. Elif Arslan", students: 86, duration: 120 },
  { id: "c8", name: "Sayısal Elektronik", group: "Elektrik-Elektronik 2", teacher: "Dr. Kemal Aksoy", students: 66, duration: 90 },
  { id: "c9", name: "Mukavemet", group: "Makine Müh. 2", teacher: "Dr. Burak Çelik", students: 78, duration: 90 },
  { id: "c10", name: "Termodinamik", group: "Makine Müh. 2", teacher: "Dr. Derya Öztürk", students: 84, duration: 120 },
  { id: "c11", name: "Web Programlama", group: "Bilgisayar Müh. 3", teacher: "Dr. Selin Yılmaz", students: 52, duration: 90 },
  { id: "c12", name: "Olasılık ve İstatistik", group: "Bilgisayar Müh. 2", teacher: "Dr. Murat Şahin", students: 70, duration: 90 },
];
const demoRooms = [
  { id: "r1", name: "A-101", capacity: 100 },
  { id: "r2", name: "A-102", capacity: 80 },
  { id: "r3", name: "B-201", capacity: 70 },
  { id: "r4", name: "B-202", capacity: 60 },
];
const demoTeachers = [...new Set(demoCourses.map(course => course.teacher))].map((name, index) => ({ id: `t${index + 1}`, name }));
const demoAssistants = [
  { id: "a1", name: "Arş. Gör. Deniz Aydın" },
  { id: "a2", name: "Arş. Gör. Ece Yıldız" },
  { id: "a3", name: "Arş. Gör. Can Erdem" },
  { id: "a4", name: "Arş. Gör. Melis Koç" },
];

function isoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function nextMonday() {
  const date = new Date();
  const distance = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + distance);
  return isoLocal(date);
}
function mondayOf(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return nextMonday();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return isoLocal(date);
}
function getDates(start) {
  return DAYS.map((_, index) => {
    const date = new Date(`${start}T12:00:00`);
    date.setDate(date.getDate() + index);
    return isoLocal(date);
  });
}
function dateText(value, options = { day: "numeric", month: "long" }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR", options);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function defaultState() {
  return { courses: demoCourses, teachers: demoTeachers, assistants: demoAssistants, rooms: demoRooms, settings: { weekStart: nextMonday(), days: [0, 1, 2, 3, 4], times: [...ALL_TIMES], population: 80, generations: 250, crossover: 80, mutation: 5 }, result: null, sample: true };
}
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.courses) && Array.isArray(saved.rooms) && saved.settings) {
      saved.settings.days ??= [0, 1, 2, 3, 4];
      if (!Array.isArray(saved.teachers)) saved.teachers = [...new Set(saved.courses.map(course => course.teacher).filter(Boolean))].map((name, index) => ({ id: `m${index}`, name }));
      if (!Array.isArray(saved.assistants)) saved.assistants = demoAssistants;
      if (saved.result?.assignments?.some(gene => !Number.isInteger(gene.assistant))) saved.result = null;
      return saved;
    }
  } catch { /* Start with sample data when storage is unavailable. */ }
  return defaultState();
}
let state = readState();
const $ = selector => document.querySelector(selector);
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* The UI remains usable without storage. */ } };
let toastTimer;
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 3500);
}
function slots() {
  return getDates(state.settings.weekStart).flatMap((date, index) => state.settings.days.includes(index) ? state.settings.times.map(time => ({ date, time })) : []);
}
function invalidate() { state.result = null; save(); render(); }
function assignmentRows() {
  if (!state.result) return [];
  const availableSlots = slots();
  return state.result.assignments.map((gene, index) => ({ exam: state.courses[index], room: state.rooms[gene.room], assistant: state.assistants[gene.assistant], slot: availableSlots[gene.slot], index }))
    .filter(row => row.exam && row.room && row.assistant && row.slot)
    .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.time.localeCompare(b.slot.time) || a.exam.name.localeCompare(b.exam.name, "tr"));
}
function setView(view) {
  document.querySelectorAll(".view").forEach(node => node.classList.toggle("active", node.id === view));
  document.querySelectorAll(".nav-item").forEach(node => node.classList.toggle("active", node.dataset.view === view));
  const titles = { overview: "Genel Bakış", courses: "Dersler", staff: "Hocalar ve Asistanlar", rooms: "Derslikler", calendar: "Sınav Takvimi", settings: "Planlama Ayarları" };
  $("#breadcrumbCurrent").textContent = titles[view];
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderStats() {
  const dates = getDates(state.settings.weekStart);
  $("#termLabel").textContent = state.sample ? "Örnek veriler · Sınav haftası" : "Mühendislik Fakültesi · Sınav haftası";
  $("#clearSample").classList.toggle("hidden", !state.sample);
  $("#dateRangeLabel").textContent = `${dateText(dates[0])} – ${dateText(dates[4], { day: "numeric", month: "long", year: "numeric" })}`;
  $("#statCourses").textContent = state.courses.length;
  $("#navCourseCount").textContent = state.courses.length;
  $("#statTeachers").textContent = state.teachers.length;
  $("#statAssistants").textContent = state.assistants.length;
  $("#statConflicts").textContent = state.result ? state.result.fitness.hard : "—";
  $("#statConflictNote").textContent = state.result ? "Son plan" : "Henüz oluşturulmadı";
  $("#courseHeadingCount").textContent = state.courses.length;
}
function renderWeek() {
  const dates = getDates(state.settings.weekStart);
  const rows = assignmentRows();
  $("#weekPreview").innerHTML = `<div class="mini-week">${dates.map((date, index) => {
    const exams = rows.filter(row => row.slot.date === date);
    return `<div class="mini-day"><div class="mini-day-head">${DAYS[index]}<strong>${dateText(date, { day: "numeric" })}</strong></div>${exams.length ? exams.map(row => `<div class="mini-exam"><time>${escapeHtml(row.slot.time)}</time><strong>${escapeHtml(row.exam.name)}</strong><span>${escapeHtml(row.room.name)}</span></div>`).join("") : `<div class="mini-empty">Sınav yok</div>`}</div>`;
  }).join("")}</div>`;
  const result = state.result;
  const statusClass = !result ? "neutral" : result.fitness.hard ? "warn" : "";
  const title = !result ? "Henüz program yok" : result.fitness.hard ? "İhlaller incelenmeli" : "Zorunlu çakışma yok";
  const sub = !result ? "Program oluşturduğunuzda sonuç burada görünür." : result.fitness.hard ? "Gün, saat veya personel havuzunu genişletip yeniden deneyin." : "Grup, hoca, asistan, derslik ve kapasite kontrol edildi.";
  $("#healthContent").innerHTML = `<div class="health-body"><div class="health-status ${statusClass}"><b>${!result ? "○" : result.fitness.hard ? "!" : "✓"}</b><div><strong>${title}</strong><small>${sub}</small></div></div><div class="health-line"><span>Grup çakışması</span><b>${result?.fitness.details.group ?? "—"}</b></div><div class="health-line"><span>Hoca çakışması</span><b>${result?.fitness.details.teacher ?? "—"}</b></div><div class="health-line"><span>Asistan çakışması</span><b>${result?.fitness.details.assistant ?? "—"}</b></div><div class="health-line"><span>Derslik çakışması</span><b>${result?.fitness.details.room ?? "—"}</b></div><div class="health-line"><span>Kapasite aşımı</span><b>${result?.fitness.details.capacity ?? "—"}</b></div></div>`;
}
function renderCourses() {
  $("#courseTeacherSelect").innerHTML = `<option value="">Hoca seçin</option>${state.teachers.map(teacher => `<option value="${escapeHtml(teacher.name)}">${escapeHtml(teacher.name)}</option>`).join("")}`;
  $("#courseRows").innerHTML = state.courses.length ? state.courses.map(course => `<tr><td><div class="course-cell"><span class="course-code">${escapeHtml(course.name.slice(0, 2).toLocaleUpperCase("tr-TR"))}</span><span class="cell-main">${escapeHtml(course.name)}</span></div></td><td>${escapeHtml(course.group)}</td><td>${escapeHtml(course.teacher)}</td><td>${course.students}</td><td><span class="tag">${course.duration} dk</span></td><td><button class="icon-button" data-delete-course="${escapeHtml(course.id)}" aria-label="${escapeHtml(course.name)} dersini sil" title="Dersi sil">×</button></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>Henüz ders yok</strong>Planlama için bir ders ekleyin.</div></td></tr>`;
}
function renderStaff() {
  $("#teacherCount").textContent = state.teachers.length;
  $("#assistantCount").textContent = state.assistants.length;
  $("#teacherList").innerHTML = state.teachers.length ? state.teachers.map(person => `<div class="staff-row"><span class="staff-avatar">${escapeHtml(person.name.slice(0, 1))}</span><span>${escapeHtml(person.name)}</span><button class="icon-button" data-delete-teacher="${escapeHtml(person.id)}" aria-label="${escapeHtml(person.name)} hocasını sil" title="Hocayı sil">×</button></div>`).join("") : `<div class="empty-state">Henüz hoca eklenmedi.</div>`;
  $("#assistantList").innerHTML = state.assistants.length ? state.assistants.map(person => `<div class="staff-row"><span class="staff-avatar assistant-avatar">${escapeHtml(person.name.slice(0, 1))}</span><span>${escapeHtml(person.name)}</span><button class="icon-button" data-delete-assistant="${escapeHtml(person.id)}" aria-label="${escapeHtml(person.name)} asistanını sil" title="Asistanı sil">×</button></div>`).join("") : `<div class="empty-state">Henüz asistan eklenmedi.</div>`;
}
function renderRooms() {
  $("#roomCards").innerHTML = state.rooms.length ? state.rooms.map(room => `<div class="panel room-card"><div class="room-card-top"><div class="room-icon">▧</div><button class="icon-button" data-delete-room="${escapeHtml(room.id)}" aria-label="${escapeHtml(room.name)} dersliğini sil" title="Dersliği sil">×</button></div><h2>${escapeHtml(room.name)}</h2><p>Mühendislik Fakültesi dersliği</p><div class="room-capacity"><span>Sınav kapasitesi</span><strong>${room.capacity} kişi</strong></div></div>`).join("") : `<div class="panel empty-state"><strong>Henüz derslik yok</strong>Takvim için bir derslik ekleyin.</div>`;
}
function renderCalendar() {
  const dates = getDates(state.settings.weekStart);
  const rows = assignmentRows();
  $("#calendarSubtitle").textContent = `${dateText(dates[0])} – ${dateText(dates[4], { day: "numeric", month: "long", year: "numeric" })} · ${rows.length} sınav`;
  const result = state.result;
  const banner = $("#resultBanner");
  banner.className = `result-banner ${!result ? "neutral" : result.fitness.hard ? "warn" : ""}`;
  banner.innerHTML = !result
    ? `<div><strong>Henüz sınav programı oluşturulmadı</strong>Dersleri, hocaları, asistanları ve derslikleri girdikten sonra “Program Oluştur” düğmesine basın.</div>`
    : `<div><strong>${result.fitness.hard ? `${result.fitness.hard} zorunlu ihlal bulundu` : "Zorunlu çakışma bulunmadı"}</strong>${result.fitness.hard ? "Bu veri ve zaman aralıklarıyla bulunan en iyi sonucu gözden geçirin." : "Grup, hoca, asistan, derslik ve kapasite kısıtları sağlandı."}</div><span>${result.generations} nesil · ${result.durationMs} ms</span>`;
  const times = state.settings.times;
  $("#calendarGrid").innerHTML = `<div class="full-calendar"><div class="calendar-corner"></div>${dates.map((date, index) => `<div class="calendar-head">${DAYS[index]}<b>${dateText(date, { day: "numeric" })}</b></div>`).join("")}${times.map(time => `<div class="time-label">${time}</div>${dates.map(date => `<div class="calendar-cell">${rows.filter(row => row.slot.date === date && row.slot.time === time).map(row => `<div class="calendar-exam"><strong>${escapeHtml(row.exam.name)}</strong><span>${escapeHtml(row.room.name)} · ${escapeHtml(row.assistant.name)}</span><small>${time}–${endTime(time, row.exam.duration)}</small></div>`).join("")}</div>`).join("")}`).join("")}</div>`;
  $("#scheduleRows").innerHTML = rows.length ? rows.map(row => `<tr><td><span class="cell-main">${DAYS[dates.indexOf(row.slot.date)]}</span><span class="cell-sub">${dateText(row.slot.date)} · ${row.slot.time}–${endTime(row.slot.time, row.exam.duration)}</span></td><td class="cell-main">${escapeHtml(row.exam.name)}<span class="cell-sub">${escapeHtml(row.exam.group)}</span></td><td>${escapeHtml(row.exam.teacher)}</td><td>${escapeHtml(row.assistant.name)}</td><td>${escapeHtml(row.room.name)}</td><td><span class="tag ${result.fitness.hard ? "bad" : "good"}">${result.fitness.hard ? "Kontrol et" : "Planlandı"}</span></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>Takvim boş</strong>Bir program oluşturduğunuzda sınavlar burada listelenir.</div></td></tr>`;
  $("#exportCsv").disabled = !rows.length;
}
function endTime(start, duration) {
  const total = toMinutes(start) + duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function renderSettings() {
  const settings = state.settings;
  $("#weekStart").value = settings.weekStart;
  $("#population").value = settings.population;
  $("#generations").value = settings.generations;
  $("#crossover").value = settings.crossover;
  $("#mutation").value = settings.mutation;
  $("#slotOptions").innerHTML = ALL_TIMES.map(time => `<button type="button" class="slot-option ${settings.times.includes(time) ? "selected" : ""}" data-time="${time}" aria-pressed="${settings.times.includes(time)}">${time}</button>`).join("");
  $("#dayOptions").innerHTML = DAYS.map((day, index) => `<button type="button" class="slot-option ${settings.days.includes(index) ? "selected" : ""}" data-day="${index}" aria-pressed="${settings.days.includes(index)}">${day}</button>`).join("");
}
function render() { renderStats(); renderWeek(); renderCourses(); renderStaff(); renderRooms(); renderCalendar(); renderSettings(); }
function generate() {
  try {
    const availableSlots = slots();
    if (state.courses.some(course => !state.teachers.some(teacher => teacher.name === course.teacher))) throw new Error("Derslerin hoca kayıtlarını tamamlayın.");
    const result = generateSchedule(state.courses, state.rooms, availableSlots, state.assistants, state.settings);
    state.result = result;
    save(); render(); setView("calendar");
    toast(result.fitness.hard ? "En iyi aday oluşturuldu; zorunlu ihlalleri inceleyin." : "Çakışmasız sınav takvimi oluşturuldu.");
  } catch (error) { toast(error.message); }
}
function exportCsv() {
  const rows = assignmentRows();
  if (!rows.length) return;
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const content = [["Tarih", "Gün", "Başlangıç", "Bitiş", "Ders", "Çakışma grubu", "Hoca", "Gözetmen asistan", "Derslik", "Kişi sayısı"], ...rows.map(row => [row.slot.date, DAYS[getDates(state.settings.weekStart).indexOf(row.slot.date)], row.slot.time, endTime(row.slot.time, row.exam.duration), row.exam.name, row.exam.group, row.exam.teacher, row.assistant.name, row.room.name, row.exam.students])].map(line => line.map(quote).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `sinav-takvimi-${state.settings.weekStart}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) setView(viewButton.dataset.view);
  if (event.target.closest('[data-action="generate"]')) generate();
  const courseButton = event.target.closest("[data-delete-course]");
  if (courseButton) { state.courses = state.courses.filter(course => course.id !== courseButton.dataset.deleteCourse); state.sample = false; invalidate(); toast("Ders silindi; takvim yeniden oluşturulmalı."); }
  const roomButton = event.target.closest("[data-delete-room]");
  if (roomButton) { state.rooms = state.rooms.filter(room => room.id !== roomButton.dataset.deleteRoom); state.sample = false; invalidate(); toast("Derslik silindi; takvim yeniden oluşturulmalı."); }
  const teacherButton = event.target.closest("[data-delete-teacher]");
  if (teacherButton) {
    const teacher = state.teachers.find(person => person.id === teacherButton.dataset.deleteTeacher);
    if (state.courses.some(course => course.teacher === teacher.name)) { toast("Bu hocaya bağlı dersler var. Önce dersleri silin."); return; }
    state.teachers = state.teachers.filter(person => person.id !== teacher.id);
    state.sample = false; invalidate(); toast("Hoca silindi.");
  }
  const assistantButton = event.target.closest("[data-delete-assistant]");
  if (assistantButton) { state.assistants = state.assistants.filter(person => person.id !== assistantButton.dataset.deleteAssistant); state.sample = false; invalidate(); toast("Asistan silindi; program yeniden oluşturulmalı."); }
  const timeButton = event.target.closest("[data-time]");
  if (timeButton) {
    const chosen = new Set(state.settings.times);
    if (chosen.has(timeButton.dataset.time) && chosen.size === 1) { toast("En az bir saat seçili olmalı."); return; }
    chosen.has(timeButton.dataset.time) ? chosen.delete(timeButton.dataset.time) : chosen.add(timeButton.dataset.time);
    state.settings.times = ALL_TIMES.filter(time => chosen.has(time));
    invalidate();
  }
  const dayButton = event.target.closest("[data-day]");
  if (dayButton) {
    const chosen = new Set(state.settings.days);
    const index = Number(dayButton.dataset.day);
    if (chosen.has(index) && chosen.size === 1) { toast("En az bir gün seçili olmalı."); return; }
    chosen.has(index) ? chosen.delete(index) : chosen.add(index);
    state.settings.days = [...chosen].sort((a, b) => a - b);
    invalidate();
  }
});
$("#showCourseForm").addEventListener("click", () => $("#courseFormPanel").classList.remove("hidden"));
$("#cancelCourseForm").addEventListener("click", () => $("#courseFormPanel").classList.add("hidden"));
$("#showRoomForm").addEventListener("click", () => $("#roomFormPanel").classList.remove("hidden"));
$("#cancelRoomForm").addEventListener("click", () => $("#roomFormPanel").classList.add("hidden"));
$("#courseForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const teacher = state.teachers.find(person => person.name === data.get("teacherId"));
  if (!teacher) { toast("Kayıtlı bir hoca seçin."); return; }
  state.courses.push({ id: crypto.randomUUID(), name: data.get("name").trim(), group: data.get("group").trim(), teacher: teacher.name, students: Number(data.get("students")), duration: Number(data.get("duration")) }); state.sample = false;
  event.currentTarget.reset(); $("#courseFormPanel").classList.add("hidden"); invalidate(); toast("Ders eklendi.");
});
$("#roomForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.rooms.push({ id: crypto.randomUUID(), name: data.get("name").trim(), capacity: Number(data.get("capacity")) }); state.sample = false;
  event.currentTarget.reset(); $("#roomFormPanel").classList.add("hidden"); invalidate(); toast("Derslik eklendi.");
});
function registerPerson(event, key, title) {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("name").trim();
  if (!name) { toast("Ad ve soyad girin."); return; }
  if (state[key].some(person => person.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) { toast(`${title} zaten kayıtlı.`); return; }
  state[key].push({ id: crypto.randomUUID(), name });
  state.sample = false; event.currentTarget.reset(); invalidate(); toast(`${title} eklendi.`);
}
$("#teacherForm").addEventListener("submit", event => registerPerson(event, "teachers", "Hoca"));
$("#assistantForm").addEventListener("submit", event => registerPerson(event, "assistants", "Asistan"));
$("#saveSettings").addEventListener("click", () => {
  const weekStart = mondayOf($("#weekStart").value);
  const population = Number($("#population").value);
  const generations = Number($("#generations").value);
  const crossover = Number($("#crossover").value);
  const mutation = Number($("#mutation").value);
  if (!Number.isInteger(population) || population < 20 || population > 300 || !Number.isInteger(generations) || generations < 20 || generations > 1000 || crossover < 0 || crossover > 100 || mutation < 0 || mutation > 100) { toast("Algoritma ayarlarını geçerli aralıklarda girin."); return; }
  state.settings = { ...state.settings, weekStart, population, generations, crossover, mutation };
  invalidate(); toast("Ayarlar kaydedildi; yeni takvim oluşturabilirsiniz.");
});
$("#exportCsv").addEventListener("click", exportCsv);
$("#clearSample").addEventListener("click", () => {
  state.courses = [];
  state.teachers = [];
  state.assistants = [];
  state.rooms = [];
  state.sample = false;
  invalidate(); setView("staff"); toast("Örnek kayıtlar temizlendi. Kendi personel kayıtlarınızla başlayın.");
});

// Example data is explicitly a demo. Generate an initial preview so the UI is useful on first open.
if (!localStorage.getItem(STORAGE_KEY)) {
  try { state.result = generateSchedule(state.courses, state.rooms, slots(), state.assistants, state.settings); save(); } catch { /* Show empty state if demo data cannot be scheduled. */ }
}
render();
