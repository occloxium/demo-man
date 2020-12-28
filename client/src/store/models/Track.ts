export type TrackStatePaused = {
  type: "paused",
  progress: number,
}

export type TrackStateStopped = {
  type: "stopped",
  finished: boolean,
  started: boolean,
}

export type TrackStatePlaying = {
  type: "playing",
  progress: number,
}

export type TrackState = TrackStatePlaying | TrackStatePaused | TrackStateStopped;

export interface Track {
  url: string,
  title: string,
  artist: string,
  mp3: string,
  progress: number,
  duration: number,
  state: TrackState,
}
