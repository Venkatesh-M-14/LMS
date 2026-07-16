import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import type { StudentItemView } from '@academy/shared';
import { i18n } from '../../../../app/i18n';
import { ItemInput } from '../ItemInputs';

function Harness({ item, onChange }: { item: StudentItemView; onChange: (a: unknown) => void }) {
  const [value, setValue] = useState<unknown>(undefined);
  return (
    <I18nextProvider i18n={i18n}>
      <ItemInput
        item={item}
        value={value}
        onChange={(answer) => {
          setValue(answer);
          onChange(answer);
        }}
      />
    </I18nextProvider>
  );
}

describe('ItemInput', () => {
  it('MCQ: selecting an option emits { selectedOptionId }', async () => {
    const onChange = vi.fn();
    render(
      <Harness
        onChange={onChange}
        item={{
          itemId: 'i1',
          order: 1,
          type: 'MCQ',
          points: 2,
          payload: {
            prompt: 'Pick one',
            options: [
              { id: 'a', text: 'Alpha' },
              { id: 'b', text: 'Beta' },
            ],
          },
        }}
      />,
    );
    await userEvent.click(screen.getByLabelText('Beta'));
    expect(onChange).toHaveBeenLastCalledWith({ selectedOptionId: 'b' });
  });

  it('MULTI_SELECT: toggling checkboxes accumulates and removes ids', async () => {
    const onChange = vi.fn();
    render(
      <Harness
        onChange={onChange}
        item={{
          itemId: 'i2',
          order: 1,
          type: 'MULTI_SELECT',
          points: 3,
          payload: {
            prompt: 'Pick some',
            options: [
              { id: 'a', text: 'Alpha' },
              { id: 'b', text: 'Beta' },
              { id: 'c', text: 'Gamma' },
            ],
          },
        }}
      />,
    );
    await userEvent.click(screen.getByLabelText('Alpha'));
    await userEvent.click(screen.getByLabelText('Gamma'));
    expect(onChange).toHaveBeenLastCalledWith({ selectedOptionIds: ['a', 'c'] });

    await userEvent.click(screen.getByLabelText('Alpha'));
    expect(onChange).toHaveBeenLastCalledWith({ selectedOptionIds: ['c'] });
  });

  it('OUTPUT_PREDICTION: shows the code and captures typed output', async () => {
    const onChange = vi.fn();
    render(
      <Harness
        onChange={onChange}
        item={{
          itemId: 'i3',
          order: 1,
          type: 'OUTPUT_PREDICTION',
          points: 3,
          payload: { prompt: 'What prints?', language: 'javascript', code: 'console.log(42)' },
        }}
      />,
    );
    expect(screen.getByText('console.log(42)')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/your predicted output/i), '42');
    expect(onChange).toHaveBeenLastCalledWith({ predictedOutput: '42' });
  });

  it('REFLECTION: counts words against the minimum', async () => {
    render(
      <Harness
        onChange={vi.fn()}
        item={{
          itemId: 'i4',
          order: 1,
          type: 'REFLECTION',
          points: 4,
          payload: { prompt: 'Explain briefly.', minWords: 10 },
        }}
      />,
    );
    await userEvent.type(screen.getByLabelText(/your answer/i), 'one two three');
    expect(screen.getByText(/3 words \(aim for at least 10\)/i)).toBeInTheDocument();
  });
});
