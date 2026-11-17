"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "en" | "id";
export const LANGS: { code: Lang; label: string }[] = [{ code: "en", label: "English" }, { code: "id", label: "Bahasa Indonesia" }];

/* English is the source of truth. `{name}` placeholders are filled by t(key, {name}); **x** renders bold via <Rich>. */
const en = {
  "gate.title": "Inbox",
  "gate.setupTitle": "Create the admin account",
  "gate.setupIntro": "First run. You'll be the admin and can add accounts for family from inside the app.",
  "gate.signInIntro": "Sign in to continue.",
  "gate.choosePw": "Choose a password (8+ characters)",
  "gate.setupKey": "Setup key",
  "gate.setupKeyPh": "APP_PASSWORD from the server settings",
  "gate.createAdmin": "Create admin",
  "gate.signIn": "Sign in",
  "field.username": "Username",
  "field.password": "Password",
  "field.language": "Language",

  "login.title": "Sign in to {label}",
  "login.phoneIntro": "Enter the phone number of the Telegram account, with country code.",
  "login.codeTitle": "Enter the code",
  "login.codeIntro": "Telegram sent a login code to your other signed-in app (or by SMS).",
  "login.pwTitle": "Two-step password",
  "login.pwIntro": "This account has a cloud password set.",
  "login.phone": "Phone number",
  "login.code": "Login code",
  "login.sendCode": "Send code",
  "login.using": "Using api_id {id}.",
  "login.change": "Change credentials",
  "login.done": "Signed in to {label}",

  "btn.back": "Back", "btn.continue": "Continue", "btn.cancel": "Cancel", "btn.save": "Save", "btn.close": "Close",
  "btn.signOut": "Sign out", "btn.show": "Show", "btn.hide": "Hide", "btn.pause": "Pause", "btn.resume": "Resume",

  "acc.add": "Add account", "acc.settings": "Account settings",
  "acc.editIntro": "Swap the API keys or rename this account. New keys sign the account out.",
  "acc.addIntro": "Each account has its own API keys and session.",
  "acc.name": "Name", "acc.namePh": "Personal, Work…", "acc.hashKeep": "Leave blank to keep current",
  "acc.remove": "Remove account",
  "acc.removeConfirm": "Remove “{label}” from this app? Its stored session is deleted, but messages already saved in your archive are kept. Your Telegram account is not affected.",
  "acc.getKeys": "Get the keys at",
  "acc.added": "Account “{label}” added",
  "acc.saved": "Account saved",
  "acc.removed": "Account removed",
  "acc.signedOut": "Signed out of Telegram",

  "pw.title": "Change password",
  "pw.intro": "Other browsers where you're signed in will be signed out.",
  "pw.current": "Current password",
  "pw.new": "New password (8+ characters)",
  "pw.changed": "Password changed",

  "users.title": "People",
  "users.intro": "Everyone signs in with their own username and sees only their own Telegram accounts. Not even you can open theirs from inside the app.",
  "users.admin": "admin",
  "users.accounts": "{n} Telegram accounts",
  "users.accounts1": "1 Telegram account",
  "users.reset": "Reset password",
  "users.remove": "Remove",
  "users.newName": "New username",
  "users.pwPh": "8+ characters",
  "users.add": "Add person",
  "users.created": "Created “{name}”. Share the username and password with them.",
  "users.resetPrompt": "New password for {name} (8+ characters). They will be signed out everywhere.",
  "users.resetDone": "Password for {name} changed",
  "users.removeConfirm": "Remove “{name}”?\n\nThis deletes their Telegram accounts from this app AND their archived messages. It cannot be undone. Their real Telegram accounts are not affected.",
  "users.removed": "{name} removed",

  "menu.addAccount": "Add account",
  "menu.signedInAs": "Signed in as {name}",
  "menu.adminSuffix": " (admin)",
  "menu.people": "People",
  "menu.changePassword": "Change password",
  "menu.signOut": "Sign out",
  "menu.signedIn": "Signed in",
  "menu.notSignedIn": "Not signed in",
  "out.title": "Sign out?",
  "out.body": "You'll need your username and password to get back in. Your Telegram accounts stay connected, and the daily background job keeps archiving.",
  "out.done": "Signed out",

  "list.inbox": "Inbox",
  "list.searchChats": "Search chats",
  "list.notSignedIn": "Not signed in yet.",
  "list.loadFail": "Could not load chats.",
  "list.noMatch": "No chats match.",
  "list.none": "No chats yet.",
  "list.you": "You: ",
  "filter.all": "All", "filter.unread": "Unread", "filter.user": "People", "filter.group": "Groups", "filter.channel": "Channels", "filter.archived": "Archived",
  "list.noArchived": "No archived chats.",
  "main.connectTitle": "Connect a Telegram account",
  "main.connectIntro": "Add your API credentials, then sign in with your phone number. Credentials and sessions are stored encrypted.",
  "main.getKeysPre": "Get an **api_id** and **api_hash** at",
  "main.pick": "Pick a chat to start reading",

  "auto.saving": "Saving chats to your archive",
  "auto.progress": "{done} of {total}",
  "auto.skipped": " · {n} skipped",
  "auto.paused": " · paused",
  "auto.finished": "All chats saved to your archive",
  "auto.upToDate": "Archive is up to date",

  "chat.private": "Private chat", "chat.bot": "Bot", "chat.group": "Group", "chat.channel": "Channel",
  "chat.search": "Search in chat",
  "chat.back": "Back",
  "chat.saveBtn": "Save this chat's entire history to your archive",
  "chat.saveBtnKept": "Save this chat's entire history to your archive ({n} deleted messages kept so far)",
  "chat.loadFail": "Could not load messages.",
  "chat.loading": "Loading…",
  "chat.nothing": "Nothing found.",
  "chat.empty": "No messages.",
  "chat.older": "Load earlier messages",
  "chat.readonly": "Read-only · opening a chat here won’t mark messages as read in Telegram",
  "chat.saving": "Saving…",
  "chat.savingN": "Saving… {n}",
  "chat.savedN": "Saved {n} messages from “{name}”",
  "chat.saveFail": "Saving failed: {msg}",
  "msg.deleted": "Deleted message",
  "msg.deletedFrom": "Deleted message from {name}",
  "msg.deletedTag": "Deleted",
  "msg.edited": "edited",
  "msg.editedVersions": "Edited · {n} earlier versions",
  "msg.editedVersion1": "Edited · 1 earlier version",
  "msg.unknown": "Unknown",
  "msg.media": "Media",
  "media.photo": "Photo", "media.video": "Video", "media.voice": "Voice message", "media.sticker": "Sticker",
  "media.audio": "Audio", "media.file": "File", "media.location": "Location", "media.poll": "Poll", "media.contact": "Contact", "media.other": "Message",

  "save.title": "Save this chat to your archive?",
  "save.confirm": "Save history",
  "save.intro": "The app already saves the newest 3,000 messages of every chat automatically. This button saves **the entire history** of “{name}”: every message, however old, copied into your private archive database.",
  "save.b1": "If someone deletes a message later, it stays in the chat as “Deleted message” and you can click **Show** to read it.",
  "save.b2": "Big chats can take a few minutes. Keep this tab open until it says “Saved”.",
  "save.b3": "It does **not** mark anything as read and changes nothing on Telegram.",
  "save.b4": "Safe to run again: it only adds new messages and flags ones that disappeared.",

  "date.today": "Today", "date.yesterday": "Yesterday",

  "pins.title": "Pinned messages",
  "pins.intro": "Saved in this app only. Pinning never changes anything on Telegram.",
  "pins.none": "Nothing pinned yet. Hover a message and press the pin to keep it here.",
  "pins.pin": "Pin this message",
  "pins.unpin": "Unpin",
  "pins.open": "Go to message",
  "chat.pinChat": "Pin this conversation to the top of the list",
  "chat.pinShort": "Pin chat",
  "chat.pinnedShort": "Pinned",
  "chat.pinTitle": "Pin this conversation?",
  "chat.pinBody": "“{name}” will stay at the top of your chat list. This is saved only in this app; nothing changes on Telegram.",
  "chat.pinConfirm": "Pin conversation",
  "chat.unpinTitle": "Unpin this conversation?",
  "chat.unpinBody": "“{name}” goes back to its normal place in the list.",
  "chat.unpinConfirm": "Unpin",
  "chat.unpinChat": "Unpin this conversation",
  "chat.pinnedToast": "Conversation pinned",
  "chat.unpinnedToast": "Conversation unpinned",
  "chat.pinFail": "Could not change the pin: {msg}",
  "chat.backLatest": "Back to the latest messages",
  "list.pinned": "Pinned",
  "pins.pinned": "Message pinned",
  "pins.unpinned": "Pin removed",
  "pins.fail": "Could not pin: {msg}",
  "pins.deletedNote": "Deleted on Telegram, kept here",
  "pins.inChat": "Pinned messages in this chat",

  "settings.title": "Settings",
  "settings.password": "Password",
  "settings.passwordHint": "Change the password you use to sign in to this app.",
  "settings.change": "Change",
  "settings.people": "People",
  "settings.peopleHint": "Add family members and manage who can sign in. Each person only sees their own Telegram accounts.",
  "settings.manage": "Manage",
} as const;

