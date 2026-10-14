import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "url";
import { analyzeSymptoms } from "./services/analyzer.js";
import { analyzeHeuristically } from "./services/heuristicAnalyzer.js";
import { resolveNearbyCare } from "./services/nearbyCareSearch.js";
import { getProviderCircuitSnapshot } from "./services/providerCircuit.js";
import { getAiHealthSnapshot, refreshAiHealth } from "./services/providerHealth.js";
import { createRefinementJob, getRefinementJob } from "./services/refinementStore.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const currentFilePath = fileURLToPath(import.meta.url);

app.use(
  cors({
    origin: true
  })
);
app.use(express.json({ limit: "12mb" }));

app.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "pulsepath-api",
    message: "PulsePath backend is running.",
    routes: {
      health: "/api/health",
      analyze: "/api/analyze",
      hospitals: "/api/hospitals"
    }
  });
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_request, response) => {
  response.status(204).end();
});

app.get("/api/health", (_request, response) => {
  let snapshot = getAiHealthSnapshot();

  if (!snapshot.checking && !snapshot.checkedAt) {
    refreshAiHealth({ force: true }).catch((error) => {
      console.error("AI health probe failed.", error.message);
    });
    snapshot = getAiHealthSnapshot();
  }

  response.json({
    ok: true,
    service: "pulsepath-api",
    circuits: getProviderCircuitSnapshot(),
    ...snapshot
  });
});

app.post("/api/analyze", async (request, response) => {
  const { message = "", imageDataUrl = "" } = request.body || {};

  if (!message.trim() && !imageDataUrl) {
    response.status(400).json({
      error: "A symptom description or symptom image is required."
    });
    return;
  }

  try {
    const analysis = await analyzeSymptoms(request.body, {
      responseWindowMs: 5000
    });

    if (analysis.pendingRefinement && analysis.livePromise) {
      const refinementJob = createRefinementJob({
        initialResult: analysis.result,
        livePromise: analysis.livePromise
      });

      response.json({
        ...analysis.result,
        refinementId: refinementJob.id,
        refinementProviderHint: analysis.refinementProviderHint,
        pendingRefinement: true
      });
      return;
    }

    response.json(analysis.result);
  } catch (error) {
    console.error("Analyze endpoint failed.", error.message);
    response.status(500).json({
      error: "PulsePath could not analyze the symptoms right now. Please try again."
    });
  }
});

app.get("/api/refinement/:id", (request, response) => {
  const job = getRefinementJob(request.params.id);

  if (!job) {
    response.status(404).json({
      error: "Refinement job not found."
    });
    return;
  }

  response.json(job);
});

app.get("/api/hospitals", async (request, response) => {
  const location =
    request.query.lat && request.query.lng
      ? {
          label: request.query.location || "Current location",
          city: request.query.location || "Current location",
          coords: {
            lat: Number(request.query.lat),
            lng: Number(request.query.lng)
          }
        }
      : request.query.location || "Kolkata";
  const fallback = analyzeHeuristically({
    location,
    message: request.query.message || ""
  });

  try {
    const nearbyCare = await resolveNearbyCare({
      location,
      urgencyLevel: fallback.urgency.level,
      recommendedSpecialty: fallback.recommendedDoctor.specialty
    });

    response.json(
      nearbyCare.nearbyHospitals.length ? nearbyCare.nearbyHospitals : fallback.nearbyHospitals
    );
  } catch {
    response.json(fallback.nearbyHospitals);
  }
});

export default app;

if (process.argv[1] === currentFilePath) {
  refreshAiHealth({ force: true }).catch((error) => {
    console.error("Initial AI health probe failed.", error.message);
  });

  app.listen(port, () => {
    console.log(`PulsePath API listening on http://localhost:${port}`);
  });
}
