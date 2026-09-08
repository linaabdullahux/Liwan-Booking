/* =========================================================
   Booking flow — vanilla JS, 3 steps.
   The room is chosen on the landing page (index.html) and
   arrives here via ?room=slug, shown as a fixed context label.
   The client only ever *proposes* a slot; create_booking() on
   the server re-checks the rules and the database's exclusion
   constraint has the final word, so a race between two people
   booking the same slot can never produce two bookings.
   ========================================================= */

const DURATIONS = [10,15,30,45,60,120,180,240,300,360]; // minutes
const SLOT_STEP_MIN = 10; // granularity for candidate start times
const TZ = "Asia/Riyadh"; // fixed business timezone — Riyadh has no DST, so +03:00 is always correct

const state = {
  rooms: [],
  room: null,
  companies: [],
  date: null,
  duration: 60,
  start: null, // ISO string of chosen slot start
  end: null,
  guests: [],
};

function fmtDurationLabel(min){
  if (min < 60) return getLang()==="en" ? `${min}m` : `${min} د`;
  const h = min/60;
  return getLang()==="en" ? `${h}h` : `${h} س`;
}

function showStep(n){
  document.querySelectorAll("[data-step-panel]").forEach(p=>{
    p.classList.toggle("hidden", Number(p.getAttribute("data-step-panel")) !== n);
  });
  document.querySelectorAll(".step-pill").forEach(p=>{
    const step = Number(p.getAttribute("data-step"));
    p.classList.toggle("active", step === n);
    p.classList.toggle("done", step < n);
  });
  document.getElementById("form-alert").scrollIntoView({ behavior:"smooth", block:"start" });
}

function showError(msg){
  const box = document.getElementById("form-alert");
  box.innerHTML = `<div class="alert alert-error">${msg}</div>`;
  box.scrollIntoView({ behavior:"smooth", block:"start" });
}
function clearError(){ document.getElementById("form-alert").innerHTML = ""; }

