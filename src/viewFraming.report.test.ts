import { expect, test } from 'vitest';
import { buildFramingReport } from './viewFraming';

const report = buildFramingReport({
  desktop: 16 / 9,
  tablet: 4 / 3,
  portrait: 9 / 16
});

test('view framing report stays printable for layout tuning', () => {
  const compact = report.map((row) => ({
    view: row.view,
    aspect: row.aspect,
    target: row.target,
    left: row.marginLeft.toFixed(3),
    right: row.marginRight.toFixed(3),
    bottom: row.marginBottom.toFixed(3),
    top: row.marginTop.toFixed(3)
  }));

  console.table(compact);

  expect(report.length).toBeGreaterThan(0);
});
