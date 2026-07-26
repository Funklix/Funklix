"use strict";

function evaluateBrandDnaGenerationPreflight({ state, dependencyEngine } = {}) {
  try {
    if (typeof dependencyEngine?.evaluateDirectDependencies !== "function") {
      return Object.freeze({ status: "error", dependency: null });
    }
    const result = dependencyEngine.evaluateDirectDependencies({
      state,
      consumerModuleType: "brand_dna"
    });
    const dependency = Array.isArray(result?.dependencies)
      ? result.dependencies.find((item) => item?.dependencyModuleType === "founder_story") || null
      : null;
    if (!dependency) return Object.freeze({ status: "error", dependency: null });
    if (dependency.usable === true) return Object.freeze({ status: "usable", dependency });
    if (dependency.resolutionStatus === "ambiguous") return Object.freeze({ status: "ambiguous", dependency });
    if (dependency.resolutionStatus === "unavailable" && dependency.available === false) {
      return Object.freeze({ status: "unavailable", dependency });
    }
    if (dependency.resolutionStatus === "resolved" && dependency.available === true && dependency.ready === false) {
      return Object.freeze({ status: "incomplete", dependency });
    }
    return Object.freeze({ status: "error", dependency });
  } catch (_error) {
    return Object.freeze({ status: "error", dependency: null });
  }
}

const BrandDnaGenerationPreflight = Object.freeze({ evaluateBrandDnaGenerationPreflight });

if (typeof window !== "undefined") window.BrandDnaGenerationPreflight = BrandDnaGenerationPreflight;
if (typeof module !== "undefined" && module.exports) module.exports = BrandDnaGenerationPreflight;
