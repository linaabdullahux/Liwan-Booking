let CURRENT = null; // { id, room_id, room_name_ar, room_name_en, customer_name, ... }
let TOKEN = null;
const TZ = "Asia/Riyadh"; // fixed business timezone, same as booking.js

function icsFor(booking){
  const toICS = d => new Date(d).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  const roomName = getLang()==="en" ? booking.room_name_en : booking.room_name_ar;
  const body = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Leewan Arab//Booking//AR",
    "BEGIN:VEVENT",
    `UID:${booking.id}@leewan-arab`,
    `DTSTAMP:${toICS(new Date())}`,
    `DTSTART:${toICS(booking.start_time)}`,
    `DTEND:${toICS(booking.end_time)}`,
    `SUMMARY:${roomName} — ${t('site_name')}`,
    `LOCATION:${roomName}`,
    "END:VEVENT","END:VCALENDAR"
  ].join("\r\n");
  return "data:text/calendar;charset=utf8," + encodeURIComponent(body);
}

function renderBooking(b){
  const locale = getLang()==="en" ? "en-US" : "ar-SA";
  const start = new Date(b.start_time), end = new Date(b.end_time);
  const roomName = getLang()==="en" ? b.room_name_en : b.room_name_ar;

  document.getElementById("room-context").textContent = roomName;
  document.getElementById("room-context").classList.remove("hidden");
  document.getElementById("confirm-stepper").classList.remove("hidden");

  document.getElementById("summary-box").innerHTML = `
    <div class="summary-row"><span class="k">${t('summary_room')}</span><span class="v">${roomName}</span></div>
    <div class="summary-row"><span class="k">${t('summary_date')}</span><span class="v">${start.toLocaleDateString(locale,{year:'numeric',month:'long',day:'numeric',timeZone:TZ})}</span></div>
    <div class="summary-row"><span class="k">${t('summary_time')}</span><span class="v">${start.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})} – ${end.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})}</span></div>
    <div class="summary-row"><span class="k">${t('summary_company')}</span><span class="v">${b.customer_name||''}</span></div>
    <div class="summary-row"><span class="k">${t('summary_email')}</span><span class="v">${b.customer_email||''}</span></div>
  `;
  document.getElementById("ics-link").setAttribute("href", icsFor(b));

  const statusBox = document.getElementById("status-alert");
  const actions = document.querySelector(".confirm-actions");
  if (b.status === "cancelled"){
    statusBox.innerHTML = `<div class="alert alert-info">${t('booking_cancelled')}</div>`;
    actions.classList.add("hidden");
  } else {
    statusBox.innerHTML = "";
    actions.classList.remove("hidden");
  }
}

async function loadFromURL(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const token = params.get("token");

  if (!id || !token){
    document.getElementById("lookup-box").classList.remove("hidden");
    return;
  }

  try{
    const booking = await apiGetBookingByToken(id, token);
    if (!booking){ document.getElementById("not-found-box").classList.remove("hidden"); return; }
    CURRENT = booking; TOKEN = token;
    document.getElementById("detail-box").classList.remove("hidden");
    renderBooking(booking);
  }catch(e){
    console.error(e);
    document.getElementById("not-found-box").classList.remove("hidden");
  }
}

/* ---------- lookup box (paste link) ---------- */
document.getElementById("lookup-go").addEventListener("click", ()=>{
  const raw = document.getElementById("lookup-input").value.trim();
  const err = document.getElementById("lookup-error");
  try{
    const u = new URL(raw, location.href);
    const id = u.searchParams.get("id"), token = u.searchParams.get("token");
    if (!id || !token) throw new Error("missing");
    u.searchParams.set("lang", getLang());
    location.href = u.pathname + u.search;
  }catch(e){
    err.textContent = t("booking_not_found");
    err.classList.remove("hidden");
  }
});

