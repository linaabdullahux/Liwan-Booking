let allRooms = [];
let allCompanies = [];
let currentFilter = "today";
const TZ = "Asia/Riyadh"; // the business's fixed timezone — always display in this zone, regardless of the viewer's device settings

function isoRangeFor(filter){
  const now = new Date();
  if (filter === "today"){
    const start = new Date(now); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate()+1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (filter === "week"){
    const start = new Date(now); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate()+7);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (filter === "month"){
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return {}; // all
}

async function guardAuth(){
  const session = await apiAdminSession();
  if (!session){
    location.href = "login.html?lang=" + getLang();
    return false;
  }
  return true;
}

async function loadFilters(){
  try{ allRooms = await apiGetRooms(); }catch(e){ allRooms = []; }
  try{ allCompanies = await apiGetCompanies(); }catch(e){ allCompanies = []; }

  const roomFilter = document.getElementById("room-filter");
  const blockRoom = document.getElementById("block-room");
  const roomOpts = allRooms.map(r => `<option value="${r.id}">${getLang()==="en"?r.name_en:r.name_ar}</option>`).join("");
  roomFilter.innerHTML = `<option value="">${t('admin_filter_room')}</option>` + roomOpts;
  blockRoom.innerHTML = roomOpts;

  const companyFilter = document.getElementById("company-filter");
  const companyOpts = allCompanies.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  companyFilter.innerHTML = `<option value="">${t('admin_filter_company')}</option>` + companyOpts;
  document.getElementById("edit-booking-company").innerHTML = companyOpts;
}

function statusBadge(status){
  if (status === "confirmed") return `<span class="badge badge-confirmed">${t('status_confirmed')}</span>`;
  if (status === "cancelled") return `<span class="badge badge-cancelled">${t('status_cancelled')}</span>`;
  return `<span class="badge badge-closed">${t('status_closed')}</span>`;
}

let currentRows = [];

async function refreshTable(){
  const { from, to } = isoRangeFor(currentFilter);
  const roomId = document.getElementById("room-filter").value || undefined;
  const companyId = document.getElementById("company-filter").value || undefined;
  const search = document.getElementById("search-input").value.trim() || undefined;
  const dateFilterVal = document.getElementById("date-filter").value;

  let params = { roomId, companyId, search };
  if (dateFilterVal){
    const d = new Date(dateFilterVal); d.setHours(0,0,0,0);
    const d2 = new Date(d); d2.setDate(d2.getDate()+1);
    params.from = d.toISOString(); params.to = d2.toISOString();
  } else {
    params.from = from; params.to = to;
  }

  let rows = [];
  try{ rows = await apiAdminGetBookings(params); }catch(e){ console.error(e); }
  currentRows = rows;

  const tbody = document.getElementById("bookings-tbody");
  const locale = getLang()==="en" ? "en-US":"ar-SA";
  tbody.innerHTML = rows.map(b=>{
    const start = new Date(b.start_time), end = new Date(b.end_time);
    const roomName = b.rooms ? (getLang()==="en"?b.rooms.name_en:b.rooms.name_ar) : "";
    const timeLabel = `${start.toLocaleDateString(locale,{month:'short',day:'numeric',timeZone:TZ})} · ${start.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})}–${end.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:TZ})}`;
    let actions = "";
    if (b.status === "confirmed"){
      actions = `<button class="btn btn-outline btn-sm" data-edit="${b.id}">${t('admin_edit')}</button>
                 <button class="btn btn-danger btn-sm" data-cancel="${b.id}">${t('admin_cancel')}</button>`;
    } else if (b.status === "blocked"){
      actions = `<button class="btn btn-outline btn-sm" data-reopen="${b.id}">${t('admin_open_slot')}</button>`;
    }
    return `<tr class="${b.status==='cancelled'?'row-cancelled':''}">
      <td>${timeLabel}</td>
      <td>${roomName}</td>
      <td>${b.customer_name||''}</td>
      <td>${b.customer_email||''}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${actions}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft);">—</td></tr>`;

  tbody.querySelectorAll("[data-cancel]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if (!confirm(t("cancel_confirm_q"))) return;
      await apiAdminCancelBooking(btn.getAttribute("data-cancel"));
      refreshTable(); refreshStats();
    });
  });
  tbody.querySelectorAll("[data-reopen]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await apiAdminReopenSlot(btn.getAttribute("data-reopen"));
      refreshTable();
    });
  });
  tbody.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=> openEditModal(btn.getAttribute("data-edit")));
  });
}

