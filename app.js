// ---------- Settings (easy to change later) ----------

// Expense categories from MyMoney_Simple2026.xlsx (Settings sheet)
const CATEGORIES = [
  { name: "Car loan", group: "Need" },
  { name: "Family", group: "Need" },
  { name: "Tata's rent", group: "Need" },
  { name: "Personal want", group: "Want" },
  { name: "Travel & Tourism", group: "Want" },
];
const GROUPS = ["Need", "Want"];

const CURRENCIES = {
  LAK: { symbol: "₭", decimals: 0 },
  THB: { symbol: "฿", decimals: 2 },
  USD: { symbol: "$", decimals: 2 },
};
const DEFAULT_CURRENCY = "LAK";

const STORAGE_KEY = "myjournal.expenses";
const RATES_KEY = "myjournal.rates";
const DEFAULT_RATES = { USD: 22500, THB: 690 }; // LAK per 1 unit

// Savings goals from MyMoney_Simple2026.xlsx (Goals sheet), in USD
const GOALS = [
  { name: "Family spare fund", target: 2000, monthly: 50 },
  { name: "Retirement", target: 1200, monthly: 100 },
  { name: "Home Office", target: 10000, monthly: 400 },
];
const SAVINGS_KEY = "myjournal.savings";
const TAB_KEY = "myjournal.tab";

// Shown in Settings → Build info. Update with every build.
const BUILD = { number: 9, date: "2026-09-17" };
const BACKUP_FORMAT = "my-journal-backup";

// Daily message lines from your Daily quotes.docx (encouragements, reminders, questions)
const DAILY_LINES = [
  "Start the day with a cup of coffee.",
  "Don’t forget to love yourself.",
  "It’s OK not to be OK.",
  "Be kind to myself.",
  "Thanks to myself for coming this far.",
  "Progress, not perfection.",
  "Be healthy, be happy!",
  "Make today an adventure quest!",
  "Just don’t give a damn sometimes.",
  "Stay strong and focus on this moment.",
  "I’m cute and I know it!",
  "Keep calm, the day is starting!",
  "Coffee first, work later.",
  "Go to bed early today!",
  "Be active, no more resting!",
  "Beware of doomscrolling!",
  "It’s stretching day!",
  "No-sugar day!",
  "What do I need to give myself more of today?",
  "What can I let go of today?",
  "What matters most to me right now?",
  "Am I happy with how I’m spending my time?",
  "What is taking up too much of my energy?",
  "What am I avoiding?",
  "What am I worried about?",
  "What am I proud of?",
  "What have I learned recently?",
  "What do I want more of in my life?",
  "What do I want less of?",
  "What kind of person do I want to become?",
  "I’m only human",
  "Watching for the bump",
  "Bankai! Senbonzakura Kageyoshi~",
  "Gomu Gomu no Jet Pistol",
  "Brace yourself, winter is coming",
  "You know nothing, Jon Snow",
  "Oops, I did it again",
  "One more episode, really?",
  "Work hard, meow harder!",
  "Relax, it’s resting time",
  "Stay away from dehydration",
  "You too can become a hero",
  "I’m gonna be the Pirate King!",
  "Time to write something",
  "Get ready and GO!",
  "I love my JOB!",
  "More water pleaseee",
  "Stay tuned, reading time!",
  "What’s on my mind today?",
  "That’s my ninja way!",
];
const DAILY_KEY = "myjournal.daily";


// ---------- Saving on this device ----------

// One list of entries under one storage key (used for expenses and savings)
function makeStore(key) {
  const load = () => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw); // throws if the saved data is damaged, so we never overwrite it
    if (!Array.isArray(list)) throw new Error(`Saved data in ${key} is not a list`);
    return list;
  };
  const save = (list) => localStorage.setItem(key, JSON.stringify(list));
  return {
    load,
    save,
    add(entry) {
      const list = load();
      list.push(entry);
      save(list);
    },
    update(id, changes) {
      const list = load();
      const index = list.findIndex((e) => e.id === id);
      if (index === -1) throw new Error("Entry not found");
      list[index] = { ...list[index], ...changes, updatedAt: new Date().toISOString() };
      save(list);
    },
    remove(id) {
      save(load().filter((e) => e.id !== id));
    },
  };
}

const expenseStore = makeStore(STORAGE_KEY);
const savingsStore = makeStore(SAVINGS_KEY);

const loadExpenses = expenseStore.load;
const addExpense = expenseStore.add;
const updateExpense = expenseStore.update;
const deleteExpense = expenseStore.remove;

function loadRates() {
  try {
    return { ...DEFAULT_RATES, ...JSON.parse(localStorage.getItem(RATES_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_RATES };
  }
}

function saveRates(rates) {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates));
}