/* ---------- resolve room from URL + load companies ---------- */
async function initRoom(){
  const params = new URLSearchParams(location.search);
  const slug = params.get("room");

  try{
    state.rooms = await apiGetRooms();
  }catch(e){
    state.rooms = [
      { id: "meeting", slug:"meeting", name_ar:"قاعة الاجتماعات", name_en:"Meeting Room", open_time:"08:00:00", close_time:"22:00:00" },
      { id: "brainstorm", slug:"brainstorm", name_ar:"قاعة العصف الذهني", name_en:"Brainstorming Room", open_time:"08:00:00", close_time:"22:00:00" },
    ];
    console.warn("Using placeholder rooms — connect Supabase to go live.", e);
  }

  state.room = state.rooms.find(r => r.slug === slug) || state.rooms[0];
  document.getElementById("room-context").textContent = getLang()==="en" ? state.room.name_en : state.room.name_ar;

  try{
    state.companies = await apiGetCompanies();
  }catch(e){
    state.companies = [];
    console.warn("Could not load companies — connect Supabase to go live.", e);
  }
  const companySelect = document.getElementById("cust-company");
  companySelect.innerHTML = state.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

/* ---------- Step 1: date / duration / time ---------- */
const dateInput = document.getElementById("date-input");
(function initDateBounds(){
  const today = new Date();
  const max = new Date(Date.now() + 7*24*60*60*1000);
  const toStr = d => d.toISOString().slice(0,10);
  dateInput.min = toStr(today);
  dateInput.max = toStr(max);
  dateInput.value = toStr(today);
  state.date = dateInput.value;
})();
dateInput.addEventListener("change", ()=>{ state.date = dateInput.value; loadSlots(); });

const durationGrid = document.getElementById("duration-grid");
durationGrid.innerHTML = DURATIONS.map(m => `<div class="duration-chip" data-min="${m}">${fmtDurationLabel(m)}</div>`).join("");
durationGrid.addEventListener("click", e=>{
  const chip = e.target.closest(".duration-chip");
  if (!chip) return;
  durationGrid.querySelectorAll(".duration-chip").forEach(c=>c.classList.remove("selected"));
  chip.classList.add("selected");
  state.duration = Number(chip.getAttribute("data-min"));
  loadSlots();
});
durationGrid.querySelector('[data-min="60"]').classList.add("selected");

function combineLocal(dateStr, timeStr){
  // Always interpret the picked date/time as Riyadh local time, regardless
  // of the visitor's own device timezone — this is what keeps "3pm" meaning
  // the same wall-clock hour for every booking, no matter who's booking it.
  return new Date(`${dateStr}T${timeStr.slice(0,5)}:00+03:00`);
}

async function loadSlots(){
  const timeGrid = document.getElementById("time-grid");
  const noSlotsMsg = document.getElementById("no-slots-msg");
  const nextBtn = document.getElementById("to-step-2");
  timeGrid.innerHTML = "";
  noSlotsMsg.classList.add("hidden");
  nextBtn.disabled = true;
  state.start = null; state.end = null;

  const openTime = (state.room && state.room.open_time) || "08:00:00";
  const closeTime = (state.room && state.room.close_time) || "22:00:00";

  let busy = [];
  try{
    busy = await apiGetBusyRanges(state.room.id, state.date);
  }catch(e){ console.warn("Could not load availability — connect Supabase to go live.", e); }

  const dayStart = combineLocal(state.date, openTime);
  const dayEnd = combineLocal(state.date, closeTime);
  const now = new Date();
  const minStart = new Date(now.getTime() + 10*60*1000);

  const slots = [];
  for (let tt = new Date(dayStart); tt.getTime() + state.duration*60000 <= dayEnd.getTime(); tt = new Date(tt.getTime() + SLOT_STEP_MIN*60000)){
    const slotStart = new Date(tt);
    const slotEnd = new Date(tt.getTime() + state.duration*60000);
    if (slotStart < minStart) continue; // respects the 10-minute minimum notice
    const conflict = busy.find(b => {
      const bStart = new Date(b.start_time), bEnd = new Date(b.end_time);
      return slotStart < bEnd && slotEnd > bStart;
    });
    slots.push({ start: slotStart, end: slotEnd, busy: !!conflict, bookedBy: conflict ? conflict.company_name : null });
  }

  if (!slots.length){
    noSlotsMsg.classList.remove("hidden");
    return;
  }

  const locale = getLang()==="en" ? "en-US" : "ar-SA";
  timeGrid.innerHTML = slots.map((s,i) => `
    <button type="button" class="time-slot ${s.busy?'busy':''}" data-i="${i}" ${s.busy?'disabled':''}>
      ${s.start.toLocaleTimeString(locale, {hour:'2-digit', minute:'2-digit', timeZone: TZ})}
      ${s.busy && s.bookedBy ? `<span class="slot-owner">* ${s.bookedBy}</span>` : ''}
    </button>
  `).join("");

  timeGrid.querySelectorAll(".time-slot:not(.busy)").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      timeGrid.querySelectorAll(".time-slot").forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
      const s = slots[Number(btn.getAttribute("data-i"))];
      state.start = s.start.toISOString();
      state.end = s.end.toISOString();
      nextBtn.disabled = false;
    });
  });
}

document.getElementById("to-step-2").addEventListener("click", ()=>{
  if (!state.start){ showError(t("error_required")); return; }
  clearError();
  showStep(2);
});

