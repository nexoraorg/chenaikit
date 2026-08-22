import { describe, expect, it } from "vitest";

import {
  PROVENANCE_FORMAT_VERSION,
  ProvenanceValidationError,
  REQUIRED_PROVENANCE_FIELDS,
  createProvenance,
  isSupportedProvenanceFormatVersion,
  parseProvenance,
  serializeProvenance,
  validateProvenance,
  type ProvenanceMetadata,
} from "./index.js";

function completeProvenance(): ProvenanceMetadata {
  return {
    formatVersion: PROVENANCE_FORMAT_VERSION,
    sourceRevision: "9f2c1b0a7d4e5f6a8b9c0d1e2f3a4b5c6d7e8f90",
    sourceRepository: "https://github.com/nexoraorg/chenaikit",
    dependencies: [
      { name: "scikit-learn", version: "1.5.1" },
      { name: "numpy", version: "2.0.1" },
    ],
    configurationId: "sha256:0d4f0b0f9d1c2e3a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f901234",
    createdAt: "2026-08-22T10:15:30Z",
  };
}

describe("validateProvenance", () => {
  it("accepts a complete provenance record", () => {
    expect(validateProvenance(completeProvenance())).toEqual({
      valid: true,
      missingFields: [],
      invalidFields: [],
    });
  });

  it("accepts an artifact built with no dependencies", () => {
    const result = validateProvenance({
      ...completeProvenance(),
      dependencies: [],
    });
    expect(result.valid).toBe(true);
  });

  it.each(REQUIRED_PROVENANCE_FIELDS)(
    "reports %s as missing when it is absent",
    (field) => {
      const candidate: Partial<ProvenanceMetadata> = completeProvenance();
      delete candidate[field];

      const result = validateProvenance(candidate);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toEqual([field]);
      expect(result.invalidFields).toEqual([]);
    }
  );

  it("reports every missing field at once", () => {
    const result = validateProvenance({
      sourceRevision: "9f2c1b0a7d4e5f6a8b9c0d1e2f3a4b5c6d7e8f90",
    });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual([
      "formatVersion",
      "sourceRepository",
      "dependencies",
      "configurationId",
      "createdAt",
    ]);
  });

  it("treats blank strings as missing rather than valid", () => {
    const result = validateProvenance({
      ...completeProvenance(),
      sourceRevision: "   ",
      configurationId: "",
    });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual(["sourceRevision", "configurationId"]);
  });

  it("rejects an empty object", () => {
    const result = validateProvenance({});
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual([...REQUIRED_PROVENANCE_FIELDS]);
  });

  it("rejects null input without throwing", () => {
    const result = validateProvenance(null);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual([...REQUIRED_PROVENANCE_FIELDS]);
  });

  it("flags a dependency entry that has no version", () => {
    const result = validateProvenance({
      ...completeProvenance(),
      dependencies: [{ name: "numpy" } as never],
    });
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["dependencies"]);
  });

  it("flags a non-array dependency list", () => {
    const result = validateProvenance({
      ...completeProvenance(),
      dependencies: "numpy==2.0.1" as never,
    });
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["dependencies"]);
  });

  it("flags a timestamp that is not ISO 8601", () => {
    const result = validateProvenance({
      ...completeProvenance(),
      createdAt: "22/08/2026 10:15",
    });
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["createdAt"]);
  });

  it("flags an unknown format version", () => {
    const result = validateProvenance({
      ...completeProvenance(),
      formatVersion: 99,
    });
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toEqual(["formatVersion"]);
  });
});

