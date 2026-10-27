export const DEFAULT_CONTRACT = `O'QUV XIZMATLARI KO'RSATISH SHARTNOMASI No {raqam}

{shahar}, {sana}

"{markaz}" (keyingi o'rinlarda — Markaz) bir tomondan, va {ota_ona} (keyingi o'rinlarda — Buyurtmachi) ikkinchi tomondan, {oquvchi} (keyingi o'rinlarda — O'quvchi) ni o'qitish yuzasidan quyidagilar haqida shartnoma tuzdilar.

1. SHARTNOMA PREDMETI
1.1. Markaz O'quvchini «{kurs}» yo'nalishi bo'yicha {guruh} guruhida o'qitadi, Buyurtmachi esa xizmat haqini to'laydi.
1.2. O'qish muddati: {muddat} oy. Darslar haftasiga {kunlar} kunlari, soat {vaqt} da o'tkaziladi.

2. TO'LOV
2.1. Oylik to'lov: {narx}.
2.2. To'lov har oyning {tolov_kuni}-sanasigacha amalga oshiriladi.
2.3. Uzrsiz qoldirilgan darslar uchun to'lov qaytarilmaydi.

3. TOMONLARNING MAJBURIYATLARI
3.1. Markaz malakali o'qituvchi, o'quv joyi va materiallar bilan ta'minlaydi, ota-onaga o'quvchining davomati va natijalari haqida ma'lumot berib boradi.
3.2. Buyurtmachi to'lovni o'z vaqtida qiladi, O'quvchining darslarga muntazam qatnashishini ta'minlaydi.
3.3. O'quvchi markaz ichki tartib qoidalariga rioya qiladi va jihozlarga ehtiyotkorlik bilan munosabatda bo'ladi.

4. SHARTNOMANI BEKOR QILISH
4.1. Har bir tomon 10 kun oldin yozma xabar berib shartnomani bekor qilishi mumkin.

5. TOMONLAR REKVIZITLARI
Markaz: {markaz}, {manzil}, tel: {markaz_tel}
Buyurtmachi: {ota_ona}, tel: {ota_ona_tel}

Markaz: ______________          Buyurtmachi: ______________`;

export function fillContract(t: string, v: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
}