export type Key = keyof typeof en;

const id: Record<Key, string> = {
  "gate.title": "Kotak masuk",
  "gate.setupTitle": "Buat akun admin",
  "gate.setupIntro": "Pertama kali dipakai. Kamu akan jadi admin dan bisa menambah akun untuk keluarga dari dalam aplikasi.",
  "gate.signInIntro": "Masuk untuk melanjutkan.",
  "gate.choosePw": "Buat kata sandi (min. 8 karakter)",
  "gate.setupKey": "Kunci setup",
  "gate.setupKeyPh": "APP_PASSWORD dari pengaturan server",
  "gate.createAdmin": "Buat admin",
  "gate.signIn": "Masuk",
  "field.username": "Nama pengguna",
  "field.password": "Kata sandi",
  "field.language": "Bahasa",

  "login.title": "Masuk ke {label}",
  "login.phoneIntro": "Masukkan nomor telepon akun Telegram, lengkap dengan kode negara.",
  "login.codeTitle": "Masukkan kode",
  "login.codeIntro": "Telegram mengirim kode masuk ke aplikasi Telegram lain yang sedang login (atau lewat SMS).",
  "login.pwTitle": "Kata sandi dua langkah",
  "login.pwIntro": "Akun ini memakai kata sandi cloud.",
  "login.phone": "Nomor telepon",
  "login.code": "Kode masuk",
  "login.sendCode": "Kirim kode",
  "login.using": "Memakai api_id {id}.",
  "login.change": "Ubah kredensial",
  "login.done": "Berhasil masuk ke {label}",

  "btn.back": "Kembali", "btn.continue": "Lanjut", "btn.cancel": "Batal", "btn.save": "Simpan", "btn.close": "Tutup",
  "btn.signOut": "Keluar", "btn.show": "Tampilkan", "btn.hide": "Sembunyikan", "btn.pause": "Jeda", "btn.resume": "Lanjutkan",

  "acc.add": "Tambah akun", "acc.settings": "Pengaturan akun",
  "acc.editIntro": "Ganti API key atau ubah nama akun ini. Key baru akan mengeluarkan akun ini dari Telegram.",
  "acc.addIntro": "Setiap akun punya API key dan sesi sendiri.",
  "acc.name": "Nama", "acc.namePh": "Pribadi, Kerja…", "acc.hashKeep": "Kosongkan untuk tetap memakai yang lama",
  "acc.remove": "Hapus akun",
  "acc.removeConfirm": "Hapus “{label}” dari aplikasi ini? Sesi tersimpannya dihapus, tetapi pesan yang sudah tersimpan di arsip tetap ada. Akun Telegram aslimu tidak terpengaruh.",
  "acc.getKeys": "Dapatkan key di",
  "acc.added": "Akun “{label}” ditambahkan",
  "acc.saved": "Akun disimpan",
  "acc.removed": "Akun dihapus",
  "acc.signedOut": "Keluar dari Telegram",

  "pw.title": "Ganti kata sandi",
  "pw.intro": "Browser lain tempat kamu masuk akan otomatis keluar.",
  "pw.current": "Kata sandi saat ini",
  "pw.new": "Kata sandi baru (min. 8 karakter)",
  "pw.changed": "Kata sandi diganti",

  "users.title": "Anggota",
  "users.intro": "Setiap orang masuk dengan nama pengguna sendiri dan hanya melihat akun Telegram miliknya. Bahkan kamu tidak bisa membuka akun mereka dari dalam aplikasi.",
  "users.admin": "admin",
  "users.accounts": "{n} akun Telegram",
  "users.accounts1": "1 akun Telegram",
  "users.reset": "Reset kata sandi",
  "users.remove": "Hapus",
  "users.newName": "Nama pengguna baru",
  "users.pwPh": "min. 8 karakter",
  "users.add": "Tambah anggota",
  "users.created": "“{name}” dibuat. Bagikan nama pengguna dan kata sandinya kepada mereka.",
  "users.resetPrompt": "Kata sandi baru untuk {name} (min. 8 karakter). Mereka akan keluar dari semua perangkat.",
  "users.resetDone": "Kata sandi {name} diganti",
  "users.removeConfirm": "Hapus “{name}”?\n\nIni menghapus akun Telegram mereka dari aplikasi ini DAN pesan arsipnya. Tidak bisa dibatalkan. Akun Telegram asli mereka tidak terpengaruh.",
  "users.removed": "{name} dihapus",

  "menu.addAccount": "Tambah akun",
  "menu.signedInAs": "Masuk sebagai {name}",
  "menu.adminSuffix": " (admin)",
  "menu.people": "Anggota",
  "menu.changePassword": "Ganti kata sandi",
  "menu.signOut": "Keluar",
  "menu.signedIn": "Sudah masuk",
  "menu.notSignedIn": "Belum masuk",
  "out.title": "Keluar?",
  "out.body": "Kamu perlu nama pengguna dan kata sandi untuk masuk lagi. Akun Telegrammu tetap terhubung, dan tugas harian di latar belakang tetap mengarsipkan.",
  "out.done": "Berhasil keluar",

  "list.inbox": "Kotak masuk",
  "list.searchChats": "Cari obrolan",
  "list.notSignedIn": "Belum masuk.",
  "list.loadFail": "Gagal memuat obrolan.",
  "list.noMatch": "Tidak ada obrolan yang cocok.",
  "list.none": "Belum ada obrolan.",
  "list.you": "Kamu: ",
  "filter.all": "Semua", "filter.unread": "Belum dibaca", "filter.user": "Orang", "filter.group": "Grup", "filter.channel": "Kanal", "filter.archived": "Diarsipkan",
  "list.noArchived": "Tidak ada obrolan yang diarsipkan.",
  "main.connectTitle": "Hubungkan akun Telegram",
  "main.connectIntro": "Tambahkan kredensial API, lalu masuk dengan nomor teleponmu. Kredensial dan sesi disimpan terenkripsi.",
  "main.getKeysPre": "Dapatkan **api_id** dan **api_hash** di",
  "main.pick": "Pilih obrolan untuk mulai membaca",

  "auto.saving": "Menyimpan obrolan ke arsip",
  "auto.progress": "{done} dari {total}",
  "auto.skipped": " · {n} dilewati",
  "auto.paused": " · dijeda",
  "auto.finished": "Semua obrolan tersimpan di arsip",
  "auto.upToDate": "Arsip sudah terbaru",

  "chat.private": "Obrolan pribadi", "chat.bot": "Bot", "chat.group": "Grup", "chat.channel": "Kanal",
  "chat.search": "Cari di obrolan",
  "chat.back": "Kembali",
  "chat.saveBtn": "Simpan seluruh riwayat obrolan ini ke arsip",
  "chat.saveBtnKept": "Simpan seluruh riwayat obrolan ini ke arsip ({n} pesan terhapus sudah tersimpan)",
  "chat.loadFail": "Gagal memuat pesan.",
  "chat.loading": "Memuat…",
  "chat.nothing": "Tidak ditemukan.",
  "chat.empty": "Belum ada pesan.",
  "chat.older": "Muat pesan sebelumnya",
  "chat.readonly": "Hanya baca · membuka obrolan di sini tidak menandai pesan sebagai dibaca di Telegram",
  "chat.saving": "Menyimpan…",
  "chat.savingN": "Menyimpan… {n}",
  "chat.savedN": "{n} pesan dari “{name}” tersimpan",
  "chat.saveFail": "Gagal menyimpan: {msg}",
  "msg.deleted": "Pesan dihapus",
  "msg.deletedFrom": "Pesan dari {name} dihapus",
  "msg.deletedTag": "Dihapus",
  "msg.edited": "diedit",
  "msg.editedVersions": "Diedit · {n} versi sebelumnya",
  "msg.editedVersion1": "Diedit · 1 versi sebelumnya",
  "msg.unknown": "Tidak dikenal",
  "msg.media": "Media",
  "media.photo": "Foto", "media.video": "Video", "media.voice": "Pesan suara", "media.sticker": "Stiker",
  "media.audio": "Audio", "media.file": "Berkas", "media.location": "Lokasi", "media.poll": "Polling", "media.contact": "Kontak", "media.other": "Pesan",

  "save.title": "Simpan obrolan ini ke arsip?",
  "save.confirm": "Simpan riwayat",
  "save.intro": "Aplikasi sudah otomatis menyimpan 3.000 pesan terbaru dari setiap obrolan. Tombol ini menyimpan **seluruh riwayat** “{name}”: semua pesan, selama apa pun, disalin ke database arsip pribadimu.",
  "save.b1": "Jika seseorang menghapus pesan nanti, pesan itu tetap ada di obrolan sebagai “Pesan dihapus” dan bisa dibaca dengan menekan **Tampilkan**.",
  "save.b2": "Obrolan besar bisa memakan beberapa menit. Biarkan tab ini terbuka sampai muncul “tersimpan”.",
  "save.b3": "Ini **tidak** menandai pesan sebagai dibaca dan tidak mengubah apa pun di Telegram.",
  "save.b4": "Aman dijalankan ulang: hanya menambah pesan baru dan menandai pesan yang hilang.",

  "date.today": "Hari ini", "date.yesterday": "Kemarin",

  "pins.title": "Pesan tersemat",
  "pins.intro": "Hanya tersimpan di aplikasi ini. Menyematkan tidak mengubah apa pun di Telegram.",
  "pins.none": "Belum ada pesan tersemat. Arahkan kursor ke pesan lalu tekan pin untuk menyimpannya di sini.",
  "pins.pin": "Sematkan pesan ini",
  "pins.unpin": "Lepas sematan",
  "pins.open": "Ke pesan",
  "chat.pinChat": "Sematkan percakapan ini di atas daftar",
  "chat.pinShort": "Sematkan chat",
  "chat.pinnedShort": "Tersemat",
  "chat.pinTitle": "Sematkan percakapan ini?",
  "chat.pinBody": "“{name}” akan tetap berada di atas daftar obrolanmu. Ini hanya tersimpan di aplikasi ini; tidak ada yang berubah di Telegram.",
  "chat.pinConfirm": "Sematkan percakapan",
  "chat.unpinTitle": "Lepas sematan percakapan ini?",
  "chat.unpinBody": "“{name}” kembali ke posisi normalnya di daftar.",
  "chat.unpinConfirm": "Lepas sematan",
  "chat.unpinChat": "Lepas sematan percakapan ini",
  "chat.pinnedToast": "Percakapan disematkan",
  "chat.unpinnedToast": "Sematan percakapan dilepas",
  "chat.pinFail": "Gagal mengubah sematan: {msg}",
  "chat.backLatest": "Kembali ke pesan terbaru",
  "list.pinned": "Tersemat",
  "pins.pinned": "Pesan disematkan",
  "pins.unpinned": "Sematan dilepas",
  "pins.fail": "Gagal menyematkan: {msg}",
  "pins.deletedNote": "Dihapus di Telegram, tetap disimpan di sini",
  "pins.inChat": "Pesan tersemat di obrolan ini",

  "settings.title": "Pengaturan",
  "settings.password": "Kata sandi",
  "settings.passwordHint": "Ganti kata sandi yang kamu pakai untuk masuk ke aplikasi ini.",
  "settings.change": "Ganti",
  "settings.people": "Anggota",
  "settings.peopleHint": "Tambah anggota keluarga dan atur siapa yang bisa masuk. Setiap orang hanya melihat akun Telegram miliknya.",
  "settings.manage": "Kelola",
};

