import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { WebSocketProvider, useWebSocket, useWebSocketWithBackoff } from '../WebSocketProvider';
import { useWebSocketEvent } from '../../hooks/useWebSocketEvent';

// Mock socket.io-client
const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();
const mockSocketEmit = jest.fn();
const mockSocketDisconnect = jest.fn();
const mockSocketConnect = jest.fn();

let connectHandler: (() => void) | null = null;
let alertHandler: ((data: any) => void) | null = null;

jest.mock('socket.io-client', () => {
  return {
    io: jest.fn().mockImplementation((url: string) => {
      return {
        connected: true,
        on: jest.fn((event: string, handler: any) => {
          if (event === 'connect') connectHandler = handler;
          if (event === 'alert:new') alertHandler = handler;
          mockSocketOn(event, handler);
        }),
        off: mockSocketOff,
        emit: mockSocketEmit,
        disconnect: mockSocketDisconnect,
        connect: mockSocketConnect
      };
    })
  };
});

const TestConsumer: React.FC = () => {
  const { isConnected, send, recentAlerts, queuedCount } = useWebSocket();
  const [lastAlert, setLastAlert] = React.useState<any>(null);

  useWebSocketEvent('/alerts', 'alert:new', (data) => {
    setLastAlert(data);
  });

  return (
    <div>
      <div data-testid="status">{isConnected ? 'Connected' : 'Disconnected'}</div>
      <div data-testid="queued">{queuedCount}</div>
      <div data-testid="alert-title">{lastAlert?.title || 'No Alert'}</div>
      <button data-testid="send-btn" onClick={() => send('/alerts', 'test:event', { payload: 'hello' })}>
        Send
      </button>
    </div>
  );
};

describe('WebSocketProvider and React Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectHandler = null;
    alertHandler = null;
  });

  test('renders children and provides websocket context', async () => {
    render(
      <WebSocketProvider autoConnect={true} url="http://localhost:5000">
        <TestConsumer />
      </WebSocketProvider>
    );

    // Simulate connection event
    if (connectHandler) {
      act(() => {
        connectHandler!();
      });
    }

    expect(screen.getByTestId('status')).toHaveTextContent('Connected');
  });

  test('sends event via socket emit when connected', async () => {
    render(
      <WebSocketProvider autoConnect={true} url="http://localhost:5000">
        <TestConsumer />
      </WebSocketProvider>
    );

    const sendBtn = screen.getByTestId('send-btn');
    act(() => {
      sendBtn.click();
    });

    expect(mockSocketEmit).toHaveBeenCalledWith('test:event', { payload: 'hello' });
  });

  test('receives events via useWebSocketEvent hook', async () => {
    render(
      <WebSocketProvider autoConnect={true} url="http://localhost:5000">
        <TestConsumer />
      </WebSocketProvider>
    );

    if (alertHandler) {
      act(() => {
        alertHandler!({ id: 'alert-99', title: 'Critical Fraud Alert' });
      });
    }

    expect(screen.getByTestId('alert-title')).toHaveTextContent('Critical Fraud Alert');
  });
});
