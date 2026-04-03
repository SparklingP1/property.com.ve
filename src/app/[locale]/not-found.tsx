import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-stone-900 mb-4">404</h1>
        <p className="text-xl text-stone-600 mb-2">
          Página no encontrada
        </p>
        <p className="text-lg text-stone-500 mb-8">
          Page not found
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
        >
          Ir al Inicio / Go Home
        </Link>
      </div>
    </div>
  );
}
