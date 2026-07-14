import path from "node:path";

const CANDIDATE_ARENA_ARTIFACT_DIRECTORY = "candidate-arena-runs";

export function rebaseCandidateArenaArtifactPath(
  artifactPath: string,
  targetArtifactRoot: string
): string | undefined {
  if (!path.isAbsolute(artifactPath)) return undefined;
  const normalizedArtifactPath = path.normalize(artifactPath);
  const resolvedTargetRoot = path.resolve(targetArtifactRoot);
  if (path.basename(resolvedTargetRoot) !== CANDIDATE_ARENA_ARTIFACT_DIRECTORY) {
    return undefined;
  }
  if (isPathWithin(normalizedArtifactPath, resolvedTargetRoot)) {
    return normalizedArtifactPath;
  }

  const segments = normalizedArtifactPath.split(path.sep);
  const rootIndex = segments.lastIndexOf(CANDIDATE_ARENA_ARTIFACT_DIRECTORY);
  if (rootIndex < 0 || rootIndex === segments.length - 1) return undefined;
  const relativeArtifactPath = segments.slice(rootIndex + 1).join(path.sep);
  const rebased = path.resolve(resolvedTargetRoot, relativeArtifactPath);
  return isPathWithin(rebased, resolvedTargetRoot) ? rebased : undefined;
}

function isPathWithin(filePath: string, root: string): boolean {
  const relativePath = path.relative(root, filePath);
  return relativePath !== "" && relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath);
}
