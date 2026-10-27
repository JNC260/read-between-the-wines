import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockSession, testUser } from '../test-utils';
import App from './app';

vi.mock('../lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }));
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  getMeetings: vi.fn().mockResolvedValue([]),
  getCurrentPoll: vi.fn().mockResolvedValue(null),
  getBookSuggestions: vi.fn().mockResolvedValue([]),
  getReadBooks: vi.fn().mockResolvedValue([]),
}));

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

  it('shows the greeting, the two nav links and the account menu when signed in', () => {
    mockSession(testUser({ firstName: 'Ada' }));
    renderApp();
    expect(screen.getByRole('heading', { name: 'Hi, Ada.' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Events',
      'Members',
    ]);
    expect(screen.getByLabelText('Account menu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('only shows admins the new event and new poll links', () => {
    mockSession(testUser());
    const { unmount } = renderApp();
    expect(screen.queryByRole('link', { name: 'New event' })).toBeNull();
    unmount();

    mockSession(testUser({ isAdmin: true }));
    renderApp();
    expect(screen.getByRole('link', { name: 'New event' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New poll' })).toBeTruthy();
  });
});
