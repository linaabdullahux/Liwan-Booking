/* =========================================================
   i18n — Arabic (default) / English
   Language is carried via ?lang=ar|en on the URL so it
   survives page navigation without needing localStorage.
   ========================================================= */

const I18N = {
  ar: {
    site_name: "ليوان أرُب",
    nav_book: "احجز الآن",
    nav_admin_login: "الدخول كمشرف",
    nav_admin: "لوحة التحكم",

    hero_eyebrow: "قاعات اجتماعات ليوان أرُب",
    hero_title: "احجز قاعة اجتماعك في دقيقة",
    hero_lede: "اختر القاعة، حدد التاريخ والمدة، واحصل على تأكيد فوري بالبريد الإلكتروني.",
    hero_cta: "ابدأ الحجز",

    rooms_title: "قاعاتنا",
    room_meeting_name: "قاعة الاجتماعات التنفيذية",
    room_meeting_desc: "مساحة رسمية مجهزة للاجتماعات وجلسات العمل.",
    room_brainstorm_name: "قاعة العصف الذهني",
    room_brainstorm_desc: "بيئة مفتوحة ومرنة لجلسات الأفكار والتعاون.",
    room_select_cta: "احجز هذه القاعة",

    step_room: "القاعة",
    step_datetime: "الوقت",
    step_details: "بياناتك",
    step_confirm: "التأكيد",

    label_room: "اختر القاعة",
    label_date: "اختر التاريخ",
    label_duration: "مدة الحجز",
    label_time: "الوقت المتاح",
    label_company: "اسم الشركة",
    label_company_placeholder: "اختر اسم الشركة",
    label_email: "البريد الإلكتروني",
    label_notes: "ملاحظات (اختياري)",
    placeholder_notes: "أي تفاصيل إضافية عن الاجتماع…",
    label_guests: "دعوة ضيف",
    placeholder_guest_email: "البريد الإلكتروني للضيف",
    btn_add_guest: "إضافة",
    guests_hint: "سيصل للضيف إشعار بالبريد عند تأكيد الحجز.",
    slot_booked_by: "محجوز باسم",

    no_slots: "لا توجد أوقات متاحة في هذا اليوم لهذه المدة، جرّب تاريخًا آخر أو مدة أقصر.",
    pick_date_first: "اختر التاريخ والمدة أولًا لعرض الأوقات المتاحة.",

    btn_continue: "متابعة",
    btn_back: "رجوع",
    btn_confirm_booking: "تأكيد الحجز",
    btn_submitting: "جارِ التأكيد…",

    summary_title: "ملخص الحجز",
    summary_room: "القاعة",
    summary_date: "التاريخ",
    summary_time: "الوقت",
    summary_duration: "المدة",
    summary_company: "الشركة",
    summary_email: "البريد الإلكتروني",
    summary_guests: "الضيوف المدعوون",

    error_double_book: "عذرًا، هذا الوقت تم حجزه للتو من شخص آخر. يرجى اختيار وقت آخر.",
    error_generic: "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.",
    error_required: "يرجى تعبئة جميع الحقول المطلوبة.",
    error_invalid_email: "صيغة البريد الإلكتروني غير صحيحة.",
    error_min_notice: "لا يمكن الحجز إلا قبل الموعد بـ10 دقائق على الأقل.",
    error_max_notice: "لا يمكن الحجز لأكثر من أسبوع مقدمًا.",

    confirm_title: "تم تأكيد حجزك بنجاح",
    confirm_lede: "تم إرسال نسخة من الحجز إلى بريدك الإلكتروني.",
    confirm_view_details: "عرض تفاصيل الحجز",
    confirm_add_calendar: "إضافة إلى التقويم",
    confirm_edit: "تعديل الحجز",
    confirm_cancel: "إلغاء الحجز",
    confirm_new: "حجز جديد",
    cancel_confirm_q: "هل تريد تأكيد إلغاء هذا الحجز؟",
    cancel_yes: "نعم، ألغِ الحجز",
    cancel_no: "تراجع",
    booking_cancelled: "تم إلغاء الحجز.",
    booking_not_found: "لم نتمكن من العثور على هذا الحجز، يرجى التأكد من الرابط.",

    manage_title: "إدارة حجزك",
    manage_lede: "أدخل رقم الحجز، أو استخدم الرابط المرسل إليك بالبريد الإلكتروني.",
    label_booking_ref: "رقم الحجز",

    admin_login_title: "دخول لوحة التحكم",
    label_password: "كلمة المرور",
    btn_login: "دخول",
    login_error: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",

    admin_today: "حجوزات اليوم",
    admin_week: "حجوزات الأسبوع",
    admin_month: "حجوزات الشهر",
    admin_all: "كل الحجوزات",
    admin_rooms: "القاعات",
    admin_blocked: "الأوقات المغلقة",
    admin_search_ph: "ابحث باسم الشركة…",
    admin_filter_room: "كل القاعات",
    admin_filter_date: "التاريخ",
    admin_filter_company: "كل الشركات",
    admin_manage_companies: "إدارة الشركات",
    admin_add_company: "إضافة شركة",
    admin_new_company_ph: "اسم الشركة الجديدة",
    admin_col_time: "الوقت",
    admin_col_room: "القاعة",
    admin_col_customer: "الشركة",
    admin_col_email: "البريد",
    admin_col_status: "الحالة",
    admin_col_actions: "إجراءات",
    admin_cancel: "إلغاء",
    admin_edit: "تعديل",
    admin_close_slot: "إغلاق وقت",
    admin_open_slot: "فتح الوقت",
    admin_export: "تصدير CSV",
    admin_export_range: "تحديد مدة التصدير",
    admin_export_from: "من تاريخ",
    admin_export_to: "إلى تاريخ",
    admin_export_hint: "اتركي الحقلين فارغين لتصدير كل الحجوزات بدون تحديد مدة.",
    admin_logout: "تسجيل الخروج",
    admin_stat_today: "حجوزات اليوم",
    admin_stat_week: "حجوزات الأسبوع",
    admin_stat_rooms: "القاعات النشطة",
    admin_stat_hours: "ساعات محجوزة (أسبوعيًا)",
    status_confirmed: "مؤكد",
    status_cancelled: "ملغى",
    status_closed: "مغلق يدويًا",

    edit_booking_title: "تعديل الحجز",
    admin_edit_booking: "تعديل الحجز",
    edit_save: "حفظ التعديل",

    csv_col_date: "التاريخ",
    csv_col_time: "الوقت",
    csv_col_room: "القاعة",
    csv_col_customer: "اسم الشركة",
    csv_col_email: "البريد الإلكتروني",
    csv_col_status: "حالة الحجز",
    csv_col_notes: "ملاحظات الحجز",

    footer_rights: "جميع الحقوق محفوظة - ليوان أرُب {year} ©",
    footer_credit: "إنشاء وتطوير بواسطة لينا",
  },

  en: {
    site_name: "Liwan Arob",
    nav_book: "Book now",
    nav_admin_login: "Admin sign in",
    nav_admin: "Admin panel",

    hero_eyebrow: "Liwan Arob meeting rooms",
    hero_title: "Book your meeting room in a minute",
    hero_lede: "Pick a room, choose your date and duration, and get an instant email confirmation",
    hero_cta: "Start booking",

    rooms_title: "Our rooms",
    room_meeting_name: "Meeting Room",
    room_meeting_desc: "A formal space equipped for meetings and work sessions.",
    room_brainstorm_name: "Brainstorming Room",
    room_brainstorm_desc: "An open, flexible space for ideas and collaboration.",
    room_select_cta: "Book this room",

    step_room: "Room",
    step_datetime: "Time",
    step_details: "Your details",
    step_confirm: "Confirm",

    label_room: "Choose a room",
    label_date: "Choose a date",
    label_duration: "Booking duration",
    label_time: "Available time",
    label_company: "Company name",
    label_company_placeholder: "Select a company",
    label_email: "Email address",
    label_notes: "Notes (optional)",
    placeholder_notes: "Any extra details about the meeting…",
    label_guests: "Invite a guest",
    placeholder_guest_email: "Guest's email address",
    btn_add_guest: "Add",
    guests_hint: "The guest will get an email once the booking is confirmed.",
    slot_booked_by: "Booked by",

    no_slots: "No available times on this day for this duration — try another date or a shorter duration.",
    pick_date_first: "Choose a date and duration first to see available times.",

    btn_continue: "Continue",
    btn_back: "Back",
    btn_confirm_booking: "Confirm booking",
    btn_submitting: "Confirming…",

    summary_title: "Booking summary",
    summary_room: "Room",
    summary_date: "Date",
    summary_time: "Time",
    summary_duration: "Duration",
    summary_company: "Company",
    summary_email: "Email",
    summary_guests: "Invited guests",

    error_double_book: "Sorry, this time was just booked by someone else. Please pick another time.",
    error_generic: "Something went wrong. Please try again.",
    error_required: "Please fill in all required fields.",
    error_invalid_email: "That email address doesn't look right.",
    error_min_notice: "Bookings must be made at least 10 minutes in advance.",
    error_max_notice: "Bookings can't be made more than a week in advance.",

    confirm_title: "Booking confirmed successfully",
    confirm_lede: "A copy of your booking has been sent to your email.",
    confirm_view_details: "View booking details",
    confirm_add_calendar: "Add to calendar",
    confirm_edit: "Edit booking",
    confirm_cancel: "Cancel booking",
    confirm_new: "Make another booking",
    cancel_confirm_q: "Are you sure you want to cancel this booking?",
    cancel_yes: "Yes, cancel it",
    cancel_no: "Never mind",
    booking_cancelled: "Booking cancelled.",
    booking_not_found: "We couldn't find that booking. Please check the link.",

    manage_title: "Manage your booking",
    manage_lede: "Enter your booking reference, or use the link from your confirmation email.",
    label_booking_ref: "Booking reference",

    admin_login_title: "Admin sign in",
    label_password: "Password",
    btn_login: "Sign in",
    login_error: "Incorrect email or password.",

    admin_today: "Today's bookings",
    admin_week: "This week",
    admin_month: "This month",
    admin_all: "All bookings",
    admin_rooms: "Rooms",
    admin_blocked: "Blocked times",
    admin_search_ph: "Search by company name…",
    admin_filter_room: "All rooms",
    admin_filter_date: "Date",
    admin_filter_company: "All companies",
    admin_manage_companies: "Manage companies",
    admin_add_company: "Add company",
    admin_new_company_ph: "New company name",
    admin_col_time: "Time",
    admin_col_room: "Room",
    admin_col_customer: "Company",
    admin_col_email: "Email",
    admin_col_status: "Status",
    admin_col_actions: "Actions",
    admin_cancel: "Cancel",
    admin_edit: "Edit",
    admin_close_slot: "Close slot",
    admin_open_slot: "Reopen slot",
    admin_export: "Export CSV",
    admin_export_range: "Set export range",
    admin_export_from: "From date",
    admin_export_to: "To date",
    admin_export_hint: "Leave both fields empty to export all bookings with no date limit.",
    admin_logout: "Sign out",
    admin_stat_today: "Today's bookings",
    admin_stat_week: "This week's bookings",
    admin_stat_rooms: "Active rooms",
    admin_stat_hours: "Hours booked (this week)",
    status_confirmed: "Confirmed",
    status_cancelled: "Cancelled",
    status_closed: "Manually closed",

    edit_booking_title: "Edit booking",
    admin_edit_booking: "Edit booking",
    edit_save: "Save changes",

    csv_col_date: "Date",
    csv_col_time: "Time",
    csv_col_room: "Room",
    csv_col_customer: "Company name",
    csv_col_email: "Email",
    csv_col_status: "Booking status",
    csv_col_notes: "Booking notes",

    footer_rights: "All rights reserved - Liwan Arob {year} ©",
    footer_credit: "Built by Lina",
  }
};