/* ---------- cancel ---------- */
document.getElementById("cancel-btn")?.addEventListener("click", ()=>{
  document.getElementById("cancel-modal").classList.remove("hidden");
});
document.getElementById("cancel-no")?.addEventListener("click", ()=>{
  document.getElementById("cancel-modal").classList.add("hidden");
});
document.getElementById("cancel-yes")?.addEventListener("click", async ()=>{
  try{
    await apiCancelBooking(CURRENT.id, TOKEN);
    document.getElementById("cancel-modal").classList.add("hidden");
    CURRENT.status = "cancelled";
    renderBooking(CURRENT);
  }catch(e){
    console.error(e);
  }
});

/* ---------- reschedule ---------- */
document.getElementById("edit-btn")?.addEventListener("click", ()=>{
  const panel = document.getElementById("edit-panel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")){
    const dateEl = document.getElementById("edit-date");
    const today = new Date().toISOString().slice(0,10);
    const max = new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,10);
    dateEl.min = today; dateEl.max = max;
    dateEl.value = new Date(CURRENT.start_time).toISOString().slice(0,10);
    loadEditSlots();
  }
});
document.getElementById("cancel-edit")?.addEventListener("click", ()=>{
  document.getElementById("edit-panel").classList.add("hidden");
});
document.getElementById("edit-date")?.addEventListener("change", loadEditSlots);

let editSlots = [];
let editChosen = null;

async function loadEditSlots(){
  const grid = document.getElementById("edit-time-grid");
  const dateStr = document.getElementById("edit-date").value;
  const durationMs = new Date(CURRENT.end_time) - new Date(CURRENT.start_time);
  const durationMin = durationMs / 60000;

  const busy = await apiGetBusyRanges(CURRENT.room_id, dateStr).catch(()=>[]);
  const dayStart = new Date(`${dateStr}T08:00:00+03:00`);
  const dayEnd = new Date(`${dateStr}T22:00:00+03:00`);
  const now = new Date();
  const minStart = new Date(now.getTime()+10*60*1000);

  editSlots = [];
  for (let tt = new Date(dayStart); tt.getTime()+durationMin*60000 <= dayEnd.getTime(); tt = new Date(tt.getTime()+10*60000)){
    const s = new Date(tt), e = new Date(tt.getTime()+durationMin*60000);
    if (s < minStart) continue;
    const overlapsSelf = (new Date(CURRENT.start_time).getTime() === s.getTime());
    const isBusy = !overlapsSelf && busy.some(b=>{
      const bs=new Date(b.start_time), be=new Date(b.end_time);
      return s<be && e>bs;
    });
    editSlots.push({start:s, end:e, busy:isBusy});
  }

  const locale = getLang()==="en" ? "en-US":"ar-SA";
  grid.innerHTML = editSlots.map((s,i)=>`
    <button type="button" class="time-slot ${s.busy?'busy':''}" data-i="${i}" ${s.busy?'disabled':''}>
      ${s.start.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})}
    </button>`).join("");
  grid.querySelectorAll(".time-slot:not(.busy)").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      grid.querySelectorAll(".time-slot").forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
      editChosen = editSlots[Number(btn.getAttribute("data-i"))];
    });
  });
}

document.getElementById("save-reschedule")?.addEventListener("click", async ()=>{
  if (!editChosen){ return; }
  try{
    await apiRescheduleBooking(CURRENT.id, TOKEN, editChosen.start.toISOString(), editChosen.end.toISOString());
    CURRENT.start_time = editChosen.start.toISOString();
    CURRENT.end_time = editChosen.end.toISOString();
    document.getElementById("edit-panel").classList.add("hidden");
    renderBooking(CURRENT);
  }catch(e){
    console.error(e);
    const msg = String(e.message||e);
    alert(msg.includes("23P01")||msg.toLowerCase().includes("exclu") ? t("error_double_book") : t("error_generic"));
  }
});

document.addEventListener("DOMContentLoaded", loadFromURL);

document.getElementById("reveal-details-btn")?.addEventListener("click", ()=>{
  document.getElementById("details-panel").classList.remove("hidden");
  document.getElementById("reveal-details-btn").classList.add("hidden");
});