// ---------- Helpers ----------

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatMoney(amount, currency) {
  const { symbol, decimals } = CURRENCIES[currency];
  return symbol + " " + amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Adds thousand separators while typing: 25000 -> 25,000
function formatWhileTyping(text, decimals) {
  let s = text.replace(/[^\d.]/g, "");
  if (decimals === 0) s = s.replace(/\./g, "");
  const [intPart, ...rest] = s.split(".");
  const grouped = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (rest.length === 0) return grouped;
  return grouped + "." + rest.join("").slice(0, decimals);
}

function readAmount(text, decimals) {
  const n = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(n)) return NaN;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function rateFor(currency, rates) {
  return currency === DEFAULT_CURRENCY ? 1 : rates[currency];
}

// Saved entries keep the rate from the day they were added.
// Entries from before rates existed fall back to today's rate.
function lakAmountOf(expense, rates) {
  if (typeof expense.lakAmount === "number") return expense.lakAmount;
  const rate = rateFor(expense.currency, rates);
  return rate ? Math.round(expense.amount * rate) : 0;
}

function groupOf(expense) {
  if (expense.group) return expense.group;
  const found = CATEGORIES.find((c) => c.name === expense.category);
  return found ? found.group : "";
}

function shortDate(iso, withYear = false) {
  const [y, m, d] = iso.split("-").map(Number);
  const options = { day: "numeric", month: "short" };
  if (withYear) options.year = "numeric";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", options);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// A big tap button that works like a radio button
function choiceButton(name, value) {
  const label = el("label", "item-btn");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  label.append(input, el("span", "", value));
  return label;
}

// In-app delete confirmation: the browser's own confirm() box is blocked in some browsers
function toggleConfirm(confirmId, actionsId, show) {
  $(confirmId).hidden = !show;
  $(actionsId).hidden = show;
}

// ---------- Dashboard ----------

const $ = (id) => document.getElementById(id);

const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth(); // 0 = January

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function summaryRow(label, amount) {
  const li = el("li", "row");
  li.append(el("span", "", label), el("span", "row-amount", formatMoney(amount, "LAK")));
  return li;
}

function renderDashboard() {
  const rates = loadRates();
  let all = [];
  let loadProblem = false;
  try {
    all = loadExpenses();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }

  const key = monthKey(viewYear, viewMonth);
  const items = all
    .filter((e) => typeof e.date === "string" && e.date.startsWith(key))
    .map((e) => ({ ...e, lak: lakAmountOf(e, rates) }))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const total = items.reduce((sum, e) => sum + e.lak, 0);
  const sumWhere = (test) => items.filter(test).reduce((sum, e) => sum + e.lak, 0);

  $("month-label").textContent = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  $("total").textContent = formatMoney(total, "LAK");

  $("by-group").replaceChildren(
    ...GROUPS.map((g) => summaryRow(g, sumWhere((e) => groupOf(e) === g)))
  );

  $("by-item").replaceChildren(
    ...GROUPS.flatMap((g) => {
      const list = el("ul");
      for (const c of CATEGORIES.filter((c) => c.group === g)) {
        list.append(summaryRow(c.name, sumWhere((e) => e.category === c.name)));
      }
      return [el("h4", "", g), list];
    })
  );

  $("log").replaceChildren(
    ...items.map((e) => {
      const row = el("button", "log-row");
      row.type = "button";
      const item = el("span", "log-item");
      item.append(el("span", "", e.category));
      if (e.note) item.append(el("span", "small", e.note));
      const amount = el("span", "log-amount");
      amount.append(el("span", "", formatMoney(e.lak, "LAK")));
      if (e.currency !== DEFAULT_CURRENCY) amount.append(el("span", "small", formatMoney(e.amount, e.currency)));
      row.append(el("span", "log-date", shortDate(e.date)), item, amount);
      row.addEventListener("click", () => openEdit(e.id));
      const li = el("li");
      li.append(row);
      return li;
    })
  );
  $("log-empty").textContent = loadProblem
    ? "Your saved transactions couldn't be read."
    : "No transactions this month.";
  $("log-empty").hidden = items.length > 0;
}

function changeMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  renderDashboard();
}

$("prev-month").addEventListener("click", () => changeMonth(-1));
$("next-month").addEventListener("click", () => changeMonth(1));

// ---------- Pop-ups ----------

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
}

// ---------- Add transaction pop-up ----------

const addDialog = $("add-dialog");
const addForm = $("add-form");
const amountEl = $("amount");
const currencyEl = $("currency");
const dateEl = $("date");
const noteEl = $("note");

function fillAddForm() {
  for (const [code, { symbol }] of Object.entries(CURRENCIES)) {
    currencyEl.add(new Option(`${symbol} ${code}`, code));
  }
  for (const g of GROUPS) {
    const group = el("div", "item-group");
    const buttons = el("div", "item-buttons");
    for (const c of CATEGORIES.filter((c) => c.group === g)) {
      buttons.append(choiceButton("item", c.name));
    }
    group.append(el("span", "item-group-label", g), buttons);
    $("item-choices").append(group);
  }
}

function hideAddErrors() {
  for (const id of ["item-error", "amount-error", "rate-error", "add-error"]) $(id).hidden = true;
}

function resetAddForm() {
  addForm.reset();
  currencyEl.value = DEFAULT_CURRENCY;
  dateEl.value = todayISO();
  hideAddErrors();
}

let editingId = null; // null = adding a new transaction

function setMode(id) {
  editingId = id;
  $("add-title").textContent = id ? "Edit transaction" : "Add transaction";
  $("delete-transaction").hidden = !id;
  toggleConfirm("delete-confirm", "form-actions", false);
}

$("open-add").addEventListener("click", () => {
  resetAddForm();
  setMode(null);
  addDialog.showModal();
});

