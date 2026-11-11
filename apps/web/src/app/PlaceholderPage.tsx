import { Link } from 'react-router';

import { focusRing } from '../shared/ui/styles';

interface PlaceholderPageProps {
  title: string;
  message: string;
  backLink?: { to: string; label: string };
}

/** Static page for routes without content yet (and for unknown paths). */
export function PlaceholderPage({ title, message, backLink }: PlaceholderPageProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-slate-700">{message}</p>
      {backLink && (
        <Link
          to={backLink.to}
          className={`inline-block rounded-md font-medium text-teal-800 underline ${focusRing}`}
        >
          {backLink.label}
        </Link>
      )}
    </section>
  );
}
