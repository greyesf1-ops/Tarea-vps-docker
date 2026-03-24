import {
  supportAnalysisResponseSchema,
  type SupportAnalysisResponse
} from "@support/shared";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api";

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Ocurrio un error en la solicitud.");
  }

  return data as T;
}

export async function analyzeSupportDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const data = await handleResponse<SupportAnalysisResponse>(
    await fetch(`${apiBaseUrl}/analyze`, {
      method: "POST",
      body: formData
    })
  );

  return supportAnalysisResponseSchema.parse(data);
}
