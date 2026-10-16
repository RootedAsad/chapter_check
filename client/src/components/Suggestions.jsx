export default function Suggestions({ suggestions }) {
  if (!suggestions.length) return null;

  return (
    <section className="card" aria-labelledby="suggestions-heading">
      <h3 id="suggestions-heading" className="text-lg font-semibold text-stone-900">
        Suggestions
      </h3>
      <p className="mt-1 text-sm text-stone-600">Ideas to consider. ChapterCheck never rewrites your text; every choice is yours.</p>
      <ul className="mt-4 space-y-3">
        {suggestions.map((s) => (
          <li key={s.id} className="border-l-4 border-amber-600 bg-amber-50 py-2 pl-4 pr-3">
            <p className="font-semibold text-stone-900">{s.title}</p>
            <p className="mt-0.5 text-sm text-stone-700">{s.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
