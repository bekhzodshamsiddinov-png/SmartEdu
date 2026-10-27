/** Qidiruv tizimlari uchun tuzilgan ma'lumot (schema.org). `<` belgisi qochiriladi — HTML ichiga xavfsiz joylashadi */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
