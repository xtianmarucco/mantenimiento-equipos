import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HealthStatusCard } from './HealthStatusCard';

describe('HealthStatusCard', () => {
  it('shows a checking message while loading', () => {
    render(<HealthStatusCard state={{ status: 'loading' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Comprobando conexión');
  });

  it('shows the API as available when healthy', () => {
    render(<HealthStatusCard state={{ status: 'ok' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('API disponible');
  });

  it('shows the API as unavailable on error', () => {
    render(<HealthStatusCard state={{ status: 'error' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('API no disponible');
  });
});
