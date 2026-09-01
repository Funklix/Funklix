# BW-29.4.2 — Persona Journey Canvas-context boundary fix

The confirmed `400 invalid_request / canvas_context_invalid / access_verified` response has only one route source: the first `validateCanvasContext` call after Board access. The production projection admitted a legacy string-valued `social.hashtags` field, while that validator requires an array. Its exact result is `unsupported_canvas`, HTTP 400, detail `hashtags_shape`; provider execution cannot begin.

The v2 saved request removes that rejected full-Canvas boundary. It sends Board and selection references only, and the handler resolves selected nodes from the saved Board after access verification. Unsaved runs use the separate `persona_journey_unsaved_context_v1` schema containing selected nodes only; neither request mode carries edges or layout/display state.
