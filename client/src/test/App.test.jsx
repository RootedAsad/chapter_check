// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import App from '../App.jsx';
import sample from '../data/sample-chapter.txt?raw';
import { runAnalysis } from '../services/analyzer.js';

vi.mock('../services/analyzer.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runAnalysis: vi.fn(actual.runAnalysis) };
});

afterEach(() => cleanup());

const textarea = () => screen.getByLabelText('Your chapter');
const type = (value) => fireEvent.change(textarea(), { target: { value } });
const click = (name) => fireEvent.click(screen.getByRole('button', { name }));

describe('ChapterCheck UI', () => {
  it('shows the empty state and live counts', () => {
    render(<App />);
    expect(screen.getByText('Your results will appear here')).toBeTruthy();
    type('Hello brave new world.');
    const counts = document.getElementById('chapter-counts');
    expect(counts.textContent).toContain('4 words');
    expect(counts.textContent).toContain('22 /');
  });

  it('validates empty and too-short input without calling the analyzer', () => {
    runAnalysis.mockClear();
    render(<App />);
    click('Analyze');
    expect(screen.getByRole('alert').textContent).toMatch(/paste a chapter/i);
    type('Far too short.');
    click('Analyze');
    expect(screen.getByRole('alert').textContent).toMatch(/at least 10 words/i);
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it('analyzes the sample and renders the dashboard with matching highlights', async () => {
    render(<App />);
    click('Try Sample');
    expect(textarea().value).toBe(sample.trim());
    click('Analyze');

    const heading = await screen.findByRole('heading', { name: 'Results' });
    await waitFor(() => expect(document.activeElement).toBe(heading));

    expect(screen.getByRole('meter', { name: 'Flesch Reading Ease score' })).toBeTruthy();
    expect(screen.getByText('Writing statistics')).toBeTruthy();

    const list = screen.getByRole('heading', { name: '5 hardest sentences' }).closest('section').querySelector('ol');
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);

    const chapter = screen.getByTestId('highlighted-chapter');
    expect(chapter.textContent).toBe(sample.trim());
    expect(chapter.querySelectorAll('mark').length).toBeGreaterThanOrEqual(5);
    expect(chapter.querySelector('mark#hardest-1').textContent).toContain('barometric');
    expect(screen.getByRole('heading', { name: 'Suggestions' })).toBeTruthy();
  });

  it('flags results as stale when the text is edited after analysis', async () => {
    render(<App />);
    click('Try Sample');
    click('Analyze');
    await screen.findByRole('heading', { name: 'Results' });
    expect(screen.queryByText(/edited the chapter/i)).toBeNull();
    type(`${sample} One more sentence appears at the very end.`);
    expect(screen.getByText(/edited the chapter/i)).toBeTruthy();
  });

  it('clears text and results', async () => {
    render(<App />);
    click('Try Sample');
    click('Analyze');
    await screen.findByRole('heading', { name: 'Results' });
    click('Clear');
    expect(textarea().value).toBe('');
    expect(screen.queryByRole('heading', { name: 'Results' })).toBeNull();
    expect(screen.getByText('Your results will appear here')).toBeTruthy();
  });

  it('shows a friendly error and can retry when analysis fails', async () => {
    runAnalysis.mockRejectedValueOnce(new Error('Could not reach the analysis server.'));
    render(<App />);
    click('Try Sample');
    click('Analyze');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not reach the analysis server.');
    expect(screen.queryByRole('heading', { name: 'Results' })).toBeNull();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Results' })).toBeTruthy();
  });

  it('shows a loading state while analyzing', async () => {
    let finish;
    runAnalysis.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    render(<App />);
    click('Try Sample');
    click('Analyze');
    expect(await screen.findByText(/analyzing your chapter/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /analyzing/i }).disabled).toBe(true);
    const { analyzeChapter } = await import('../lib/readability.js');
    finish(analyzeChapter(sample));
    expect(await screen.findByRole('heading', { name: 'Results' })).toBeTruthy();
  });
});
