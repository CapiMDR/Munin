function parseOneBasedIndexes(values) {
  const tokens = values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (!tokens.length || !tokens.every((value) => /^\d+$/.test(value))) return undefined;
  return [...new Set(tokens.map(Number))].filter((index) => index > 0);
}

function partitionOneBasedIndexes(indexes, itemCount) {
  const unique = [...new Set(indexes)].filter((index) => Number.isInteger(index) && index > 0);
  return {
    valid: unique.filter((index) => index <= itemCount),
    invalid: unique.filter((index) => index > itemCount),
  };
}

module.exports = { parseOneBasedIndexes, partitionOneBasedIndexes };
