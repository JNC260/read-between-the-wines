import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockSession, testUser } from '../test-utils';
import App from './app';

vi.mock('../lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }));

const renderApp = () =>
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );

describe('App', () => {
  it('shows the club name and a log in link when signed out', () => {
    mockSession(null);
    renderApp();
    expect(screen.getByRole('heading', { name: 'Read Between the Wines' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows the under construction message, nav and sign out when signed in', () => {
    mockSession(testUser({ firstName: 'Ada' }));
    renderApp();
    expect(screen.getByText(/Welcome, Ada! The site is under construction/)).toBeTruthy();
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });
});
