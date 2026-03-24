import { DashboardPage } from "@/components/dashboard-page";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-10">
      <section className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.34em] text-sea/65">
          Option D • Support Intake AI
        </p>
        <h1 className="mt-3 max-w-4xl text-5xl font-semibold leading-tight text-slate-950">
          Clasifica tickets, capturas y formularios de soporte con IA y devuelve
          un JSON trazable listo para software.
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-700">
          El flujo combina LLM, structured output, tool calling y una orquestacion
          agentic para detectar tipo de documento, extraer datos clave, proponer
          acciones y pedir aclaraciones cuando falte contexto.
        </p>
      </section>

      <DashboardPage />
    </main>
  );
}
