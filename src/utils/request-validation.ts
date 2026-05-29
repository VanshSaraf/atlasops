export interface NormalizedRunRequest {
  repoUrl: string;
  teamName?: string;
  leaderName?: string;
  retryLimit?: number;
  dryRun?: boolean;
}

export interface RequestValidationResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

export function validateRunRequest(
  body: Record<string, unknown> | undefined,
): RequestValidationResult<NormalizedRunRequest> {
  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  if (!repoUrl) {
    return {
      ok: false,
      message: "Missing required field: repoUrl",
    };
  }

  const retryLimitRaw = body?.retryLimit;
  const retryLimit =
    typeof retryLimitRaw === "number"
      ? retryLimitRaw
      : typeof retryLimitRaw === "string" && retryLimitRaw.trim()
        ? Number(retryLimitRaw)
        : undefined;

  if (
    retryLimit !== undefined &&
    (!Number.isFinite(retryLimit) || retryLimit < 1 || retryLimit > 20)
  ) {
    return {
      ok: false,
      message: "retryLimit must be a number between 1 and 20",
    };
  }

  const teamName = normalizeOptionalString(body?.teamName);
  const leaderName = normalizeOptionalString(body?.leaderName);
  const dryRun = typeof body?.dryRun === "boolean" ? body.dryRun : true;

  return {
    ok: true,
    data: {
      repoUrl,
      teamName,
      leaderName,
      retryLimit,
      dryRun,
    },
  };
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
