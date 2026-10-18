export type Scalar = string | number | boolean | null;

/** Request keys present in `input` -> {column: value} for `set ${tx(row)}`; undefined keys are skipped. */
export const toRow = (input: object, cols: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(cols)
      .filter(([k]) => (input as Record<string, unknown>)[k] !== undefined)
      .map(([k, c]) => [c, (input as Record<string, Scalar>)[k]]),
  ) as Record<string, Scalar>;