/* Messages that come from the server in English: exact text -> Indonesian (anything not listed is shown as is). */
const serverId: Record<string, string> = {
  "Wrong username or password": "Nama pengguna atau kata sandi salah",
  "Wrong setup key": "Kunci setup salah",
  "Setup is already done": "Setup sudah selesai",
  "Locked": "Terkunci",
  "Admins only": "Hanya untuk admin",
  "Account not found": "Akun tidak ditemukan",
  "User not found": "Pengguna tidak ditemukan",
  "That username is taken": "Nama pengguna itu sudah dipakai",
  "Username: 3-32 characters, letters, numbers, . _ -": "Nama pengguna: 3-32 karakter, huruf, angka, . _ -",
  "Password must be at least 8 characters (it protects Telegram sessions).": "Kata sandi minimal 8 karakter (melindungi sesi Telegram).",
  "Current password is wrong": "Kata sandi saat ini salah",
  "You can't remove yourself": "Kamu tidak bisa menghapus dirimu sendiri",
  "Name, api_id and api_hash are required": "Nama, api_id, dan api_hash wajib diisi",
  "Request a code first": "Minta kode terlebih dahulu",
  "Not signed in": "Belum masuk",
  "Telegram rejected these api_id / api_hash. Check them in account settings.": "Telegram menolak api_id / api_hash ini. Periksa di pengaturan akun.",
  "That phone number looks invalid. Include the country code.": "Nomor telepon tidak valid. Sertakan kode negara.",
  "Wrong code.": "Kode salah.",
  "Code expired. Go back and request a new one.": "Kode kedaluwarsa. Kembali dan minta kode baru.",
  "Wrong 2FA password.": "Kata sandi 2FA salah.",
  "This number is banned by Telegram.": "Nomor ini diblokir Telegram.",
};
function trServer(msg: string): string {
  const m = msg.match(/^Too many wrong passwords\. Try again in (\d+) min\.$/);
  if (m) return `Terlalu banyak salah kata sandi. Coba lagi dalam ${m[1]} menit.`;
  const f = msg.match(/^Too many attempts\. Try again in (\d+)s\.$/);
  if (f) return `Terlalu banyak percobaan. Coba lagi dalam ${f[1]} detik.`;
  return serverId[msg] ?? msg;
}

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void; locale: string;
  t: (k: Key, vars?: Record<string, string | number>) => string;
  tr: (serverMessage: string) => string;
};
const C = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      setLangState(saved === "id" || saved === "en" ? saved : navigator.language?.toLowerCase().startsWith("id") ? "id" : "en");
    } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem("lang", l); } catch {} }, []);
  const value = useMemo<Ctx>(() => {
    const dict: Record<Key, string> = lang === "id" ? id : en;
    return {
      lang, setLang, locale: lang === "id" ? "id-ID" : "en-US",
      t: (k, vars) => (dict[k] ?? en[k]).replace(/\{(\w+)\}/g, (_, n) => String(vars?.[n] ?? `{${n}}`)),
      tr: (m) => (lang === "id" ? trServer(m) : m),
    };
  }, [lang, setLang]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useI18n(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}

/** Renders **bold** segments. */
export function Rich({ text }: { text: string }) {
  return <>{text.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <select className={"lang " + className} aria-label={t("field.language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