async function refreshStats(){
  try{
    const today = isoRangeFor("today");
    const week = isoRangeFor("week");
    const [todayRows, weekRows] = await Promise.all([
      apiAdminGetBookings({ from: today.from, to: today.to }),
      apiAdminGetBookings({ from: week.from, to: week.to }),
    ]);
    const confirmedToday = todayRows.filter(b=>b.status==="confirmed");
    const confirmedWeek = weekRows.filter(b=>b.status==="confirmed");
    const hours = confirmedWeek.reduce((sum,b)=> sum + (new Date(b.end_time)-new Date(b.start_time))/3600000, 0);
    document.getElementById("stat-today").textContent = confirmedToday.length;
    document.getElementById("stat-week").textContent = confirmedWeek.length;
    document.getElementById("stat-rooms").textContent = allRooms.length;
    document.getElementById("stat-hours").textContent = Math.round(hours);
  }catch(e){ console.error(e); }
}

document.querySelectorAll(".admin-nav a[data-filter]").forEach(a=>{
  a.addEventListener("click", (e)=>{
    e.preventDefault();
    currentFilter = a.getAttribute("data-filter");
    document.querySelectorAll(".admin-nav a").forEach(x=>x.classList.remove("active"));
    a.classList.add("active");
    document.getElementById("date-filter").value = "";
    document.getElementById("view-title").textContent = a.textContent;
    refreshTable();
  });
});
document.getElementById("search-input").addEventListener("input", ()=>refreshTable());
document.getElementById("room-filter").addEventListener("change", ()=>refreshTable());
document.getElementById("company-filter").addEventListener("change", ()=>refreshTable());
document.getElementById("date-filter").addEventListener("change", ()=>refreshTable());

document.getElementById("logout-btn").addEventListener("click", async ()=>{
  await apiAdminLogout();
  location.href = "login.html?lang=" + getLang();
});

/* ---------- add-company modal ---------- */
document.getElementById("add-company-btn").addEventListener("click", ()=>{
  document.getElementById("new-company-name").value = "";
  document.getElementById("company-modal").classList.remove("hidden");
});
document.getElementById("company-cancel").addEventListener("click", ()=>{
  document.getElementById("company-modal").classList.add("hidden");
});
document.getElementById("company-save").addEventListener("click", async ()=>{
  const name = document.getElementById("new-company-name").value.trim();
  if (!name) return;
  try{
    await apiAdminAddCompany(name);
    document.getElementById("company-modal").classList.add("hidden");
    await loadFilters(); // the new company is now available everywhere, including the public booking dropdown
  }catch(e){
    alert(t("error_generic") + " (" + (e.message||e) + ")");
  }
});

/* ---------- edit-booking modal ---------- */
function openEditModal(bookingId){
  const b = currentRows.find(r => r.id === bookingId);
  if (!b) return;
  const start = new Date(b.start_time), end = new Date(b.end_time);
  const toLocalDate = d => {
    // Render the Riyadh wall-clock date/time into the <input> fields,
    // regardless of the admin's own device timezone.
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
    return parts;
  };
  const toLocalTime = d => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour:"2-digit", minute:"2-digit", hour12:false }).format(d);

  document.getElementById("edit-booking-modal").setAttribute("data-booking-id", bookingId);
  document.getElementById("edit-booking-company").value = b.company_id || "";
  document.getElementById("edit-booking-date").value = toLocalDate(start);
  document.getElementById("edit-booking-start").value = toLocalTime(start);
  document.getElementById("edit-booking-end").value = toLocalTime(end);
  document.getElementById("edit-booking-modal").classList.remove("hidden");
}
document.getElementById("edit-booking-cancel").addEventListener("click", ()=>{
  document.getElementById("edit-booking-modal").classList.add("hidden");
});
document.getElementById("edit-booking-save").addEventListener("click", async ()=>{
  const modal = document.getElementById("edit-booking-modal");
  const bookingId = modal.getAttribute("data-booking-id");
  const companyId = document.getElementById("edit-booking-company").value;
  const date = document.getElementById("edit-booking-date").value;
  const startT = document.getElementById("edit-booking-start").value;
  const endT = document.getElementById("edit-booking-end").value;
  if (!date || !startT || !endT) return;
  try{
    await apiAdminUpdateBooking(
      bookingId,
      new Date(`${date}T${startT}:00+03:00`).toISOString(),
      new Date(`${date}T${endT}:00+03:00`).toISOString(),
      companyId || null
    );
    modal.classList.add("hidden");
    refreshTable();
  }catch(e){
    const msg = String(e.message||e);
    alert((msg.includes("23P01") || msg.toLowerCase().includes("exclu")) ? t("error_double_book") : t("error_generic") + " (" + msg + ")");
  }
});

