export default function InicioPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-end px-6 py-4">
        <form action="/auth/salir" method="post">
          <button
            type="submit"
            className="text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <h1 className="text-5xl font-semibold tracking-tight">Merk1</h1>
      </div>
    </main>
  );
}
