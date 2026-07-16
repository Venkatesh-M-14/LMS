import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ContentBlockDto } from '@academy/shared';
import { BlockRenderer } from '../BlockRenderer';

function block(
  partial: Partial<ContentBlockDto> & Pick<ContentBlockDto, 'type' | 'payload'>,
): ContentBlockDto {
  return { id: Math.random().toString(36).slice(2), order: 1, payloadSchemaVersion: 1, ...partial };
}

describe('BlockRenderer', () => {
  it('renders markdown, code, and callout blocks in order', () => {
    render(
      <BlockRenderer
        blocks={[
          block({
            order: 2,
            type: 'CODE',
            payload: { language: 'javascript', code: 'const x = 1;', filename: 'x.js' },
          }),
          block({
            order: 1,
            type: 'MARKDOWN',
            payload: { markdown: '# Lesson Heading\n\nBody paragraph.' },
          }),
          block({
            order: 3,
            type: 'CALLOUT',
            payload: { variant: 'warning', title: 'Watch out', markdown: 'Danger here.' },
          }),
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Lesson Heading' })).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByText('x.js')).toBeInTheDocument();
    expect(screen.getByText('Watch out')).toBeInTheDocument();

    // Order: heading (order 1) must precede the code block (order 2).
    const heading = screen.getByRole('heading', { name: 'Lesson Heading' });
    const code = screen.getByText('const x = 1;');
    expect(heading.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders images with their alt text', () => {
    render(
      <BlockRenderer
        blocks={[
          block({
            type: 'IMAGE',
            payload: { url: 'https://example.com/pic.png', alt: 'Memory diagram' },
          }),
        ]}
      />,
    );
    expect(screen.getByAltText('Memory diagram')).toBeInTheDocument();
  });

  it('shows a warning instead of crashing on a malformed payload', () => {
    render(<BlockRenderer blocks={[block({ type: 'CODE', payload: { nonsense: true } })]} />);
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument();
  });
});
