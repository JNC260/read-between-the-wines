import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

const renderApp = (at = '/') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <Where />
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

  it('shows the greeting, the nav and the account menu when signed in', () => {
    mockSession(testUser({ firstName: 'Ada' }));
    renderApp();
    expect(screen.getByRole('heading', { name: 'Hi, Ada.' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Home',
      'Meetings',
      'Books',
      'Members',
    ]);
    expect(screen.getByLabelText('Account menu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('marks Books as the current tab on every book page', () => {
    mockSession(testUser());
    for (const at of ['/books/suggestions', '/books/read', '/books/suggest']) {
      const { unmount } = renderApp(at);
      const nav = screen.getByRole('navigation', { name: 'Main' });
      const current = within(nav)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current.map((a) => a.textContent)).toEqual(['Books']);
      unmount();
    }
  });

  it('sends old /events links to the same page under /meetings', () => {
    mockSession(testUser());
    renderApp('/events/00000000-0000-4000-8000-000000000002/edit');
    expect(screen.getByTestId('where').textContent).toBe(
      '/meetings/00000000-0000-4000-8000-000000000002/edit',
    );
  });

  it('only shows admins the new meeting and new poll links', () => {
    mockSession(testUser());
    const { unmount } = renderApp();
    expect(screen.queryByRole('link', { name: 'New meeting' })).toBeNull();
    unmount();

    mockSession(testUser({ isAdmin: true }));
    renderApp();
    expect(screen.getByRole('link', { name: 'New meeting' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New poll' })).toBeTruthy();
  });
});
