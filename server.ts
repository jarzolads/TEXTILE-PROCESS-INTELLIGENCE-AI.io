import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy init of GoogleGenAI client to avoid crash if API Key is missing on boot
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in the Settings > Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API Route: Analizar Indicadores
app.post("/api/analyze", async (req, res) => {
  try {
    const data = req.body;
    const ai = getGeminiClient();

    const systemInstruction = `Eres un Ingeniero Químico Textil Senior, Auditor de Calidad y Especialista en Lean Manufacturing de clase mundial con amplia experiencia en metodologías Lean, Six Sigma y control de procesos en tintorería, hilandería y tejeduría.
Tu objetivo es analizar los datos de producción, calidad, auditorías, acciones CAPA e inventarios de tela proporcionados para emitir un diagnóstico técnico profundo, identificar áreas de oportunidad clave y formular recomendaciones accionables de mejora continua utilizando herramientas Lean.

Responde estrictamente en formato Markdown bien organizado y profesional. Utiliza viñetas, tablas cuando corresponda y sé muy detallado e industrial.`;

    const prompt = `Analiza los siguientes datos de desempeño de nuestra planta textil:

DATOS DE DESEMPEÑO:
${JSON.stringify(data, null, 2)}

Por favor, genera un informe técnico completo que incluya:
1. **Diagnóstico general del proceso**: Estado actual del OEE, la productividad y el cumplimiento del plan.
2. **KPIs Críticos o con peor desempeño**: Identificación cuantitativa de los cuellos de botella e indicadores rezagados (ej. Disponibilidad, Calidad, Scrap, Retrabajos).
3. **Análisis de Causas Raíz potenciales**: Explicación técnica de por qué ocurren estos problemas (ej. fallas mecánicas en telares, inconsistencias de teñido, problemas de tensión de hilos, etc.) basados en los tipos de defectos del Pareto.
4. **Recomendaciones de Mejora y Herramientas Lean Aplicables**: Cuándo y cómo aplicar herramientas como 5S, Kaizen, PDCA, DMAIC, Diagramas de Ishikawa, 5 Whys, y Poka-Yoke específicas para resolver los fallos detectados.
5. **Propuestas de Acciones Correctivas y Preventivas (CAPA)**: Acciones concretas recomendadas para la sección CAPA, incluyendo responsabilidades típicas en planta textil.
6. **Riesgos Detectados**: Identificación de riesgos operativos, de seguridad o de calidad a mediano plazo (ej. rotura de stock de telas clave o retraso en pedidos).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error("Error running analyze API:", error);
    res.status(500).json({ error: error.message || "An error occurred during AI analysis." });
  }
});

// API Route: Generar Reporte Ejecutivo para Gerencia
app.post("/api/report", async (req, res) => {
  try {
    const data = req.body;
    const ai = getGeminiClient();

    const systemInstruction = `Eres un Director de Operaciones Textiles y Consultor de Excelencia Operacional. Hablas con un lenguaje corporativo de alto nivel, conciso pero con rigor métrico, orientado a resultados financieros y eficiencia de planta.
Escribe un Reporte Ejecutivo formal dirigido a la Alta Dirección del Grupo Textil.`;

    const prompt = `Genera un Reporte Ejecutivo de Planta con base en la siguiente información de control de calidad, producción y stock:

DATOS OPERATIVOS:
${JSON.stringify(data, null, 2)}

El reporte debe incluir:
1. **Resumen de Gestión y Eficiencia Global (OEE)**: Un párrafo sintetizado de alto nivel técnico.
2. **Impacto Financiero de las Pérdidas**: Cómo repercute el Scrap y las Unidades Defectuosas/Retrabajadas en los costos operativos y de materiales (ej. desperdicio de tela, reprocesos químicos).
3. **Resumen de Cumplimiento Normativo y Auditorías**: Resumen de hallazgos críticos de auditoría y estado del plan de acción CAPA.
4. **Balance de Inventario y Pedidos**: Análisis rápido de si el stock de telas actual y el estado de los pedidos comprometen las entregas comerciales.
5. **Decisiones Estratégicas Recomendadas**: 3 directrices ejecutivas clave para el Gerente de Planta enfocadas en maximizar la rentabilidad y calidad del proceso.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Error running report API:", error);
    res.status(500).json({ error: error.message || "An error occurred while generating the Executive Report." });
  }
});

// Vite middleware integration
async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TEXTILE PROCESS INTELLIGENCE AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});
