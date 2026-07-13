"use strict";

let fallbackCounter = 0;

function getRuntimeCrypto() {
  if (typeof globalThis !== "undefined" && globalThis.crypto) return globalThis.crypto;
  if (typeof require === "function") {
    return require("crypto").webcrypto || null;
  }
  return null;
}

function createFallbackUuid() {
  const runtimeCrypto = getRuntimeCrypto();
  if (runtimeCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    runtimeCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  fallbackCounter += 1;
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 14);
  return `${timestamp}-${randomPart}-${fallbackCounter.toString(36)}`;
}

function createKnowledgeModuleInstanceId() {
  const runtimeCrypto = getRuntimeCrypto();
  const uuid = typeof runtimeCrypto?.randomUUID === "function"
    ? runtimeCrypto.randomUUID()
    : createFallbackUuid();
  return `km_${uuid}`;
}

function isKnowledgeModuleInstanceId(value) {
  return typeof value === "string" && /^km_[A-Za-z0-9][A-Za-z0-9_-]{7,}$/.test(value);
}

const KnowledgeModuleIdentity = Object.freeze({
  createKnowledgeModuleInstanceId,
  isKnowledgeModuleInstanceId
});

if (typeof window !== "undefined") {
  window.KnowledgeModuleIdentity = KnowledgeModuleIdentity;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = KnowledgeModuleIdentity;
}