describe("createProvenance", () => {
  it("stamps the current format version when it is omitted", () => {
    const { formatVersion: _ignored, ...withoutVersion } = completeProvenance();

    const result = createProvenance(withoutVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.formatVersion).toBe(PROVENANCE_FORMAT_VERSION);
    expect(result.provenance.sourceRevision).toBe(withoutVersion.sourceRevision);
    expect(result.provenance.configurationId).toBe(withoutVersion.configurationId);
  });

  it("preserves dependency order", () => {
    const result = createProvenance(completeProvenance());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.dependencies.map((d) => d.name)).toEqual([
      "scikit-learn",
      "numpy",
    ]);
  });

  it("copies the dependency list so later mutation cannot rewrite provenance", () => {
    const input = completeProvenance();
    const result = createProvenance(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    input.dependencies.push({ name: "pandas", version: "2.2.2" });
    expect(result.provenance.dependencies).toHaveLength(2);
  });

  it.each(["sourceRevision", "sourceRepository", "configurationId", "createdAt"] as const)(
    "refuses to build a record when %s is missing",
    (field) => {
      const input: Partial<ProvenanceMetadata> = completeProvenance();
      delete input[field];

      const result = createProvenance(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.missingFields).toEqual([field]);
      expect(result.error).toContain(field);
    }
  );

  it("refuses to build a record when dependencies are missing", () => {
    const input: Partial<ProvenanceMetadata> = completeProvenance();
    delete input.dependencies;

    const result = createProvenance(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingFields).toEqual(["dependencies"]);
  });

  it("never silently accepts empty input", () => {
    const result = createProvenance({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingFields).toEqual([
      "sourceRevision",
      "sourceRepository",
      "dependencies",
      "configurationId",
      "createdAt",
    ]);
  });
});

describe("serializeProvenance / parseProvenance", () => {
  it("round-trips a valid record unchanged", () => {
    const provenance = completeProvenance();
    const parsed = parseProvenance(serializeProvenance(provenance));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.provenance).toEqual(provenance);
  });

  it("emits fields in the canonical order", () => {
    const payload = JSON.parse(serializeProvenance(completeProvenance()));
    expect(Object.keys(payload)).toEqual([...REQUIRED_PROVENANCE_FIELDS]);
  });

  it("throws rather than publishing incomplete provenance", () => {
    const incomplete = completeProvenance();
    incomplete.configurationId = "";

    expect(() => serializeProvenance(incomplete)).toThrow(ProvenanceValidationError);
    try {
      serializeProvenance(incomplete);
    } catch (error) {
      expect(error).toBeInstanceOf(ProvenanceValidationError);
      expect((error as ProvenanceValidationError).missingFields).toEqual([
        "configurationId",
      ]);
    }
  });

  it("rejects a payload written by a newer format version", () => {
    const payload = JSON.stringify({
      ...completeProvenance(),
      formatVersion: PROVENANCE_FORMAT_VERSION + 1,
    });

    const parsed = parseProvenance(payload);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("unsupported-format-version");
    expect(parsed.invalidFields).toEqual(["formatVersion"]);
  });

  it("rejects a payload with no format version at all", () => {
    const { formatVersion: _ignored, ...withoutVersion } = completeProvenance();

    const parsed = parseProvenance(JSON.stringify(withoutVersion));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("unsupported-format-version");
    expect(parsed.missingFields).toEqual(["formatVersion"]);
  });

  it("rejects a recognized version whose required fields are incomplete", () => {
    const payload = JSON.stringify({
      formatVersion: PROVENANCE_FORMAT_VERSION,
      sourceRevision: "9f2c1b0a7d4e5f6a8b9c0d1e2f3a4b5c6d7e8f90",
    });

    const parsed = parseProvenance(payload);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("incomplete-provenance");
    expect(parsed.missingFields).toEqual([
      "sourceRepository",
      "dependencies",
      "configurationId",
      "createdAt",
    ]);
  });

  it("rejects malformed JSON", () => {
    const parsed = parseProvenance("{not json");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("malformed-json");
  });

  it("rejects a JSON array", () => {
    const parsed = parseProvenance("[]");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("malformed-json");
  });
});

describe("isSupportedProvenanceFormatVersion", () => {
  it("accepts the current version and refuses anything else", () => {
    expect(isSupportedProvenanceFormatVersion(PROVENANCE_FORMAT_VERSION)).toBe(true);
    expect(isSupportedProvenanceFormatVersion(0)).toBe(false);
    expect(isSupportedProvenanceFormatVersion("1")).toBe(false);
    expect(isSupportedProvenanceFormatVersion(undefined)).toBe(false);
  });
});