/* ---------- block slot modal ---------- */
document.getElementById("block-slot-btn").addEventListener("click", ()=>{
  document.getElementById("block-modal").classList.remove("hidden");
});
document.getElementById("block-cancel").addEventListener("click", ()=>{
  document.getElementById("block-modal").classList.add("hidden");
});
document.getElementById("block-save").addEventListener("click", async ()=>{
  const roomId = document.getElementById("block-room").value;
  const date = document.getElementById("block-date").value;
  const startT = document.getElementById("block-start").value;
  const endT = document.getElementById("block-end").value;
  if (!roomId || !date || !startT || !endT) return;
  try{
    await apiAdminBlockSlot({
      roomId,
      start: new Date(`${date}T${startT}:00+03:00`).toISOString(),
      end: new Date(`${date}T${endT}:00+03:00`).toISOString(),
    });
    document.getElementById("block-modal").classList.add("hidden");
    refreshTable();
  }catch(e){
    alert(t("error_generic") + " (" + (e.message||e) + ")");
  }
});

/* ---------- export ---------- */
document.getElementById("export-toggle-btn").addEventListener("click", ()=>{
  document.getElementById("export-range-box").classList.toggle("hidden");
});

document.getElementById("export-btn").addEventListener("click", async ()=>{
  try{
    const fromVal = document.getElementById("export-from").value;
    const toVal = document.getElementById("export-to").value;
    const from = fromVal ? new Date(`${fromVal}T00:00:00+03:00`).toISOString() : undefined;
    const to = toVal ? new Date(`${toVal}T23:59:59+03:00`).toISOString() : undefined; // include the whole "to" day

    const rows = await apiAdminExportCSV({ from, to });
    const locale = getLang()==="en" ? "en-US" : "ar-SA";

    // Columns in the exact order requested: room, date, time, company
    // name, email, status — plus the booking's own notes as a bonus.
    const columns = [
      { key: "room",      label: t("csv_col_room") },
      { key: "date",      label: t("csv_col_date") },
      { key: "time",      label: t("csv_col_time") },
      { key: "customer",  label: t("csv_col_customer") },
      { key: "email",     label: t("csv_col_email") },
      { key: "status",    label: t("csv_col_status") },
      { key: "notes",     label: t("csv_col_notes") },
    ];

    const clean = s => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim();

    const csvRows = rows.map(r => {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      const dateStr = start.toLocaleDateString(locale, { year:"numeric", month:"2-digit", day:"2-digit", timeZone: TZ });
      const startStr = start.toLocaleTimeString(locale, { hour:"2-digit", minute:"2-digit", timeZone: TZ });
      const endStr = end.toLocaleTimeString(locale, { hour:"2-digit", minute:"2-digit", timeZone: TZ });
      return {
        room: getLang()==="en" ? r.room_en : r.room_ar,
        date: dateStr,
        time: `${startStr}–${endStr}`,
        customer: clean(r.company_name),
        email: clean(r.customer_email),
        status: clean(r.status_ar || r.status_raw),
        notes: clean(r.notes),
      };
    });

    // Excel's comma-CSV parsing depends on the OS's regional settings
    // (many Arabic-locale Windows machines use semicolons, which is what
    // was scrambling the columns before). UTF-16LE + tabs sidesteps that
    // entirely — Excel recognizes this format correctly on every
    // machine, in every region, without any manual import step, in
    // Arabic or English alike.
    const headerLine = columns.map(c => c.label).join("\t");
    const dataLines = csvRows.map(row => columns.map(c => row[c.key]).join("\t"));
    const text = [headerLine, ...dataLines].join("\r\n");

    const buf = new ArrayBuffer(2 + text.length * 2);
    const view = new DataView(buf);
    view.setUint16(0, 0xFEFF, true); // BOM, little-endian
    for (let i = 0; i < text.length; i++) view.setUint16(2 + i*2, text.charCodeAt(i), true);
    const blob = new Blob([buf], { type: "text/tab-separated-values;charset=utf-16le;" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leewan-bookings-${new Date().toISOString().slice(0,10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert(t("error_generic"));
  }
});

document.addEventListener("DOMContentLoaded", async ()=>{
  const ok = await guardAuth();
  if (!ok) return;
  await loadFilters();
  await refreshTable();
  await refreshStats();
});
