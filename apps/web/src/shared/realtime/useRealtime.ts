import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '../../app/hooks';

let socket: Socket | null = null;

/**
 * Keeps one authenticated socket per session. Grading pushes invalidate the
 * relevant queries so results pages update the moment the judge/instructor
 * finishes (polling remains as fallback).
 */
export function useRealtime(): void {
  const queryClient = useQueryClient();
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  useEffect(() => {
    if (!accessToken) {
      socket?.disconnect();
      socket = null;
      return;
    }

    socket?.disconnect();
    socket = io({ auth: { token: accessToken }, transports: ['websocket', 'polling'] });

    socket.on('attempt:graded', () => {
      void queryClient.invalidateQueries({ queryKey: ['quiz'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [accessToken, queryClient]);
}