function getLang(){
  const p = new URLSearchParams(location.search);
  const l = p.get("lang");
  return (l === "en") ? "en" : "ar";
}

function t(key){
  const lang = getLang();
  const raw = (I18N[lang] && I18N[lang][key]) || (I18N.ar[key]) || key;
  return raw.replace("{year}", new Date().getFullYear());
}

function withLang(url){
  const lang = getLang();
  const [path, hash] = url.split("#");
  const u = new URL(path, location.href);
  u.searchParams.set("lang", lang);
  return u.pathname + u.search + (hash ? "#"+hash : "");
}

function applyI18n(){
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === "en") ? "ltr" : "rtl";

  document.querySelectorAll("[data-i18n]").forEach(el=>{
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });

  // rewrite internal links / lang switcher to preserve navigation target
  document.querySelectorAll("a[data-href]").forEach(a=>{
    a.setAttribute("href", withLang(a.getAttribute("data-href")));
  });
  document.querySelectorAll(".lang-toggle a").forEach(a=>{
    const target = a.getAttribute("data-lang");
    a.classList.toggle("active", target === lang);
    const u = new URL(location.href);
    u.searchParams.set("lang", target);
    a.setAttribute("href", u.pathname + u.search + location.hash);
  });

  const titleKey = document.body.getAttribute("data-title-key");
  if (titleKey) document.title = t(titleKey) + " — " + t("site_name");
}

document.addEventListener("DOMContentLoaded", applyI18n);
