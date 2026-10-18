import { render, screen } from '@testing-library/react';
import { App } from './App.tsx';

describe('App shell', () => {
  it('shows the welcome screen with the privacy promise and the footer on an empty history', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /see what works/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/your data never leaves your device/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import LinkedIn export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try with sample data' })).toBeInTheDocument();
    expect(screen.getByText('Not affiliated with LinkedIn Corporation.')).toBeInTheDocument();
  });
});
