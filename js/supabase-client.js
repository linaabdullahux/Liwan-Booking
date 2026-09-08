/* =========================================================
   Supabase configuration
   Fill these two values in after creating your Supabase
   project (Project Settings → API). The anon/public key is
   safe to expose in front-end code — it has no power beyond
   what Row Level Security and the RPC functions allow.
   ========================================================= */
const SUPABASE_URL = "https://pvaexipdewgwowhhbmmo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLY9TWRULnkd3rKRkmA5PQ_hCvlfP-y";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- public booking API ---------- */

async function apiGetRooms(){
  const { data, error } = await sb.from("rooms").select("*").eq("active", true).order("created_at");
  if (error) throw error;
  return data;
}

async function apiGetCompanies(){
  const { data, error } = await sb.from("companies").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data;
}

async function apiGetBusyRanges(roomId, dateStr){
  const { data, error } = await sb.rpc("get_busy_ranges", { p_room_id: roomId, p_day: dateStr });
  if (error) throw error;
  return data;
}

async function apiCreateBooking({ roomId, start, end, companyId, email, notes, guestEmails }){
  const { data, error } = await sb.rpc("create_booking", {
    p_room_id: roomId,
    p_start: start,
    p_end: end,
    p_company_id: companyId,
    p_email: email,
    p_notes: notes || null,
    p_guest_emails: guestEmails && guestEmails.length ? guestEmails : null,
  });
  if (error) throw error;
  return data && data[0];
}

async function apiGetBookingByToken(id, token){
  const { data, error } = await sb.rpc("get_booking_by_token", { p_id: id, p_token: token });
  if (error) throw error;
  return data && data[0];
}

async function apiCancelBooking(id, token){
  const { data, error } = await sb.rpc("cancel_booking", { p_id: id, p_token: token });
  if (error) throw error;
  return data;
}

async function apiRescheduleBooking(id, token, start, end){
  const { data, error } = await sb.rpc("reschedule_booking", { p_id: id, p_token: token, p_start: start, p_end: end });
  if (error) throw error;
  return data;
}

/* ---------- admin API (requires signed-in admin user) ---------- */

async function apiAdminLogin(email, password){
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function apiAdminLogout(){
  await sb.auth.signOut();
}

async function apiAdminSession(){
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function apiAdminGetBookings({ from, to, roomId, companyId, search } = {}){
  let q = sb.from("bookings")
    .select("id, start_time, end_time, status, customer_name, customer_email, notes, company_id, room_id, rooms(name_ar,name_en)")
    .order("start_time", { ascending: true });
  if (from) q = q.gte("start_time", from);
  if (to) q = q.lte("start_time", to);
  if (roomId) q = q.eq("room_id", roomId);
  if (companyId) q = q.eq("company_id", companyId);
  if (search) q = q.ilike("customer_name", `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function apiAdminCancelBooking(id){
  const { error } = await sb.from("bookings").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

async function apiAdminUpdateBooking(id, start, end, companyId){
  const { data, error } = await sb.rpc("admin_update_booking", {
    p_id: id, p_start: start, p_end: end, p_company_id: companyId || null,
  });
  if (error) throw error;
  return data;
}

async function apiAdminAddCompany(name){
  const { data, error } = await sb.from("companies").insert({ name: name.trim() }).select().single();
  if (error) throw error;
  return data;
}

async function apiAdminBlockSlot({ roomId, start, end }){
  const { error } = await sb.from("bookings").insert({
    room_id: roomId, start_time: start, end_time: end, status: "blocked", customer_name: "مغلق يدويًا",
  });
  if (error) throw error;
}

async function apiAdminReopenSlot(id){
  const { error } = await sb.from("bookings").update({ status: "cancelled" }).eq("id", id).eq("status", "blocked");
  if (error) throw error;
}

async function apiAdminExportCSV({ from, to } = {}){
  let q = sb.from("bookings_export").select("*");
  if (from) q = q.gte("start_time", from);
  if (to) q = q.lte("start_time", to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
