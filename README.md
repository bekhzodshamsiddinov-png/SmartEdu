# SmartEdu

United IT Clubs o'quv markazi uchun boshqaruv tizimi (CRM + ERP). Barcha ma'lumotlar o'zingizning Postgres bazangizda saqlanadi.

## Bo'limlar

| Bo'lim | Nima qiladi |
| --- | --- |
| Ish stoli | Administratorning kunlik checklisti: o'qituvchi kelishi, davomat, qo'ng'iroqlar, to'lov eslatmalari, ota-onaga hisobot, ofisga kelganlar, kunlik hisobot |
| Nazorat | Rahbar uchun: har bir xodimning bugungi va 7 kunlik bajarilish foizi, bajarilmagan ishlar |
| Bosh sahifa | Bugungi darslar, asosiy raqamlar (kun / hafta / oy / yil), qarzdorlar, kelmaganlar, sotuv voronkasi |
| Lidlar | Kanban voronka: Yangi → Bog'lanildi → Sinov darsi → To'lov / Rad etdi, manba bo'yicha konversiya |
| O'quvchilar | Ro'yxat, filtrlar, profil: to'lovlar, davomat, baholar, qo'ng'iroqlar, natijalar, ketish sababi va qaytarish urinishi |
| Guruhlar | Guruhlar, dars jadvali, o'qituvchi va support, yo'nalishlar va narxlar |
| Davomat | Bir bosishda belgilash, dars mavzusi, o'qituvchi kechikishi, kelmaganlarga qo'ng'iroq ro'yxati |
| To'lovlar | Oylik tushum, usullar bo'yicha, qarzdorlar ro'yxati |
| Moliya | Kirim-chiqim jurnali (hujjat raqami bilan), SmartEdu / bank / soliq oylik solishtirmasi, tahlil |
| Xodimlar | Rollar va ruxsatlar, har bir xodimning oylik ko'rsatkichlari |
| Vazifalar | Vazifa berish va nazorat |
| Onlayn kurslar | Kurslar, modul va darslar konstruktori, sotuvlar, onlayn o'quvchilar, promokodlar |
| Filiallar | Yuqoridagi tanlagich orqali filial bo'yicha ko'rish, xodimni filialga bog'lash, filiallar taqqoslamasi |
| Bitiruvchilar | Ish joyi, daromad, oxirgi aloqa, tavsiyalar |
| Hisobotlar | Oylik hisobot (chop etish / PDF) va xodimlarning kunlik hisobotlari |
| Sozlamalar | Markaz ma'lumotlari, to'lov va oylik sanalari, to'liq zaxira (JSON) va CSV eksport |

## Rollar

`rahbar` hamma narsani ko'radi. `admin`, `oqituvchi`, `support`, `sotuv`, `marketing`, `bugalter` faqat o'z bo'limlarini ko'radi (`src/lib/roles.ts`).

## Texnologiya

Next.js 15 (App Router, Server Actions), TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL (Neon), JWT sessiya.

## O'rnatish

```bash
npm install
cp .env.example .env.local   # DATABASE_URL va AUTH_SECRET ni to'ldiring
npm run db:migrate
npm run dev
```

Birinchi kirishda `/setup` sahifasida rahbar hisobi yaratiladi. `SETUP_CODE` o'rnatilgan bo'lsa, shu kod so'raladi.

### Muhit o'zgaruvchilari

| Nomi | Vazifasi |
| --- | --- |
| `DATABASE_URL` | Postgres ulanish manzili |
| `AUTH_SECRET` | Sessiya kaliti (kamida 32 belgi) |
| `SETUP_CODE` | Birinchi rahbar hisobini yaratish uchun kod (ixtiyoriy) |

Sxema o'zgarsa: `src/db/schema.ts` → `npm run db:generate` → deploy paytida `scripts/migrate.mjs` avtomatik ishlaydi.