/* ---------- Step 2: details + guests ---------- */
const guestTags = document.getElementById("guest-tags");
function renderGuests(){
  guestTags.innerHTML = state.guests.map((g,i)=>`<span class="tag">${g}<button type="button" data-i="${i}">×</button></span>`).join(" ");
  guestTags.querySelectorAll("button").forEach(b=>{
    b.addEventListener("click", ()=>{ state.guests.splice(Number(b.getAttribute("data-i")),1); renderGuests(); });
  });
}
document.getElementById("add-guest").addEventListener("click", ()=>{
  const input = document.getElementById("guest-email");
  const email = input.value.trim();
  if (!email) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ showError(t("error_invalid_email")); return; }
  clearError();
  state.guests.push(email);
  input.value = "";
  renderGuests();
});
// Pressing Enter in the guest field silently did nothing before — easy to
// miss that the guest was never actually added, so wire it to the same
// action as clicking "إضافة".
document.getElementById("guest-email").addEventListener("keydown", (e)=>{
  if (e.key === "Enter"){
    e.preventDefault();
    document.getElementById("add-guest").click();
  }
});

document.getElementById("back-to-1").addEventListener("click", ()=>showStep(1));
document.getElementById("to-step-3").addEventListener("click", ()=>{
  const companyId = document.getElementById("cust-company").value;
  const email = document.getElementById("cust-email").value.trim();
  if (!companyId || !email){ showError(t("error_required")); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ showError(t("error_invalid_email")); return; }
  clearError();
  renderSummary();
  showStep(3);
});

/* ---------- Step 3: review + submit ---------- */
function renderSummary(){
  const locale = getLang()==="en" ? "en-US" : "ar-SA";
  const start = new Date(state.start), end = new Date(state.end);
  const companySelect = document.getElementById("cust-company");
  const companyName = companySelect.options[companySelect.selectedIndex]?.text || "";
  const box = document.getElementById("summary-box");
  box.innerHTML = `
    <div class="summary-row"><span class="k">${t('summary_room')}</span><span class="v">${getLang()==='en'?state.room.name_en:state.room.name_ar}</span></div>
    <div class="summary-row"><span class="k">${t('summary_date')}</span><span class="v">${start.toLocaleDateString(locale,{year:'numeric',month:'long',day:'numeric',timeZone:TZ})}</span></div>
    <div class="summary-row"><span class="k">${t('summary_time')}</span><span class="v">${start.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})} – ${end.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})}</span></div>
    <div class="summary-row"><span class="k">${t('summary_duration')}</span><span class="v">${fmtDurationLabel(state.duration)}</span></div>
    <div class="summary-row"><span class="k">${t('summary_company')}</span><span class="v">${companyName}</span></div>
    <div class="summary-row"><span class="k">${t('summary_email')}</span><span class="v">${document.getElementById('cust-email').value}</span></div>
    ${state.guests.length ? `<div class="summary-row"><span class="k">${t('summary_guests')}</span><span class="v">${state.guests.join(', ')}</span></div>` : ''}
  `;
}

document.getElementById("back-to-2").addEventListener("click", ()=>showStep(2));

document.getElementById("submit-booking").addEventListener("click", async ()=>{
  const btn = document.getElementById("submit-booking");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = t("btn_submitting");
  clearError();
  try{
    const result = await apiCreateBooking({
      roomId: state.room.id,
      start: state.start,
      end: state.end,
      companyId: document.getElementById("cust-company").value,
      email: document.getElementById("cust-email").value.trim(),
      notes: document.getElementById("cust-notes").value.trim(),
      guestEmails: state.guests,
    });
    location.href = `confirmation.html?id=${result.id}&token=${result.cancel_token}&lang=${getLang()}`;
  } catch(e){
    console.error("BOOKING ERROR:", e);
    const msg = String(
      e?.message ||
      e?.details ||
      e?.hint ||
      e ||
      "Unknown error"
    );

    showError("خطأ الحجز: " + msg);
    if (msg.includes("23P01") || msg.toLowerCase().includes("exclu")){
      showError(t("error_double_book"));
      loadSlots();
      showStep(1);
    } else if (msg.includes("TOO_SOON")){
      showError(t("error_min_notice"));
    } else if (msg.includes("TOO_FAR")){
      showError(t("error_max_notice"));
    } else {
      showError(t("error_generic"));
    }
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.addEventListener("DOMContentLoaded", async ()=>{
  await initRoom();
  await loadSlots();
});