function openEdit(id) {
  let expense;
  try {
    expense = loadExpenses().find((e) => e.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!expense) return;

  resetAddForm();
  setMode(id);
  const radio = addForm.querySelector(`input[name="item"][value="${CSS.escape(expense.category)}"]`);
  if (radio) radio.checked = true;
  currencyEl.value = expense.currency;
  amountEl.value = formatWhileTyping(String(expense.amount), CURRENCIES[expense.currency].decimals);
  dateEl.value = expense.date;
  noteEl.value = expense.note || "";
  addDialog.showModal();
}

$("delete-transaction").addEventListener("click", () => {
  toggleConfirm("delete-confirm", "form-actions", true);
  $("delete-no").focus();
});

$("delete-no").addEventListener("click", () => {
  toggleConfirm("delete-confirm", "form-actions", false);
  $("delete-transaction").focus();
});

$("delete-yes").addEventListener("click", () => {
  if (!editingId) return;
  try {
    deleteExpense(editingId);
  } catch (err) {
    console.error(err);
    $("add-error").hidden = false;
    return;
  }
  addDialog.close();
  renderDashboard();
});

$("item-choices").addEventListener("change", () => ($("item-error").hidden = true));

amountEl.addEventListener("input", () => {
  amountEl.value = formatWhileTyping(amountEl.value, CURRENCIES[currencyEl.value].decimals);
  $("amount-error").hidden = true;
});

currencyEl.addEventListener("change", () => {
  amountEl.value = formatWhileTyping(amountEl.value, CURRENCIES[currencyEl.value].decimals);
  $("rate-error").hidden = true;
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const checked = addForm.querySelector('input[name="item"]:checked');
  const currency = currencyEl.value;
  const amount = readAmount(amountEl.value, CURRENCIES[currency].decimals);

  let original = null;
  if (editingId) {
    try {
      original = loadExpenses().find((e) => e.id === editingId) || null;
    } catch (err) {
      console.error(err);
    }
    if (!original) {
      $("add-error").hidden = false;
      return;
    }
  }
  // An edit keeps its original rate unless the amount or currency changed
  const keepRate = original && original.rate && original.currency === currency && original.amount === amount;
  const rate = keepRate ? original.rate : rateFor(currency, loadRates());

  $("item-error").hidden = Boolean(checked);
  $("amount-error").hidden = amount > 0;
  $("rate-error-text").textContent = `No ${currency} rate yet. Set it in Settings.`;
  $("rate-error").hidden = Boolean(rate);
  $("add-error").hidden = true;
  if (!checked || !(amount > 0) || !rate) return;

  const category = CATEGORIES.find((c) => c.name === checked.value);
  const expense = {
    amount,
    currency,
    rate,
    lakAmount: Math.round(amount * rate),
    date: dateEl.value || todayISO(),
    category: category.name,
    group: category.group,
    note: noteEl.value.trim(),
  };

  try {
    if (original) {
      updateExpense(original.id, expense);
    } else {
      addExpense({ id: newId(), ...expense, createdAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error(err);
    $("add-error").hidden = false;
    return;
  }

  addDialog.close();
  const [y, m] = expense.date.split("-").map(Number);
  viewYear = y;
  viewMonth = m - 1;
  renderDashboard();
});

// ---------- My Skin cycle (the My Skin page itself arrives in Build 7) ----------

const SKIN_CYCLE = ["Exfoliate", "Retinol", "Recovery 1", "Recovery 2"];
const SKIN_LETTERS = ["E", "R", "M", "M"]; // shown in the calendar: E xfoliate, R etinol, M oist
const SKIN_START = { date: "2026-09-15", night: 1 }; // 15 Sep 2026 = Retinol

function daysBetween(fromISO, toISO) {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// The cycle follows the calendar, and "tonight" ends at midnight (local date)
function skinNightIndex(dateISO) {
  const n = SKIN_CYCLE.length;
  return ((SKIN_START.night + daysBetween(SKIN_START.date, dateISO)) % n + n) % n;
}

function skinNightFor(dateISO) {
  return SKIN_CYCLE[skinNightIndex(dateISO)];
}

function skinLetterFor(dateISO) {
  return SKIN_LETTERS[skinNightIndex(dateISO)];
}

// ---------- My Skin page ----------
// Only the nights you marked Done are stored, keyed by date: { "YYYY-MM-DD": "done" }

const SKIN_DATA_KEY = "myjournal.skin";

function loadSkin() {
  try {
    const map = JSON.parse(localStorage.getItem(SKIN_DATA_KEY) || "{}");
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  } catch {
    return {};
  }
}

function saveSkin(map) {
  localStorage.setItem(SKIN_DATA_KEY, JSON.stringify(map));
}

function setSkinDay(dateISO, done) {
  const map = loadSkin();
  if (done) map[dateISO] = "done";
  else delete map[dateISO];
  saveSkin(map);
  renderSkin();
  renderHome();
}

let skinViewYear = now.getFullYear();
let skinViewMonth = now.getMonth();

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function renderSkin() {
  const map = loadSkin();
  const today = todayISO();

  // Tonight card
  $("skin-today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  $("skin-tonight").textContent = skinNightFor(today);
  const doneTonight = map[today] === "done";
  $("skin-done-btn").textContent = doneTonight ? "✓ Done" : "Done";
  $("skin-done-btn").classList.toggle("primary", doneTonight);
  toggleConfirm("skin-undo-confirm", "skin-done-actions", false);

  // Month calendar
  $("skin-month-label").textContent = new Date(skinViewYear, skinViewMonth, 1)
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const daysInMonth = new Date(skinViewYear, skinViewMonth + 1, 0).getDate();
  const blanks = (new Date(skinViewYear, skinViewMonth, 1).getDay() + 6) % 7; // weeks start on Monday
  const cells = [];
  for (let i = 0; i < blanks; i++) cells.push(el("span", "cal-cell cal-blank"));
  for (let day = 1; day <= daysInMonth; day++) {
    const date = isoDate(skinViewYear, skinViewMonth, day);
    const done = map[date] === "done";
    const canTap = date <= today && date >= SKIN_START.date;
    const cell = el("button", "cal-cell");
    cell.type = "button";
    cell.append(
      el("span", "cal-day", String(day)),
      el("span", "cal-letter", skinLetterFor(date)),
      el("span", "cal-mark", done ? "✓" : "")
    );
    if (date === today) cell.classList.add("is-today");
    if (done) cell.classList.add("is-done");
    if (canTap) cell.addEventListener("click", () => openSkinDay(date));
    else {
      cell.classList.add("is-off");
      cell.disabled = true;
    }
    cell.setAttribute("aria-label", `${shortDate(date, true)}, ${skinNightFor(date)}${done ? ", done" : ""}`);
    cells.push(cell);
  }
  $("skin-calendar").replaceChildren(...cells);
}

function changeSkinMonth(delta) {
  const d = new Date(skinViewYear, skinViewMonth + delta, 1);
  skinViewYear = d.getFullYear();
  skinViewMonth = d.getMonth();
  renderSkin();
}

$("skin-prev-month").addEventListener("click", () => changeSkinMonth(-1));
$("skin-next-month").addEventListener("click", () => changeSkinMonth(1));

// Tonight's Done button toggles: tap again and confirm to clear it
$("skin-done-btn").addEventListener("click", () => {
  const today = todayISO();
  if (loadSkin()[today] === "done") {
    toggleConfirm("skin-undo-confirm", "skin-done-actions", true);
    $("skin-undo-no").focus();
  } else {
    setSkinDay(today, true);
  }
});

$("skin-undo-no").addEventListener("click", () => {
  toggleConfirm("skin-undo-confirm", "skin-done-actions", false);
  $("skin-done-btn").focus();
});

$("skin-undo-yes").addEventListener("click", () => setSkinDay(todayISO(), false));

// Fixing one day from the calendar
let skinDayDate = null;

function openSkinDay(dateISO) {
  skinDayDate = dateISO;
  const done = loadSkin()[dateISO] === "done";
  $("skin-day-title").textContent = `${shortDate(dateISO, true)} · ${skinNightFor(dateISO)}`;
  $("skin-day-state").textContent = done ? "Marked done" : "Not marked yet";
  $("skin-day-done").hidden = done;
  $("skin-day-not-done").hidden = !done;
  $("skin-day-dialog").showModal();
}

$("skin-day-done").addEventListener("click", () => {
  setSkinDay(skinDayDate, true);
  $("skin-day-dialog").close();
});

$("skin-day-not-done").addEventListener("click", () => {
  setSkinDay(skinDayDate, false);
  $("skin-day-dialog").close();
});

// ---------- Daily message ----------
// One line a day, picked at midnight. Random, but no repeats until every line has been shown.

function loadDaily() {
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return saved;
  } catch {
    return {};
  }
}

function saveDaily(state) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(state));
}

function dailyLineFor(dateISO) {
  const saved = loadDaily();
  if (saved.date === dateISO && DAILY_LINES[saved.index]) return DAILY_LINES[saved.index];

  let shown = Array.isArray(saved.shown) ? saved.shown.filter((i) => Number.isInteger(i) && DAILY_LINES[i]) : [];
  let left = DAILY_LINES.map((_, i) => i).filter((i) => !shown.includes(i));
  if (left.length === 0) { // every line has been shown: start the rotation again
    shown = [];
    left = DAILY_LINES.map((_, i) => i);
  }
  const index = left[Math.floor(Math.random() * left.length)];
  shown.push(index);
  try {
    saveDaily({ date: dateISO, index, shown });
  } catch (err) {
    console.error(err);
  }
  return DAILY_LINES[index];
}

// ---------- Pages: Home, My Money, My Skin (Settings opens on top) ----------

const VIEWS = ["home", "money", "skin", "diary"];
const VIEW_KEY = "myjournal.view";
let currentView = "home";

// overlay: "" (a normal page), "settings", or "note" (the diary writing page)
function applyPages(overlay = "") {
  for (const view of VIEWS) $(`${view}-page`).hidden = overlay !== "" || view !== currentView;
  $("settings-page").hidden = overlay !== "settings";
  $("diary-note-page").hidden = overlay !== "note";
  $("tabbar").hidden = overlay !== "" || currentView !== "money";
  window.scrollTo(0, 0);
}

function renderHome() {
  const today = todayISO();
  $("daily-line").textContent = dailyLineFor(today);
  const done = loadSkin()[today] === "done";
  $("skin-tile-tonight").textContent = `Tonight: ${skinNightFor(today)}${done ? " ✓" : ""}`;
}

function showView(view, { push = false } = {}) {
  currentView = view;
  if (view === "home") renderHome();
  if (view === "skin") renderSkin();
  if (view === "diary") renderDiary();
  applyPages();
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {}
  if (push) history.pushState({ view, fromHome: true }, ""); // so the phone's Back gesture returns Home
}

function goHome() {
  if (history.state && history.state.fromHome) {
    history.back(); // same as the phone's Back gesture
  } else {
    showView("home");
    history.replaceState({ view: "home" }, "");
  }
}

// From Home, My Money always starts on the Expenses tab
$("tile-money").addEventListener("click", () => {
  showTab("expenses");
  showView("money", { push: true });
});
$("tile-skin").addEventListener("click", () => showView("skin", { push: true }));
$("tile-diary").addEventListener("click", () => showView("diary", { push: true }));
for (const button of document.querySelectorAll(".go-home")) button.addEventListener("click", goHome);

// The skin tile updates after midnight when the app comes back into view
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderHome();
});

// ---------- My Diary ----------

const DIARY_KEY = "myjournal.diary";
const diaryStore = makeStore(DIARY_KEY);

let editingNoteId = null;              // null = writing a new note
let noteOpenedWith = { title: "", text: "" };
let leavingNote = false;               // true while a save, delete or discard closes the page
let savingNote = false;                // guards a double tap on Save

function renderDiary() {
  let notes = [];
  let loadProblem = false;
  try {
    notes = diaryStore.load();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }
  // Newest first. Sorting on date and createdAt only, so editing a note never moves it.
  const rows = [...notes].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  $("diary-log").replaceChildren(...rows.map(noteRow));
  $("diary-empty").textContent = loadProblem ? "Your saved notes couldn't be read." : "No notes yet.";
  $("diary-empty").hidden = rows.length > 0;
}

function noteRow(note) {
  const row = el("button", "log-row note-row");
  row.type = "button";
  row.append(
    el("span", "log-date", note.date ? shortDate(note.date, true) : ""),
    el("span", "log-item", note.title || "(untitled)")
  );
  row.addEventListener("click", () => openNote(note.id));
  const li = el("li");
  li.append(row);
  return li;
}

function noteWhen(note) {
  const when = new Date(note.createdAt || `${note.date}T00:00:00`);
  const stamp = when.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return note.updatedAt ? `${stamp} · edited` : stamp;
}

function noteFields() {
  return { title: $("diary-title").value.trim(), text: $("diary-text").value.trim() };
}

function noteIsDirty() {
  const now = noteFields();
  return now.title !== noteOpenedWith.title || now.text !== noteOpenedWith.text;
}

function showNoteError(message) {
  $("diary-error").textContent = message;
  $("diary-error").hidden = false;
}

function openNoteEditor(note) {
  editingNoteId = note ? note.id : null;
  $("diary-note-title").textContent = note ? "Edit note" : "New note";
  $("diary-title").value = note ? note.title || "" : "";
  $("diary-text").value = note ? note.text || "" : "";
  $("diary-when").textContent = note ? noteWhen(note) : "";
  $("diary-when").hidden = !note;
  $("delete-note").hidden = !note;
  $("diary-error").hidden = true;
  $("diary-leave-confirm").hidden = true;
  toggleConfirm("diary-delete-confirm", "diary-form-actions", false);
  noteOpenedWith = noteFields();
  leavingNote = false;
  savingNote = false;
  applyPages("note");
  history.pushState({ view: currentView, note: true }, ""); // so Back closes the writing page
  (note ? $("diary-text") : $("diary-title")).focus();
}

function openNote(id) {
  let note;
  try {
    note = diaryStore.load().find((n) => n.id === id);
  } catch (err) {
    console.error(err);
  }
  if (note) openNoteEditor(note);
}

$("diary-new").addEventListener("click", () => openNoteEditor(null));
$("close-note").addEventListener("click", () => history.back());

for (const field of [$("diary-title"), $("diary-text")]) {
  field.addEventListener("input", () => ($("diary-error").hidden = true));
}

$("save-note").addEventListener("click", () => {
  if (savingNote) return;
  const { title, text } = noteFields();
  if (!title && !text) {
    showNoteError("Write something first.");
    return;
  }
  savingNote = true;
  const finalTitle = title || text.split("\n")[0].slice(0, 60);
  try {
    if (editingNoteId) {
      diaryStore.update(editingNoteId, { title: finalTitle, text });
    } else {
      diaryStore.add({ id: newId(), title: finalTitle, text, date: todayISO(), createdAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error(err);
    savingNote = false;
    showNoteError("Sorry, this note couldn't be saved. Your writing is still here.");
    return;
  }
  savingNote = false;
  renderDiary();
  leavingNote = true;
  history.back();
});

$("delete-note").addEventListener("click", () => {
  toggleConfirm("diary-delete-confirm", "diary-form-actions", true);
  $("diary-delete-no").focus();
});

$("diary-delete-no").addEventListener("click", () => {
  toggleConfirm("diary-delete-confirm", "diary-form-actions", false);
  $("delete-note").focus();
});

$("diary-delete-yes").addEventListener("click", () => {
  if (!editingNoteId) return;
  try {
    diaryStore.remove(editingNoteId);
  } catch (err) {
    console.error(err);
    toggleConfirm("diary-delete-confirm", "diary-form-actions", false);
    showNoteError("Sorry, this note couldn't be deleted.");
    return;
  }
  renderDiary();
  leavingNote = true;
  history.back();
});

$("diary-leave-no").addEventListener("click", () => {
  toggleConfirm("diary-leave-confirm", "diary-form-actions", false);
  $("diary-text").focus();
});

$("diary-leave-yes").addEventListener("click", () => {
  toggleConfirm("diary-leave-confirm", "diary-form-actions", false);
  leavingNote = true;
  history.back();
});

// ---------- Settings page ----------

const rateInputs = { USD: $("rate-USD"), THB: $("rate-THB") };
let pendingRestore = null; // a checked backup waiting for "Yes, restore"

function showSettingsStatus(id, message, isProblem = false) {
  $(id).textContent = message;
  $(id).classList.toggle("is-problem", isProblem);
  $(id).hidden = false;
}

function fillRateInputs() {
  const rates = loadRates();
  for (const [code, input] of Object.entries(rateInputs)) {
    input.value = rates[code] ? formatWhileTyping(String(rates[code]), 2) : "";
  }
}

function openSettings() {
  fillRateInputs();
  for (const id of ["rates-error", "rates-status", "backup-status"]) $(id).hidden = true;
  cancelRestore();
  applyPages("settings");
  history.pushState({ view: currentView, settings: true }, ""); // so the phone's Back gesture closes Settings
}

for (const button of document.querySelectorAll(".open-settings")) button.addEventListener("click", openSettings);
$("close-settings").addEventListener("click", () => history.back());

// Back / forward (← Back, ⌂ and the phone's Back gesture) all land here
window.addEventListener("popstate", (event) => {
  const state = event.state || { view: "home" };
  if (state.settings) {
    fillRateInputs();
    applyPages("settings");
    return;
  }
  if (state.note) {
    applyPages("note");
    return;
  }
  // Leaving the writing page with unsaved text: ask first, and put the history entry back
  if (!$("diary-note-page").hidden && !leavingNote && noteIsDirty()) {
    history.pushState({ view: currentView, note: true }, "");
    toggleConfirm("diary-delete-confirm", "diary-form-actions", false);
    toggleConfirm("diary-leave-confirm", "diary-form-actions", true);
    $("diary-leave-no").focus();
    return;
  }
  const noteWasOpen = !$("diary-note-page").hidden;
  leavingNote = false;
  const settingsWasOpen = !$("settings-page").hidden;
  showView(VIEWS.includes(state.view) ? state.view : "home");
  if (settingsWasOpen) document.querySelector(`#${currentView}-page .open-settings`).focus();
  if (noteWasOpen) $("diary-new").focus();
});

// Exchange rates

for (const input of Object.values(rateInputs)) {
  input.addEventListener("input", () => {
    input.value = formatWhileTyping(input.value, 2);
    $("rates-error").hidden = true;
    $("rates-status").hidden = true;
  });
}

$("rates-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const rates = {};
  for (const [code, input] of Object.entries(rateInputs)) {
    const value = readAmount(input.value, 2);
    if (!(value > 0)) {
      $("rates-error").hidden = false;
      $("rates-status").hidden = true;
      return;
    }
    rates[code] = value;
  }
  saveRates(rates);
  showSettingsStatus("rates-status", "Rates saved ✓");
  renderDashboard();
});

// Backup: one file with everything, shared through the phone's Share menu (or downloaded)

function makeBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 4, // 2 added My Skin, 3 the daily message, 4 the diary notes
    build: BUILD.number,
    exportedAt: new Date().toISOString(),
    expenses: expenseStore.load(),
    savings: savingsStore.load(),
    rates: loadRates(),
    skin: loadSkin(),
    daily: loadDaily(),
    diary: diaryStore.load(),
  };
}

function backupSummary(backup) {
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${count(backup.expenses.length, "expense")} · ${count(backup.savings.length, "saving")}`
    + ` · ${count((backup.diary || []).length, "note")}`;
}

$("backup-btn").addEventListener("click", async () => {
  $("backup-status").hidden = true;
  let backup;
  try {
    backup = makeBackup();
  } catch (err) {
    console.error(err);
    showSettingsStatus("backup-status", "Your saved data couldn't be read, so no backup was made.", true);
    return;
  }

  const name = `my-journal-backup-${todayISO()}.json`;
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My Journal backup" });
      showSettingsStatus("backup-status", `Backup shared ✓ (${backupSummary(backup)})`);
      return;
    } catch (err) {
      if (err.name === "AbortError") {
        showSettingsStatus("backup-status", "Backup cancelled.");
        return;
      }
      console.error(err); // sharing failed: fall back to saving the file
    }
  }

  const url = URL.createObjectURL(file);
  const link = el("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showSettingsStatus("backup-status", `Backup saved to Downloads ✓ (${backupSummary(backup)})`);
});

// Restore: check the file, show what's in it, then replace everything after "Yes, restore"

function checkBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || !Array.isArray(backup.expenses) || !Array.isArray(backup.savings)) {
    throw new Error("Not a My Journal backup");
  }
  const isEntry = (e) => e && typeof e.id === "string" && typeof e.amount === "number" && typeof e.date === "string";
  if (!backup.expenses.every(isEntry) || !backup.savings.every(isEntry)) {
    throw new Error("Backup has damaged entries");
  }
  // Backups made before My Skin existed (version 1) have no "skin", and those leave My Skin untouched
  if (backup.skin !== undefined && (typeof backup.skin !== "object" || backup.skin === null || Array.isArray(backup.skin))) {
    throw new Error("Backup has damaged skin days");
  }
  if (backup.daily !== undefined && (typeof backup.daily !== "object" || backup.daily === null || Array.isArray(backup.daily))) {
    throw new Error("Backup has a damaged daily message");
  }
  // Backups made before My Diary existed (version 3 and older) have no "diary", and those leave notes untouched
  if (backup.diary !== undefined && (!Array.isArray(backup.diary) || !backup.diary.every((n) => n && typeof n.id === "string"))) {
    throw new Error("Backup has damaged notes");
  }
  return backup;
}

function cancelRestore() {
  pendingRestore = null;
  toggleConfirm("restore-confirm", "backup-actions", false);
}

$("restore-btn").addEventListener("click", () => {
  $("restore-file").value = "";
  $("restore-file").click();
});

$("restore-file").addEventListener("change", async () => {
  const file = $("restore-file").files[0];
  if (!file) return;
  $("backup-status").hidden = true;
  try {
    pendingRestore = checkBackup(JSON.parse(await file.text()));
  } catch (err) {
    console.error(err);
    cancelRestore();
    showSettingsStatus("backup-status", "This file isn't a My Journal backup, so nothing was changed.", true);
    return;
  }
  const when = pendingRestore.exportedAt ? shortDate(pendingRestore.exportedAt.slice(0, 10), true) : "an unknown date";
  $("restore-summary").textContent = `Restore the backup from ${when}?`;
  toggleConfirm("restore-confirm", "backup-actions", true);
  $("restore-no").focus();
});

$("restore-no").addEventListener("click", () => {
  cancelRestore();
  $("restore-btn").focus();
});

$("restore-yes").addEventListener("click", () => {
  if (!pendingRestore) return;
  const backup = pendingRestore;
  const keys = [STORAGE_KEY, SAVINGS_KEY, RATES_KEY, SKIN_DATA_KEY, DAILY_KEY, DIARY_KEY];
  const before = keys.map((key) => localStorage.getItem(key));
  try {
    expenseStore.save(backup.expenses);
    savingsStore.save(backup.savings);
    if (backup.rates) saveRates({ ...DEFAULT_RATES, ...backup.rates });
    if (backup.skin) saveSkin(backup.skin);
    if (backup.daily) saveDaily(backup.daily);
    if (backup.diary) diaryStore.save(backup.diary);
  } catch (err) {
    console.error(err);
    // Put everything back the way it was
    keys.forEach((key, i) => (before[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, before[i])));
    cancelRestore();
    showSettingsStatus("backup-status", "Restore failed, so your data wasn't changed.", true);
    return;
  }
  cancelRestore();
  renderDashboard();
  renderSavings();
  renderSkin();
  renderDiary();
  renderHome();
  fillRateInputs();
  showSettingsStatus("backup-status", `Restored ✓ (${backupSummary(backup)})`);
});

// ---------- Savings tab ----------

function renderSavings() {
  let all = [];
  let loadProblem = false;
  try {
    all = savingsStore.load();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }

  const total = all.reduce((sum, s) => sum + s.amount, 0);
  $("savings-total").textContent = formatMoney(total, "USD");

  $("goals").replaceChildren(
    ...GOALS.map((g) => {
      const saved = all.filter((s) => s.goal === g.name).reduce((sum, s) => sum + s.amount, 0);
      const card = el("div", "goal");
      card.append(
        el("div", "goal-name", g.name),
        el("div", "", `${formatMoney(saved, "USD")} / ${formatMoney(g.target, "USD")}`)
      );
      const bar = el("div", "bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", `${g.name} progress`);
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(g.target));
      bar.setAttribute("aria-valuenow", String(Math.min(saved, g.target)));
      const fill = el("div", "bar-fill");
      fill.style.width = `${Math.min(100, g.target ? (saved / g.target) * 100 : 0)}%`;
      bar.append(fill);
      card.append(bar, el("div", "small", `${formatMoney(g.monthly, "USD")} a month`), el("div", "small", goalStatus(saved, g)));
      return card;
    })
  );

  sortedSavings = [...all].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("saving-log").replaceChildren(...sortedSavings.slice(0, RECENT_LOG_COUNT).map(savingRow));
  $("open-saving-log").hidden = sortedSavings.length <= RECENT_LOG_COUNT;
  $("saving-log-empty").textContent = loadProblem ? "Your saved savings couldn't be read." : "No savings yet.";
  $("saving-log-empty").hidden = sortedSavings.length > 0;
  renderFullSavingLog();
}

// Same as the spreadsheet: months left = still needed ÷ monthly (rounded up), finish = this month + months left
function goalStatus(saved, goal) {
  const remaining = Math.round((goal.target - saved) * 100) / 100;
  if (remaining <= 0) return "Goal reached ✓";
  if (!(goal.monthly > 0)) return "";
  const months = Math.ceil(remaining / goal.monthly);
  const today = new Date();
  const finish = new Date(today.getFullYear(), today.getMonth() + months, 1)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${months} ${months === 1 ? "month" : "months"} left · est. ${finish}`;
}

function savingRow(s) {
  const row = el("button", "log-row with-year");
  row.type = "button";
  const goal = el("span", "log-item");
  goal.append(el("span", "", s.goal));
  if (s.note) goal.append(el("span", "small", s.note));
  row.append(el("span", "log-date", shortDate(s.date, true)), goal, el("span", "log-amount", formatMoney(s.amount, "USD")));
  row.addEventListener("click", () => openSavingEdit(s.id));
  const li = el("li");
  li.append(row);
  return li;
}

// ---------- Full saving log pop-up (10 per page, fits the phone screen without scrolling) ----------

const RECENT_LOG_COUNT = 5;
const LOG_PAGE_SIZE = 10;
let sortedSavings = [];
let logPage = 0; // 0 = first page

function renderFullSavingLog() {
  const count = sortedSavings.length;
  const pages = Math.max(1, Math.ceil(count / LOG_PAGE_SIZE));
  logPage = Math.min(Math.max(logPage, 0), pages - 1);
  const start = logPage * LOG_PAGE_SIZE;
  const pageRows = sortedSavings.slice(start, start + LOG_PAGE_SIZE);

  $("saving-log-full").replaceChildren(...pageRows.map(savingRow));
  $("saving-log-range").textContent = count
    ? `${start + 1}–${start + pageRows.length} of ${count}`
    : "No savings yet.";
  $("log-page-label").textContent = `Page ${logPage + 1} of ${pages}`;
  $("log-prev").disabled = logPage === 0;
  $("log-next").disabled = logPage >= pages - 1;
}

function changeLogPage(delta) {
  logPage += delta;
  renderFullSavingLog();
  $("saving-log-dialog").scrollTop = 0;
}

$("open-saving-log").addEventListener("click", () => {
  logPage = 0;
  renderFullSavingLog();
  $("saving-log-dialog").showModal();
  $("saving-log-dialog").scrollTop = 0;
});
$("log-prev").addEventListener("click", () => changeLogPage(-1));
$("log-next").addEventListener("click", () => changeLogPage(1));

// ---------- Add / Edit saving pop-up ----------

const savingDialog = $("saving-dialog");
const savingForm = $("saving-form");
const savingAmountEl = $("saving-amount");
const savingDateEl = $("saving-date");
const savingNoteEl = $("saving-note");

let editingSavingId = null; // null = adding a new saving

function fillSavingForm() {
  for (const g of GOALS) $("goal-choices").append(choiceButton("goal", g.name));
}

function resetSavingForm() {
  savingForm.reset();
  savingDateEl.value = todayISO();
  for (const id of ["goal-error", "saving-amount-error", "saving-error"]) $(id).hidden = true;
}

function setSavingMode(id) {
  editingSavingId = id;
  $("saving-title").textContent = id ? "Edit saving" : "Add saving";
  $("delete-saving").hidden = !id;
  toggleConfirm("saving-delete-confirm", "saving-form-actions", false);
}

$("open-saving").addEventListener("click", () => {
  resetSavingForm();
  setSavingMode(null);
  savingDialog.showModal();
});

function openSavingEdit(id) {
  let saving;
  try {
    saving = savingsStore.load().find((s) => s.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!saving) return;

  resetSavingForm();
  setSavingMode(id);
  const radio = savingForm.querySelector(`input[name="goal"][value="${CSS.escape(saving.goal)}"]`);
  if (radio) radio.checked = true;
  savingAmountEl.value = formatWhileTyping(String(saving.amount), 2);
  savingDateEl.value = saving.date;
  savingNoteEl.value = saving.note || "";
  savingDialog.showModal();
}

$("delete-saving").addEventListener("click", () => {
  toggleConfirm("saving-delete-confirm", "saving-form-actions", true);
  $("saving-delete-no").focus();
});

$("saving-delete-no").addEventListener("click", () => {
  toggleConfirm("saving-delete-confirm", "saving-form-actions", false);
  $("delete-saving").focus();
});

$("saving-delete-yes").addEventListener("click", () => {
  if (!editingSavingId) return;
  try {
    savingsStore.remove(editingSavingId);
  } catch (err) {
    console.error(err);
    $("saving-error").hidden = false;
    return;
  }
  savingDialog.close();
  renderSavings();
});

$("goal-choices").addEventListener("change", () => ($("goal-error").hidden = true));

savingAmountEl.addEventListener("input", () => {
  savingAmountEl.value = formatWhileTyping(savingAmountEl.value, 2);
  $("saving-amount-error").hidden = true;
});

savingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const checked = savingForm.querySelector('input[name="goal"]:checked');
  const amount = readAmount(savingAmountEl.value, 2);
  $("goal-error").hidden = Boolean(checked);
  $("saving-amount-error").hidden = amount > 0;
  $("saving-error").hidden = true;
  if (!checked || !(amount > 0)) return;

  const saving = {
    goal: checked.value,
    amount,
    date: savingDateEl.value || todayISO(),
    note: savingNoteEl.value.trim(),
  };

  try {
    if (editingSavingId) {
      savingsStore.update(editingSavingId, saving);
    } else {
      savingsStore.add({ id: newId(), ...saving, createdAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error(err);
    $("saving-error").hidden = false;
    return;
  }

  savingDialog.close();
  renderSavings();
});

// ---------- Tabs ----------

function showTab(name) {
  for (const tab of ["expenses", "savings"]) {
    const selected = tab === name;
    $(`tab-${tab}`).setAttribute("aria-selected", String(selected));
    $(`panel-${tab}`).hidden = !selected;
  }
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {}
  window.scrollTo(0, 0);
}

$("tab-expenses").addEventListener("click", () => showTab("expenses"));
$("tab-savings").addEventListener("click", () => showTab("savings"));

// ---------- Start ----------

fillAddForm();
fillSavingForm();
renderDashboard();
renderSavings();
$("build-info").textContent = `My Journal · Build ${BUILD.number} · ${shortDate(BUILD.date, true)}`;

let startTab = "expenses";
try {
  if (localStorage.getItem(TAB_KEY) === "savings") startTab = "savings";
} catch {}
showTab(startTab);

// Open where you left off (the first time after Build 6: Home)
let startView = "home";
try {
  const saved = localStorage.getItem(VIEW_KEY);
  if (VIEWS.includes(saved)) startView = saved;
} catch {}
showView(startView);
history.replaceState({ view: startView }, "");

// Lets the app open without internet once it's been added to the home screen
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}

// Ask Chrome to keep this app's data permanently, so it isn't cleared when the phone is low on space
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then((kept) => kept || navigator.storage.persist())
    .catch((err) => console.error(err));
}
