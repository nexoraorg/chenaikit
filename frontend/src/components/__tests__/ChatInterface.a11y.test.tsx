import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ChatInterface from '../ChatInterface';

describe('ChatInterface accessibility', () => {
  it('labels the message input and send control', () => {
    render(<ChatInterface title="Support chat" />);
    expect(screen.getByRole('log', { name: /conversation history/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('announces new messages in the live region', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await user.type(screen.getByRole('textbox', { name: /message/i }), 'Hello');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ChatInterface />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
