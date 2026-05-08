'use client';

import { useEffect, useRef } from 'react';
import { getQueueSocket, disconnectQueueSocket } from '@/lib/socket';
import { useQueueStore } from '@/stores/queue.store';
import { useAuthStore } from '@/stores/auth.store';

export function useQueueSocket() {
  const { accessToken, user } = useAuthStore();
  const { setQueueState, addEntry, updateEntry, removeEntry, setConnected } = useQueueStore();
  const socketRef = useRef<ReturnType<typeof getQueueSocket> | null>(null);

  useEffect(() => {
    if (!accessToken || !user?.companyId) return;

    const socket = getQueueSocket(accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('queue:subscribe', user.companyId);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('queue:state', setQueueState);
    socket.on('queue:joined', addEntry);
    socket.on('queue:called', updateEntry);
    socket.on('queue:updated', updateEntry);
    socket.on('queue:left', removeEntry);

    socket.on('error', (msg) => console.error('Socket error:', msg));

    return () => {
      socket.emit('queue:unsubscribe', user.companyId);
      socket.off('queue:state');
      socket.off('queue:joined');
      socket.off('queue:called');
      socket.off('queue:updated');
      socket.off('queue:left');
      socket.off('error');
    };
  }, [accessToken, user?.companyId, setQueueState, addEntry, updateEntry, removeEntry, setConnected]);

  useEffect(() => {
    return () => { disconnectQueueSocket(); };
  }, []);

  return useQueueStore();
}
