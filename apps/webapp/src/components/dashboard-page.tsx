"use client";

import type {
  SupportAnalysisResponse,
  ToolTraceEntry
} from "@support/shared";
import { useMutation } from "@tanstack/react-query";
import { ChangeEvent, ReactNode, useMemo, useState } from "react";

import { analyzeSupportDocument } from "@/lib/api";
import { cn } from "@/lib/utils";

const supportedTypes = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv";

function ResultPill(props: {
  tone: "success" | "review" | "error";
  children: ReactNode;
}) {
  const classes = {
    success: "bg-emerald-100 text-emerald-800",
    review: "bg-amber-100 text-amber-800",
    error: "bg-rose-100 text-rose-800"
  };

  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", classes[props.tone])}>
      {props.children}
    </span>
  );
}

function SectionCard(props: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-soft backdrop-blur",
        props.className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sea/70">
        {props.eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">{props.title}</h2>
      <div className="mt-5">{props.children}</div>
    </article>
  );
}

function PrettyJson(props: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-[1.5rem] bg-slate px-4 py-4 text-sm text-slate-100">
      {JSON.stringify(props.value, null, 2)}
    </pre>
  );
}

function ToolTraceList(props: { items: ToolTraceEntry[] }) {
  return (
    <div className="grid gap-3">
      {props.items.map((item, index) => (
        <div
          key={`${item.tool}-${index}`}
          className="rounded-[1.4rem] border border-slate-200 bg-cloud px-4 py-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-950">{item.tool}</p>
            <ResultPill tone={item.success ? "success" : "error"}>
              {item.success ? "ok" : "fallo"}
            </ResultPill>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.reason}</p>
        </div>
      ))}
    </div>
  );
}

function statusTone(status: SupportAnalysisResponse["status"]) {
  if (status === "success") {
    return "success";
  }

  if (status === "needs_review") {
    return "review";
  }

  return "error";
}

export function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<SupportAnalysisResponse | null>(null);
  const analysisMutation = useMutation({
    mutationFn: analyzeSupportDocument,
    onSuccess: (data) => {
      setResult(data);
    }
  });

  const extractedEntries = useMemo(() => {
    if (!result) {
      return [];
    }

    return Object.entries(result.extracted_data).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== null && value !== "";
    });
  }, [result]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
    setResult(null);
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      return;
    }

    await analysisMutation.mutateAsync(selectedFile);
  }

  const isProcessing = analysisMutation.isPending;

  return (
    <div className="grid gap-8">
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard eyebrow="Upload" title="Sube un documento de soporte">
          <p className="text-sm leading-6 text-slate-700">
            Puedes probar con tickets, capturas, formularios simples o notas en
            PDF, imagen o texto. El sistema debe clasificar el archivo, extraer
            datos clave, sugerir una accion y registrar trazabilidad.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-full border border-sea/20 bg-mist px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-sea/40">
              Seleccionar archivo
              <input
                className="hidden"
                type="file"
                accept={supportedTypes}
                onChange={handleFileChange}
              />
            </label>
            <button
              className="rounded-full bg-slate px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1c2d45] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedFile || isProcessing}
              onClick={handleAnalyze}
              type="button"
            >
              {isProcessing ? "Procesando..." : "Analizar documento"}
            </button>
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-mist px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">Estado del procesamiento</p>
            <ul className="mt-3 space-y-2">
              <li>1. Carga del archivo y validacion de formato.</li>
              <li>2. Tool de extraccion y lectura de senales.</li>
              <li>3. Agente con decisiones y tool calling.</li>
              <li>4. Validacion estructurada del JSON final.</li>
            </ul>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            {selectedFile
              ? `Archivo listo: ${selectedFile.name}`
              : "No has seleccionado un archivo todavia."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Para la prueba de error controlado puedes usar `samples/invalid-sample.csv`.
          </p>

          {analysisMutation.isError ? (
            <p className="mt-4 rounded-[1.4rem] border border-coral/20 bg-rose-50 px-4 py-3 text-sm text-coral">
              {analysisMutation.error.message}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard eyebrow="Criteria" title="Cobertura de la tarea">
          <div className="grid gap-3 text-sm text-slate-700">
            <div className="rounded-[1.3rem] bg-cloud px-4 py-4">
              UI web con carga de archivo, estado, advertencias y resultado estructurado.
            </div>
            <div className="rounded-[1.3rem] bg-cloud px-4 py-4">
              Backend FastAPI con respuesta validada por Pydantic.
            </div>
            <div className="rounded-[1.3rem] bg-cloud px-4 py-4">
              Workflow agentic con decisiones para `success`, `needs_review` y `error`.
            </div>
            <div className="rounded-[1.3rem] bg-cloud px-4 py-4">
              Minimo dos tools visibles en `tool_trace`.
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard eyebrow="Result" title="Respuesta estructurada">
          {result ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <ResultPill tone={statusTone(result.status)}>{result.status}</ResultPill>
                <ResultPill tone="success">{result.document_type}</ResultPill>
                <span className="text-sm text-slate-600">
                  needs_clarification: {String(result.needs_clarification)}
                </span>
              </div>

              <div className="rounded-[1.5rem] bg-mist px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sea/70">
                  Summary
                </p>
                <p className="mt-3 text-base leading-7 text-slate-800">{result.summary}</p>
              </div>

              <PrettyJson value={result} />
            </div>
          ) : (
            <p className="rounded-[1.5rem] bg-mist px-5 py-4 text-sm text-slate-700">
              Aqui se mostrara el JSON final con las llaves exactas del contrato cuando
              proceses un documento.
            </p>
          )}
        </SectionCard>

        <SectionCard eyebrow="Data" title="Campos detectados y alertas">
          {result ? (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {extractedEntries.length ? (
                  extractedEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-[1.3rem] border border-slate-200 bg-cloud px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sea/70">
                        {key.replaceAll("_", " ")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-800">
                        {Array.isArray(value) ? value.join(", ") : String(value)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.5rem] bg-mist px-4 py-4 text-sm text-slate-700 sm:col-span-2">
                    No hay campos suficientes todavia o el archivo termino en error controlado.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] bg-[#fff5ea] px-4 py-4">
                  <p className="text-sm font-semibold text-slate-950">Warnings</p>
                  {result.warnings.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">Sin advertencias.</p>
                  )}
                </div>

                <div className="rounded-[1.5rem] bg-[#eef7fb] px-4 py-4">
                  <p className="text-sm font-semibold text-slate-950">
                    Clarifying questions
                  </p>
                  {result.clarifying_questions.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {result.clarifying_questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      No hacen falta aclaraciones.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-[1.5rem] bg-mist px-5 py-4 text-sm text-slate-700">
              Cuando exista respuesta, aqui veras categoria, prioridad, accion sugerida,
              faltantes y evidencias.
            </p>
          )}
        </SectionCard>
      </section>

      <SectionCard eyebrow="Trace" title="Tool trace del workflow agentic">
        {result ? (
          <ToolTraceList items={result.tool_trace} />
        ) : (
          <p className="rounded-[1.5rem] bg-mist px-5 py-4 text-sm text-slate-700">
            El trace dejara claro que tools se ejecutaron, por que se llamaron y si
            tuvieron exito.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
