function versionDifference(versiona, versionb) {
  const splitA = versiona.split(".");
  const splitB = versionb.split(".");
  const diffs = [];
  for (const index in splitA) {
    const itemA = splitA[index];
    const itemB = splitB[index];
    diffs.push(itemA - itemB);
  }
  return diffs;
}

/**
 *
 * @param {string[]} values
 * @returns
 */
function sortVersions(values) {
  return values.sort((a, b) => {
    const difference = versionDifference(a, b);
    for (const item of difference) {
      if (item > 0) {
        return 1;
      } else if (item < 0) {
        return -1;
      }
    }
    return 0;
  });
}
/**
 *
 * @param {string} version
 * @param {string[]} contenders
 * @returns
 */
function nearestVersion(version, contenders) {
  if (contenders.includes(version)) {
    return version;
  }
  const sorted = sortVersions([version, ...contenders]);
  const idealVersionIndex = sorted.indexOf(version);
  const above = sorted[idealVersionIndex + 1];
  const below = sorted[idealVersionIndex - 1];
  if (above === undefined) {
    return below;
  }
  if (below === undefined) {
    return above;
  }

  const aboveDiff = versionDifference(above, version).map((v) => Math.abs(v)); // how far above is from the ideal
  const belowDiff = versionDifference(below, version).map((v) => Math.abs(v)); // how far below is from the ideal

  const sortedDiffs = sortVersions(
    [aboveDiff, belowDiff].map((v) => v.join(".")),
  ); // We want to go for the lower one, meaning the one closer to ideal
  return aboveDiff.join(".") === sortedDiffs[0] ? above : below; // Join because if we split sortedDiffs we would have to do an array comparison, which can not be done with ===
}

module.exports = { versionDifference, sortVersions, nearestVersion };
