import { z } from 'zod';

export const MusicTrackSchema = z.object({
  id: z.string(), // YouTube video ID or stream ID
  title: z.string().max(300),
  author: z.string().max(100).default(''),
  duration: z.string().max(20).default('0:00'),
  durationSeconds: z.number().int().nonnegative().default(0),
  thumbnailUrl: z.string().default(''),
  addedByUserId: z.string(),
  addedByName: z.string(),
  url: z.string(),
});

export type MusicTrack = z.infer<typeof MusicTrackSchema>;

export const MusicStatusSchema = z.enum(['playing', 'paused', 'stopped']);
export type MusicStatus = z.infer<typeof MusicStatusSchema>;

export const MusicLoopModeSchema = z.enum(['off', 'all', 'single']);
export type MusicLoopMode = z.infer<typeof MusicLoopModeSchema>;

export const MusicPlaybackStateSchema = z.object({
  channelId: z.string(),
  currentTrack: MusicTrackSchema.nullable().default(null),
  status: MusicStatusSchema.default('stopped'),
  positionSeconds: z.number().nonnegative().default(0),
  lastUpdatedTimestamp: z.number().int().positive().default(() => Date.now()),
  queue: z.array(MusicTrackSchema).default([]),
  loopMode: MusicLoopModeSchema.default('off'),
  hostUserId: z.string().optional(),
  hostDisplayName: z.string().optional(),
});

export type MusicPlaybackState = z.infer<typeof MusicPlaybackStateSchema>;

export const MusicActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('play'),
    channelId: z.string(),
    track: MusicTrackSchema.optional(), // if undefined, resumes current track
  }),
  z.object({
    action: z.literal('pause'),
    channelId: z.string(),
  }),
  z.object({
    action: z.literal('resume'),
    channelId: z.string(),
  }),
  z.object({
    action: z.literal('seek'),
    channelId: z.string(),
    positionSeconds: z.number().nonnegative(),
  }),
  z.object({
    action: z.literal('skip'),
    channelId: z.string(),
  }),
  z.object({
    action: z.literal('queue_add'),
    channelId: z.string(),
    track: MusicTrackSchema,
  }),
  z.object({
    action: z.literal('queue_remove'),
    channelId: z.string(),
    trackId: z.string(),
  }),
  z.object({
    action: z.literal('stop'),
    channelId: z.string(),
  }),
  z.object({
    action: z.literal('loop_mode'),
    channelId: z.string(),
    mode: MusicLoopModeSchema,
  }),
]);

export type MusicAction = z.infer<typeof MusicActionSchema>;
