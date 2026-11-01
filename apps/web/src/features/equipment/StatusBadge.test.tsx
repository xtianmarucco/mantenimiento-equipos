import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['OPERATIONAL', 'Operativo'],
    ['IN_REPAIR', 'En reparación'],
    ['OUT_OF_SERVICE', 'Fuera de servicio'],
    ['RETIRED', 'Dado de baja'],
  ] as const)('labels %s as "%s" in text, not only by color', (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(label).parentElement).toHaveTextContent(`Estado: ${label}`);
  });
});
