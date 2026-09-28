import { describe, it, expect } from 'vitest';
import {
  MusicTrackSchema,
  MusicPlaybackStateSchema,
  MusicActionSchema,
} from '../schemas/music';

describe('Music and Watch Together Schemas', () => {
  it('validates a music track properly', () => {
    const track = {
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      author: 'Rick Astley',
      duration: '3:32',
      durationSeconds: 212,
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      addedByUserId: 'usr_123',
      addedByName: 'Erdem',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    };

    const parsed = MusicTrackSchema.parse(track);
    expect(parsed.id).toBe('dQw4w9WgXcQ');
    expect(parsed.durationSeconds).toBe(212);
  });

  it('validates playback state and defaults', () => {
    const state = {
      channelId: 'chan_voice_1',
      status: 'playing' as const,
      positionSeconds: 45.5,
    };

    const parsed = MusicPlaybackStateSchema.parse(state);
    expect(parsed.channelId).toBe('chan_voice_1');
    expect(parsed.status).toBe('playing');
    expect(parsed.queue).toEqual([]);
    expect(parsed.loopMode).toBe('off');
  });

  it('validates music actions', () => {
    const playAction = {
      action: 'play' as const,
      channelId: 'c1',
      track: {
        id: '123',
        title: 'Song',
        author: 'Artist',
        duration: '1:00',
        durationSeconds: 60,
        thumbnailUrl: '',
        addedByUserId: 'u1',
        addedByName: 'Erdem',
        url: 'https://youtube.com/watch?v=123',
      },
    };

    const parsedPlay = MusicActionSchema.parse(playAction);
    expect(parsedPlay.action).toBe('play');

    const pauseAction = {
      action: 'pause' as const,
      channelId: 'c1',
    };
    expect(MusicActionSchema.parse(pauseAction).action).toBe('pause');

    const seekAction = {
      action: 'seek' as const,
      channelId: 'c1',
      positionSeconds: 120,
    };
    expect(MusicActionSchema.parse(seekAction).action).toBe('seek');
  });
});
